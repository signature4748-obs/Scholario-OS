// spawn-detached.mjs — one-shot launcher: starts the target command fully
// detached (new session, own process group), so it survives the Bash tool
// call that spawned it (direct `&`+setsid children get reaped at call end;
// processes spawned detached from INSIDE a running process survive — the
// keepalive→dev chain proved this empirically).
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const ROOT = '/home/z/my-project'
const [cmd, ...args] = process.argv.slice(2)
if (!cmd) {
  console.error('usage: bun spawn-detached.mjs <cmd> [args…]')
  process.exit(1)
}
const out = fs.openSync(`${ROOT}/dev.log`, 'a')
const child = spawn(cmd, args, {
  cwd: ROOT,
  detached: true,
  stdio: ['ignore', out, out],
})
child.unref()
console.log(`detached spawn: ${cmd} ${args.join(' ')} (pid ${child.pid})`)
