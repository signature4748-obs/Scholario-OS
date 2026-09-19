'use client'

/**
 * lesson-planner/progress-panel — Curriculum Progress (LP-2 polish). One
 * honest overall line ("20 of 32 topics · 63%") with a spring-animated
 * emerald bar, a compact stats row (topics left, pace, teaching days) and
 * thin per-unit progress rows in each unit's accent colour with staggered
 * entrance. Linear bars only — per the module spec.
 */

import { motion } from 'framer-motion'
import { CalendarCheck, Clock3, ListTodo } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { cn } from '@/lib/utils'
import type { LessonPlanPayload, UnitProgress } from './api'
import { AnimatedBar, unitAccent } from './shared'

function UnitRow({ unit, index }: { unit: UnitProgress; index: number }) {
  const pct = unit.total > 0 ? Math.round((unit.completed / unit.total) * 100) : 0
  const accent = unitAccent(unit.unitNo)
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.08 + index * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="py-2.5 first:pt-0 last:pb-0"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium" title={`Unit ${unit.unitNo} · ${unit.unitName}`}>
          <span
            className={cn(
              'mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold tabular-nums',
              accent.chip,
            )}
            aria-hidden="true"
          >
            {unit.unitNo}
          </span>
          {unit.unitName}
        </p>
        <p className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
          {unit.completed}/{unit.total}
        </p>
      </div>
      <div className="mt-1.5">
        <AnimatedBar
          pct={pct}
          className="h-1.5"
          barClassName={accent.bar}
          delay={0.12 + index * 0.05}
          ariaLabel={`Unit ${unit.unitNo} · ${unit.unitName}`}
        />
      </div>
    </motion.div>
  )
}

export function ProgressPanel({ plan }: { plan: LessonPlanPayload }) {
  const { progress, units, pace } = plan
  const remaining = Math.max(0, progress.total - progress.completed)

  const stats: [icon: typeof ListTodo, label: string, value: string][] = [
    [ListTodo, 'Topics left', `${remaining}`],
    [Clock3, 'Pace', `${pace.periodsPerWeek || 0} p/w`],
    [CalendarCheck, 'Teaching', `${pace.teachingDaysPerWeek} d/w`],
  ]

  return (
    <GlassCard hover={false} className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Curriculum Progress
        </p>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {progress.completed} of {progress.total} topics
        </p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <motion.p
          key={progress.pct}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="font-display text-2xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400"
        >
          {progress.pct}%
        </motion.p>
        <AnimatedBar
          pct={progress.pct}
          className="h-2 min-w-0 flex-1"
          ariaLabel={`${plan.subjectName} curriculum completion`}
        />
      </div>

      {/* stats row */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {stats.map(([Icon, label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-border/70 bg-muted/30 px-2.5 py-2"
          >
            <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
              {label}
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      {units.length > 0 ? (
        <div className="mt-4 max-h-72 divide-y divide-border/60 overflow-y-auto border-t border-border/60 pt-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25">
          {units.map((u, i) => (
            <UnitRow key={`${u.unitNo}-${u.unitName}`} unit={u} index={i} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">No units configured yet.</p>
      )}
    </GlassCard>
  )
}
