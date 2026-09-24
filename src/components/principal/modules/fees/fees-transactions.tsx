'use client'

/**
 * FeesTransactionsSection — serious financial transaction table.
 *
 * CANONICAL DATA SOURCE: every row is a real FeeTransaction from
 * GET /api/fees/transactions — receipts, verification trail, gateway
 * references, collector identity — never the client fee-store seeds.
 *
 * - KPI cards in the shared Overview SummaryCard language (SaaS-STAGE-1):
 *   Transactions · Total Collected · Avg. Transaction (verified rows only
 *   for amounts; the Transactions card carries the verified/other split)
 * - Filters: search, class, mode, status, fee head, type, SOURCE
 *   (Office / Teacher / Class Teacher / Student — operational source;
 *   gateway is a channel, never a source). Desktop = inline selects via
 *   the shared FilterToolbar; tablet/mobile = ONE compact Filters button
 *   opening the filter sheet.
 * - Row actions: View (detail drawer) and, for rows that carry an issued
 *   receipt, Print / Download via the canonical A5/A4 dual-copy receipt
 *   engine (fee-receipt-a5.tsx — fed an adapter of the canonical row).
 * - Export generates a real CSV from the filtered rows.
 * - Row click: opens a slide-from-right Transaction Detail Drawer showing
 *   student info, fee info, payment info, gateway info (if available),
 *   the collection & verification trail, and audit info.
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download, Printer, Eye,
  Receipt as ReceiptIcon, User, Calendar,
  CreditCard, Landmark, ShieldCheck, AlertCircle,
  FileText, Banknote, Ban,
  ArrowUpRight, ReceiptText, IndianRupee, Clock3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  useFeeStore, collectorSourceLabel,
  type PaymentMode, type TransactionCategory,
} from '@/lib/store/fee-store'
import { formatINR, formatDate, formatRelativeTime, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SummaryCard, SummaryCardGrid } from '../shared/summary-card'
import { FilterToolbar } from '../shared/filter-toolbar'
import { FeePanel, FeeEmptyState, ModeIcon, modeAccent, SourceChip, DateTimeText } from './fees-shared'
import { FeeReceiptA5Preview, printReceiptA5, downloadReceiptA5 } from './fee-receipt-a5'
import {
  useCanonicalFees,
  txnStatusMeta,
  canonicalMethodLabel,
  canonicalSourceRole,
  isPendingTxnStatus,
  isVerifiedTxnStatus,
  isRejectedTxnStatus,
  toStoreFeeTxn,
  isoDate,
  type CanonicalTxn,
} from './use-canonical-fees'
import { toast } from 'sonner'
import { useDismissOnEscape } from '@/hooks/use-dismiss-on-escape'

// ─── Financial type badge (Core Fee / Examination Fee / Additional) ────

const TXN_TYPE_META: Record<TransactionCategory, { label: string; className: string }> = {
  CORE: { label: 'Core Fee', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20' },
  EXAMINATION: { label: 'Exam Fee', className: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/20' },
  ADDITIONAL: { label: 'Additional', className: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20' },
}

// Category dot tones used where the Type column merges into the Fee Head
// cell (spec §7): Core = emerald, Examination = cyan, Additional = violet.
const TXN_TYPE_DOT: Record<TransactionCategory, { label: string; dot: string }> = {
  CORE: { label: 'Core Fee', dot: 'bg-emerald-500' },
  EXAMINATION: { label: 'Examination Fee', dot: 'bg-cyan-500' },
  ADDITIONAL: { label: 'Additional Charge', dot: 'bg-violet-500' },
}

export function TransactionTypeBadge({ category, className }: { category: TransactionCategory; className?: string }) {
  const meta = TXN_TYPE_META[category] ?? TXN_TYPE_META.CORE
  return (
    <span className={cn('inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap', meta.className, className)}>
      {meta.label}
    </span>
  )
}

/** Canonical status badge — the module's badge recipe with the dot
 *  indicator: VERIFIED = emerald · PENDING/UNDER = amber · REJECTED = rose. */
