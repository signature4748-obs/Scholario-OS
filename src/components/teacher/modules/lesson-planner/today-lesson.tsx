'use client'

/**
 * lesson-planner/today-lesson — the COMPACT Current Topic card (LP-3 UI
 * refinement). Replaces the former oversized emerald hero: same canonical
 * payload (plan.today.topic — the server-derived current lesson, never
 * fabricated), same optimistic completion toggle, but presented in the
 * SCHOLARIO house language — a quiet white card with an emerald left accent
 * (the "Now" row recipe from My Timetable), modest type scale, a status
 * chip and one primary action.
 *
 * States: in-progress / today → "Mark Completed" · completed → "Completed ·
 * <date>" + Undo · nothing scheduled → the server's honest reason in a
 * compact quiet card.
 */

import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarOff,
  CalendarRange,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Undo2,
} from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { HubEmptyState } from '@/components/teacher/modules/shared/hub-stat-cards'
import { cn } from '@/lib/utils'
import type { LessonPlanPayload } from './api'
import { TOPIC_STATUS } from './shared'
import { formatDayHeading, formatDayRange, formatDayShort } from './shared'

interface CurrentTopicCardProps {
  plan: LessonPlanPayload
  /** True while THIS topic's completion toggle is in flight. */
  pending: boolean
  onToggleCompletion: (topicId: string, completed: boolean) => void
}

export function CurrentTopicCard({ plan, pending, onToggleCompletion }: CurrentTopicCardProps) {
  const { today } = plan
  const topic = today.topic

  // Honest empty state — the server explains WHY nothing is scheduled today.
  if (!topic) {
    return (
      <GlassCard hover={false} className="p-4 sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Current Topic
        </p>
        <HubEmptyState
          icon={CalendarOff}
          title={today.reason ?? 'No lesson scheduled for today'}
          hint={`Today · ${formatDayHeading(today.date)}`}
          className="py-6"
        />
      </GlassCard>
    )
  }

  const status = TOPIC_STATUS[topic.status]
  const isDone = topic.status === 'completed'

  return (
    <GlassCard
      hover={false}
      className="border-l-2 border-l-emerald-500/70 p-4 sm:p-5"
    >
      {/* label row */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Current Topic
          </p>
          <span className={status.chip}>{status.label}</span>
        </div>
        <p className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
          Today · {formatDayHeading(today.date)}
        </p>
      </div>

      {/* topic identity */}
      <h2 className="mt-2 text-lg font-bold leading-snug tracking-tight text-foreground sm:text-xl">
        {topic.topicName}
      </h2>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={`Unit ${topic.unitNo} · ${topic.unitName}`}>
        Unit {topic.unitNo} · {topic.unitName}
      </p>

      {topic.description && (
        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {topic.description}
        </p>
      )}

      {/* meta + action footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 border-t border-border/60 pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">{topic.periodsNeeded} periods</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">{formatDayRange(topic.startDate, topic.endDate)}</span>
          </span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {isDone ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="flex shrink-0 items-center gap-2"
            >
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Completed{topic.completedOn ? ` · ${formatDayShort(topic.completedOn)}` : ''}
              </span>
              <button
                type="button"
                onClick={() => onToggleCompletion(topic.id, false)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-60"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                Undo
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="cta"
              type="button"
              onClick={() => onToggleCompletion(topic.id, true)}
              disabled={pending}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold',
                'text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-70',
              )}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Mark Completed
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  )
}
