'use client'

/**
 * profile-tab-growth — the Principal's view of ONE student's growth (§30).
 *
 * Replaces the former Discipline tab, which rendered RANDOM store data
 * (disciplinePoints/disciplineRecords from seed-data.ts) — a fake
 * universe. This tab is 100% canonical: GET /api/principal/growth/student
 * /[id] returns the same score derivation + point ledger every teacher
 * surface renders, including the correction chain (§29) — the Principal
 * can inspect exactly where every point came from.
 */

import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import type { GrowthEventItem, GrowthScoreDto } from '@/lib/teacher-hub-types'
import { GlassCard } from '@/components/shared/ui'
import { cn } from '@/lib/utils'
import {
  GrowthDimensions,
  GrowthScoreRing,
  MonthDeltaChip,
} from '@/components/teacher/modules/student-growth/growth-summary'
import {
  SOURCE_LABELS,
  isAutomaticSource,
  pointsChipClass,
  pointsTextClass,
  relativeDay,
  signedDelta,
  signedPoints,
} from '@/components/teacher/modules/student-growth/shared'
import { Metric, Section } from './shared'

type Props = { student: { id: string; name?: string } }

interface GrowthPayload {
  student: { id: string; name: string; classLabel: string }
  score: GrowthScoreDto | null
  events: GrowthEventItem[]
}

export function GrowthTab({ student }: Props) {
  const [data, setData] = useState<GrowthPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    fetch(`/api/principal/growth/student/${encodeURIComponent(student.id)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (r) => {
        const j: unknown = await r.json().catch(() => null)
        const env = j as { ok?: unknown; error?: unknown; data?: GrowthPayload } | null
        if (!r.ok || !env || env.ok !== true || !env.data) {
          throw new Error(env && typeof env.error === 'string' ? env.error : `Request failed (${r.status})`)
        }
        return env.data
      })
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Growth could not load.')
      })
    return () => {
      cancelled = true
    }
  }, [student.id, reload])

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card/40 p-4 text-center">
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        <button
          onClick={() => setReload((r) => r + 1)}
          className="mt-2 text-xs text-primary font-medium hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-lg bg-muted" />
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <GlassCard hover={false} className="p-4">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
          <GrowthScoreRing
            score={data.score?.score ?? null}
            monthDelta={data.score?.monthDelta ?? 0}
            size={112}
          />
          <div className="w-full min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Growth Score
              </span>
              <MonthDeltaChip monthDelta={data.score?.monthDelta ?? 0} />
            </div>
            {data.score ? (
              <GrowthDimensions dimensions={data.score.dimensions} columns />
            ) : (
              <p className="text-center text-xs text-muted-foreground sm:text-left">
                Building from attendance and academic records — no score invented.
              </p>
            )}
          </div>
        </div>
        {data.score && (
          <p className="mt-3 border-t border-border pt-2 text-center text-[10px] text-muted-foreground">
            Ledger: {signedDelta(data.score.totalPoints)} lifetime points · {data.score.eventCount} events ·{' '}
            {signedDelta(data.score.monthDelta)} this month
          </p>
        )}
      </GlassCard>

      <Section title="Point Ledger">
        {data.events.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/40 p-4 text-center">
            <TrendingUp className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-sm font-medium">No growth events yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Points recorded by teachers and automatic attendance/exam evaluation will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.events.map((e) => (
              <div
                key={e.id}
                className={cn(
                  'rounded-lg border border-border bg-card/40 p-2.5',
                  e.status !== 'ACTIVE' && 'opacity-60',
                  e.points > 0 ? 'border-l-2 border-l-emerald-500/60' : 'border-l-2 border-l-amber-500/60',
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      'mt-0.5 inline-flex h-7 w-10 shrink-0 items-center justify-center rounded-md border text-xs font-bold tabular-nums',
                      pointsChipClass(e.points),
                    )}
                  >
                    {signedPoints(e.points)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{e.reason}</p>
                    {e.note && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{e.note}</p>}
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {relativeDay(e.effectiveAt)} ·{' '}
                      {e.createdBy ? e.createdBy.name : SOURCE_LABELS[e.source] ?? 'Automatic'}
                      {e.status === 'SUPERSEDED' && ' · superseded by a correction'}
                      {e.correctsId && ' · correction'}
                    </p>
                    {e.correctionNote && (
                      <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-[10px] italic text-muted-foreground">
                        Correction note — {e.correctionNote}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Automatic events"
          value={String(data.events.filter((e) => isAutomaticSource(e.source) && e.status === 'ACTIVE').length)}
          color="text-sky-600 dark:text-sky-400"
        />
        <Metric
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Manual points"
          value={signedDelta(
            data.events
              .filter((e) => e.source === 'MANUAL' && e.status === 'ACTIVE')
              .reduce((s, e) => s + e.points, 0),
          )}
          color={pointsTextClass(1)}
        />
      </div>
    </div>
  )
}