export function CanonicalTxnStatusBadge({ status }: { status: string }) {
  const meta = txnStatusMeta(status)
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap', meta.accent)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {meta.label}
    </span>
  )
}

/** Financial category of a canonical txn — resolved through the fee row
 *  it applied to (fee.type), Core by fallback. */
function canonicalTxnCategory(t: CanonicalTxn, feeTypeOf: (feeId: string | null) => string | undefined): TransactionCategory {
  const type = feeTypeOf(t.feeId)
  if (type === 'EXAMINATION' || type === 'EXAM') return 'EXAMINATION'
  if (type === 'ADDITIONAL') return 'ADDITIONAL'
  return 'CORE'
}

// Status filter facet values (mobile sheet + inline select share them).
type StatusFilterValue = 'all' | 'verified' | 'pending' | 'rejected'
const STATUS_OPTIONS: Array<{ value: StatusFilterValue; label: string }> = [
  { value: 'all', label: 'All Status' },
  { value: 'verified', label: 'Verified' },
  { value: 'pending', label: 'Pending verification' },
  { value: 'rejected', label: 'Rejected' },
]

// Mobile-only source facet label mapping (kept beside the table).
const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'office', label: 'Office' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'class_teacher', label: 'Class Teacher' },
  { value: 'self', label: 'Student self-service' },
]

