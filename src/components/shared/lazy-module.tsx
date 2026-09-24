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
 * This wrapper hardens every role-module mount with two layers:
 *   1. IMPORT RETRY — a failed dynamic import is retried twice (fresh
 *      chunk URL) before surfacing the error.
 *   2. ERROR BOUNDARY — if the module still fails (or throws while
 *      rendering), a compact "This module could not be loaded — Try
 *      again" card replaces ONLY that module; the shell, navigation and
 *      session stay alive. Retrying builds a FRESH dynamic instance
 *      (React.lazy caches rejected imports, so a plain remount would
 *      replay the same failure).
 */

const CHUNK_ERROR = /ChunkLoadError|Loading chunk|Loading CSS chunk|imported module/i

async function importWithRetry<T>(loader: () => Promise<T>, attempts = 2): Promise<T> {
  try {
    return await loader()
  } catch (err) {
    if (attempts > 0 && CHUNK_ERROR.test(String((err as Error)?.message ?? err))) {
      // Give the dev server (or the browser cache) a beat, then retry —
      // the recompiled chunk usually exists by the next attempt.
      await new Promise((r) => setTimeout(r, 350))
      return importWithRetry(loader, attempts - 1)
    }
    throw err
  }
}

interface ModuleErrorBoundaryProps {
  /** Builds a FRESH loadable component — called again on retry. */
  build: () => React.ComponentType<any>
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
 */
export function lazyModule(
  loader: () => Promise<{ [key: string]: any }>,
  pick: string,
): React.ComponentType<any> {
  const build = () =>
    dynamic(() => importWithRetry(loader).then((m) => m[pick] as React.ComponentType<any>), {
      loading: ModuleLoading,
    })

  function LazyModule() {
    return (
      <ModuleErrorBoundary build={build}>
        {(Comp) => <Comp />}
      </ModuleErrorBoundary>
    )
  }
  LazyModule.displayName = `lazyModule(${pick})`
  return LazyModule
}
