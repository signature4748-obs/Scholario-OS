'use strict'

/**
 * Scholario custom webpack lazyCompilation backend (gateway-aware).
 *
 * WHY THIS EXISTS (dev-stability architecture):
 *   The `/` god-entry dynamically imports every role panel. A FULL compile
 *   of all panels at once peaks ~3.1–3.4GB — over the sandbox's 4GB cgroup
 *   once the QA browser is also resident — and OOM-kills the dev server in
 *   a death loop. webpack's lazyCompilation compiles modules only when the
 *   browser actually requests them (each panel compiles on first visit),
 *   keeping peak memory a fraction of the full build.
 *
 * WHY NOT THE DEFAULT BACKEND:
 *   webpack's default backend opens its SSE server on a RANDOM port and
 *   burns the ABSOLUTE url (`http://localhost:<random>/lazy-compilation-using-`)
 *   into the browser chunks. Browsers reaching the app through the sandbox
 *   gateway (single external port, `XTransformPort` query routing) cannot
 *   open `localhost:<random>` — "localhost" is the VISITOR'S machine — so
 *   every lazy module rejects and the page renders blank.
 *
 *   This backend fixes both problems:
 *     · FIXED port (default 3777, `SCHOLARIO_LAZY_PORT` to override;
 *       falls back to a random port on EADDRINUSE);
 *     · the query string is stripped BEFORE module keys are parsed —
 *       the gateway appends `?XTransformPort=…` to every proxied request
 *       and the default backend would treat it as part of the key;
 *     · the browser-side client (./lazy-client.js) connects SAME-ORIGIN
 *       through the gateway (`/lazy-compilation-using-…?XTransformPort=3777`)
 *       with a direct absolute-URL fallback for local development.
 *
 * Contract (mirrors webpack's bundled backend, next/dist/compiled/webpack
 * bundle5.js module 70580): `backend(compiler, callback)` →
 * `callback(null, { dispose(done), module(module) })`; `module()` returns
 * `{ client, data, active }`. Each Next compiler (node/web) calls it once —
 * the SSE server is a shared singleton for the process lifetime.
 */

const http = require('http')

const PORT = Number(process.env.SCHOLARIO_LAZY_PORT || 3777)
const PREFIX = '/lazy-compilation-using-'
const DISPOSE_GRACE_MS = 120_000 // upstream default: 2min decay

/** Same encoding as upstream — keys must be byte-identical. */
function encodeModuleId(identifier) {
  return `${encodeURIComponent(
    identifier.replace(/\\/g, '/').replace(/@/g, '_'),
  ).replace(/%(2F|3A|24|26|2B|2C|3B|3D)/g, decodeURIComponent)}`
}

function createBackend() {
  const activeKeys = new Map() // key → refcount
  const compilers = new Set()
  let urlBase = null
  let server = null
  let listeningCallbacks = []

  const invalidateAll = () => {
    for (const c of compilers) {
      if (c.watching) c.watching.invalidate()
    }
  }

  const requestListener = (req, res) => {
    if (req.url === undefined) return
    // GATEWAY FIX: strip `?XTransformPort=…` (and any other query) BEFORE
    // slicing the prefix — keys must never absorb the query string.
    const keys = req.url.split('?')[0].slice(PREFIX.length).split('@')

    req.socket.on('close', () => {
      setTimeout(() => {
        for (const key of keys) {
          const count = activeKeys.get(key) || 0
          activeKeys.set(key, count - 1)
          if (count === 1) {
            // Module no longer in use — next compile skips it (upstream log).
          }
        }
      }, DISPOSE_GRACE_MS)
    })

    req.socket.setNoDelay(true)
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    })
    res.write('\n')

    let needsCompile = false
    for (const key of keys) {
      const count = activeKeys.get(key) || 0
      activeKeys.set(key, count + 1)
      if (count === 0) needsCompile = true
    }
    if (needsCompile) invalidateAll()
  }

  const startServer = (onListening) => {
    server = http.createServer(requestListener)
    server.on('listening', () => {
      const addr = server.address()
      urlBase = `http://localhost:${addr.port}`
      console.log(`[lazy-compilation] SSE backend open at ${urlBase}${PREFIX} (gateway-aware, fixed port preferred)`)
      onListening(null)
    })
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && PORT !== 0) {
        // Fixed port taken (stale server from a previous process) — fall
        // back to an ephemeral port rather than dying.
        console.warn(`[lazy-compilation] port ${PORT} busy — falling back to a random port`)
        server.close()
        startServer(onListening)
        return
      }
      onListening(err)
    })
    server.listen(PORT === 0 ? undefined : PORT)
  }

  return {
    ready(onReady) {
      if (urlBase) return onReady(null)
      listeningCallbacks.push(onReady)
      if (!server) {
        startServer((err) => {
          const cbs = listeningCallbacks
          listeningCallbacks = []
          cbs.forEach((cb) => cb(err))
        })
      }
    },
    addCompiler(compiler) {
      compilers.add(compiler)
    },
    removeCompiler(compiler) {
      compilers.delete(compiler)
    },
    /** Client module path per compiler target (node vs web). */
    clientFor(compiler) {
      const isNode =
        (compiler.options && compiler.options.externalsPresets && compiler.options.externalsPresets.node) ||
        String(compiler.options && compiler.options.target || '').includes('node')
      if (isNode) {
        // Upstream node client — the dev server process connects directly.
        try {
          return require.resolve('next/dist/compiled/webpack/lazy-compilation-node.js')
        } catch {
          return require.resolve('next/dist/compiled/webpack/lazy-compilation-web.js')
        }
      }
      // OUR gateway-aware web client.
      return require.resolve('./lazy-client.js')
    },
    makeModule(compiler, module) {
      const data = encodeModuleId(module.identifier())
      const active = (activeKeys.get(data) || 0) > 0
      return {
        client: `${this.clientFor(compiler)}?${encodeURIComponent(urlBase + PREFIX)}`,
        data,
        active,
      }
    },
  }
}

function getSingleton() {
  if (!globalThis.__SCHOLARIO_LAZY_BACKEND__) {
    globalThis.__SCHOLARIO_LAZY_BACKEND__ = createBackend()
  }
  return globalThis.__SCHOLARIO_LAZY_BACKEND__
}

/** The backend webpack calls once per compiler. */
module.exports = function scholarioLazyBackend(compiler, callback) {
  const be = getSingleton()
  be.addCompiler(compiler)
  be.ready((err) => {
    if (err) return callback(err)
    callback(null, {
      // The singleton SSE server lives for the whole dev process; webpack
      // calls dispose on compiler shutdown, but other compilers still need
      // it — a no-op keeps the shared server intact.
      dispose(done) {
        be.removeCompiler(compiler)
        done()
      },
      module(module) {
        return be.makeModule(compiler, module)
      },
    })
  })
}
