'use client'

/**
 * results/assessment-selector — the one prominent control.
 *
 * Declared exams are selectable chips in chronological declaration
 * order, the latest carries a subtle LATEST tag, and the next upcoming
 * exam appears at the end as a quiet "pending" chip so the student
 * always sees the session shape. Wrapping (not scrolling) keeps iPad and
 * mobile safe from horizontal overflow at any exam count.
 *
 * Data source: the server exam list (/api/student/results) — examName +
 * declaredAt per chip; the upcoming chip from the `upcoming` payload.
 */

import { Check, Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MyResultExam } from '../shared/canonical'
import { chronological, monthDay } from './derive'

interface UpcomingExam {
  examName: string
  startsAt: string
  endsAt: string | null
}

interface AssessmentSelectorProps {
  /** Declared exams (latest-declared first, as the server returns them). */
  exams: MyResultExam[]
  upcoming: UpcomingExam | null
  selectedId: string
  onSelect: (id: string) => void
}

export function AssessmentSelector({ exams, upcoming, selectedId, onSelect }: AssessmentSelectorProps) {
  // Chips read forward in time: oldest declared → latest declared → next up.
  const inOrder = chronological(exams)
  const latestId = exams.length > 0 ? exams[0].examId : null

  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Select assessment">
      {inOrder.map((exam) => {
        const isSelected = exam.examId === selectedId
        const isLatest = exam.examId === latestId
        return (
          <button
            key={exam.examId}
            role="tab"
            type="button"
            aria-selected={isSelected}
            onClick={() => onSelect(exam.examId)}
            title={`Result declared ${monthDay(exam.declaredAt)}`}
            className={cn(
              'group relative flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'cursor-pointer',
              !isSelected && 'border-border bg-card text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
              isSelected && 'border-primary/40 bg-primary/[0.09] font-semibold text-foreground shadow-2xs'
            )}
          >
            <Check
              className={cn('h-3.5 w-3.5 shrink-0 transition-colors', isSelected ? 'text-primary' : 'text-muted-foreground/50')}
              aria-hidden
            />
            <span className="min-w-0 truncate">{exam.examName}</span>
            <span className={cn('shrink-0 text-[10px] tabular-nums', isSelected ? 'text-muted-foreground' : 'text-muted-foreground/70')}>
              {monthDay(exam.declaredAt)}
            </span>
            {isLatest && (
              <span className="absolute -top-2 left-2.5 rounded-full border border-primary/30 bg-primary px-1.5 py-px text-[8px] font-bold uppercase tracking-[0.12em] text-primary-foreground">
                Latest
              </span>
            )}
          </button>
        )
      })}

      {upcoming && (
        <div
          aria-label={`${upcoming.examName}: upcoming`}
          title={`Starts ${monthDay(upcoming.startsAt)}`}
          className="flex cursor-default items-center gap-2 rounded-xl border border-dashed border-border/70 bg-transparent px-3.5 py-2 text-xs text-muted-foreground/70"
        >
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
          <span className="min-w-0 truncate">{upcoming.examName}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
            {monthDay(upcoming.startsAt)}
          </span>
        </div>
      )}
    </div>
  )
}
