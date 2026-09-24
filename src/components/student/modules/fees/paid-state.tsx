'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Receipt, Lock } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { formatINR } from '@/lib/format'

/**
 * AllPaidState — the honest celebratory empty state. Rendered ONLY when
 * the CANONICAL server ledger computes a zero outstanding balance with a
 * non-zero billed total (outstanding ≤ 0 && billed > 0) — never for a
 * student who simply has no fee records yet (that is the honest
 * "No fee records yet" empty state in index.tsx).
 */
export function AllPaidState({ billed, latestReceiptNo }: {
  billed: number
  latestReceiptNo: string | null
}) {
  return (
    <GlassCard className="p-6 sm:p-8 relative overflow-hidden">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
      <div className="relative flex flex-col items-center text-center py-4">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/25"
        >
          <CheckCircle2 className="h-7 w-7" />
        </motion.div>
        <h3 className="mt-4 font-display text-xl font-bold text-foreground">All fees paid</h3>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm leading-relaxed">
          Your full session obligation of {formatINR(billed)} is settled — nothing outstanding, nothing due.
        </p>
        {latestReceiptNo && (
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" aria-hidden /> Latest receipt · {latestReceiptNo}
          </span>
        )}
      </div>
    </GlassCard>
  )
}

/**
 * OnlineUnavailableCard — online rails are off (platform policy for this
 * school, or no payment gateway configured server-side). The balance is
 * still visible; the path forward is the school office.
 */
export function OnlineUnavailableCard({ outstanding }: { outstanding: number }) {
  return (
    <GlassCard className="p-4 border-border">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground border border-border" aria-hidden>
          <Lock className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-[240px]">
          <h3 className="text-sm font-semibold text-foreground">Online payment isn&apos;t available</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xl leading-relaxed">
            Please contact the school office to pay by cash or other offline methods.
          </p>
        </div>
        <div className="shrink-0 rounded-lg bg-muted/40 border border-border px-3 py-1.5 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</p>
          <p className="text-sm font-bold tabular-nums">{formatINR(outstanding)}</p>
        </div>
      </div>
    </GlassCard>
  )
}
