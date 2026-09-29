/**
 * Scholario inline asset watchdog — the document-level half of the
 * Asset Guard system (root-cause fix for the raw/unstyled page flash).
 *
 * WHY THIS EXISTS (production asset-loading problem):
 *   The sandbox dev server restarts (watchdog respawns, OOM guard,
 *   deploys). During a restart window the browser's critical-CSS
 *   request (`/_next/static/css/app/layout.css?v=<timestamp>` — a
 *   cache-busted URL that MUST hit the server) can fail, while the
 *   stable-named dev JS chunks still load (disk cache) and React
 *   boots anyway. React then renders the full public website with
 *   ZERO stylesheets → the browser shows the raw HTML fallback
 *   (Times New Roman, blue links, "About Academics Facilities …").
 *   The same window can also kill the JS chunks themselves → the
 *   app stays an empty skeleton forever.
 *
 * WHAT THIS DOES (honest recovery — never hides a real failure):
 *   1. Probe: a `<div class="scholario-asset-probe">` is appended to
 *      <body>. globals.css hides it (`display:none`). After the
 *      window load event the probe is checked — visible probe means
 *      the critical stylesheet is NOT applied.
 *   2. Retry: failed <link rel=stylesheet> elements are re-requested
 *      (cache-busted, up to 3 attempts with backoff). The dev server
 *      is usually back within seconds, so the retry normally lands
 *      and the app appears FULLY STYLED — the user never sees raw
 *      HTML. While retrying, body paint is held (`visibility:hidden`)
 *      so the unstyled flash is not shown mid-recovery.
 *   3. Recovery screen: if the stylesheet cannot be loaded after all
 *      retries — or if the JS never boots (no hydration flag within
 *      30s of load while CSS is fine) — a branded, self-contained
 *      (inline-styled) recovery screen replaces the page:
 *      "Scholario couldn't load this workspace." + Retry.
 *      It is NOT a spinner and NOT a mask: it appears only when the
 *      application genuinely cannot load, and it self-dismisses the
 *      moment assets recover (background poll).
 *
 *   Normal successful loads are 100% unchanged — the watchdog only
 *   acts when the probe/flags prove a failure.
 *
 * This file exports the script as a STRING; layout.tsx injects it as
 * the first <body> child via <script dangerouslySetInnerHTML>. It is
 * plain ES5, dependency-free, idempotent, and SSR-inert.
 */
