'use client'

/**
 * PlatformActivityFeed — the REAL cross-school activity stream (server
 * records: staff ActivityLog actions, successful fee payments, user
 * sign-ins), rendered inside the Super Admin's Platform Overview.
 *
 * Deliberately distinct from the tenant-store "Recent platform changes"
 * panel: that one shows the mock control plane; this one shows events that
 * actually happened in the school's database — including TIMETABLE_PUBLISHED
 * entries written by the Principal's publish flow.
 *
 * Presentation: hairline ledger rows (same rhythm as the tenant panels) —
 * kind icon chip · actor · summary · school badge · relative timestamp.
 * Loading = quiet skeleton; failure = honest note + retry (never fake data).
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  BadgeCheck,
  IndianRupee,
  LogIn,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/principal/modules/shared/panel'

interface FeedEvent {
  id: string
  at: string
  kind: 'staff' | 'payment' | 'signin'
  actor: string
  school: string | null
  summary: string
  meta: string | null
}

interface ActivityPayload {
  events: FeedEvent[]
  counts: { staff: number; payments: number; signins: number }
}

const KIND_META = {
  staff: { icon: BadgeCheck, tone: 'text-sky-600 dark:text-sky-400 bg-sky-500/10', label: 'Staff action' },
  payment: { icon: IndianRupee, tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10', label: 'Payment' },
  signin: { icon: LogIn, tone: 'text-violet-600 dark:text-violet-400 bg-violet-500/10', label: 'Sign-in' },
} as const

/** "just now" / "4m ago" / "3h ago" / "2d ago" — honest, coarse, stable. */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

async function fetchActivity(): Promise<ActivityPayload> {
  const res = await fetch('/api/superadmin/activity', {
    cache: 'no-store',
    credentials: 'same-origin',
  })
  const json = (await res.json().catch(() => null)) as
    | { ok?: unknown; error?: unknown; data?: ActivityPayload }
    | null
  if (!res.ok || !json || json.ok !== true) {
    throw new Error(typeof json?.error === 'string' ? json.error : `Request failed (${res.status})`)
  }
  return json.data as ActivityPayload
}

export function PlatformActivityFeed() {
  const [data, setData] = useState<ActivityPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    fetchActivity()
      .then((payload) => {
        if (!alive) return
        setData(payload)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Could not load activity')
      })
    return () => {
      alive = false
    }
  }, [reloadKey])

  const retry = useCallback(() => setReloadKey((k) => k + 1), [])

  const events = data?.events ?? []

  return (
    <Panel
      title="School records activity"
      subtitle="Live from the server — staff actions, payments & sign-ins"
      bodyClassName="p-0"
      action={
        <button
          type="button"
          onClick={retry}
          title="Refresh the activity feed"
          aria-label="Refresh activity feed"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        </button>
      }
    >
      {/* Loading skeleton — first fetch, no data yet */}
      {!data && !error && (
        <div className="space-y-1 p-3" aria-busy="true" aria-label="Loading activity">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 py-1.5" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="h-6 w-6 shrink-0 animate-pulse rounded-md bg-muted/70" />
              <div className="h-3 w-40 animate-pulse rounded bg-muted/60" />
              <div className="ml-auto h-3 w-14 animate-pulse rounded bg-muted/50" />
            </div>
          ))}
        </div>
      )}

      {/* Error — honest, retryable */}
      {error && !data && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-4">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Activity unavailable.</span> {error}
          </p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="h-3 w-3" aria-hidden /> Retry
          </button>
        </div>
      )}

      {/* The feed — hairline ledger rows, newest first */}
      {data && (
        <ul className="max-h-96 overflow-y-auto">
          {events.map((e) => {
            const meta = KIND_META[e.kind]
            const Icon = meta.icon
            return (
              <li
                key={e.id}
                className="flex items-center gap-2.5 border-t border-border/40 px-3 py-2.5 transition-colors first:border-t-0 hover:bg-muted/30"
                title={e.meta ?? undefined}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                    meta.tone,
                  )}
                  aria-hidden
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-xs">
                    <span className="font-semibold text-foreground">{e.actor}</span>
                    <span className="text-muted-foreground"> — {e.summary}</span>
                  </p>
                  {e.meta && (
                    <p className="truncate text-[10px] text-muted-foreground/80">{e.meta}</p>
                  )}
                </div>
                {e.school && (
                  <span
                    className="hidden max-w-[130px] shrink-0 truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border sm:inline-block"
                    title={e.school}
                  >
                    {e.school}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground" suppressHydrationWarning>
                  {relativeTime(e.at)}
                </span>
              </li>
            )
          })}
          {events.length === 0 && (
            <li className="flex flex-col items-center justify-center px-3 py-10 text-center">
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-muted/40 text-muted-foreground/60">
                <Activity className="h-4 w-4" aria-hidden />
              </div>
              <p className="text-xs font-semibold text-muted-foreground">No recorded activity yet</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                Staff actions, payments and sign-ins will appear here as they happen.
              </p>
            </li>
          )}
        </ul>
      )}
    </Panel>
  )
}
