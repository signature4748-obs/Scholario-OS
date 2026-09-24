'use client'

import { motion } from 'framer-motion'
import { FileText, CheckCircle2, AlertTriangle, Receipt } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { formatINR, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MyFeeItem } from '../shared/canonical'

/**
 * FeeStructure — what the balance is made of, straight from the CANONICAL
 * server fee ledger: one row per real Fee billed to this student, each
 * with its own paid / outstanding position and status. The summary
 * waterfall carries the money truth (Billed → Paid → Awaiting
 * verification → Balance due) — the same arithmetic /api/student/fees
 * applies and the Principal's Fee Management reads.
 */
export function FeeStructure({ fees, totals }: {
  fees: MyFeeItem[]
  totals: { billed: number; paid: number; pendingVerification: number; outstanding: number; overdue: number }
}) {
  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> What you&apos;re billed for
        </h3>
        <span className="text-[11px] text-muted-foreground">{fees.length} fee{fees.length === 1 ? '' : 's'} this session</span>
      </div>

      <div className="divide-y divide-border">
        {fees.map((f, i) => (
          <FeeRow key={f.id} fee={f} index={i} />
        ))}
      </div>

      {/* The money truth — one honest waterfall (canonical ledger totals) */}
      <div className="mt-4 rounded-xl border border-border bg-muted/25 p-3.5 space-y-1.5 text-xs">
        <SummaryRow label="Billed this session" value={formatINR(totals.billed)} />
        <SummaryRow label="Paid" value={formatINR(totals.paid)} tone="emerald" />
        {totals.pendingVerification > 0 && (
          <SummaryRow label="Awaiting verification (not counted as paid)" value={formatINR(totals.pendingVerification)} tone="amber" />
        )}
        <div className="border-t border-dashed border-border pt-1.5 mt-1.5">
          <SummaryRow
            label="Balance due"
            value={formatINR(totals.outstanding)}
            medium
            tone={totals.outstanding > 0 ? (totals.overdue > 0 ? 'rose' : 'amber') : 'emerald'}
          />
        </div>
      </div>
    </GlassCard>
  )
}

function FeeRow({ fee: f, index: i }: { fee: MyFeeItem; index: number }) {
  const settled = f.outstanding <= 0
  const overdue = f.status === 'OVERDUE'
  const partial = f.status === 'PARTIAL'

  const chip =
    settled ? { label: 'Paid', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
    : overdue ? { label: 'Overdue', cls: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400' }
    : partial ? { label: 'Partial', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' }
    : { label: 'Unpaid', cls: 'border-border bg-muted/50 text-muted-foreground' }

  const sub = settled
    ? f.dueDate ? `Paid in full · was due ${formatDate(f.dueDate)}` : 'Paid in full'
    : overdue
      ? f.dueDate ? `Overdue since ${formatDate(f.dueDate)}` : 'Overdue'
      : partial
        ? `${formatINR(f.paid)} of ${formatINR(f.amount)} paid${f.dueDate ? ` · due ${formatDate(f.dueDate)}` : ''}`
        : f.dueDate ? `Due ${formatDate(f.dueDate)}` : 'Due date not set'

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.04 }}
      className="flex items-center justify-between gap-3 py-2.5"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            settled && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            overdue && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
            partial && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
            !settled && !overdue && !partial && 'bg-muted text-muted-foreground',
          )}
          aria-hidden
        >
          {settled ? <CheckCircle2 className="h-3.5 w-3.5" /> : overdue || partial ? <AlertTriangle className="h-3.5 w-3.5" /> : <Receipt className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{f.title}</p>
          <p className="text-[10px] text-muted-foreground/80">{sub}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold tabular-nums">{formatINR(f.amount)}</p>
          <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-semibold', chip.cls)}>
            {chip.label}
          </span>
        </div>
        {!settled && (
          <p className={cn('text-[10px] tabular-nums', overdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400')}>
            {formatINR(f.outstanding)} due
          </p>
        )}
      </div>
    </motion.div>
  )
}

function SummaryRow({ label, value, medium, tone }: {
  label: string
  value: string
  medium?: boolean
  tone?: 'emerald' | 'amber' | 'rose'
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn('text-muted-foreground text-left', medium && 'font-semibold text-foreground')}>{label}</span>
      <span
        className={cn(
          'tabular-nums shrink-0',
          medium ? 'font-bold' : 'font-medium',
          tone === 'emerald' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'amber' && 'text-amber-600 dark:text-amber-400',
          tone === 'rose' && 'text-rose-600 dark:text-rose-400',
        )}
      >
        {value}
      </span>
    </div>
  )
}
