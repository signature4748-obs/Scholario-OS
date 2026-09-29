/* global __resourceQuery, location */

"use strict";

/**
 * Scholario gateway-aware lazy-compilation WEB client (v2 — resilient).
 *
 * Drop-in replacement for webpack's bundled lazy-compilation-web.js with
 * behavioural changes around WHERE the EventSource connects and WHAT
 * HAPPENS WHEN THE CONNECTION BREAKS.
 *
 * WHERE (v1 behaviour, kept):
 *   upstream:  new EventSource("http://localhost:<port>/lazy-compilation-using-…")
 *              → absolute URL to the dev machine. Visitors behind the
 *                sandbox gateway resolve "localhost" to THEIR OWN machine
 *                → connection fails → every lazy module rejects → blank page.
 *
 *   here:      gateway mode (REMOTE visitors — the default)
 *              new EventSource("/lazy-compilation-using-…?XTransformPort=<port>")
 *              → SAME-ORIGIN request the gateway forwards to the dev
 *                machine's backend port. Works for every visitor.
 *
 *              direct mode (LOCAL browsers only)
 *              A browser running ON the dev machine (page origin is
 *              localhost/127.0.0.1) connects straight to the absolute
 *              backend URL. v1 first tried the same-origin request, which
 *              404s on the bare :3000 dev server (no gateway in the path)
 *              and only then fell back — one wasted round trip per chunk.
 *
 * WHAT HAPPENS ON BREAK (v2 — the fix for the console error
 * "Problem communicating active modules to the server: undefined …"):
 *   v1/upstream treated EVERY EventSource error as fatal: it reported to
 *   webpack's onError, which REJECTS the still-pending first-visit module
 *   promise (webpack codegen: `onError = reject`). In this sandbox the dev
 *   server is periodically OOM-killed and respawned by the keepalive
 *   watchdog (documented pattern), and gateway intermediaries can idle out
 *   silent SSE streams — every such transient break therefore surfaced as
 *   an unhandled module rejection in the visitor's console even though the
 *   backend comes back seconds later and the module would have compiled.
 *
 *   v2 keeps the keepAlive()/onError contract byte-compatible with the
 *   upstream client (webpack's LazyCompilationProxyModule calls it), but:
 *     · errors trigger an internal RETRY LOOP (2s cadence) instead of an
 *       immediate report — this covers BOTH retryable network drops and
 *       fatal failures (the gateway answers dev-server death windows with
 *       a 502 HTML page, which makes the browser give up auto-reconnect;
 *       we tear down and re-create the EventSource ourselves);
 *     · the error is reported to webpack ONLY after a SUSTAINED outage
 *       (default 30s, once per outage) — a genuinely unreachable backend
 *       still surfaces honestly, transient restart windows do not;
 *     · retrying continues even after a report — if the backend returns,
 *       still-pending modules still resolve.
 */

if (typeof EventSource !== "function") {
        throw new Error(
                "Environment doesn't support lazy compilation (requires EventSource)"
        );
}

var urlBase = decodeURIComponent(__resourceQuery.slice(1));
var parsedBase;
try {
        parsedBase = new URL(urlBase);
} catch (e) {
        parsedBase = null;
}

/**
 * Local-origin detection: a browser running ON the dev machine can reach
 * the backend directly; every other visitor must ride the gateway. The
 * v1 gateway→direct fallback is GONE for remote visitors — falling back
 * to `http://localhost:<port>` on a remote visitor's machine is a
 * guaranteed failure and only ever produced noise.
 */
var localOrigin = false;
try {
        if (typeof location === "object" && location) {
                var h = location.hostname;
                localOrigin =
                        h === "localhost" ||
                        h === "127.0.0.1" ||
                        h === "::1" ||
                        h === "[::1]" ||
                        h === "0.0.0.0" ||
                        h === "" ||
                        /\.localhost$/.test(h);
        }
} catch (e) {
        localOrigin = false;
}

// "gateway" → same-origin via the sandbox gateway; "direct" → absolute URL.
var mode = !parsedBase || localOrigin ? "direct" : "gateway";

var RECONNECT_MS = 2_000; // retry cadence while the backend is unreachable
var OUTAGE_REPORT_MS = 30_000; // sustained failure before surfacing the error

