'use client'

/**
 * NextUp — the dashboard's "what should I do next" focus, derived ENTIRELY
 * from the real timetable (period states re-derived from the device clock
 * every 30s; the aggregate supplies today's periods + the next teaching
 * day). Three honest states:
 *
 *   NOW      a period is currently running — subject, class, room, a live
 *            "ends 10:15 AM" line and an "Open lesson" entry;
 *   NEXT UP  the next period later today — time, subject, class, room,
 *            with an "Open timetable" entry;
 *   DONE     no more periods today — the next teaching day + its first
 *            period, or a calm free-day line when the week is empty.
 *
 * Rendered inside the hero card (right rail on md+, below the greeting on
 * mobile) — never a floating widget with invented schedule data.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Clock, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatTime,
  periodsWithState,
  toMinutes,
} from './hooks/use-teacher-dashboard'
import type { TeacherDashboardData } from './types'

interface NextUpProps {
  data: TeacherDashboardData
  now: Date
  onNavigate: (key: string) => void
}

export function NextUp({ data, now, onNavigate }: NextUpProps) {
  const reduce = useReducedMotion()
  const periods = periodsWithState(data.today.periods, now)
  const current = periods.find((p) => p.state === 'current')
  const upcoming = periods.find((p) => p.state === 'upcoming')

  // ── NOW ───────────────────────────────────────────────────────────
  if (current) {
    const end = toMinutes(current.endTime)
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const endsLabel =
      end != null
        ? end > nowMins
          ? `ends ${formatTime(current.endTime)}`
          : 'wrapping up'
        : null
    return (
      <Panel
        reduce={reduce}
        tone="now"
        eyebrow={
          <>
            <PulseDot reduce={reduce} />
            <span>Now · Period {current.period}</span>
          </>
        }
        title={current.subjectName}
        meta={
          <>
            <span className="truncate">{current.classLabel}</span>
            <Dot />
            <span className="inline-flex shrink-0 items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              {current.room ?? '—'}
            </span>
          </>
        }
        foot={endsLabel}
        actionLabel="Open lesson"
        onAction={() => onNavigate('lesson-planner')}
      />
    )
  }

  // ── NEXT UP ───────────────────────────────────────────────────────
  if (upcoming) {
    const start = toMinutes(upcoming.startTime)
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const inLabel =
      start != null && start > nowMins
        ? `in ${start - nowMins} min`
        : null
    return (
      <Panel
        reduce={reduce}
        tone="next"
        eyebrow={<span>Next up · Period {upcoming.period}</span>}
        time={formatTime(upcoming.startTime)}
        title={upcoming.subjectName}
        meta={
          <>
            <span className="truncate">{upcoming.classLabel}</span>
            <Dot />
            <span className="inline-flex shrink-0 items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              {upcoming.room ?? '—'}
            </span>
          </>
        }
        foot={inLabel}
        actionLabel="Open timetable"
        onAction={() => onNavigate('my-timetable')}
      />
    )
  }

  // ── NO MORE PERIODS TODAY ─────────────────────────────────────────
  const nd = data.nextDay
  if (periods.length > 0 || nd) {
    return (
      <Panel
        reduce={reduce}
        tone="done"
        eyebrow={<span>Today&rsquo;s teaching</span>}
        title={nd ? 'No more periods today' : 'No teaching periods today'}
        meta={
          nd ? (
            <span className="truncate">
              Next: {nd.weekday} · {formatTime(nd.period.startTime)}
              <span className="text-muted-foreground"> — {nd.period.subjectName}, {nd.period.classLabel}</span>
            </span>
          ) : (
            <span>Nothing else scheduled for {data.today.weekday}.</span>
          )
        }
        actionLabel="Open timetable"
        onAction={() => onNavigate('my-timetable')}
        actionQuiet
      />
    )
  }

  // No timetable at all — the schedule card's empty state covers this;
  // keep a single calm line so the hero rail never looks broken.
  return (
    <Panel
      reduce={reduce}
      tone="done"
      eyebrow={<span>Today&rsquo;s teaching</span>}
      title="No classes scheduled"
      meta={<span>Your timetable has no teaching periods for {data.today.weekday}.</span>}
    />
  )
}

// ─── pieces ─────────────────────────────────────────────────────────

type PanelTone = 'now' | 'next' | 'done'

const TONE: Record<PanelTone, { wrap: string; eyebrow: string; time: string }> = {
  now: {
    wrap: 'border-emerald-500/30 bg-emerald-500/[0.05]',
    eyebrow: 'text-emerald-700 dark:text-emerald-400',
    time: 'text-emerald-700 dark:text-emerald-400',
  },
  next: {
    wrap: 'border-border bg-background/70',
    eyebrow: 'text-muted-foreground',
    time: 'text-foreground',
  },
  done: {
    wrap: 'border-border/70 bg-muted/20',
    eyebrow: 'text-muted-foreground',
    time: 'text-foreground',
  },
}

function Panel({
  reduce,
  tone,
  eyebrow,
  time,
  title,
  meta,
  foot,
  actionLabel,
  onAction,
  actionQuiet,
}: {
  reduce: boolean | null
  tone: PanelTone
  eyebrow: React.ReactNode
  /** optional large time headline (NEXT UP state) */
  time?: string
  title: string
  meta: React.ReactNode
  foot?: string | null
  actionLabel?: string
  onAction?: () => void
  actionQuiet?: boolean
}) {
  const t = TONE[tone]
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex h-full min-w-0 flex-col justify-between gap-3 rounded-xl border p-4',
        t.wrap,
      )}
      aria-label="Next up"
    >
      <div className="min-w-0">
        <p className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider', t.eyebrow)}>
          {eyebrow}
        </p>
        {time && (
          <p className={cn('mt-1.5 font-display text-xl font-bold leading-none tabular-nums', t.time)}>
            {time}
          </p>
        )}
        <p className="mt-1.5 truncate font-display text-sm font-bold tracking-tight">{title}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[11px] text-muted-foreground">
          {meta}
        </p>
        {foot && (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden /> {foot}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={cn(
            'group inline-flex w-fit min-h-[32px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            actionQuiet
              ? 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              : tone === 'now'
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent/60',
          )}
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </button>
      )}
    </motion.div>
  )
}

/** The soft live dot for the NOW state — one gentle pulse, no strobe. */
function PulseDot({ reduce }: { reduce: boolean | null }) {
  if (reduce) return <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
  return (
    <span className="relative flex h-1.5 w-1.5" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none [animation-duration:2s]" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
    </span>
  )
}

function Dot() {
  return <span className="shrink-0 text-muted-foreground/50" aria-hidden>·</span>
}
