'use client'

/**
 * student-growth/academic-performance — SUBJECT PERFORMANCE with clean
 * horizontal progress indicators. Every value comes from the analytics
 * payload (real ExamMark rows normalized by each subject's configured
 * maxMarks — the honest denominator); the latest GRADED assessment drives
 * the rows, and each row shows how many students carry that average.
 *
 * Bars animate smoothly to their actual percentage (0 → pct) and the
 * whole section respects prefers-reduced-motion (static render instead).
 */

import { motion, useReducedMotion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { HubEmptyState } from '@/components/teacher/modules/shared/hub-stat-cards'
import { cn } from '@/lib/utils'
import type { ClassAnalytics } from '../analytics/types'

interface AcademicPerformanceProps {
  a: ClassAnalytics
  /** null = all subjects; otherwise only that subject's row renders */
  subjectFilter: string | null
}

function barTone(pct: number): string {
  if (pct >= 75) return 'bg-emerald-500'
  if (pct >= 55) return 'bg-amber-500'
  return 'bg-rose-500'
}

export function AcademicPerformance({ a, subjectFilter }: AcademicPerformanceProps) {
  const reduce = useReducedMotion()
  const rows = subjectFilter
    ? a.subjectAverages.filter((s) => s.subject === subjectFilter)
    : a.subjectAverages

  return (
    <GlassCard hover={false} className="p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">Academic Performance</h3>
        <p className="text-[11px] text-muted-foreground">
          {a.latestAssessment
            ? `${a.latestAssessment.name} · ${a.label}`
            : `${a.label} · no graded assessment yet`}
        </p>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Subject averages from entered marks, normalized by each subject&apos;s maximum.
      </p>

      {rows.length === 0 ? (
        <HubEmptyState
          icon={BookOpen}
          title="No subject marks yet"
          hint="Subject averages appear as soon as marks are entered for a graded assessment of this class."
          className="py-8"
        />
      ) : (
        <div
          className="space-y-3"
          role="list"
          aria-label={`Subject averages for ${a.label}`}
        >
          {rows.map((s, i) => (
            <motion.div
              key={s.subject}
              role="listitem"
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.05, duration: 0.25 }}
              className={cn(
                'rounded-xl px-3 py-2.5 transition-colors',
                subjectFilter === s.subject ? 'bg-primary/[0.05] ring-1 ring-primary/20' : 'hover:bg-muted/40',
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium">{s.subject}</p>
                <p className="shrink-0 font-display text-sm font-bold tabular-nums">
                  {s.pct}%
                </p>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(s.pct)}
                aria-label={`${s.subject} class average`}
              >
                <motion.div
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${Math.min(Math.max(s.pct, 0), 100)}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 + Math.min(i, 8) * 0.05 }}
                  className={cn('h-full rounded-full', barTone(s.pct))}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                avg {s.avg} / {s.max} · {s.graded} of {a.studentCount} students graded
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}
