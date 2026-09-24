'use client'

/**
 * results/history — the ACADEMIC TIMELINE.
 *
 * Result history reads like a story, not a list: a vertical timeline
 * where every declared exam is a coloured node (its own type colour),
 * the latest carries a subtle LATEST indicator, and the next upcoming
 * exam continues the line in clearly-muted styling (clock icon, dashed
 * connector, "Pending") so a future exam can never be mistaken for a
 * declared result. Clicking a declared node selects that result in the
 * page above — no round-trip.
 *
 * Data: the SERVER's declared exams (/api/student/results) + the single
 * next upcoming exam from the same payload.
 */

import { CalendarClock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MyResultExam } from '../shared/canonical'
import { chronological, fmtPct, shortDate, typeKey, type KnownExamType } from './derive'
import { gradeTone } from './grade-tone'
import { SectionLabel } from '../../shell/page-header'

/** Assessment-type colour identity — one colour per exam kind. */
const TYPE_COLOR: Record<KnownExamType, { dot: string; ring: string; text: string }> = {
  'Unit Test': {
    dot: 'bg-sky-500',
    ring: 'ring-sky-500/25',
    text: 'text-sky-600 dark:text-sky-400',
  },
  'Mid Term': {
    dot: 'bg-violet-500',
    ring: 'ring-violet-500/25',
    text: 'text-violet-600 dark:text-violet-400',
  },
  Final: {
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/25',
    text: 'text-amber-600 dark:text-amber-400',
  },
}

interface HistoryProps {
  /** Declared exams (latest-declared first, as the server returns them). */
  exams: MyResultExam[]
  upcoming: { examName: string; startsAt: string; endsAt: string | null } | null
  /** Scale-bound grade fn (school-configured bands). */
  gradeFor: (pct: number) => string
  selectedId: string
  onSelect: (id: string) => void
}

export function History({ exams, upcoming, gradeFor, selectedId, onSelect }: HistoryProps) {
  // The story reads forward: oldest declared → latest → what's coming next.
  const inOrder = chronological(exams)
  const latestId = exams.length > 0 ? exams[0].examId : null

  return (
    <section aria-label="Result history">
      <SectionLabel hint={`${exams.length} declared`}>Result History</SectionLabel>

      <ol className="relative mt-3 space-y-1">
        {/* The timeline spine */}
        <span className="absolute bottom-3 left-[1.05rem] top-3 w-px bg-border/80" aria-hidden />

        {inOrder.map((exam) => {
          const grade = exam.pct != null ? gradeFor(exam.pct) : null
          const tone = grade ? gradeTone(grade) : null
          const color = TYPE_COLOR[typeKey(exam.type)]
          const isActive = exam.examId === selectedId
          const isLatest = exam.examId === latestId

          return (
            <li key={exam.examId} className="relative pl-11">
              {/* The node */}
              <span
                className={cn(
                  'absolute left-2.5 top-1/2 flex h-[1.4rem] w-[1.4rem] -translate-y-1/2 items-center justify-center rounded-full bg-background ring-4',
                  color.ring,
                )}
              >
                <span className={cn('h-2.5 w-2.5 rounded-full', color.dot, isActive && 'h-3 w-3')} />
              </span>

              <button
                type="button"
                onClick={() => onSelect(exam.examId)}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive ? 'bg-primary/[0.07] shadow-2xs' : 'hover:bg-muted/40',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={cn('truncate text-sm', isActive ? 'font-bold text-foreground' : 'font-semibold text-foreground/90')}>
                      {exam.examName}
                    </span>
                    {isLatest && (
                      <span className="rounded-full border border-primary/30 bg-primary/[0.08] px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
                        Latest
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600/70" aria-hidden />
                    Declared {shortDate(exam.declaredAt)}
                  </span>
                </span>
                {exam.pct != null && (
                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className="text-sm font-bold tabular-nums text-foreground">{fmtPct(exam.pct)}%</span>
                    {grade && tone && (
                      <span className={cn('rounded-lg border px-2 py-0.5 text-[11px] font-bold tabular-nums', tone.badge)}>{grade}</span>
                    )}
                  </span>
                )}
              </button>
            </li>
          )
        })}

        {upcoming && (
          <li className="relative pl-11" aria-label={`${upcoming.examName}: upcoming`}>
            {/* The node — dashed, unmistakably not a result yet */}
            <span
              className="absolute left-2.5 top-1/2 flex h-[1.4rem] w-[1.4rem] -translate-y-1/2 items-center justify-center rounded-full bg-background ring-4 ring-border/40"
              aria-hidden
            >
              <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground/50 bg-transparent" />
            </span>
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/60 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-muted-foreground">{upcoming.examName}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/70">
                  <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
                  Starts {shortDate(upcoming.startsAt)}
                </p>
              </span>
              <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Pending
              </span>
            </div>
          </li>
        )}
      </ol>
    </section>
  )
}
