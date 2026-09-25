'use client'

/**
 * class-hub/growth-card — the class's growth picture (§14): the average
 * growth score plus improving / steady / needs-attention counts, from the
 * SAME canonical growthScoresFor derivation the Student Growth module
 * renders. Compact by design — My Class stays an overview hub, not an
 * analytics dashboard. "View Growth" hands off to the Student Growth
 * module with this class preselected (focus-store).
 */

import { motion } from 'framer-motion'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { useFocusStore } from '@/lib/store/focus-store'
import { cn } from '@/lib/utils'
import type { ClassHubClass } from './types'

export function GrowthCard({
  cls,
  onNavigate,
}: {
  cls: ClassHubClass
  onNavigate: (key: string) => void
}) {
  const g = cls.growth

  const openGrowth = () => {
    useFocusStore.getState().setFocus({
      type: 'growth-class',
      id: cls.classId,
      title: cls.label,
      moduleKey: 'growth',
    })
    onNavigate('growth')
  }

  return (
    <GlassCard hover={false} className="p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          Class Growth
        </h3>
        <span className="text-[10px] text-muted-foreground">growth scores</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center">
          <p
            className={cn(
              'font-display text-2xl font-bold leading-none tabular-nums',
              g.average == null
                ? 'text-muted-foreground/60'
                : g.average >= 75
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : g.average >= 55
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400',
            )}
          >
            {g.average ?? '—'}
          </p>
          <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            average
          </p>
          {g.scoredCount < cls.studentCount && (
            <p className="mt-1 text-[9px] font-semibold tabular-nums text-muted-foreground/80">
              {g.scoredCount} of {cls.studentCount}
            </p>
          )}
        </div>
        <div className="grid flex-1 grid-cols-3 gap-2">
          <BandTile i={0} glyph="↑" tone="emerald" label="Improving" value={g.improving} />
          <BandTile i={1} glyph="→" tone="sky" label="Steady" value={g.steady} />
          <BandTile
            i={2}
            glyph="↓"
            tone={g.needsAttention > 0 ? 'amber' : 'muted'}
            label="Attention"
            value={g.needsAttention}
          />
        </div>
      </div>

      {g.building > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground/70">
          {g.building} still building — not enough records yet
        </p>
      )}
      {g.building === 0 && g.scoredCount > 0 && g.scoredCount === cls.studentCount && (
        <p className="mt-2 text-[10px] text-muted-foreground/70">All {cls.studentCount} students scored</p>
      )}

      <button
        type="button"
        onClick={openGrowth}
        className="mt-3 inline-flex min-h-[34px] w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        View Growth
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </GlassCard>
  )
}

function BandTile({
  i,
  glyph,
  tone,
  label,
  value,
}: {
  i: number
  glyph: string
  tone: 'emerald' | 'sky' | 'amber' | 'muted'
  label: string
  value: number
}) {
  const tones = {
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.06]',
    sky: 'text-sky-600 dark:text-sky-400 bg-sky-500/[0.06]',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/[0.07]',
    muted: 'text-muted-foreground bg-muted/40',
  } as const
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05, duration: 0.3 }}
      className={cn('rounded-xl border border-border px-1.5 py-2.5 text-center', tones[tone])}
    >
      <p className="font-display text-lg font-bold leading-none tabular-nums">
        <span aria-hidden="true" className="mr-0.5 text-xs">{glyph}</span>
        {value}
      </p>
      <p className="mt-1 text-[10px] leading-tight opacity-80">{label}</p>
    </motion.div>
  )
}
