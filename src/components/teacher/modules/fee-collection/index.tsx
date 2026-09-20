'use client'

/**
 * FeeCollectionModule — the Class Teacher's "Fees & Payments" workspace
 * (MASTER TASK §7, §13–§15, §25, §33–§34).
 *
 * Appointment-gated: the server only returns classes the signed-in
 * teacher is currently the class teacher of — no appointment means the
 * module honestly says so (§42).
 *
 * Everything derives from ONE fetch of GET /api/teacher/fee-collection:
 *   · summary tiles (billed / collected / awaiting verification /
 *     outstanding / overdue) — real ledger + canonical txn numbers;
 *   · the month sheet (‹ September 2026 ›) — verified + pending totals;
 *   · the collection table with filters (student search, status,
 *     method, source) — canonical transactions only, responsive:
 *     full table ≥ md, stacked transaction cards on mobile (§33);
 *   · Collect Fee (STAGE 1 — honest "awaiting verification" result);
 *   · per-student ledger sheet + the shared receipt viewer.
 */

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { GradientAvatar } from '@/components/shared/ui'
import { formatINR } from '@/lib/format'
import { FeeReceiptViewer } from '@/components/shared/fee-collection/receipt-viewer'
import { methodLabel, sourceLabel, sourceStory, txnDate, txnStatusMeta } from '@/components/shared/fee-collection/txn-meta'
import { useFeeCollection } from './hooks'
import type { FeeTxn } from './types'
import { CollectFeeDialog } from './collect-dialog'
import { StudentLedgerSheet } from './student-ledger'
import {
  AlertTriangle, ArrowLeftRight, BadgeCheck, Banknote, CalendarDays, ChevronLeft,
  ChevronRight, Clock3, Receipt, Search, TrendingUp, Wallet, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type StatusFilter = 'all' | 'pending' | 'verified' | 'rejected'
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Awaiting verification' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
]

