// warm-chunks.mjs — recursively fetch the app page + every /_next chunk
// referenced (fixpoint), compiling them server-side WITHOUT a browser
// (rebuild of the wiped /home/z/.qa/warm-chunks.sh from worklog Task 2).
// Sequential fetches keep compile memory manageable inside the 4GB cgroup.
const BASE = 'http://localhost:3000'
const seen = new Set()
let fetched = 0
let failed = 0

async function walk(url, depth) {
  if (seen.has(url) || seen.size > 700) return
  seen.add(url)
  let text = ''
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(90000) })
    fetched++
    if (!r.ok) {
      failed++
      return
    }
    const ct = r.headers.get('content-type') || ''
    if (/javascript|text\/html/.test(ct)) text = await r.text()
    else return
  } catch {
    failed++
    return
  }
  // Chunk refs: /_next/static/... .js (and .mjs) URLs embedded in HTML/JS.
  const matches =
    text.match(/\/_next\/[A-Za-z0-9\/._-]+\.(?:js|mjs)/g) || []
  for (const m of [...new Set(matches)]) {
    if (depth < 12) await walk(BASE + m, depth + 1)
  }
}

await walk(BASE + '/', 0)
console.log(
  `[warm] done: ${fetched} fetched (${failed} failed), ${seen.size} unique urls`
)
