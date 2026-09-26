'use client'

import { Component, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModuleLoading } from '@/components/shared/module-loading'

/**
 * lazyModule — chunk-resilient lazy module loader (stabilization §22/§29).
 *
 * Dev servers invalidate lazy chunks during recompiles (webpack
 * lazyCompilation) and production deployments retire chunk URLs after a
 * new ship — both surface as `ChunkLoadError: Loading chunk … failed`
 * inside React.lazy, which otherwise unmounts the whole app to a blank
 * screen (the commit-phase crash leaves the root error boundary unable
 * to render).
 *
 * This wrapper hardens every role-module mount with three layers:
 *   1. IMPORT RETRY — a failed dynamic import is retried twice (fresh
 *      chunk URL) before surfacing the error.
 *   2. STALE-RUNTIME RECOVERY — if the chunk graph itself is retired
 *      (dev recompile / re-deploy), one guarded full page reload fetches
 *      a fresh runtime instead of dead-ending on an unfixable import.
 *   3. ERROR BOUNDARY — if the module still fails (or throws while
 *      rendering), a compact "This module could not be loaded — Try
 *      again" card replaces ONLY that module; the shell, navigation and
 *      session stay alive. Retrying builds a FRESH dynamic instance
 *      (React.lazy caches rejected imports, so a plain remount would
 *      replay the same failure).
 */

const CHUNK_ERROR = /ChunkLoadError|Loading chunk|Loading CSS chunk|imported module/i

// One guarded full reload per window: when a runtime's chunk graph has
// been RETIRED (dev-server recompile after heavy edits, or a production
// re-deploy), no in-place import can ever succeed — the browser is holding
// URLs the server no longer serves. The ONLY real recovery is fetching a
// fresh runtime (exactly what Next.js itself does for chunk errors during
// client-side navigation). The sessionStorage guard caps this at one
// attempt per window so a genuinely broken build cannot reload-loop; the
// error boundary card remains the last-resort surface.
const CHUNK_RELOAD_KEY = 'scholario-chunk-reload-at'
const CHUNK_RELOAD_WINDOW_MS = 15_000

function chunkReloadAllowed(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0)
    return Number.isFinite(at) && Date.now() - at > CHUNK_RELOAD_WINDOW_MS
  } catch {
    return false // storage disabled — never auto-reload blindly
  }
}

async function importWithRetry<T>(loader: () => Promise<T>, attempts = 5): Promise<T> {
  try {
    return await loader()
  } catch (err) {
    const message = String((err as Error)?.message ?? err)
    if (CHUNK_ERROR.test(message)) {
      if (attempts > 0) {
        // Give the dev server (or the browser cache) a beat, then retry —
        // the recompiled chunk usually exists by the next attempt. First-
        // visit lazy compiles of heavy modules can take a few seconds on a
        // busy dev box; 5 × 500ms keeps the wait well under the perceived-
        // hang threshold while covering slow compiles WITHOUT the full
        // reload (which resets the viewer's place in the app).
        await new Promise((r) => setTimeout(r, 500))
        return importWithRetry(loader, attempts - 1)
      }
      // Retries exhausted: the chunk graph this runtime references is
      // retired. Recover ONCE with a full reload (fresh runtime = fresh
      // chunk URLs); hold the loader open while the document unloads.
      if (typeof window !== 'undefined' && chunkReloadAllowed()) {
        try {
          window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
        } catch {
          /* guard write failed — proceed, worst case is one extra reload */
        }
        window.location.reload()
        return await new Promise<T>(() => {})
      }
    }
    throw err
  }
}

interface ModuleErrorBoundaryProps {
  /** Builds a FRESH loadable component — called again on retry. */
  build: () => React.ComponentType<any>
  /** Diagnostic label (e.g. "lazyModule(StudentsClassesModule)") — used
   *  ONLY for the traceability console.error when the module fails. */
  label?: string
  children: (Comp: React.ComponentType<any>) => ReactNode
}

interface ModuleErrorBoundaryState {
  error: Error | null
  Comp: React.ComponentType<any>
}

export class ModuleErrorBoundary extends Component<ModuleErrorBoundaryProps, ModuleErrorBoundaryState> {
  state: ModuleErrorBoundaryState = { error: null, Comp: this.props.build() }

  static getDerivedStateFromError(error: Error): Partial<ModuleErrorBoundaryState> {
    return { error }
  }

  // Traceability (stabilization §21): the compact card is intentionally
  // quiet for users, but the actual error must never be swallowed — log
  // it with the module label so QA/dev can connect the card to its cause.
  componentDidCatch(error: Error, info: unknown) {
    console.error(`[lazyModule] ${this.props.label ?? 'module'} failed to load:`, error, info)
  }

  private retry = () => {
    this.setState({ error: null, Comp: this.props.build() })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card/60 p-8 py-16 text-center" role="alert">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold">This module could not be loaded</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              The section failed to load — your session and the rest of the app are unaffected.
              Trying again usually resolves it.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={this.retry}>
            <RotateCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      )
    }
    return this.props.children(this.state.Comp)
  }
}

/**
 * Same contract as the panels' local `lazy()` helpers — a dynamic()
 * component that compiles on first visit, hardened with import retry +
 * a per-module error boundary.
 *
 * PROPS ARE FORWARDED: modules mounted through this wrapper receive the
 * exact props their caller passes (e.g. the Teacher module-router's
 * onNavigate handoffs). The previous `<Comp />` render dropped every
 * prop, which silently broke cross-module navigation buttons inside
 * lazily-loaded modules (they saw onNavigate = undefined).
 */
export function lazyModule(
  loader: () => Promise<{ [key: string]: any }>,
  pick: string,
): React.ComponentType<any> {
  const build = () =>
    dynamic(() => importWithRetry(loader).then((m) => m[pick] as React.ComponentType<any>), {
      loading: ModuleLoading,
    })

  function LazyModule(props: Record<string, any>) {
    return (
      <ModuleErrorBoundary build={build} label={LazyModule.displayName}>
        {(Comp) => <Comp {...props} />}
      </ModuleErrorBoundary>
    )
  }
  LazyModule.displayName = `lazyModule(${pick})`
  return LazyModule
}