export function FeesTransactionsSection() {
  const { data, loading, error, refresh } = useCanonicalFees()
  // Receipt chrome (paper size, school header) — a Settings concern, not
  // ledger data; the receipt engine reads its configuration here.
  const receiptSettings = useFeeStore((s) => s.receiptSettings)

  const [search, setSearch] = useState('')
  const [modeFilter, setModeFilter] = useState<'all' | PaymentMode>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all')
  const [classFilter, setClassFilter] = useState('all')
  const [feeHeadFilter, setFeeHeadFilter] = useState('all')
  // FINANCIAL TYPE filter — Core Fee / Examination Fee / Additional Charge.
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionCategory>('all')
  // OPERATIONAL SOURCE filter (SaaS-STAGE-1) — Office / Teacher /
  // Class Teacher / Student self-service. Gateway is a channel, not a source.
  const [sourceFilter, setSourceFilter] = useState('all')
  const [viewReceipt, setViewReceipt] = useState<CanonicalTxn | null>(null)
  const [detailTxn, setDetailTxn] = useState<CanonicalTxn | null>(null)

  // Escape closes the receipt preview modal (backdrop click already does).
  useDismissOnEscape(() => setViewReceipt(null), !!viewReceipt)

  const txns = useMemo(
    () => [...(data?.txns ?? [])].sort(
      (a, b) => new Date(b.collectedAt ?? b.createdAt).getTime() - new Date(a.collectedAt ?? a.createdAt).getTime(),
    ),
    [data],
  )
  // Fee-head → fee-row type resolution (drives the Type facet/dot).
  const feeTypeOf = useMemo(
    () => (feeId: string | null) => (feeId ? data?.feeById.get(feeId)?.type : undefined),
    [data],
  )
  const classes = useMemo(() => {
    const set = new Set(txns.map((t) => t.className).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [txns])
  const feeHeads = useMemo(() => {
    const set = new Set(txns.map((t) => t.feeHeadName).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [txns])
  const modes = useMemo(() => {
    const set = new Set(txns.map((t) => canonicalMethodLabel(t.method)))
    return Array.from(set).sort()
  }, [txns])

  const filtered = useMemo(() => {
    return txns.filter((t) => {
      const q = search.toLowerCase().trim()
      if (q
        && !(t.studentName ?? '').toLowerCase().includes(q)
        && !(t.receiptNo ?? '').toLowerCase().includes(q)
        && !t.id.toLowerCase().includes(q)
        && !(t.referenceNumber ?? '').toLowerCase().includes(q)) return false
      if (modeFilter !== 'all' && canonicalMethodLabel(t.method) !== modeFilter) return false
      if (statusFilter === 'verified' && !isVerifiedTxnStatus(t.status)) return false
      if (statusFilter === 'pending' && !isPendingTxnStatus(t.status)) return false
      if (statusFilter === 'rejected' && !isRejectedTxnStatus(t.status)) return false
      if (classFilter !== 'all' && t.className !== classFilter) return false
      if (feeHeadFilter !== 'all' && t.feeHeadName !== feeHeadFilter) return false
      if (typeFilter !== 'all' && canonicalTxnCategory(t, feeTypeOf) !== typeFilter) return false
      if (sourceFilter !== 'all' && sourceKeyOf(t) !== sourceFilter) return false
      return true
    })
  }, [txns, search, modeFilter, statusFilter, classFilter, feeHeadFilter, typeFilter, sourceFilter, feeTypeOf])

  // ─── Summary metrics ────────────────────────────────────────────────
  // Only verified transactions count toward amount totals. The Total
  // count reflects ALL rows matching the current filters, and the
  // verified count shows how many of those have settled.
  const verifiedFiltered = useMemo(
    () => filtered.filter((t) => isVerifiedTxnStatus(t.status)),
    [filtered],
  )
  const totalAmount = verifiedFiltered.reduce((s, t) => s + t.amount, 0)
  const verifiedCount = verifiedFiltered.length
  const totalCount = filtered.length
  const avgAmount = verifiedCount > 0 ? Math.round(totalAmount / verifiedCount) : 0

  const activeFiltersCount = (modeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (classFilter !== 'all' ? 1 : 0) + (feeHeadFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0) + (sourceFilter !== 'all' ? 1 : 0)

  // Reset ghost in the toolbar — same fields the filter sheet's
  // "Clear Filters" button clears (search text intentionally untouched).
  const handleResetFilters = () => {
    setModeFilter('all'); setStatusFilter('all'); setClassFilter('all'); setFeeHeadFilter('all'); setTypeFilter('all'); setSourceFilter('all')
  }

  // Receipt adapters — the canonical A5/A4 dual-copy receipt engine keeps
  // rendering the office document; rows without an issued receipt (pending
  // verification / rejected collections) honestly have none to print.
  const storeTxnOf = (t: CanonicalTxn) => toStoreFeeTxn(t, {
    admissionNo: data?.studentsById.get(t.studentId ?? '')?.admissionNo,
    sessionLabel: data?.sessionLabel,
  })
  const doPrint = (t: CanonicalTxn) => {
    printReceiptA5(storeTxnOf(t), receiptSettings)
    toast.success('Print dialog opened')
  }
  const doDownload = (t: CanonicalTxn) => {
    downloadReceiptA5(storeTxnOf(t), receiptSettings)
    toast.success('Receipt downloaded', { description: `${t.receiptNo}.html` })
  }

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.info('Nothing to export', { description: 'No transactions match the current filters.' })
      return
    }
    const headers = ['Receipt No', 'Transaction ID', 'Student', 'Admission No', 'Class', 'Fee Head', 'Type', 'Amount', 'Mode', 'Source', 'Status', 'Date', 'Collected By', 'Verified By', 'Rejected By', 'Rejection Reason', 'Reference No', 'Note']
    const rows = filtered.map((t) => [
      t.receiptNo ?? '', t.id, t.studentName ?? '', data?.studentsById.get(t.studentId ?? '')?.admissionNo ?? '',
      t.className ?? '', t.feeHeadName ?? '',
      (TXN_TYPE_META[canonicalTxnCategory(t, feeTypeOf)] ?? TXN_TYPE_META.CORE).label,
      String(t.amount), canonicalMethodLabel(t.method), collectorSourceLabel(canonicalSourceRole(t.source)),
      txnStatusMeta(t.status).label, isoDate(t.collectedAt ?? t.createdAt), t.collectedByName ?? '',
      t.verifiedByName ?? '', t.rejectedByName ?? '', t.rejectionReason ?? '', t.referenceNumber ?? '', t.note ?? '',
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => {
        const s = String(c ?? '')
        // Quote + escape per RFC 4180
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Export downloaded', { description: `${filtered.length} transaction(s) exported to CSV.` })
  }

  // ── Honest async states ─────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading transactions">
        <SummaryCardGrid columns={3}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-4 space-y-2.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          ))}
        </SummaryCardGrid>
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="rounded-xl border border-border overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border-t border-border/30 px-4 py-3"><Skeleton className="h-4 w-full" /></div>
          ))}
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <FeePanel title="Transactions" subtitle="canonical payment ledger">
        <FeeEmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Could not load the transactions ledger"
          description={error}
          action={<Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refresh()}>Try again</Button>}
        />
      </FeePanel>
    )
  }

  if (txns.length === 0) {
    return (
      <FeePanel title="Transactions" subtitle="canonical payment ledger">
        <FeeEmptyState
          icon={<ReceiptIcon className="h-6 w-6" />}
          title="No fee transactions yet"
          description="Collections recorded by the office, class teachers and the gateway appear here with their receipts."
          action={<Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refresh()}>Refresh</Button>}
        />
      </FeePanel>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI cards — the shared Overview SummaryCard language (SaaS-STAGE-1):
          amounts from verified rows only; the Transactions card carries the
          verified vs other split as its sub line. */}
      <SummaryCardGrid columns={3}>
        <SummaryCard
          label="Transactions"
          value={totalCount}
          tone="slate"
          icon={<ReceiptText className="h-4 w-4" />}
          sub={`${verifiedCount} verified · ${totalCount - verifiedCount} other`}
        />
        <SummaryCard
          label="Total Collected"
          value={formatINR(totalAmount, true)}
          tone="emerald"
          icon={<IndianRupee className="h-4 w-4" />}
          sub="verified only · across filtered rows"
          delay={0.05}
        />
        <SummaryCard
          label="Avg. Transaction"
          value={formatINR(avgAmount, true)}
          tone="teal"
          icon={<ArrowUpRight className="h-4 w-4" />}
          sub="per verified payment"
          delay={0.1}
        />
      </SummaryCardGrid>

      {/* Toolbar — shared responsive FilterToolbar (SaaS-STAGE-1):
          desktop = search + Class/Mode/Status/Fee Head/Type/Source inline;
          tablet/mobile = ONE compact Filters button → filter sheet. */}
      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search student / receipt / transaction ID…"
        activeCount={activeFiltersCount}
        onReset={handleResetFilters}
        filters={[
          { id: 'class', label: 'Class', value: classFilter, onChange: setClassFilter, placeholder: 'All Classes', options: [{ value: 'all', label: 'All Classes' }, ...classes.map((c) => ({ value: c, label: c }))] },
          { id: 'mode', label: 'Mode', value: modeFilter, onChange: (v) => setModeFilter(v as 'all' | PaymentMode), placeholder: 'All Modes', options: [{ value: 'all', label: 'All Modes' }, ...modes.map((m) => ({ value: m, label: m }))] },
          { id: 'status', label: 'Status', value: statusFilter, onChange: (v) => setStatusFilter(v as StatusFilterValue), placeholder: 'All Status', options: STATUS_OPTIONS },
          { id: 'head', label: 'Fee Head', value: feeHeadFilter, onChange: setFeeHeadFilter, placeholder: 'All Heads', options: [{ value: 'all', label: 'All Heads' }, ...feeHeads.map((h) => ({ value: h, label: h }))] },
          { id: 'type', label: 'Type', value: typeFilter, onChange: (v) => setTypeFilter(v as 'all' | TransactionCategory), placeholder: 'All Types', options: [{ value: 'all', label: 'All Types' }, { value: 'CORE', label: 'Core Fee' }, { value: 'EXAMINATION', label: 'Examination Fee' }] },
          { id: 'source', label: 'Source', value: sourceFilter, onChange: setSourceFilter, placeholder: 'All Sources', options: SOURCE_OPTIONS },
        ]}
        actions={
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        }
      />

      {/* Transactions table — module ledger recipe: flush p-0 body inside the
          rounded-xl bordered panel; SOLID sticky header row; py-2.5 text-xs
          cells; hover:bg-muted/30 rows */}
      <FeePanel bodyClassName="p-0">
        <div className="overflow-x-auto max-h-[36rem]">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr className="h-10 bg-muted shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                <th className="text-left px-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground whitespace-nowrap bg-muted">Receipt</th>
                <th className="text-left px-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground whitespace-nowrap bg-muted">Student</th>
                <th className="text-left px-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground whitespace-nowrap bg-muted hidden lg:table-cell">Class</th>
                <th className="text-left px-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground whitespace-nowrap bg-muted hidden md:table-cell">Fee Head</th>
                <th className="text-right px-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground whitespace-nowrap bg-muted">Amount</th>
                <th className="text-center px-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground whitespace-nowrap bg-muted hidden sm:table-cell">Mode</th>
                <th className="text-center px-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground whitespace-nowrap bg-muted hidden xl:table-cell">Source</th>
                <th className="text-center px-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground whitespace-nowrap bg-muted">Status</th>
                <th className="text-left px-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground whitespace-nowrap bg-muted hidden lg:table-cell">Date</th>
                <th className="text-center px-3 text-[11px] uppercase tracking-wider font-medium text-muted-foreground whitespace-nowrap bg-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const dotMeta = TXN_TYPE_DOT[canonicalTxnCategory(t, feeTypeOf)] ?? TXN_TYPE_DOT.CORE
                const mode = canonicalMethodLabel(t.method)
                const admissionNo = data?.studentsById.get(t.studentId ?? '')?.admissionNo ?? ''
                return (
                  <tr
                    key={t.id}
                    className="border-t border-border/30 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setDetailTxn(t)}
                  >
                    <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{t.receiptNo ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs">
                      <p className="font-medium">{t.studentName ?? '—'}</p>
                      {admissionNo && <p className="text-[10px] text-muted-foreground font-mono">{admissionNo}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">{t.className ?? '—'}</td>
                    {/* Fee Head + merged category chip (Type column removed): tiny
                        colored dot — Core emerald / Exam cyan / Additional violet */}
                    <td className="px-3 py-2.5 text-xs hidden md:table-cell max-w-[220px]">
                      <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full" title={`${dotMeta.label} · ${t.feeHeadName ?? '—'}`}>
                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotMeta.dot)} aria-hidden />
                        <span className="truncate text-muted-foreground">{t.feeHeadName ?? '—'}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium whitespace-nowrap">{formatINR(t.amount)}</td>
                    <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                      <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ring-1', modeAccent(mode))}>
                        <ModeIcon mode={mode} className="h-2.5 w-2.5" />
                        {mode}
                      </span>
                    </td>
                    {/* Operational source (SaaS-STAGE-1): Office / Teacher /
                        Class Teacher / Student — never the gateway channel. */}
                    <td className="px-3 py-2.5 text-center hidden xl:table-cell">
                      <SourceChip role={canonicalSourceRole(t.source)} collectedBy={t.collectedByName ?? undefined} maxW="max-w-[120px]" />
                    </td>
                    <td className="px-3 py-2.5 text-center"><CanonicalTxnStatusBadge status={t.status} /></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                      <DateTimeText date={isoDate(t.collectedAt ?? t.createdAt)} instant={t.collectedAt ?? t.createdAt} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div
                        className="inline-flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button onClick={() => setDetailTxn(t)} className="inline-flex items-center justify-center h-6 w-6 rounded text-primary hover:bg-primary/10 transition-colors" title="View details" aria-label={`View details of ${t.receiptNo ?? t.id}`}>
                          <Eye className="h-3 w-3" />
                        </button>
                        {t.receiptNo ? (
                          <>
                            <button onClick={() => doPrint(t)} className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Print receipt" aria-label={`Print receipt ${t.receiptNo}`}>
                              <Printer className="h-3 w-3" />
                            </button>
                            <button onClick={() => doDownload(t)} className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Download receipt" aria-label={`Download receipt ${t.receiptNo}`}>
                              <Download className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex h-6 w-6 items-center justify-center text-[9px] text-muted-foreground/50" title="No receipt issued yet">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="py-12"><FeeEmptyState icon={<ReceiptIcon className="h-6 w-6" />} title="No transactions match your filters" description="Try adjusting the search or filter criteria." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </FeePanel>

      {/* Receipt preview modal — only rows with an issued receipt. */}
      <AnimatePresence>
        {viewReceipt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Receipt ${viewReceipt.receiptNo} preview`}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setViewReceipt(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-xl p-4 max-h-[90vh] overflow-y-auto w-[min(56rem,calc(100vw-2rem))]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* THE canonical A5/A4 dual-copy receipt (thermal consolidated away) */}
              <FeeReceiptA5Preview
                transaction={storeTxnOf(viewReceipt)}
                settings={receiptSettings}
                onClose={() => setViewReceipt(null)}
                onPrint={() => doPrint(viewReceipt)}
                onDownload={() => doDownload(viewReceipt)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction detail drawer (slide-from-right) */}
      <TransactionDetailDrawer
        txn={detailTxn}
        data={data ?? null}
        receiptSettings={receiptSettings}
        onClose={() => setDetailTxn(null)}
        onViewReceipt={(t) => setViewReceipt(t)}
        onPrint={doPrint}
        onDownload={doDownload}
      />
    </div>
  )
}

/** Filter facet value for a transaction's operational source. */
function sourceKeyOf(t: CanonicalTxn): 'office' | 'teacher' | 'class_teacher' | 'self' {
  const role = canonicalSourceRole(t.source)
  if (role === 'teacher') return 'teacher'
  if (role === 'class_teacher') return 'class_teacher'
  if (role === 'self') return 'self'
  return 'office'
}

// ─── Transaction Detail Drawer ──────────────────────────────────────

interface DrawerProps {
  txn: CanonicalTxn | null
  data: ReturnType<typeof useCanonicalFees>['data']
  receiptSettings: ReturnType<typeof useFeeStore.getState>['receiptSettings']
  onClose: () => void
  onViewReceipt: (t: CanonicalTxn) => void
  onPrint: (t: CanonicalTxn) => void
  onDownload: (t: CanonicalTxn) => void
}

function TransactionDetailDrawer({ txn, data, receiptSettings, onClose, onViewReceipt, onPrint, onDownload }: DrawerProps) {
  if (!txn) return null

  const student = txn.studentId ? data?.studentsById.get(txn.studentId) : undefined
  const fee = txn.feeId ? data?.feeById.get(txn.feeId) : undefined
  const mode = canonicalMethodLabel(txn.method)
  const meta = txnStatusMeta(txn.status)
  const verified = isVerifiedTxnStatus(txn.status)
  const rejected = isRejectedTxnStatus(txn.status)
  const pending = isPendingTxnStatus(txn.status)
  const hasGateway = !!txn.gatewayName || !!txn.gatewayPaymentId || !!txn.gatewayOrderId || !!txn.settlementId
  const bannerTone = verified
    ? 'bg-emerald-500/[0.04] border-emerald-500/20'
    : pending
      ? 'bg-amber-500/[0.04] border-amber-500/20'
      : rejected
        ? 'bg-rose-500/[0.04] border-rose-500/20'
        : 'bg-muted/40 border-border'
  const sessionLabel = data?.sessionLabel ?? '—'

  return (
    <Sheet open={!!txn} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <ReceiptIcon className="h-4 w-4 text-emerald-600" />
            Transaction Detail
          </SheetTitle>
          <SheetDescription className="text-[11px]">
            {txn.receiptNo ?? 'No receipt issued'} · {txn.id}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Status banner */}
          <div className={cn('rounded-lg border px-3 py-2 flex items-center justify-between', bannerTone)}>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Status</p>
              <p className="text-base font-bold mt-0.5">{meta.label}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Amount</p>
              <p className={cn('text-xl font-bold tabular-nums mt-0.5', verified ? 'text-emerald-600' : rejected ? 'text-rose-600' : '')}>
                {formatINR(txn.amount)}
              </p>
            </div>
          </div>

          {/* Student info */}
          <DetailSection icon={<User className="h-3.5 w-3.5" />} title="Student Information">
            <DetailRow label="Student Name" value={txn.studentName ?? '—'} />
            {student && <DetailRow label="Admission No" value={student.admissionNo || '—'} mono />}
            <DetailRow label="Class" value={txn.className ?? '—'} />
            {student && <DetailRow label="Roll No" value={student.rollNo || '—'} />}
            {student?.guardianName && <DetailRow label="Guardian" value={`${student.guardianName}${student.guardianPhone ? ` · ${student.guardianPhone}` : ''}`} />}
            <DetailRow label="Student ID" value={txn.studentId ?? '—'} mono />
          </DetailSection>

          {/* Fee info */}
          <DetailSection icon={<FileText className="h-3.5 w-3.5" />} title="Fee Information">
            <DetailRow
              label="Type"
              value={<TransactionTypeBadge category={canonicalTxnCategory(txn, (feeId) => (feeId ? data?.feeById.get(feeId)?.type : undefined))} />}
            />
            <DetailRow label="Fee Head" value={txn.feeHeadName ?? '—'} />
            {fee && (
              <DetailRow
                label="Applied Fee Row"
                value={`${fee.title} · ${formatINR(fee.paid, true)} of ${formatINR(fee.amount, true)} paid`}
              />
            )}
            <DetailRow label="Academic Year" value={sessionLabel} />
          </DetailSection>

          {/* Payment info */}
          <DetailSection icon={<CreditCard className="h-3.5 w-3.5" />} title="Payment Information">
            <DetailRow
              label="Mode"
              value={
                <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ring-1', modeAccent(mode))}>
                  <ModeIcon mode={mode} className="h-2.5 w-2.5" />
                  {mode}
                </span>
              }
            />
            <DetailRow label="Status" value={<CanonicalTxnStatusBadge status={txn.status} />} />
            <DetailRow label="Receipt No" value={txn.receiptNo ?? '—'} mono />
            <DetailRow label="Transaction ID" value={txn.id} mono />
            <DetailRow
              label="Collected At"
              value={
                <span className="whitespace-nowrap">
                  {formatDate(txn.collectedAt ?? txn.createdAt)}
                  {txn.collectedAt ? <span className="ml-1 text-[10px] text-muted-foreground/70">· {formatTime(txn.collectedAt).toUpperCase()}</span> : null}
                </span>
              }
            />
            {txn.referenceNumber && <DetailRow label="Reference No" value={txn.referenceNumber} mono />}
          </DetailSection>

          {/* Gateway info (only if applicable) */}
          {hasGateway && (
            <DetailSection icon={<Landmark className="h-3.5 w-3.5" />} title="Gateway Information">
              {txn.gatewayName && <DetailRow label="Gateway" value={<span className="capitalize">{txn.gatewayName}</span>} />}
              {txn.gatewayPaymentId && <DetailRow label="Gateway Payment ID" value={txn.gatewayPaymentId} mono />}
              {txn.gatewayOrderId && <DetailRow label="Gateway Order ID" value={txn.gatewayOrderId} mono />}
              {txn.settlementId && <DetailRow label="Settlement ID" value={txn.settlementId} mono />}
              {txn.reconciliationStatus && (
                <DetailRow
                  label="Reconciliation"
                  value={
                    <span className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold capitalize',
                      txn.reconciliationStatus === 'reconciled' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                      txn.reconciliationStatus === 'pending' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                      txn.reconciliationStatus === 'exception' && 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
                      txn.reconciliationStatus === 'unreconciled' && 'bg-muted text-muted-foreground',
                    )}>
                      {txn.reconciliationStatus}
                    </span>
                  }
                />
              )}
            </DetailSection>
          )}

          {/* Collection & verification trail */}
          <DetailSection icon={<Banknote className="h-3.5 w-3.5" />} title="Collection & Verification">
            <DetailRow label="Collected By" value={txn.collectedByName ?? '—'} />
            <DetailRow
              label="Verification"
              value={
                txn.verifiedByName ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="h-2.5 w-2.5" /> Verified by {txn.verifiedByName}
                  </span>
                ) : rejected ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300">
                    <Ban className="h-2.5 w-2.5" /> Rejected by {txn.rejectedByName ?? 'the office'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    <Clock3 className="h-2.5 w-2.5" /> Pending verification
                  </span>
                )
              }
            />
            {txn.verifiedAt && <DetailRow label="Verified At" value={`${formatDate(txn.verifiedAt)} · ${formatRelativeTime(txn.verifiedAt)}`} />}
            {rejected && txn.rejectedAt && <DetailRow label="Rejected At" value={`${formatDate(txn.rejectedAt)} · ${formatRelativeTime(txn.rejectedAt)}`} />}
            {rejected && txn.rejectionReason && <DetailRow label="Rejection Reason" value={txn.rejectionReason} />}
          </DetailSection>

          {/* Note (when the collector left one) */}
          {txn.note && (
            <DetailSection icon={<FileText className="h-3.5 w-3.5" />} title="Note">
              <p className="text-[11px] text-muted-foreground">{txn.note}</p>
            </DetailSection>
          )}

          {/* Audit info */}
          <DetailSection icon={<Calendar className="h-3.5 w-3.5" />} title="Audit Information">
            <DetailRow label="Recorded On" value={`${formatDate(txn.createdAt)} · ${formatRelativeTime(txn.createdAt)}`} />
            <DetailRow label="Collected By" value={txn.collectedByName ?? '—'} />
            {txn.verifiedByName && <DetailRow label="Verified By" value={txn.verifiedByName} />}
            <DetailRow label="Academic Year" value={sessionLabel} />
          </DetailSection>
        </div>

        {/* Footer actions — receipt actions exist only when a receipt was issued. */}
        <div className="border-t border-border bg-card px-4 py-3 flex items-center gap-2 flex-wrap">
          {txn.receiptNo ? (
            <>
              <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => onViewReceipt(txn)}>
                <Eye className="h-3.5 w-3.5" /> View Receipt
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onPrint(txn)}>
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onDownload(txn)}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {pending ? 'A receipt is issued once the collection is verified.' : 'No receipt was issued for this collection.'}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Drawer sub-components ───────────────────────────────────────────

function DetailSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground">{icon}</span>
        <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 space-y-1">
        {children}
      </div>
    </div>
  )
}

function DetailRow({
  label, value, mono, accent,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  accent?: 'emerald' | 'rose' | 'amber'
}) {
  const accentClass = {
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    amber: 'text-amber-600',
  }[accent ?? ''] ?? ''
  return (
    <div className="flex items-start justify-between gap-3 text-[11px]">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn('font-medium text-right min-w-0 break-words', mono && 'font-mono text-[10px]', accentClass)}>{value || '—'}</span>
    </div>
  )
}
