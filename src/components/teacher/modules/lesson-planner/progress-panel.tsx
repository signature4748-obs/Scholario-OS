'use client'

/**
 * lesson-planner/progress-panel — Curriculum Progress (LP-3 UI refinement).
 * The OVERALL percentage + bar now lives once, in the summary cards row at
 * the top of the module (the single primary progress visualization), so this
 * panel keeps only what is unique here: the per-unit breakdown — thin
 * accent bars with staggered entrance, capped by a compact header that
 * restates the completion count as plain text (context, not a second
 * indicator).
 */

import { motion } from 'framer-motion'
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
  const { progress, units } = plan

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

      {units.length > 0 ? (
        <div className="mt-3 max-h-72 divide-y divide-border/60 overflow-y-auto border-t border-border/60 pt-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25">
          {units.map((u, i) => (
            <UnitRow key={`${u.unitNo}-${u.unitName}`} unit={u} index={i} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No units configured yet.</p>
      )}
    </GlassCard>
  )
}