/** @type {EventSource | undefined} */
var activeEventSource;
var activeKeys = new Map();
var errorHandlers = new Set();
var reconnectTimer = null;
var outageTimer = null;
var outageReported = false;

function reportOutage() {
        // SSE error events carry no message/filename/lineno — v1 strung the
        // undefined fields into the message ("undefined undefined:…").
        // Report the actual condition instead.
        errorHandlers.forEach(function (onError) {
                onError(
                        new Error(
                                "Problem communicating active modules to the server: " +
                                        "the lazy-compilation backend was unreachable for " +
                                        (OUTAGE_REPORT_MS / 1000) +
                                        "s (" +
                                        mode +
                                        " mode); the dev server is likely restarting."
                        )
                );
        });
}

function armOutage() {
        if (outageTimer) return;
        outageTimer = setTimeout(function () {
                outageTimer = null;
                if (!outageReported) {
                        outageReported = true;
                        reportOutage();
                }
                // NOTE: deliberately NO stop — keep retrying. If the backend
                // comes back, still-pending modules still resolve; the report
                // above was the honest signal, not a shutdown.
        }, OUTAGE_REPORT_MS);
}

function disarmOutage() {
        if (outageTimer) {
                clearTimeout(outageTimer);
                outageTimer = null;
        }
        outageReported = false;
}

function cancelReconnect() {
        if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
        }
}

function buildUrl(keys) {
        if (mode === "gateway" && parsedBase) {
                // Same-origin path + the port as a gateway routing hint.
                return (
                        parsedBase.pathname +
                        keys +
                        "?XTransformPort=" +
                        parsedBase.port
                );
        }
        return urlBase + keys;
}

function connect() {
        if (activeEventSource) {
                activeEventSource.onopen = null;
                activeEventSource.onerror = null;
                activeEventSource.close();
                activeEventSource = undefined;
        }
        if (!activeKeys.size) return;

        var es = new EventSource(
                buildUrl(Array.from(activeKeys.keys()).join("@"))
        );
        activeEventSource = es;

        es.onopen = function () {
                if (es !== activeEventSource) return;
                // Connection (re)established: any armed outage is over.
                disarmOutage();
        };

        es.onerror = function () {
                if (es !== activeEventSource) return;
                // Transient break (dev-server OOM/respawn window, proxy idle
                // kill, gateway 502 error page): the backend returns within
                // seconds-to-minutes. Take over reconnection manually —
                // EventSource's built-in auto-reconnect gives up when the
                // response is not 200/text-event-stream (the gateway's
                // branded restart page), so relying on it would strand us.
                es.onopen = null;
                es.onerror = null;
                es.close();
                if (es === activeEventSource) activeEventSource = undefined;
                armOutage();
                scheduleReconnect();
        };
}

function scheduleReconnect() {
        if (reconnectTimer || !activeKeys.size) return;
        reconnectTimer = setTimeout(function () {
                reconnectTimer = null;
                connect();
        }, RECONNECT_MS);
}

var updateEventSource = function updateEventSource() {
        cancelReconnect();
        if (!activeKeys.size) {
                // Nothing listens any more — drop the connection and any
                // armed outage.
                if (activeEventSource) {
                        activeEventSource.onopen = null;
                        activeEventSource.onerror = null;
                        activeEventSource.close();
                        activeEventSource = undefined;
                }
                disarmOutage();
                return;
        }
        connect();
};

/**
 * @param {{ data: string, onError: (err: Error) => void, active: boolean, module: module }} options options
 * @returns {() => void} function to destroy response
 */
exports.keepAlive = function (options) {
        var data = options.data;
        var onError = options.onError;
        var active = options.active;
        // eslint-disable-next-line @next/next/no-assign-module-variable -- upstream webpack client contract: `module` is the webpack module API.
        var module = options.module;
        errorHandlers.add(onError);
        var value = activeKeys.get(data) || 0;
        activeKeys.set(data, value + 1);
        if (value === 0) {
                updateEventSource();
        }
        if (!active && !module.hot) {
                console.log(
                        "Hot Module Replacement is not enabled. Waiting for process restart..."
                );
        }

        return function () {
                errorHandlers.delete(onError);
                setTimeout(function () {
                        var value = activeKeys.get(data);
                        if (value === 1) {
                                activeKeys.delete(data);
                                updateEventSource();
                        } else {
                                activeKeys.set(data, value - 1);
                        }
                }, 1000);
        };
};
