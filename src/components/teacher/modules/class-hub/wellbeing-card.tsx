'use client'

/**
 * class-hub/wellbeing-card — the class's behavior picture from the
 * canonical BehaviorRecord rows: open concerns, students under
 * monitoring, and recent positives (the balance matters). Zeroes are
 * good news and render as such.
 */

import { motion } from 'framer-motion'
import { HeartHandshake, ShieldAlert, ShieldCheck, Eye } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { cn } from '@/lib/utils'
import type { ClassHubClass } from './types'

export function WellbeingCard({
  cls,
  onNavigate,
}: {
  cls: ClassHubClass
  onNavigate: (key: string) => void
}) {
  const b = cls.behavior
  const tiles = [
    {
      key: 'concerns',
      label: 'Open concerns',
      value: b.openConcerns,
      icon: ShieldAlert,
      tone: b.openConcerns > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
      bg: b.openConcerns > 0 ? 'bg-rose-500/[0.06]' : 'bg-muted/40',
    },
    {
      key: 'monitoring',
      label: 'Monitoring',
      value: b.monitoring,
      icon: Eye,
      tone: b.monitoring > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
      bg: b.monitoring > 0 ? 'bg-amber-500/[0.06]' : 'bg-muted/40',
    },
    {
      key: 'positive',
      label: 'Positives (30d)',
      value: b.recentPositive,
      icon: ShieldCheck,
      tone: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/[0.06]',
    },
  ]

  return (
    <GlassCard hover={false} className="p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <HeartHandshake className="h-4 w-4 text-rose-400" aria-hidden="true" />
          Class Wellbeing
        </h3>
        <span className="text-[10px] text-muted-foreground">behavior records</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t, i) => {
          const Icon = t.icon
          return (
            <motion.div
              key={t.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className={cn('rounded-xl border border-border px-1.5 py-2.5 text-center', t.bg)}
            >
              <Icon className={cn('mx-auto mb-1 h-4 w-4', t.tone)} aria-hidden="true" />
              <p className={cn('font-display text-xl font-bold tabular-nums', t.tone)}>{t.value}</p>
              <p className="text-[10px] leading-tight text-muted-foreground">{t.label}</p>
            </motion.div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => onNavigate('behavior')}
        className="mt-3 inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Open Student Behavior
      </button>
    </GlassCard>
  )
}
