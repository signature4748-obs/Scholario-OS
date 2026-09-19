'use client'

/**
 * class-hub/results-card — the OVERALL RESULTS SUBMISSION view: for each
 * recent exam (pills, newest first), every subject of the class with
 *   entered n/N bar · DRAFT vs SUBMITTED state · class average.
 * This is the whole-class picture a class teacher needs — across every
 * subject teacher, not just their own marks entry.
 */

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ClipboardList, FileCheck2, PencilLine } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ClassHubClass } from './types'

export function ResultsCard({
  cls,
  onNavigate,
}: {
  cls: ClassHubClass
  onNavigate: (key: string) => void
}) {
  const reduce = useReducedMotion()
  const exams = cls.results
  // Default to the actionable exam — the ongoing cycle, else the most
  // recent one with marks entered, else the newest.
  const defaultExam =
    exams.find((e) => e.status === 'Ongoing' || e.status === 'ONGOING') ??
    exams.find((e) => e.enteredSubjects > 0) ??
    exams[0]
  const [examId, setExamId] = useState<string>(defaultExam?.examId ?? '')
  const exam = exams.find((e) => e.examId === examId) ?? defaultExam ?? null

  return (
    <GlassCard hover={false} className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <ClipboardList className="h-4 w-4 text-sky-500" aria-hidden="true" />
          Results Submission
        </h3>
        <span className="text-[10px] text-muted-foreground">all subjects · your class</span>
      </div>

      {exams.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          No exams scheduled for this class yet.
        </p>
      ) : (
        <>
          {/* exam pills */}
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Select an exam">
            {exams.map((e) => {
              const active = exam?.examId === e.examId
              return (
                <button
                  key={e.examId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setExamId(e.examId)}
                  className={cn(
                    'min-h-[34px] rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                    active
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
                  )}
                >
                  {e.examName}
                </button>
              )
            })}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {exam && (
              <motion.div
                key={exam.examId}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/40 px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold">{exam.examName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {exam.examDate ? formatDate(exam.examDate) : 'Date not set'} · {exam.status}
                    </p>
                  </div>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{exam.enteredSubjects}</span>/{exam.totalSubjects} subjects entering ·{' '}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{exam.submittedSubjects}</span> submitted
                  </p>
                </div>

                <div className="space-y-1.5">
                  {exam.subjects.map((sub, i) => {
                    const denom = cls.studentCount
                    const enteredPct = denom > 0 ? Math.round((sub.entered / denom) * 100) : 0
                    const allSubmitted = sub.submitted > 0 && sub.submitted >= sub.entered && sub.entered > 0
                    const draftOnly = sub.entered > 0 && !allSubmitted
                    return (
                      <motion.div
                        key={sub.subjectId}
                        initial={reduce ? false : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.035, 0.28), duration: 0.25 }}
                        className="rounded-xl border border-border bg-card/40 px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-semibold">{sub.subjectName}</p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {sub.avgPct != null && (
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
                                  sub.avgPct < 40
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                                )}
                              >
                                avg {sub.avgPct}%
                              </span>
                            )}
                            {allSubmitted ? (
                              <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <FileCheck2 className="h-2.5 w-2.5" aria-hidden="true" /> Submitted
                              </span>
                            ) : draftOnly ? (
                              <span className="flex items-center gap-0.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                <PencilLine className="h-2.5 w-2.5" aria-hidden="true" /> Draft
                              </span>
                            ) : (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                        {/* entered / class-size bar */}
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <motion.div
                              initial={reduce ? false : { width: 0 }}
                              animate={{ width: `${enteredPct}%` }}
                              transition={{ type: 'spring', stiffness: 70, damping: 20, delay: 0.1 + Math.min(i * 0.03, 0.2) }}
                              className={cn('h-full rounded-full', allSubmitted ? 'bg-emerald-500' : draftOnly ? 'bg-amber-500' : 'bg-sky-500')}
                            />
                          </div>
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {sub.entered}/{denom} entered
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => onNavigate('marks')}
            className="mt-3 inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" /> Open Marks Entry
          </button>
        </>
      )}
    </GlassCard>
  )
}
