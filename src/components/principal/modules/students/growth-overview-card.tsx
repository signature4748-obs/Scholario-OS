'use client'

/**
 * growth-overview-card — the Principal's school-wide Growth snapshot (§30).
 *
 * Server truth: GET /api/principal/growth/overview — the SAME score
 * derivation every teacher surface renders, aggregated across the whole
 * school. Compact by design: average + the three bands + the latest
 * ledger events. The Principal stays informed; teachers stay scoped.
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { cn } from '@/lib/utils'
import {
  isAutomaticSource,
  pointsTextClass,
  relativeDay,
  signedDelta,
  signedPoints,
} from '@/components/teacher/modules/student-growth/shared'

interface OverviewPayload {
  studentCount: number
  scoredCount: number
  average: number | null
  improving: number
  steady: number
  needsAttention: number
  building: number
  monthPoints: number
  recentEvents: {
    id: string
    studentId: string
    studentName: string
    points: number
    reason: string
    source: string
    createdBy: string | null
    effectiveAt: string
  }[]
}

export function GrowthOverviewCard() {
  const [data, setData] = useState<OverviewPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/principal/growth/overview', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        const j: unknown = await r.json().catch(() => null)
        const env = j as { ok?: unknown; data?: OverviewPayload } | null
        if (!r.ok || !env || env.ok !== true || !env.data) throw new Error('failed')
        return env.data
      })
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <GlassCard className="p-4 sm:col-span-2 lg:col-span-1">
      <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
        <span>School Growth</span>
        <TrendingUp className="h-4 w-4 text-emerald-500" />
      </h3>

      {!data ? (
        <div className="space-y-2" aria-busy="true">
          <div className="h-10 animate-pulse rounded-lg bg-muted/50" />
          <div className="h-8 animate-pulse rounded-lg bg-muted/40" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <p
                className={cn(
                  'font-display text-2xl font-bold leading-none tabular-nums',
                  data.average == null
                    ? 'text-muted-foreground/60'
                    : data.average >= 75
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : data.average >= 55
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400',
                )}
              >
                {data.average ?? '—'}
              </p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                avg score
              </p>
            </div>
            <div className="grid flex-1 grid-cols-3 gap-1.5 text-center">
              <Band label="↑" value={data.improving} tone="emerald" />
              <Band label="→" value={data.steady} tone="sky" />
              <Band label="↓" value={data.needsAttention} tone={data.needsAttention > 0 ? 'amber' : 'muted'} />
            </div>
          </div>

          <p className="mt-2 text-[10px] text-muted-foreground">
            {data.scoredCount} of {data.studentCount} scored · {signedDelta(data.monthPoints)} ledger points this month
            {data.building > 0 ? ` · ${data.building} building` : ''}
          </p>

          <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Latest points</p>
            {data.recentEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No growth events recorded yet.</p>
            ) : (
              data.recentEvents.slice(0, 4).map((e, i) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{e.studentName}</span>
                    <span className="text-muted-foreground"> · {e.reason}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[9px] text-muted-foreground">{relativeDay(e.effectiveAt)}</span>
                    <span className={cn('font-semibold tabular-nums', pointsTextClass(e.points))}>
                      {signedPoints(e.points)}
                    </span>
                  </span>
                </motion.div>
              ))
            )}
            <p className="pt-1 text-[9px] text-muted-foreground/70">
              Automatic events (attendance · exams) + manual teacher points.{' '}
              {data.recentEvents.some((e) => isAutomaticSource(e.source)) ? '' : 'Per-student details live in each profile\u2019;s Growth tab.'}
            </p>
          </div>
        </>
      )}
    </GlassCard>
  )
}

function Band({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'sky' | 'amber' | 'muted' }) {
  const tones = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    sky: 'text-sky-600 dark:text-sky-400',
    amber: 'text-amber-600 dark:text-amber-400',
    muted: 'text-muted-foreground',
  } as const
  return (
    <div className="rounded-lg border border-border bg-card/40 py-1.5">
      <p className={cn('font-display text-base font-bold leading-none tabular-nums', tones[tone])}>
        <span aria-hidden="true" className="mr-0.5 text-[10px]">{label}</span>
        {value}
      </p>
    </div>
  )
}
