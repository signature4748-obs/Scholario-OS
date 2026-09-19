'use client'

/**
 * lesson-planner/today-lesson — THE hero (LP-2 redesign). The first thing
 * the teacher sees: a deep emerald gradient cover carrying the date, unit
 * chip, the big topic name, pace/window chips and the spring-animated
 * "Mark completed" control with a confetti burst. An animated session-
 * progress ring sits on the right. Completed lessons morph into a calm
 * emerald "Completed · <date>" state with Undo. Nothing scheduled today →
 * the server's honest reason in a quiet card — never a fabricated topic.
 */

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarOff, CalendarRange, Check, CheckCircle2, Clock, Loader2, Sparkles, Undo2 } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { HubEmptyState } from '@/components/teacher/modules/shared/hub-stat-cards'
import { cn } from '@/lib/utils'
import type { LessonPlanPayload } from './api'
import { ConfettiBurst, TOPIC_STATUS } from './shared'
import { formatDayHeading, formatDayRange, formatDayShort } from './shared'

// ─── Session progress ring ───────────────────────────────────────────────

function ProgressRing({ pct }: { pct: number }) {
  const R = 46
  const C = 2 * Math.PI * R
  return (
    <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32" role="img"
      aria-label={`Session ${pct}% complete`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeWidth="9"
          className="text-white/20" />
        <motion.circle
          cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeWidth="9"
          strokeLinecap="round" className="text-white"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - Math.min(100, Math.max(0, pct)) / 100) }}
          transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={pct}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="font-display text-2xl font-bold tabular-nums leading-none text-white sm:text-3xl"
        >
          {pct}%
        </motion.span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/70">
          session
        </span>
      </div>
    </div>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────

interface TodayLessonCardProps {
  plan: LessonPlanPayload
  /** True while THIS topic's completion toggle is in flight. */
  pending: boolean
  onToggleCompletion: (topicId: string, completed: boolean) => void
}

export function TodayLessonCard({ plan, pending, onToggleCompletion }: TodayLessonCardProps) {
  const { today } = plan
  const topic = today.topic
  const [confettiKey, setConfettiKey] = useState(0)

  const handleComplete = (id: string) => {
    setConfettiKey((k) => k + 1)
    onToggleCompletion(id, true)
  }

  if (!topic) {
    return (
      <GlassCard hover={false} className="p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today · {formatDayHeading(today.date)}
        </p>
        <HubEmptyState
          icon={CalendarOff}
          title={today.reason ?? 'No lesson scheduled for today'}
          className="py-8"
        />
      </GlassCard>
    )
  }

  const isDone = topic.status === 'completed'

  return (
    <GlassCard hover={false} className="relative overflow-hidden p-0">
      {/* deep emerald gradient cover */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-700 to-emerald-800 px-4 py-5 text-white sm:px-6 sm:py-6 dark:from-emerald-900 dark:via-teal-900 dark:to-emerald-950">
        {/* decorative atmosphere */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-teal-300/15 blur-3xl" />

        <div className="relative flex flex-col-reverse items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Today · {formatDayHeading(today.date)}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
                {TOPIC_STATUS[topic.status].label}
              </span>
            </div>

            <span className="mt-3 inline-flex max-w-full items-center rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-50/90">
              <span className="truncate">Unit {topic.unitNo} · {topic.unitName}</span>
            </span>

            <h2 className="mt-2 font-display text-xl font-bold leading-snug tracking-tight sm:text-2xl">
              {topic.topicName}
            </h2>

            {topic.description && (
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-emerald-50/85">
                {topic.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-emerald-50/90">
                <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                {topic.periodsNeeded} periods
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-emerald-50/90">
                <CalendarRange className="h-3 w-3 shrink-0" aria-hidden="true" />
                {formatDayRange(topic.startDate, topic.endDate)}
              </span>
            </div>

            <div className="relative mt-4 flex flex-wrap items-center gap-3">
              <ConfettiBurst fireKey={confettiKey} />
              <AnimatePresence mode="wait" initial={false}>
                {isDone ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-wrap items-center gap-2.5"
                  >
                    <span className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold backdrop-blur-sm">
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Completed{topic.completedOn ? ` · ${formatDayShort(topic.completedOn)}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleCompletion(topic.id, false)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 px-3 py-2 text-xs font-semibold text-white/90 transition-colors hover:bg-white/10 disabled:opacity-60"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Undo
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="cta"
                    type="button"
                    onClick={() => handleComplete(topic.id)}
                    disabled={pending}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-emerald-800 shadow-lg shadow-emerald-950/20 transition-colors hover:bg-emerald-50 disabled:opacity-70"
                  >
                    {pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    )}
                    Mark Completed
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* session progress ring */}
          <div className={cn('flex shrink-0 items-center justify-center self-center sm:self-start')}>
            <ProgressRing pct={plan.progress.pct} />
          </div>
        </div>
      </div>

      {/* quiet footline */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border bg-muted/30 px-4 py-2 sm:px-6">
        <p className="text-[11px] font-medium text-muted-foreground">
          {plan.classLabel} · {plan.subjectName}
        </p>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {plan.progress.completed}/{plan.progress.total} topics · {plan.sourceBoard}
        </p>
      </div>
    </GlassCard>
  )
}
