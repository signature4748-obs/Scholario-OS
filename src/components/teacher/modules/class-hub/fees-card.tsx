'use client'

/**
 * class-hub/fees-card — the class teacher's fee collection picture: a
 * spring collection bar, honest counts (fully paid / pending / overdue)
 * and the defaulters list (overdue first, amounts + guardian phone),
 * thin-scroll capped at ~11 rows.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Phone, Wallet } from 'lucide-react'
import { GlassCard, GradientAvatar } from '@/components/shared/ui'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ClassHubClass } from './types'

const THIN_SCROLLBAR =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent'

export function FeesCard({ cls }: { cls: ClassHubClass }) {
  const reduce = useReducedMotion()
  const fees = cls.fees
  const collectedPct =
    fees.totalBilled > 0 ? Math.round((fees.totalCollected / fees.totalBilled) * 100) : null

  return (
    <GlassCard hover={false} className="p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Wallet className="h-4 w-4 text-amber-500" aria-hidden="true" />
          Fee Collection
        </h3>
        <span className="text-[10px] text-muted-foreground">Class teacher&rsquo;s view</span>
      </div>

      {fees.totalBilled === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          No fee records for this class yet.
        </p>
      ) : (
        <>
          {/* collection bar + totals */}
          <div>
            <div className="mb-1.5 flex items-end justify-between gap-2">
              <p className="font-display text-2xl font-bold tabular-nums text-foreground">
                {collectedPct != null ? `${collectedPct}%` : '—'}
                <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">collected</span>
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {formatINR(fees.totalCollected, true)} of {formatINR(fees.totalBilled, true)}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={collectedPct ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Fee collection progress">
              <motion.div
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${collectedPct ?? 0}%` }}
                transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.15 }}
                className={cn(
                  'h-full rounded-full',
                  (collectedPct ?? 0) >= 85
                    ? 'bg-emerald-500'
                    : (collectedPct ?? 0) >= 60
                      ? 'bg-amber-500'
                      : 'bg-rose-500',
                )}
              />
            </div>
          </div>

          {/* counts */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/40 px-1.5 py-2">
              <p className="flex items-center justify-center gap-1 font-display text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> {fees.fullyPaidStudents}
              </p>
              <p className="text-[10px] text-muted-foreground">fully paid</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-1.5 py-2">
              <p className="font-display text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {fees.studentsWithFees - fees.fullyPaidStudents - fees.overdueStudents}
              </p>
              <p className="text-[10px] text-muted-foreground">pending</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-1.5 py-2">
              <p className="flex items-center justify-center gap-1 font-display text-base font-bold tabular-nums text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {fees.overdueStudents}
              </p>
              <p className="text-[10px] text-muted-foreground">overdue</p>
            </div>
          </div>

          {/* defaulters */}
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {fees.outstanding > 0
                ? `Outstanding ${formatINR(fees.outstanding, true)} — follow up with`
                : 'Everyone is up to date'}
            </p>
            {fees.defaulters.length === 0 ? (
              <p className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/[0.04] px-3 py-2.5 text-xs text-muted-foreground">
                No outstanding fees in this class. 🎉
              </p>
            ) : (
              <div className={cn('max-h-[236px] space-y-1.5 overflow-y-auto pr-1 -mr-1', THIN_SCROLLBAR)} aria-label="Students with outstanding fees">
                {fees.defaulters.map((d, i) => (
                  <motion.div
                    key={d.studentId}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.25 }}
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-card/50 px-2.5 py-2"
                  >
                    <GradientAvatar name={d.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">
                        {d.name}
                        {d.rollNo && <span className="ml-1 font-normal text-muted-foreground">· Roll {d.rollNo}</span>}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {d.guardianPhone ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Phone className="h-2.5 w-2.5" aria-hidden="true" /> {d.guardianPhone}
                          </span>
                        ) : (
                          'Guardian phone not recorded'
                        )}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                        d.hasOverdue
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {formatINR(d.outstanding, true)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </GlassCard>
  )
}
