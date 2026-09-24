'use client'

/**
 * results/subject-performance — the core of Results.
 *
 * Elegant expandable subject rows that sit DIRECTLY ON THE PAGE (no
 * card-inside-card border fatigue). Hierarchy comes from spacing,
 * hairline dividers and the subject's own colour identity:
 *   · each subject carries its canonical Timetable colour (one visual
 *     identity system across modules — Mathematics violet here AND in
 *     the timetable, never a local copy)
 *   · a proportional performance bar with the grade's tone
 *   · expansion reveals the subject's remarks when the school entered
 *     any — single-paper subjects say so, factually
 *
 * Data: the SERVER's subject rows (marks / totalMarks / grade exactly
 * as declared). Responsive: the row reflows comfortably at iPad widths;
 * the bar never shrinks to invisibility; touch targets stay generous.
 */

import { useState } from 'react'
import { ChevronDown, FileCheck2, MessageSquareQuote } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { MyResultSubject } from '../shared/canonical'
import { fmtPct, pctOfSubject } from './derive'
import { subjectColor } from '../timetable/subject-colors'
import { gradeTone } from './grade-tone'
import { SectionLabel } from '../../shell/page-header'

interface SubjectPerformanceProps {
  subjects: MyResultSubject[]
}

export function SubjectPerformance({ subjects }: SubjectPerformanceProps) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <section aria-label="Subject performance">
      <SectionLabel hint={`${subjects.length} subjects`}>Subject Performance</SectionLabel>

      {/* Rows live directly on the page — hairline dividers, zero borders */}
      <div className="mt-2 divide-y divide-border/70">
        {subjects.map((s) => {
          const color = subjectColor(s.subject)
          const pct = pctOfSubject(s)
          const grade = s.grade || '—'
          const tone = gradeTone(grade)
          const isOpen = open === s.subject
          return (
            <div key={s.subject} className={cn('transition-colors', isOpen && 'bg-muted/25')}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : s.subject)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-3.5 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4 sm:px-4"
              >
                {/* Subject identity — the Timetable's colour system */}
                <span
                  className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold ring-1', color.bg, color.text, color.ring)}
                  aria-hidden
                >
                  {s.subject.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate text-sm font-semibold text-foreground">{s.subject}</span>
                    {s.remarks && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/80">
                        <MessageSquareQuote className="h-2.5 w-2.5" aria-hidden />
                        Remark
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2.5">
                    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span
                        className={cn('block h-full rounded-full bg-gradient-to-r', color.gradient)}
                        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                      />
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground/80">{fmtPct(pct)}%</span>
                  </span>
                </span>

                <span className="hidden shrink-0 text-right sm:block">
                  <span className="block text-sm font-bold tabular-nums text-foreground">{s.marks}</span>
                  <span className="block text-[11px] tabular-nums text-muted-foreground">of {s.totalMarks}</span>
                </span>

                <span
                  className={cn('shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold tabular-nums', tone.badge)}
                >
                  {grade}
                </span>

                <ChevronDown
                  className={cn('h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform', isOpen && 'rotate-180')}
                  aria-hidden
                />
              </button>

              {/* ── Subject detail — only what actually exists ── */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-4 pt-0.5 sm:px-4 sm:pl-[4.25rem]">
                      <p className="mb-3 text-[11px] tabular-nums text-muted-foreground">
                        <span className="text-sm font-bold text-foreground">{s.marks}</span> / {s.totalMarks} ·{' '}
                        {fmtPct(pct)}% · Grade {grade}
                      </p>

                      {s.remarks ? (
                        <p className="flex items-start gap-2 rounded-r-lg border-l-2 border-violet-500/50 bg-violet-500/[0.045] px-3 py-2 text-xs leading-relaxed text-foreground/85 dark:bg-violet-500/[0.07]">
                          <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500/70" aria-hidden />
                          {s.remarks}
                        </p>
                      ) : (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                          Single written paper · {s.totalMarks} marks
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </section>
  )
}
