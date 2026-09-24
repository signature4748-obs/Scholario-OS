// keepalive.mjs — sandbox watchdog (v3, 2026-09-24).
//
// LESSON LEARNED (v2 incident): a dev server mid-compile can be
// HTTP-unresponsive for 15s+; an HTTP-only probe wrongly declared it dead,
// killed the tree and raced a respawn into EADDRINUSE. v3 decides liveness
// by the OS truth instead:
//
//   alive  ⇔ something is LISTENING on the port (ss -ltn)
//   healthy ⇔ HTTP probe answers OK within the timeout
//
//   · LISTENING + slow/failed HTTP  → server is COMPILING — leave it
//     alone (log once, never kill).
//   · NOT LISTENING (2 consecutive probes) → truly dead → kill the full
//     tree (wrapper + bash pipeline + next child + tee), WAIT until the
//     port is actually free (up to 20s, escalating to kill -9), then
//     respawn via spawn-detached.mjs and allow a 120s compile window
//     before probing again.
//
//   :3000 → Next dev (`bun run dev`)      :3003 → event-stream mini-service
//
// All output goes to stdout — spawn-detached.mjs routes it to dev.log.

import { spawn, exec } from 'node:child_process'

const ROOT = '/home/z/my-project'
const PROBE_MS = 20_000
const HTTP_TIMEOUT_MS = 10_000

const log = (msg) => console.log(`[keepalive ${new Date().toISOString()}] ${msg}`)

function sh(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (err, stdout) => resolve({ err, stdout: stdout ?? '' }))
  })
}

/** OS truth: is anything LISTENING on this port? */
async function listening(port) {
  const { stdout } = await sh(`ss -ltn | grep -c ':${port} ' || true`)
  return Number(stdout.trim() || '0') > 0
}

/** Health: does the service answer HTTP OK? */
async function healthy(port, path) {
  try {
    const res = await fetch(`http://localhost:${port}${path}`, {
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    })
    return res.ok
  } catch {
    return false
  }
}

function spawnDetached(cmd, args, cwd = ROOT) {
  const child = spawn(cmd, args, { cwd, detached: true, stdio: ['ignore', 'ignore', 'ignore'] })
  child.unref()
  log(`spawned detached: ${cmd} ${args.join(' ')} (pid ${child.pid}) in ${cwd}`)
}

async function killTree(patterns) {
  for (const p of patterns) await sh(`pkill -f "${p}" || true`)
}

/** Wait until the port is free (escalating to kill -9). */
async function waitForFreePort(port, patterns, timeoutMs = 20_000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (!(await listening(port))) return true
    await sh(patterns.map((p) => `pkill -9 -f "${p}" || true`).join('; '))
    await new Promise((r) => setTimeout(r, 1500))
  }
  return !(await listening(port))
}

const state = {
  next: { downProbes: 0, compiling: false, respawnedAt: 0 },
  stream: { downProbes: 0, respawnedAt: 0 },
}

async function ensureService(name, port, path, patterns, spawnArgs, cwd, st) {
  const isListening = await listening(port)

  // Listening but HTTP-slow ⇒ compiling — NEVER kill (v2 lesson).
  if (isListening) {
    const ok = await healthy(port, path)
    if (!ok) {
      if (!st.compiling) {
        st.compiling = true
        log(`:${port} listening but not answering yet — likely compiling; leaving it alone`)
      }
    } else if (st.compiling) {
      st.compiling = false
      log(`:${port} recovered (healthy again)`)
    }
    st.downProbes = 0
    return
  }
  st.compiling = false
  st.downProbes += 1

  // Fresh respawn gets a 120s compile window before it can be declared dead.
  if (st.respawnedAt && Date.now() - st.respawnedAt < 120_000) {
    log(`:${port} not listening yet — respawn of ${name} still within its 120s compile window`)
    return
  }
  if (st.downProbes < 2) {
    log(`:${port} not listening (probe #${st.downProbes}) — waiting one more cycle`)
    return
  }
  st.downProbes = 0
  log(`:${port} is DOWN — killing the previous ${name} tree and respawning`)
  await killTree(patterns)
  const freed = await waitForFreePort(port, patterns)
  if (!freed) {
    log(`:${port} still held after force-kill — will retry next cycle`)
    return
  }
  spawnDetached('bun', [`${ROOT}/spawn-detached.mjs`, ...spawnArgs], cwd)
  st.respawnedAt = Date.now()
}

async function tick() {
  try {
    await ensureService(
      'next dev', 3000, '/api/app-version',
      ['bun run dev', 'next dev -p 3000', 'tee dev.log'],
      ['bun', 'run', 'dev'], ROOT, state.next,
    )
    await ensureService(
      'event-stream', 3003, '/?EIO=4&transport=polling',
      ['mini-services/event-stream'],
      ['bun', 'run', 'dev'], `${ROOT}/mini-services/event-stream`, state.stream,
    )
  } catch (e) {
    log(`tick error: ${e && e.message}`)
  }
}

log('watchdog v3 started (ss-based liveness; compile windows respected)')
await tick()
setInterval(tick, PROBE_MS)
