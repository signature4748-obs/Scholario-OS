'use client'

/**
 * student-growth/assessment-performance — the ASSESSMENT PERFORMANCE
 * list: every exam the focused class knows about (configured ∪ graded),
 * newest first. Per exam: real status, students graded, class average,
 * highest/lowest and subject completion — all from ExamMark /
 * ExamSubjectConfig rows. An unsubmitted examination NEVER appears as
 * completed (0 graded, no average, honest completion bar).
 */

import { motion, useReducedMotion } from 'framer-motion'
import { ClipboardCheck } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { HubEmptyState } from '@/components/teacher/modules/shared/hub-stat-cards'
import { cn } from '@/lib/utils'
import type { AssessmentSummary, ClassAnalytics } from '../analytics/types'

interface AssessmentPerformanceProps {
  a: ClassAnalytics
  /** only assessments at/after this timestamp render (null = all) */
  periodStartMs: number | null
}

function statusChip(status: string, graded: number): { label: string; className: string } {
  const s = status.toLowerCase()
  if (s === 'completed' && graded > 0) {
    return {
      label: 'Graded',
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    }
  }
  if (s === 'completed') {
    return {
      label: 'Awaiting marks',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    }
  }
  if (s === 'ongoing') {
    return { label: 'Ongoing', className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' }
  }
  if (s === 'scheduled') {
    return { label: 'Scheduled', className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' }
  }
  if (s === 'cancelled') {
    return { label: 'Cancelled', className: 'bg-muted text-muted-foreground' }
  }
  return { label: status, className: 'bg-muted text-muted-foreground' }
}

function AssessmentRow({ exam, i }: { exam: AssessmentSummary; i: number }) {
  const reduce = useReducedMotion()
  const chip = statusChip(exam.status, exam.studentsGraded)
  const completion = exam.expected > 0 ? Math.min(1, exam.entered / exam.expected) : 0
  const subjectsDone = exam.subjectsConfigured > 0 && exam.subjectsEntered >= exam.subjectsConfigured

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.25 }}
      className="px-4 py-3.5 transition-colors hover:bg-muted/30"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 truncate text-sm font-medium">{exam.name}</p>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            chip.className,
          )}
        >
          {chip.label}
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {exam.dateLabel}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Students graded
          </p>
          <p className="font-display text-sm font-bold tabular-nums">
            {exam.studentsGraded}
            <span className="text-xs font-normal text-muted-foreground"> / {exam.studentCount}</span>
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Class average
          </p>
          <p className="font-display text-sm font-bold tabular-nums">
            {exam.classAveragePct != null ? `${exam.classAveragePct}%` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Highest · lowest
          </p>
          <p className="font-display text-sm font-bold tabular-nums">
            {exam.highestPct != null ? `${exam.highestPct}%` : '—'}
            <span className="text-xs font-normal text-muted-foreground">
              {' '}
              · {exam.lowestPct != null ? `${exam.lowestPct}%` : '—'}
            </span>
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Subjects
          </p>
          <p className="font-display text-sm font-bold tabular-nums">
            {exam.subjectsEntered}
            <span className="text-xs font-normal text-muted-foreground">
              {' '}
              / {exam.subjectsConfigured}
            </span>
            {subjectsDone && (
              <span className="ml-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                complete
              </span>
            )}
          </p>
        </div>
      </div>

      {/* marks-entry completion bar — 0% stays honestly empty */}
      <div className="mt-2.5 flex items-center gap-2">
        <div
          className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(completion * 100)}
          aria-label={`${exam.name} marks entry completion`}
        >
          <motion.div
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${completion * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className={cn(
              'h-full rounded-full',
              completion >= 1 ? 'bg-emerald-500' : 'bg-primary/70',
            )}
          />
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {exam.entered} / {exam.expected} marks
        </span>
      </div>
    </motion.li>
  )
}

export function AssessmentPerformance({ a, periodStartMs }: AssessmentPerformanceProps) {
  const exams = a.assessments.filter(
    (e) => periodStartMs == null || e.dateMs == null || e.dateMs >= periodStartMs,
  )

  return (
    <GlassCard hover={false} className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 px-4 py-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Assessment Performance
        </h3>
        <p className="truncate text-[10px] text-muted-foreground">
          {a.label} · only entered marks count — ungraded exams never show as completed
        </p>
      </div>

      {exams.length === 0 ? (
        <HubEmptyState
          icon={ClipboardCheck}
          title="No assessments in this period"
          hint="Exams configured or graded for this class appear here with their real status."
          className="py-8"
        />
      ) : (
        <ul
          className="max-h-[26rem] divide-y divide-border/50 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
          aria-label={`Assessments of ${a.label}`}
        >
          {exams.map((exam, i) => (
            <AssessmentRow key={exam.examId} exam={exam} i={i} />
          ))}
        </ul>
      )}
    </GlassCard>
  )
}
