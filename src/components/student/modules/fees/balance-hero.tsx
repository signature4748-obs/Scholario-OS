'use client'

import { motion } from 'framer-motion'
import { IndianRupee, CheckCircle2, ShieldCheck, AlertTriangle, Wallet, History, CalendarClock } from 'lucide-react'
import { GlassCard, StatusBadge } from '@/components/shared/ui'
import { AnimatedCounter } from '@/components/shared/animated-counter'
import { ProgressBar } from '@/components/shared/charts'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * BalanceHero — the balance-first financial overview.
 *
 * The BALANCE DUE is the strongest number on the page (that's the question
 * a student/guardian opens Fees to answer), with the session progress as
 * its counterweight. Every figure comes from the CANONICAL server fee
 * ledger (/api/student/fees) — the same Fee + FeeTransaction rows the
 * school's finance office reads. Colour discipline:
 *   emerald = paid / settled · amber = due / awaiting · rose = overdue ·
 *   violet = action (the Pay button).
 */

/** The canonical totals slice the hero renders (see useMyServerFees). */
export interface BalanceHeroTotals {
  billed: number
  paid: number
  pendingVerification: number
  outstanding: number
  overdue: number
}

export function BalanceHero({ totals, identity, onPay, canPayOnline }: {
  totals: BalanceHeroTotals
  identity: { classLabel: string | null; studentName: string | null; admissionNo: string | null }
  onPay: () => void
  canPayOnline: boolean
}) {
  const { billed, paid, outstanding, overdue, pendingVerification } = totals
  const paidPct = billed > 0 ? Math.min(100, Math.round((paid / billed) * 100)) : 100
  // The balance number's semantic colour — due-amount amber unless the
  // account is genuinely overdue (rose) or settled (emerald).
  const balanceTone = outstanding <= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : overdue > 0
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-amber-600 dark:text-amber-400'
  const statusVariant = outstanding <= 0 ? 'success' : overdue > 0 ? 'danger' : 'warning'
  const statusLabel = outstanding <= 0 ? 'All paid' : overdue > 0 ? 'Overdue' : 'Payment due'
  const identityLine = [identity.classLabel, identity.studentName, identity.admissionNo]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' · ')

  return (
    <GlassCard className="p-4 sm:p-5 lg:p-6 relative overflow-hidden">
      <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-amber-500/10 blur-3xl" aria-hidden />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Balance Due
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {identityLine || '—'}
            </p>
          </div>
          <StatusBadge status={statusLabel} variant={statusVariant} dot />
        </div>

        <div className="mt-4 flex items-baseline gap-3 flex-wrap">
          <p className={cn('font-display text-4xl sm:text-5xl font-extrabold tabular-nums tracking-tight', balanceTone)}>
            {outstanding > 0 ? (
              <AnimatedCounter value={outstanding} format={(n) => formatINR(n)} />
            ) : (
              formatINR(0)
            )}
          </p>
          {outstanding > 0 && (
            <span className="text-sm text-muted-foreground">of {formatINR(billed)} billed</span>
          )}
        </div>

        {/* Session progress — the counterweight to the balance */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Session progress · {paid > 0 ? `${formatINR(paid)} paid` : 'no payments yet'}</span>
            <span className={cn('font-semibold', paidPct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : '')}>{paidPct}%</span>
          </div>
          <ProgressBar value={paidPct} color={paidPct >= 100 ? 'oklch(0.55 0.14 162)' : 'oklch(0.65 0.16 75)'} height={10} />
        </div>

        {/* Money submitted but not yet verified by the office is NOT paid —
            the same verification semantics the Principal applies. */}
        {pendingVerification > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 flex items-start gap-2.5">
            <History className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {formatINR(pendingVerification)} submitted and <span className="font-semibold text-amber-600 dark:text-amber-400">awaiting office verification</span> — it is not counted as paid until the school verifies it.
            </p>
          </div>
        )}

        {/* Real ledger facts — nothing fabricated */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Paid so far
            </p>
            <p className="font-display text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatINR(paid)}
            </p>
            <p className="text-[10px] text-muted-foreground/80 mt-0.5">
              of {formatINR(billed)} billed this session
            </p>
          </div>
          {overdue > 0 ? (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400" /> Overdue now
              </p>
              <p className="font-display text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                {formatINR(overdue)}
              </p>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                Past its due date — please clear at the earliest
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card/40 p-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="h-3 w-3 text-muted-foreground" /> Overdue
              </p>
              <p className="font-display text-lg font-bold mt-0.5 text-muted-foreground">Nothing overdue</p>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                {outstanding > 0 ? 'Current dues are within their due dates' : 'Your account is fully settled'}
              </p>
            </div>
          )}
        </div>

        {outstanding > 0 && (
          <motion.div layout className="mt-5">
            {canPayOnline ? (
              <Button
                onClick={onPay}
                className="w-full h-11 gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md"
              >
                <Wallet className="h-4 w-4" /> Pay {formatINR(outstanding)} Online
              </Button>
            ) : (
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  To settle this balance, please contact the school office — online payment isn&apos;t available right now.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </GlassCard>
  )
}
