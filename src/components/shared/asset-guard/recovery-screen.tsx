'use client'

/**
 * React-side recovery screen of the Asset Guard system.
 *
 * Rendered by AssetErrorBoundary when a lazily-loaded module chunk
 * fails (e.g. the dev server restarted between the page load and the
 * panel import). Mirrors the inline watchdog's recovery screen —
 * branded, self-explanatory, with an honest Retry — but as a React
 * component so it inherits the (already loaded) design system.
 */
import { useEffect, useState } from 'react'

export function AssetRecoveryScreen({
  kind = 'chunk',
  onRetry,
}: {
  kind?: 'chunk' | 'asset'
  onRetry?: () => void
}) {
  const [seconds, setSeconds] = useState(3)

  useEffect(() => {
    const t = window.setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (seconds === 0 && onRetry) onRetry()
  }, [seconds])

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Scholario could not load this workspace"
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-background p-6 text-center"
      style={{ visibility: 'visible' }}
    >
      <div className="max-w-md">
        <div
          aria-hidden="true"
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-2xl font-extrabold text-white shadow-lg shadow-teal-600/25"
        >
          S
        </div>
        <h1 className="mb-2 text-xl font-bold text-foreground">
          Scholario couldn&rsquo;t load this workspace.
        </h1>
        <p className="mb-1 text-sm leading-relaxed text-muted-foreground">
          {kind === 'chunk'
            ? 'A part of the application failed to download — the server may be restarting. Nothing is lost.'
            : 'A required asset failed to load. Nothing is lost.'}
        </p>
        <p className="mb-5 text-xs text-muted-foreground">
          {seconds > 0 ? `Reloading in ${seconds}s…` : 'Reloading…'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="cursor-pointer rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Retry now
        </button>
        <div className="mt-6 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          SCHOLARIO · School OS
        </div>
      </div>
    </div>
  )
}
