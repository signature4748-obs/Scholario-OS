'use client'

import { motion } from 'framer-motion'
import { History, ArrowDownRight, XCircle } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { formatINR, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MyFeeTxn } from '../shared/canonical'

/**
 * Statement — the payments actually recorded against this student's fee
 * account, straight from the canonical FeeTransaction ledger
 * (/api/student/fees). A VERIFIED/SUCCESS transaction is final paid
 * money; PENDING_VERIFICATION / UNDER_VERIFICATION submissions carry an
 * "awaiting verification" badge (real money claims, not paid money);
 * REJECTED rows carry a destructive badge. The browser never invents a
 * status — every badge mirrors the server row.
 */
export function Statement({ transactions }: { transactions: MyFeeTxn[] }) {
  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> Payments &amp; receipts
        </h3>
        <span className="text-[11px] text-muted-foreground">{transactions.length} on the school ledger</span>
      </div>

      {transactions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-xl">
          No payments recorded yet this session.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {transactions.map((t, i) => (
            <TxnRow key={`${t.receiptNo ?? 'no-receipt'}-${t.collectedAt}-${i}`} txn={t} index={i} />
          ))}
        </div>
      )}
    </GlassCard>
  )
}

/** Payment-method display label ("CASH" → "Cash", "NET_BANKING" → "Net Banking"). */
function methodLabel(m: string | null): string {
  if (!m) return '—'
  const up = m.toUpperCase()
  if (up === 'UPI') return 'UPI'
  return up
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function TxnRow({ txn: t, index: i }: { txn: MyFeeTxn; index: number }) {
  const verified = t.status === 'SUCCESS' || t.status === 'VERIFIED'
  const awaiting = t.status === 'PENDING_VERIFICATION' || t.status === 'UNDER_VERIFICATION' || t.status === 'PENDING'
  const rejected = t.status === 'REJECTED'

  const badge = verified
    ? { label: 'Verified', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
    : awaiting
      ? { label: 'Awaiting verification', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' }
      : rejected
        ? { label: 'Rejected', cls: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400' }
        : { label: t.status ? t.status.charAt(0) + t.status.slice(1).toLowerCase().replace(/_/g, ' ') : 'Unknown', cls: 'border-border bg-muted/50 text-muted-foreground' }

  const detailParts = [
    t.receiptNo ?? 'No receipt yet',
    formatDate(t.collectedAt),
    t.collectedByName ? `Collected by ${t.collectedByName}` : null,
    t.verifiedByName ? `Verified by ${t.verifiedByName}` : null,
  ].filter(Boolean) as string[]

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.04, 0.3) }}
      className="flex items-center gap-3 py-2.5"
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          verified
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : awaiting
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : rejected
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {verified ? <ArrowDownRight className="h-4 w-4" /> : rejected ? <XCircle className="h-4 w-4" /> : <History className="h-4 w-4" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold tabular-nums">{formatINR(t.amount)}</p>
          <span className="text-[10px] text-muted-foreground">{methodLabel(t.method)}</span>
          <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-semibold', badge.cls)}>
            {badge.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {detailParts.join(' · ')}
        </p>
        {t.note && (
          <p className="text-[10px] text-muted-foreground/80 truncate">{t.note}</p>
        )}
      </div>
    </motion.div>
  )
}
