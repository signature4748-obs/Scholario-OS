'use client'

/**
 * StudentLedgerSheet — the per-student fee account the class teacher
 * opens from the collection table (MASTER TASK §12, §15).
 *
 * Fee lines (due / paid / balance / status) + the FULL payment history:
 * canonical transactions (their own collections with verification
 * state, direct office payments with source story) UNION pre-workflow
 * office records. Pending collections are shown SEPARATELY from paid —
 * the balance never counts unverified money (§37).
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { GradientAvatar } from '@/components/shared/ui'
import { formatINR } from '@/lib/format'
import { methodLabel, sourceStory, txnDate, txnStatusMeta } from '@/components/shared/fee-collection/txn-meta'
import type { CollectionStudent, FeeTxn } from './types'
import { Banknote, Clock3, FileText, Receipt, User, Wallet } from 'lucide-react'

interface Props {
  student: CollectionStudent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** canonical txns of THIS student (already loaded with the class) */
  txns: FeeTxn[]
  onCollect: (studentId: string, feeId?: string) => void
  onViewReceipt: (txnId: string) => void
  /** opens the ONE shared student profile (same sheet as Directory / My
   *  Class / Behavior — master task §25). */
  onViewProfile?: (studentId: string) => void
}

export function StudentLedgerSheet({ student, open, onOpenChange, txns, onCollect, onViewReceipt, onViewProfile }: Props) {
  if (!student) return null
  const ledger = student.ledger
  const studentTxns = txns.filter((t) => t.studentId === student.id)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="space-y-2 border-b p-4">
          <SheetTitle className="flex items-center gap-2.5 text-base">
            <GradientAvatar name={student.name} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{student.name}</span>
              <span className="block truncate text-[11px] font-normal text-muted-foreground">
                Roll {student.rollNo ?? '—'} · {student.guardianName ?? 'Guardian —'}
              </span>
            </span>
            {onViewProfile && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-2.5 text-[11px]"
                onClick={() => onViewProfile(student.id)}
              >
                <User className="h-3 w-3" /> Profile
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 p-4">
          {ledger && (
            <>
              {/* Headline totals */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/40 p-3 text-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Billed</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatINR(ledger.totalBilled, true)}</p>
                </div>
                <div className="border-x">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Paid</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatINR(ledger.totalPaid, true)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Balance</p>
                  <p className={`mt-0.5 text-sm font-semibold tabular-nums ${ledger.outstanding > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    {formatINR(ledger.outstanding, true)}
                  </p>
                </div>
              </div>

              {ledger.awaitingVerification > 0 && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>{formatINR(ledger.awaitingVerification)}</strong> collected and awaiting the Principal&rsquo;s
                    verification — not counted in the balance yet.
                  </span>
                </p>
              )}

              {/* Fee lines */}
              <section className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" /> Fee lines
                </h4>
                <div className="overflow-hidden rounded-xl border divide-y">
                  {ledger.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatINR(item.amount, true)} due · {formatINR(item.paid, true)} paid
                          {item.dueDate ? ` · by ${txnDate(item.dueDate)}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <StatusChip status={item.status} outstanding={item.outstanding} />
                        {item.outstanding > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1 h-7 px-2.5 text-[11px] gap-1"
                            onClick={() => { onOpenChange(false); onCollect(student.id, item.id) }}
                          >
                            <Wallet className="h-3 w-3" /> Collect
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {ledger.items.length === 0 && (
                    <p className="p-4 text-center text-xs text-muted-foreground">No fee records for this student yet.</p>
                  )}
                </div>
              </section>
            </>
          )}

          {/* Payment history — canonical union */}
          <section className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Banknote className="h-3.5 w-3.5" /> Payment history
            </h4>
            <div className="overflow-hidden rounded-xl border divide-y">
              {studentTxns.map((t) => {
                const meta = txnStatusMeta(t.status)
                return (
                  <div key={t.id} className="flex items-start gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-semibold tabular-nums">{formatINR(t.amount, true)}</p>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium ${meta.chip}`}>
                          <span className={`h-1 w-1 rounded-full ${meta.dot}`} />
                          {meta.short}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {t.feeHeadName ?? 'Fee'} · {methodLabel(t.method)} · {txnDate(t.collectedAt ?? t.createdAt)}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {sourceStory(t)}
                        {t.receiptNo ? ` · Receipt ${t.receiptNo}` : ''}
                      </p>
                      {t.rejectionReason && (
                        <p className="mt-0.5 text-[11px] text-rose-600 dark:text-rose-400">Reason: “{t.rejectionReason}”</p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-[11px] gap-1" onClick={() => onViewReceipt(t.id)}>
                      <Receipt className="h-3 w-3" /> {t.status === 'SUCCESS' ? 'Receipt' : 'View'}
                    </Button>
                  </div>
                )
              })}
              {(ledger?.officePayments ?? []).map((p) => (
                <div key={p.id} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-semibold tabular-nums">{formatINR(p.amount, true)}</p>
                      <span className="inline-flex items-center gap-1 rounded-full border bg-emerald-500/10 px-1.5 py-px text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border-emerald-500/25">
                        <span className="h-1 w-1 rounded-full bg-emerald-500" /> Paid
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {p.feeTitle} · {methodLabel(p.method)} · {txnDate(p.createdAt)}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">School Office record</p>
                  </div>
                </div>
              ))}
              {studentTxns.length === 0 && (ledger?.officePayments ?? []).length === 0 && (
                <p className="p-4 text-center text-xs text-muted-foreground">No payment records for this student yet.</p>
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function StatusChip({ status, outstanding }: { status: string; outstanding: number }) {
  if (outstanding <= 0) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Paid</span>
  }
  if (status === 'OVERDUE') {
    return <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-400">Overdue · {formatINR(outstanding, true)}</span>
  }
  if (status === 'PARTIAL') {
    return <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">Partial · {formatINR(outstanding, true)}</span>
  }
  return <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/25 bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">Due · {formatINR(outstanding, true)}</span>
}