export const ASSET_WATCHDOG_SCRIPT = String.raw`
(function () {
  'use strict';
  if (window.__SCHOLARIO_ASSET_GUARD__) return;
  window.__SCHOLARIO_ASSET_GUARD__ = true;

  var RETRY_DELAYS = [1500, 4000, 8000];
  var HYDRATION_GRACE_MS = 30000;
  var STATE = 'boot'; // boot -> ok | css-retry | recovery
  var recoveryShown = false;
  var probeEl = null;

  function dark() {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
    catch (e) { return false; }
  }

  /* ---------- CSS probe ---------- */

  function ensureProbe() {
    if (probeEl && document.body && document.body.contains(probeEl)) return probeEl;
    probeEl = document.createElement('div');
    probeEl.className = 'scholario-asset-probe';
    probeEl.setAttribute('aria-hidden', 'true');
    probeEl.id = '__scholario_css_probe';
    (document.body || document.documentElement).appendChild(probeEl);
    return probeEl;
  }

  function cssApplied() {
    try {
      var el = ensureProbe();
      return window.getComputedStyle(el).display === 'none';
    } catch (e) {
      return false;
    }
  }

  /* ---------- critical stylesheet discovery ---------- */

  /** Every Next.js-served stylesheet link on the page. Used BOTH for
   * hard-failed requests (link.sheet === null — network error, 404,
   * non-CSS body) AND for "loaded but not applying" sheets (empty CSS
   * from a compile race, or an opaque/misrouted response): the probe
   * already proved the critical CSS is not applied, so every candidate
   * is re-requested regardless of its .sheet state. */
  function criticalStylesheets() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    var out = [];
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      var href = l.getAttribute('href') || '';
      if (href.indexOf('/_next/') === -1) continue; // only app-served CSS
      out.push(l);
    }
    return out;
  }

  function retryStylesheet(href, attempt, done) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.setAttribute('data-scholario-retry', String(attempt));
    l.href = href + (href.indexOf('?') === -1 ? '?' : '&') + '__cssRetry=' + attempt;
    l.onload = function () { done(true); };
    l.onerror = function () { done(false); };
    document.head.appendChild(l);
  }

  /** Remove previous retry links whose rules never applied (probe
   * still visible) so repeated retries don't pile up <link> elements. */
  function pruneDeadRetries() {
    var dead = document.querySelectorAll('link[data-scholario-retry]');
    for (var i = 0; i < dead.length; i++) {
      var el = dead[i];
      if (el.parentNode) el.parentNode.removeChild(el);
    }
  }

  /* ---------- paint hold during retry ---------- */

  var holdStyle = null;
  function holdPaint() {
    if (holdStyle) return;
    holdStyle = document.createElement('style');
    holdStyle.id = '__scholario_asset_hold';
    holdStyle.textContent =
      'html.scholario-css-retry body{visibility:hidden !important}';
    document.head.appendChild(holdStyle);
    document.documentElement.classList.add('scholario-css-retry');
  }
  function releasePaint() {
    document.documentElement.classList.remove('scholario-css-retry');
  }

  /* ---------- branded recovery screen (inline-styled, asset-free) ---------- */

  function buildRecovery(reason) {
    var isDark = dark();
    var bg = isDark ? '#06140f' : '#f8fbf9';
    var fg = isDark ? '#e8f5ee' : '#0c1f17';
    var muted = isDark ? '#8fb8a5' : '#5b7a6b';
    var accent = '#0d9488'; // teal-600 — brand
    var accentFg = '#ffffff';

    var wrap = document.createElement('div');
    wrap.id = '__scholario_asset_recovery';
    wrap.setAttribute('role', 'alertdialog');
    wrap.setAttribute('aria-live', 'assertive');
    wrap.setAttribute('aria-label', 'Scholario could not load this workspace');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;visibility:visible;' +
      'display:flex;align-items:center;justify-content:center;' +
      'background:' + bg + ';color:' + fg + ';' +
      'font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
      'padding:24px;text-align:center;';

    var card = document.createElement('div');
    card.style.cssText = 'max-width:440px;';

    var mark = document.createElement('div');
    mark.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;' +
      'width:56px;height:56px;border-radius:16px;margin-bottom:20px;' +
      'background:' + accent + ';color:' + accentFg + ';font-weight:800;font-size:26px;';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = 'S';

    var title = document.createElement('h1');
    title.style.cssText = 'font-size:20px;font-weight:700;margin:0 0 10px;';
    title.textContent = 'Scholario couldn\u2019t load this workspace.';

    var body = document.createElement('p');
    body.style.cssText = 'font-size:14px;line-height:1.6;margin:0 0 6px;color:' + muted + ';';
    body.textContent = reason === 'js'
      ? 'The application started but its scripts didn\u2019t finish loading \u2014 the server may be restarting. Nothing is lost.'
      : 'A required stylesheet failed to load \u2014 the server may be restarting. Nothing is lost.';

    var hint = document.createElement('p');
    hint.style.cssText = 'font-size:12px;margin:0 0 22px;color:' + muted + ';';
    hint.id = '__scholario_asset_recovery_hint';
    hint.textContent = 'Retrying automatically\u2026';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Retry now';
    btn.style.cssText =
      'appearance:none;border:0;cursor:pointer;border-radius:10px;' +
      'padding:11px 26px;font-size:14px;font-weight:600;' +
      'background:' + accent + ';color:' + accentFg + ';';
    btn.onclick = function () { window.location.reload(); };

    var word = document.createElement('div');
    word.style.cssText =
      'margin-top:26px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:' + muted + ';';
    word.textContent = 'SCHOLARIO \u00b7 School OS';

    card.appendChild(mark);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(hint);
    card.appendChild(btn);
    card.appendChild(word);
    wrap.appendChild(card);
    return wrap;
  }

  function showRecovery(reason) {
    if (recoveryShown) return;
    recoveryShown = true;
    STATE = 'recovery';
    releasePaint();
    var old = document.getElementById('__scholario_asset_recovery');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    document.body.appendChild(buildRecovery(reason));
    // Keep trying: re-request the failed assets on a slow loop so the
    // screen heals itself the moment the server is back, instead of
    // waiting for the user to click Retry.
    window.setInterval(function () {
      if (reason === 'js') {
        if (document.documentElement.getAttribute('data-app-hydrated') === '1') {
          dismissRecovery();
        }
        return;
      }
      // CSS case: actively re-request the critical stylesheets.
      if (cssApplied()) { dismissRecovery(); return; }
      var targets = criticalStylesheets();
      if (targets.length) {
        pruneDeadRetries();
        var stamp = 'bg' + Date.now();
        for (var i = 0; i < targets.length; i++) {
          (function (href) {
            retryStylesheet(href, stamp, function () {
              if (cssApplied()) dismissRecovery();
            });
          })(targets[i].getAttribute('href'));
        }
      }
    }, 6000);
  }

  function dismissRecovery() {
    var el = document.getElementById('__scholario_asset_recovery');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    recoveryShown = false;
    STATE = 'ok';
    document.documentElement.setAttribute('data-scholario-assets', 'ok');
  }

  /* ---------- CSS retry state machine ---------- */

  function enterCssRetry() {
    if (STATE === 'ok' || STATE === 'css-retry') return;
    STATE = 'css-retry';
    holdPaint();
    var attempt = 0;
    var pending = false;

    function schedule() {
      if (STATE !== 'css-retry') return;
      if (cssApplied()) {
        STATE = 'ok';
        releasePaint();
        document.documentElement.setAttribute('data-scholario-assets', 'ok');
        watchHydration();
        return;
      }
      if (attempt >= RETRY_DELAYS.length) {
        showRecovery('css');
        return;
      }
      var delay = RETRY_DELAYS[attempt++];
      window.setTimeout(function () {
        if (STATE !== 'css-retry' || pending) return;
        // The probe already proved the critical CSS is not applied —
        // re-request EVERY app stylesheet link (covers both hard
        // failures (sheet === null) and loaded-but-not-applying
        // sheets such as empty compile-race CSS or opaque responses).
        var targets = criticalStylesheets();
        if (!targets.length) {
          showRecovery('css');
          return;
        }
        pruneDeadRetries();
        var remaining = targets.length;
        pending = true;
        for (var i = 0; i < targets.length; i++) {
          (function (href) {
            retryStylesheet(href, attempt, function () {
              remaining -= 1;
              if (remaining === 0) {
                pending = false;
                // Give the retried sheet a beat to apply, then re-check.
                window.setTimeout(schedule, 250);
              }
            });
          })(targets[i].getAttribute('href'));
        }
      }, delay);
    }
    schedule();
  }

  /* ---------- JS boot probe ---------- */

  function hydrated() {
    return document.documentElement.getAttribute('data-app-hydrated') === '1';
  }

  function watchHydration() {
    if (hydrated()) return;
    var waited = 0;
    var t = window.setInterval(function () {
      if (hydrated()) { window.clearInterval(t); return; }
      waited += 1000;
      if (waited >= HYDRATION_GRACE_MS) {
        window.clearInterval(t);
        if (!hydrated() && STATE !== 'recovery' && cssApplied()) {
          showRecovery('js');
        }
      }
    }, 1000);
  }

  /* ---------- bootstrap ---------- */

  function boot() {
    if (cssApplied()) {
      STATE = 'ok';
      document.documentElement.setAttribute('data-scholario-assets', 'ok');
      watchHydration();
    } else {
      enterCssRetry();
    }
  }

  if (document.readyState === 'complete') {
    window.setTimeout(boot, 800);
  } else {
    window.addEventListener('load', function () {
      window.setTimeout(boot, 800);
    });
  }
})();
`
