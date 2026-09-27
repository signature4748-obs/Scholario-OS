// warm-chunks.mjs v2 — paced recursive warmer for the lazy-compilation dev
// server.
//
// WHY: with webpack lazyCompilation every role module compiles ON DEMAND at
// first browser request. A user walking the 20-module Principal panel fires
// 20 back-to-back first-hit compiles → anon-rss 2.69GB → kernel OOM-kill →
// "This site can't be reached". keepalive.mjs triggers this warmer after
// every server (re)start so compiles happen paced in the background instead
// of during the user's clicks.
//
// HOW (mirrors what a browser does, without a browser):
//   1. literal refs — every /_next/....js URL embedded in HTML/JS text
//   2. lazy proxy chunks — webpack lazyCompilation chunk ids look like
//      "_app-pages-browser_src_components_..._tsx_lazy-compilation-proxy"
//      (served at /_next/static/chunks/<id>.js, no content hash). We extract
//      them from served JS text and fetch each: that triggers the module's
//      compile server-side; the compiled chunk text then references FURTHER
//      lazy chunks (app shell → role panels → modules → …) so the recursion
//      walks the entire 3-role module graph to a fixpoint.
//
// Sequential fetches + a delay keep compile memory pressure flat; the walk
// aborts cleanly if the server dies mid-warm (keepalive will re-trigger it
// after respawn).

const BASE = 'http://localhost:3000'
const DELAY_MS = 400 // pacing between fetches — keeps GC ahead of compiles
const MAX_URLS = 400 // hard cap on discovery
const MAX_DEPTH = 30
const seen = new Set()
let fetched = 0
let failed = 0
let dead = 0 // consecutive connection failures → server died mid-warm

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function visit(url, depth) {
  if (seen.has(url) || seen.size > MAX_URLS || dead >= 3) return
  seen.add(url)
  let text = ''
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(180_000) })
    fetched++
    dead = 0
    if (!r.ok) {
      failed++
      return
    }
    const ct = r.headers.get('content-type') || ''
    if (/javascript|text\/html/.test(ct)) text = await r.text()
    else return
  } catch {
    failed++
    dead++ // likely server compiling hard or dying — back off
    await sleep(3000)
    return
  }

  // (1) literal /_next/…js references
  const literal = text.match(/\/_next\/[A-Za-z0-9\/._-]+\.(?:js|mjs)/g) || []
  for (const m of [...new Set(literal)]) {
    if (depth < MAX_DEPTH) await visit(BASE + m, depth + 1)
  }

  // (2) lazy-compilation-proxy chunk ids (letters/digits/_/- only, no slashes
  //     → cannot false-match full URLs)
  const proxyIds = text.match(/[A-Za-z0-9_-]{4,}lazy-compilation-proxy/g) || []
  for (const id of [...new Set(proxyIds)]) {
    if (seen.size > MAX_URLS || dead >= 3) break
    if (depth < MAX_DEPTH) {
      await sleep(DELAY_MS)
      await visit(`${BASE}/_next/static/chunks/${id}.js`, depth + 1)
    }
  }
}

await visit(BASE + '/', 0)
console.log(
  `[warm] done: ${fetched} fetched (${failed} failed), ${seen.size} unique urls${
    dead >= 3 ? ' — ABORTED (server unreachable mid-warm; keepalive will re-trigger)' : ''
  }`,
)