export function FeeCollectionModule() {
  const { data, loading, error, month, changeMonth, collect } = useFeeCollection()
  const [classIdx, setClassIdx] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [methodFilter, setMethodFilter] = useState<string>('ALL')
  const [sourceFilter, setSourceFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [collectOpen, setCollectOpen] = useState(false)
  const [collectStudent, setCollectStudent] = useState<string | undefined>(undefined)
  const [ledgerStudentId, setLedgerStudentId] = useState<string | null>(null)
  const [receiptTxnId, setReceiptTxnId] = useState<string | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  const klass = data?.classes?.[Math.min(classIdx, (data?.classes.length ?? 1) - 1)] ?? null
  const students = klass?.students ?? []
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])

  const filtered = useMemo(() => {
    let rows = klass?.transactions ?? []
    if (statusFilter === 'pending') rows = rows.filter((t) => t.status === 'UNDER_VERIFICATION')
    else if (statusFilter === 'verified') rows = rows.filter((t) => t.status === 'SUCCESS')
    else if (statusFilter === 'rejected') rows = rows.filter((t) => t.status === 'REJECTED')
    if (methodFilter !== 'ALL') rows = rows.filter((t) => t.method === methodFilter)
    if (sourceFilter !== 'ALL') rows = rows.filter((t) => t.source === sourceFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter((t) =>
        (t.studentName ?? '').toLowerCase().includes(q) ||
        (t.feeHeadName ?? '').toLowerCase().includes(q) ||
        (t.receiptNo ?? '').toLowerCase().includes(q) ||
        (t.collectedBy ?? '').toLowerCase().includes(q))
    }
    return rows
  }, [klass, statusFilter, methodFilter, sourceFilter, search])

  const hasActiveFilter =
    statusFilter !== 'all' || methodFilter !== 'ALL' || sourceFilter !== 'ALL' || search.trim() !== ''

  // ── Unavailable / loading / error states (§42) ─────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
        <p className="mt-2 text-sm font-medium">Could not load the fee workspace</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }
  if (!data || data.classes.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted">
          <Wallet className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm font-semibold">Fees &amp; Payments is unavailable</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          You are not currently assigned as a Class Teacher, so there is no class fee collection
          for you to manage. Fee records become available the moment the Principal appoints you
          to a class.
        </p>
      </div>
    )
  }

  const s = klass!.summary
  const collectedPct = s.totalBilled > 0 ? Math.round((s.collected / s.totalBilled) * 100) : 0

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Fees &amp; Payments</h2>
          <p className="text-xs text-muted-foreground">
            Collect payments for your class — every rupee is verified by the Principal before it
            becomes a final receipt.
          </p>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={() => { setCollectStudent(undefined); setCollectOpen(true) }}>
          <Wallet className="h-3.5 w-3.5" /> Collect Fee
        </Button>
      </div>

      {/* Class pills */}
      {data.classes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {data.classes.map((c, i) => (
            <button
              key={c.classId}
              onClick={() => setClassIdx(i)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                i === classIdx
                  ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              {c.label} · {c.studentCount}
            </button>
          ))}
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <Tile icon={<Banknote className="h-4 w-4" />} label="Total billed" value={formatINR(s.totalBilled, true)} sub={`${klass!.label} · ${klass!.studentCount} students`} />
        <Tile icon={<BadgeCheck className="h-4 w-4" />} label="Collected" value={formatINR(s.collected, true)} sub={`${collectedPct}% of billed · verified`} tone="emerald" />
        <Tile
          icon={<Clock3 className="h-4 w-4" />}
          label="Awaiting verification"
          value={formatINR(s.awaitingVerificationAmount, true)}
          sub={s.awaitingVerificationCount > 0 ? `${s.awaitingVerificationCount} collection${s.awaitingVerificationCount === 1 ? '' : 's'} pending` : 'All collections verified'}
          tone={s.awaitingVerificationCount > 0 ? 'amber' : 'slate'}
        />
        <Tile icon={<ArrowLeftRight className="h-4 w-4" />} label="Outstanding" value={formatINR(s.outstanding, true)} sub={`${s.fullyPaid} fully paid`} tone="slate" />
        <Tile
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Overdue"
          value={String(s.overdueStudents)}
          sub={s.overdueStudents > 0 ? 'students past due date' : 'no overdue students'}
          tone={s.overdueStudents > 0 ? 'rose' : 'slate'}
        />
      </div>

      {/* Month sheet */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3.5">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => changeMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-[9.5rem] text-center">
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {klass!.month.label}
            </p>
          </div>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => changeMonth(1)} aria-label="Next month">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <span className="text-muted-foreground">
            Verified <strong className="ml-1 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatINR(klass!.month.verifiedAmount, true)}</strong>
            <span className="ml-1 text-muted-foreground/70">({klass!.month.verifiedCount})</span>
          </span>
          <span className="text-muted-foreground">
            Awaiting verification <strong className="ml-1 font-semibold tabular-nums text-amber-700 dark:text-amber-400">{formatINR(klass!.month.pendingAmount, true)}</strong>
            <span className="ml-1 text-muted-foreground/70">({klass!.month.pendingCount})</span>
          </span>
          <span className="hidden items-center gap-1 text-muted-foreground/80 sm:flex">
            <TrendingUp className="h-3 w-3" /> figures derive from actual payment records
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-sm"
              placeholder="Search student, fee, receipt…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="h-8 w-[7.5rem] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All methods</SelectItem>
                {['CASH', 'UPI', 'CARD', 'NET_BANKING', 'BANK_TRANSFER'].map((m) => (
                  <SelectItem key={m} value={m}>{methodLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-8 w-[9rem] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All sources</SelectItem>
                {['CLASS_TEACHER', 'SCHOOL_OFFICE', 'PRINCIPAL'].map((src) => (
                  <SelectItem key={src} value={src}>{sourceLabel(src)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                statusFilter === f.key
                  ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              {f.label}
              {f.key === 'pending' && s.awaitingVerificationCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  {s.awaitingVerificationCount}
                </span>
              )}
            </button>
          ))}
          <span className="ml-auto shrink-0 pl-2 text-[11px] text-muted-foreground">
            Showing {filtered.length} of {klass!.transactions.length}
          </span>
        </div>
      </div>

      {/* Collection table — desktop */}
      <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Student</th>
                <th className="px-4 py-2.5 font-semibold">Fee</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 font-semibold">Method</th>
                <th className="px-4 py-2.5 font-semibold">Source</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((t) => (
                <TxnRow
                  key={t.id}
                  txn={t}
                  onLedger={() => t.studentId && setLedgerStudentId(t.studentId)}
                  onReceipt={() => { setReceiptTxnId(t.id); setReceiptOpen(true) }}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    {hasActiveFilter ? 'No payments match these filters.' : 'No payments recorded for this class yet — collect your first fee.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collection cards — mobile (§33: stacked transaction rows) */}
      <div className="space-y-2.5 md:hidden">
        {filtered.map((t) => (
          <MobileTxnCard
            key={t.id}
            txn={t}
            onLedger={() => t.studentId && setLedgerStudentId(t.studentId)}
            onReceipt={() => { setReceiptTxnId(t.id); setReceiptOpen(true) }}
          />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border bg-card p-6 text-center text-xs text-muted-foreground">
            {hasActiveFilter ? 'No payments match these filters.' : 'No payments recorded for this class yet.'}
          </div>
        )}
      </div>

      {/* Collect Fee (STAGE 1) */}
      {collectOpen && (
        <CollectFeeDialog
          open={collectOpen}
          onOpenChange={setCollectOpen}
          klass={klass!}
          studentId={collectStudent}
          onCollect={collect}
        />
      )}

      {/* Student ledger */}
      <StudentLedgerSheet
        student={ledgerStudentId ? (studentById.get(ledgerStudentId) ?? null) : null}
        open={!!ledgerStudentId}
        onOpenChange={(o) => { if (!o) setLedgerStudentId(null) }}
        txns={klass?.transactions ?? []}
        onCollect={(sid) => { setCollectStudent(sid); setCollectOpen(true) }}
        onViewReceipt={(id) => { setLedgerStudentId(null); setReceiptTxnId(id); setReceiptOpen(true) }}
      />

      {/* Shared receipt viewer */}
      <FeeReceiptViewer txnId={receiptTxnId} open={receiptOpen} onOpenChange={setReceiptOpen} />
    </motion.div>
  )
}

// ── Pieces ────────────────────────────────────────────────────────────

function Tile({
  icon, label, value, sub, tone = 'slate',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  tone?: 'slate' | 'emerald' | 'amber' | 'rose'
}) {
  const tones = {
    slate: 'bg-muted text-muted-foreground',
    emerald: 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-600/10 text-amber-700 dark:text-amber-400',
    rose: 'bg-rose-600/10 text-rose-700 dark:text-rose-400',
  }
  return (
    <div className="min-w-0 rounded-2xl border bg-card p-3.5">
      <div className="flex items-center gap-2">
        <span className={cn('grid h-7 w-7 place-items-center rounded-lg', tones[tone])}>{icon}</span>
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 truncate text-lg font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 truncate text-[11px] text-muted-foreground" title={sub}>{sub}</p>
    </div>
  )
}

function TxnRow({ txn, onLedger, onReceipt }: { txn: FeeTxn; onLedger: () => void; onReceipt: () => void }) {
  const meta = txnStatusMeta(txn.status)
  return (
    <tr className="group transition-colors hover:bg-muted/40">
      <td className="px-4 py-3">
        <button className="flex items-center gap-2.5 text-left" onClick={onLedger}>
          <GradientAvatar name={txn.studentName ?? 'Student'} size="sm" />
          <span className="min-w-0">
            <span className="block max-w-[10rem] truncate text-sm font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
              {txn.studentName ?? 'Student'}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">{txn.className ?? ''}</span>
          </span>
        </button>
      </td>
      <td className="max-w-[9rem] truncate px-4 py-3 text-xs text-muted-foreground">{txn.feeHeadName ?? '—'}</td>
      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">{formatINR(txn.amount, true)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{txnDate(txn.collectedAt ?? txn.createdAt)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-xs">{methodLabel(txn.method)}</td>
      <td className="max-w-[10rem] px-4 py-3">
        <span className="block truncate text-xs font-medium">{sourceLabel(txn.source)}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{sourceStory(txn)}</span>
      </td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium', meta.chip)}>
          <span className={cn('h-1 w-1 rounded-full', meta.dot)} />
          {meta.short}
        </span>
        {txn.status === 'SUCCESS' && txn.receiptNo && (
          <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{txn.receiptNo}</span>
        )}
        {txn.status === 'REJECTED' && txn.rejectionReason && (
          <span className="mt-0.5 block max-w-[10rem] truncate text-[10px] text-rose-600 dark:text-rose-400" title={txn.rejectionReason}>
            “{txn.rejectionReason}”
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] gap-1" onClick={onReceipt}>
          <Receipt className="h-3 w-3" />
          {txn.status === 'SUCCESS' ? 'Receipt' : 'View'}
        </Button>
      </td>
    </tr>
  )
}

function MobileTxnCard({ txn, onLedger, onReceipt }: { txn: FeeTxn; onLedger: () => void; onReceipt: () => void }) {
  const meta = txnStatusMeta(txn.status)
  return (
    <div className="rounded-2xl border bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <button className="flex min-w-0 items-center gap-2.5 text-left" onClick={onLedger}>
          <GradientAvatar name={txn.studentName ?? 'Student'} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{txn.studentName ?? 'Student'}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {txn.className} · {txnDate(txn.collectedAt ?? txn.createdAt)}
            </span>
          </span>
        </button>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatINR(txn.amount, true)}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', meta.chip)}>
            <span className={cn('h-1 w-1 rounded-full', meta.dot)} />
            {meta.label}
          </span>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {txn.feeHeadName ?? '—'} · {methodLabel(txn.method)} · {sourceStory(txn)}
          </p>
          {txn.receiptNo && <p className="truncate font-mono text-[10px] text-muted-foreground">{txn.receiptNo}</p>}
        </div>
        <Button variant="outline" size="sm" className="h-7 shrink-0 px-2.5 text-[11px] gap-1" onClick={onReceipt}>
          <Receipt className="h-3 w-3" />
          {txn.status === 'SUCCESS' ? 'Receipt' : 'View'}
        </Button>
      </div>
    </div>
  )
}
