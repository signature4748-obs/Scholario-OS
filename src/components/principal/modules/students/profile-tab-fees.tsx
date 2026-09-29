'use client'

import { useState } from 'react'
import { AlertTriangle, BookOpen, Bus, Clock3, IndianRupee, Receipt, TrendingUp } from 'lucide-react'
import { StatusBadge } from '@/components/shared/ui'
import { FeeReceiptViewer } from '@/components/shared/fee-collection/receipt-viewer'
import { Button } from '@/components/ui/button'
import { formatINR, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StudentRecord } from '@/lib/store/students-store'
import type { StudentProfileRealData } from './profile-real-data'
import { Metric, Section, InfoRow } from './shared'

type Props = { student: StudentRecord; real?: StudentProfileRealData }

const REAL_STATUS_META: Record<string, { label: string; chip: string }> = {
  PAID: { label: 'Fees clear', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  PARTIAL: { label: 'Partially paid', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  UNPAID: { label: 'Unpaid', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  OVERDUE: { label: 'Overdue', chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  NONE: { label: 'No fees', chip: 'bg-muted text-muted-foreground' },
}

export function FeesTab({ student, real }: Props) {
  // ── Class-teacher view: REAL fee lines + canonical payment records
  // (the server sends these only for the teacher's own class). ──────────
  if (real) {
    const fees = real.fees
    if (!fees || fees.status === 'NONE' || (fees.items.length === 0 && fees.payments.length === 0)) {
      return (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No fee records for this student.</p>
        </div>
      )
    }
    return <RealFees fees={fees} />
  }

  // ── Principal store view ──────────────────────────────────────────────
  // Nothing billed yet (fresh admission) renders an honest empty state —
  // no fabricated ₹0 "Pending" ledger.
  if (student.feeTotal === 0 && student.feePaid === 0) {
    return (
      <div className="py-8 text-center">
        <IndianRupee className="mx-auto h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted-foreground">No fee records for this student yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">Fee lines appear once a fee structure is assigned to their class.</p>
      </div>
    )
  }
  const balance = student.feeTotal - student.feePaid
  const feePct = student.feeTotal > 0 ? Math.round((student.feePaid / student.feeTotal) * 100) : 0
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Metric icon={<IndianRupee className="h-3.5 w-3.5" />} label="Total" value={formatINR(student.feeTotal, true)} color="text-violet-600 dark:text-violet-400" />
        <Metric icon={<TrendingUp className="h-3.5 w-3.5" />} label="Paid" value={formatINR(student.feePaid, true)} color="text-emerald-600 dark:text-emerald-400" />
        <Metric icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Balance" value={formatINR(balance, true)} color="text-rose-600 dark:text-rose-400" />
      </div>
      <Section title="Payment Status">
        <div className="rounded-lg border border-border bg-card/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Total: {formatINR(student.feeTotal, true)}</span>
            {student.feeStatus === 'Paid' ? <StatusBadge status="Fully Paid" variant="success" dot /> : student.feeStatus === 'Partial' ? <StatusBadge status="Partial" variant="warning" dot /> : <StatusBadge status="Pending" variant="danger" dot />}
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full', student.feeStatus === 'Paid' ? 'bg-emerald-500' : student.feeStatus === 'Partial' ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${feePct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400">Paid {formatINR(student.feePaid, true)}</span>
            <span className="text-rose-600 dark:text-rose-400">Due {formatINR(balance, true)}</span>
          </div>
        </div>
      </Section>
      <Section title="Additional">
        <div className="grid grid-cols-2 gap-2">
          <InfoRow icon={<Bus className="h-3.5 w-3.5" />} label="Transport" value={student.transport ? 'Yes' : 'Not opted'} />
          <InfoRow icon={<BookOpen className="h-3.5 w-3.5" />} label="Admission" value={formatDate(student.admissionDate)} />
        </div>
      </Section>
    </div>
  )
}

// ─── Class-teacher fee picture (real records) ─────────────────────────────

function RealFees({ fees }: { fees: NonNullable<StudentProfileRealData['fees']> }) {
  const [receiptTxnId, setReceiptTxnId] = useState<string | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const status = REAL_STATUS_META[fees.status] ?? REAL_STATUS_META.NONE

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold">{fees.items.length} fee line{fees.items.length === 1 ? '' : 's'} on record</p>
          <p className="text-[10px] text-muted-foreground">
            {fees.lastPaymentAt ? `Last payment ${formatDate(fees.lastPaymentAt.slice(0, 10))}` : 'No payments recorded yet'}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold', status.chip)}>
          {status.label}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Metric icon={<IndianRupee className="h-3.5 w-3.5" />} label="Billed" value={formatINR(fees.totalBilled, true)} color="text-violet-600 dark:text-violet-400" />
        <Metric icon={<TrendingUp className="h-3.5 w-3.5" />} label="Paid" value={formatINR(fees.totalPaid, true)} color="text-emerald-600 dark:text-emerald-400" />
        <Metric icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Outstanding" value={formatINR(fees.outstanding, true)} color={fees.outstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'} />
      </div>
      {fees.awaitingVerification > 0 && (
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[11px] font-medium text-amber-800 dark:text-amber-300">
          <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
          {formatINR(fees.awaitingVerification, true)} collected — awaiting the Principal&apos;s verification (not counted in the balance)
        </p>
      )}
      {fees.items.length > 0 && (
        <Section title="Fee Lines">
          <div className="space-y-1.5 rounded-lg border border-border bg-card/40 p-3">
            {fees.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatINR(item.paid, true)} / {formatINR(item.amount, true)}
                </span>
                <span className={cn(
                  'w-[74px] shrink-0 rounded-full px-2 py-0.5 text-right text-[10px] font-semibold',
                  (REAL_STATUS_META[item.status] ?? REAL_STATUS_META.NONE).chip,
                )}>
                  {(REAL_STATUS_META[item.status] ?? REAL_STATUS_META.NONE).label}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
      {fees.payments.length > 0 && (
        <Section title="Recent Payments">
          <div className="space-y-1.5 rounded-lg border border-border bg-card/40 p-3">
            {fees.payments.map((p) => {
              const pending = p.status === 'UNDER_VERIFICATION'
              const rejected = p.status === 'REJECTED'
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="min-w-0 truncate font-medium">{p.feeTitle}</span>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[9px] font-semibold',
                          pending
                            ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : rejected
                              ? 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                              : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                        )}
                      >
                        {pending ? 'Awaiting verification' : rejected ? 'Rejected' : p.txnId ? 'Verified' : 'Paid'}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {formatDate(p.createdAt.slice(0, 10))} · {(p.method ?? '—').replace('_', ' ').toLowerCase()}
                      {p.txnId
                        ? p.source === 'CLASS_TEACHER'
                          ? p.collectedBy
                            ? ` · collected by ${p.collectedBy}`
                            : ' · class teacher'
                          : p.source === 'SCHOOL_OFFICE'
                            ? ' · paid through School Office'
                            : p.source === 'PRINCIPAL'
                              ? ' · paid through the Principal'
                              : ''
                        : p.sourceLabel
                          ? ` · ${p.sourceLabel}`
                          : ''}
                      {p.receiptNo ? ` · receipt ${p.receiptNo}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={cn('tabular-nums font-semibold', rejected ? 'text-rose-600 line-through dark:text-rose-400' : pending ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                      {formatINR(p.amount, true)}
                    </span>
                    {p.txnId && (
                      <Button
                        variant="ghost" size="sm" className="h-6 w-6 p-0"
                        aria-label="View payment document"
                        onClick={() => { setReceiptTxnId(p.txnId); setReceiptOpen(true) }}
                      >
                        <Receipt className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}
      {/* The SAME shared receipt document the fee workspace opens. */}
      <FeeReceiptViewer txnId={receiptTxnId} open={receiptOpen} onOpenChange={setReceiptOpen} />
    </div>
  )
}
