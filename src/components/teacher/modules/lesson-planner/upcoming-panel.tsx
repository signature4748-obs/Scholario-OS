'use client'

/**
 * lesson-planner/upcoming-panel — the right rail (LP-2 polish). "Upcoming"
 * lists the next scheduled topics (server-capped at 5, today included) as
 * date-tile rows: a day-number tile with month, the topic name and its
 * unit/periods meta; today's tile is amber with a pulse. Below it,
 * "Schedule basis" states where the dates come from as quiet chips: syllabus
 * board, session anchor, and the class timetable pace.
 */

import { motion } from 'framer-motion'
import { CalendarCheck, CalendarDays, GraduationCap, Route } from 'lucide-react'
import { format } from 'date-fns'
import { GlassCard } from '@/components/shared/ui'
import { HubEmptyState } from '@/components/teacher/modules/shared/hub-stat-cards'
import { cn } from '@/lib/utils'
import type { LessonPlanPayload, ScheduledTopic } from './api'
import { LIST_ITEM, LIST_STAGGER } from './shared'
import { formatDayLong, formatDayRange, parseDayKey } from './shared'

function DateTile({ topic }: { topic: ScheduledTopic }) {
  const isToday = topic.status === 'today'
  const d = parseDayKey(topic.startDate)
  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border leading-none',
        isToday
          ? 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400'
          : 'border-border bg-muted/50 text-muted-foreground',
      )}
      aria-hidden="true"
    >
      {d ? (
        <>
          <span className={cn('text-[13px] font-bold tabular-nums', isToday && 'text-amber-800 dark:text-amber-300')}>
            {d.getDate()}
          </span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">
            {format(d, 'MMM')}
          </span>
        </>
      ) : (
        <span className="text-[10px]">—</span>
      )}
    </span>
  )
}

export function UpcomingPanel({ plan }: { plan: LessonPlanPayload }) {
  const items = plan.nextUp

  return (
    <GlassCard hover={false} className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          Upcoming
        </p>
        <p className="text-[11px] tabular-nums text-muted-foreground">next {items.length}</p>
      </div>

      {items.length === 0 ? (
        <HubEmptyState
          icon={CalendarCheck}
          title="Nothing scheduled ahead"
          hint="Every topic in this curriculum is complete."
          className="py-8"
        />
      ) : (
        <motion.div
          variants={LIST_STAGGER}
          initial="hidden"
          animate="show"
          className="divide-y divide-border/60"
        >
          {items.map((topic) => {
            const isToday = topic.status === 'today'
            return (
              <motion.div
                key={topic.id}
                variants={LIST_ITEM}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5',
                  isToday && 'bg-amber-500/5',
                )}
              >
                <DateTile topic={topic} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={topic.topicName}>
                    {topic.topicName}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span
                      className={cn(
                        'font-medium tabular-nums',
                        isToday && 'font-semibold text-amber-700 dark:text-amber-400',
                      )}
                    >
                      {isToday ? 'Today' : formatDayRange(topic.startDate, topic.endDate)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">Unit {topic.unitNo}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{topic.periodsNeeded} periods</span>
                  </p>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </GlassCard>
  )
}

export function ScheduleBasisCard({ plan }: { plan: LessonPlanPayload }) {
  const { pace, sourceBoard, sessionStart } = plan
  const rows: [label: string, value: string][] = [
    ['Syllabus', sourceBoard],
    ['Session from', formatDayLong(sessionStart)],
    ['Pace', `${pace.periodsPerWeek} periods / week · ${pace.periodMinutes} min`],
    ['Teaching days', `${pace.teachingDaysPerWeek} days / week`],
  ]

  return (
    <GlassCard hover={false} className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Route className="h-3.5 w-3.5" aria-hidden="true" />
        Schedule basis
      </p>
      <dl className="mt-2.5 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-[11px] text-muted-foreground">{label}</dt>
            <dd className="min-w-0 truncate text-right text-xs font-medium" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 flex items-start gap-1.5 border-t border-border/60 pt-2.5 text-[10px] leading-relaxed text-muted-foreground/80">
        <GraduationCap className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
        Dates follow the class timetable and school holidays. Marking topics complete keeps the
        plan on pace.
      </p>
    </GlassCard>
  )
}
