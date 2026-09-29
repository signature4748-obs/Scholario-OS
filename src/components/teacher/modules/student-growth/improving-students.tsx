'use client'

/**
 * student-growth/improving-students — POSITIVE GROWTH, the honest
 * counterpart of the attention list. Each row is a student whose
 * normalized average ROSE between the two most recent graded exams —
 * real calculated change (latest avg% − previous avg%), never a
 * fabricated delta or an arbitrary label.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { GlassCard, GradientAvatar } from '@/components/shared/ui'
import { HubEmptyState } from '@/components/teacher/modules/shared/hub-stat-cards'
import type { ClassAnalytics } from '../analytics/types'

interface ImprovingStudentsProps {
  a: ClassAnalytics
  onOpenStudent: (studentId: string) => void
}

export function ImprovingStudents({ a, onOpenStudent }: ImprovingStudentsProps) {
  const reduce = useReducedMotion()
  const improving = a.improvingStudents

  return (
    <GlassCard hover={false} className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Improving
          </h3>
          <Badge variant="secondary" className="rounded-full px-2 text-[10px] font-semibold">
            {improving.length}
          </Badge>
        </div>
        <p className="truncate text-[10px] text-muted-foreground">
          {improving.length > 0
            ? `${improving[0].previousExamName} → ${improving[0].latestExamName} · real change per student`
            : 'Exam-over-exam progress appears once two assessments are graded'}
        </p>
      </div>

      {improving.length === 0 ? (
        <HubEmptyState
          icon={TrendingUp}
          title="No improving students yet"
          hint="Students whose average rose between the two most recent graded assessments will be celebrated here."
          className="py-8"
        />
      ) : (
        <div
          className="max-h-72 divide-y divide-border/50 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
          role="list"
          aria-label="Improving students"
        >
          {improving.map((s, i) => (
            <motion.button
              key={s.studentId}
              type="button"
              role="listitem"
              onClick={() => onOpenStudent(s.studentId)}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.25 }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
              aria-label={`Open ${s.name}'s growth profile`}
            >
              <GradientAvatar name={s.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Roll #{s.rollNo ?? '—'} · {s.previousAvgPct}% → {s.latestAvgPct}%
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-display text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                +{s.deltaPct} pts
              </span>
            </motion.button>
          ))}
        </div>
      )}
    </GlassCard>
  )
}
