'use client'

/**
 * QuickActions (v2) — the role-aware, context-aware shortcut grid.
 *
 *   • My Class appears ONLY for appointed class teachers;
 *   • when a class-attendance baseline is still open, Mark Attendance
 *     moves to the front and carries a quiet amber emphasis — the most
 *     time-critical action of a class teacher's day;
 *   • Message Parents shows the live unread badge from the aggregate;
 *   • Enter Marks shows a draft badge while marks entries sit in DRAFT;
 *   • every tile is a real navigation target that exists for the role.
 *
 * Tiles use the SCHOLARIO tone language (500/10 icon chip, quiet border)
 * — no loud gradients; one amber emphasis at a time, only when honest.
 */

import { motion, useReducedMotion } from 'framer-motion'
import {
  CalendarCheck, BookMarked, FileText, Megaphone,
  TrendingUp, Users, School, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/shared/ui'

type Tone = 'amber' | 'emerald' | 'rose' | 'sky' | 'violet' | 'teal'

const TONE: Record<Tone, { chip: string; emphasis?: string }> = {
  amber: { chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  emerald: { chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  rose: { chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  sky: { chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  violet: { chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  teal: { chip: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
}

interface ActionDef {
  key: string
  label: string
  icon: React.ReactNode
  tone: Tone
  /** numeric badge (rendered only when > 0) */
  badge?: number
  /** the one honest emphasis — the action the day is asking for */
  emphasized?: boolean
}

interface QuickActionsProps {
  onNavigate: (key: string) => void
  /** true only for appointed class teachers (surfaces the My Class tile) */
  isClassTeacher?: boolean
  /** open class-attendance baselines today — lifts Mark Attendance */
  unmarkedAttendance?: number
  /** live unread parent/staff messages — badges Message Parents */
  unreadMessages?: number
  /** marks entries sitting in DRAFT — badges Enter Marks */
  marksPending?: number
  /** false for a CT-only teacher with no teaching subjects — hides the
   *  lesson/marks shortcuts (their modules honestly have nothing to show) */
  hasAssignments?: boolean
}

export function QuickActions({
  onNavigate,
  isClassTeacher = false,
  unmarkedAttendance = 0,
  unreadMessages = 0,
  marksPending = 0,
  hasAssignments = true,
}: QuickActionsProps) {
  const base: ActionDef[] = []

  if (isClassTeacher) {
    base.push({
      key: 'class-hub',
      label: 'My Class',
      icon: <School className="h-4 w-4" aria-hidden />,
      tone: 'teal',
    })
  }

  base.push(
    {
      key: 'attendance',
      label: 'Mark Attendance',
      icon: <CalendarCheck className="h-4 w-4" aria-hidden />,
      tone: 'amber',
      badge: unmarkedAttendance,
      // the open baseline is the day's most time-critical action — lift it
      emphasized: unmarkedAttendance > 0,
    },
  )

  if (hasAssignments) {
    base.push(
      {
        key: 'lesson-planner',
        label: "Today's Lesson",
        icon: <BookMarked className="h-4 w-4" aria-hidden />,
        tone: 'emerald',
      },
      {
        key: 'marks',
        label: 'Enter Marks',
        icon: <FileText className="h-4 w-4" aria-hidden />,
        tone: 'rose',
        badge: marksPending,
      },
    )
  }

  base.push(
    {
      key: 'communication',
      label: 'Message Parents',
      icon: <Megaphone className="h-4 w-4" aria-hidden />,
      tone: 'sky',
      badge: unreadMessages,
    },
    {
      key: 'growth',
      label: 'Student Growth',
      icon: <TrendingUp className="h-4 w-4" aria-hidden />,
      tone: 'emerald',
    },
    {
      key: 'students',
      label: 'Student Directory',
      icon: <Users className="h-4 w-4" aria-hidden />,
      tone: 'violet',
    },
  )

  // Contextual ordering — an emphasized action moves to the very front.
  const actions = unmarkedAttendance > 0
    ? [...base.filter((a) => a.emphasized), ...base.filter((a) => !a.emphasized)]
    : base

  const reduce = useReducedMotion()

  return (
    <GlassCard className="p-3.5 sm:p-4 lg:p-5">
      <h3 className="mb-3.5 flex items-center gap-2 font-display text-sm font-bold tracking-tight">
        <Sparkles className="h-4 w-4 text-amber-500" aria-hidden /> Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((a, i) => {
          const tone = TONE[a.tone]
          // An odd count would strand the last tile — let it span the full
          // row so the grid always closes cleanly (7 → 2·2·2·1-wide).
          const isLastAlone = i === actions.length - 1 && actions.length % 2 === 1
          return (
            <motion.button
              key={a.key}
              type="button"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.25), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              whileHover={reduce ? undefined : { y: -2 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              onClick={() => onNavigate(a.key)}
              aria-label={a.badge && a.badge > 0 ? `${a.label} — ${a.badge} pending` : a.label}
              className={cn(
                'group relative flex min-h-[76px] flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isLastAlone && 'col-span-2',
                a.emphasized
                  ? 'border-amber-500/40 bg-amber-500/[0.06] hover:border-amber-500/60'
                  : 'border-border bg-card/50 hover:border-primary/30 hover:bg-accent/40',
              )}
            >
              {(a.badge ?? 0) > 0 && (
                <span
                  className={cn(
                    'absolute right-2.5 top-2.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums',
                    a.emphasized
                      ? 'bg-amber-500 text-white'
                      : 'bg-primary text-primary-foreground',
                  )}
                  aria-hidden
                >
                  {a.badge}
                </span>
              )}
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100', tone.chip)}>
                {a.icon}
              </span>
              <span className="pr-1 text-xs font-medium leading-tight">{a.label}</span>
            </motion.button>
          )
        })}
      </div>
    </GlassCard>
  )
}
