'use client'

/**
 * AssetErrorBoundary — React-tree half of the Asset Guard system.
 *
 * Catches module/chunk load failures thrown while React renders the
 * lazily-imported role panels (next dev restarts between page load
 * and a panel's first import → the chunk 404s / the SSE
 * lazy-compilation stub rejects). Without this boundary the error
 * unmounts the whole root and the user is left with a blank page.
 *
 * Behaviour:
 *   - Only intercepts LOAD failures (chunk/script/CSS import
 *     errors). Genuine application bugs are re-thrown from render()
 *     so they bubble to the Next.js dev overlay / error reporting —
 *     this guard must never swallow real errors.
 *   - Shows the branded recovery screen and schedules ONE automatic
 *     full reload after 3s (the dev server is usually back by then);
 *     the user can also retry manually.
 */
import React from 'react'
import { AssetRecoveryScreen } from './recovery-screen'

const LOAD_FAILURE_PATTERNS = [
  'Failed to fetch dynamically imported module', // Chrome / Safari dynamic import
  'Importing a module script failed', // Firefox dynamic import
  'Loading chunk', // webpack chunk error ("Loading chunk 123 failed")
  'Loading CSS chunk',
  'ChunkLoadError', // webpack legacy name
  'module script failed',
  'dynamically imported module',
  'lazy-compilation', // custom lazy-compilation backend errors
]

export function isAssetLoadFailure(error: unknown): boolean {
  if (!error) return false
  const message =
    typeof error === 'string' ? error : error instanceof Error ? error.message : ''
  if (!message) return false
  const lower = message.toLowerCase()
  return LOAD_FAILURE_PATTERNS.some((p) => lower.includes(p.toLowerCase()))
}

interface Props {
  children: React.ReactNode
}

interface State {
  error: unknown
}

export class AssetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: unknown): State {
    // Capture EVERY render error; render() decides whether it is an
    // asset-load failure (intercept) or an app bug (re-throw so the
    // dev overlay / production error reporting still sees it).
    return { error }
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[asset-guard] render error intercepted:', error, info)
  }

  render() {
    const { error } = this.state
    if (error !== null) {
      if (isAssetLoadFailure(error)) {
        return <AssetRecoveryScreen kind="chunk" onRetry={() => window.location.reload()} />
      }
      // Not an asset failure — re-throw so the error propagates to
      // the Next.js error overlay (dev) / root error handling (prod).
      throw error
    }
    return this.props.children
  }
}
