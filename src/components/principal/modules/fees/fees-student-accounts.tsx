'use client'

/**
 * FeesStudentAccountsSection — Principal's student fee account search + workspace.
 *
 * CANONICAL DATA SOURCE: every account is derived from the real Fee rows
 * (GET /api/fees) + that student's FeeTransactions (GET /api/fees/
 * transactions) via useCanonicalFees() — the same ledger the Overview and
 * Transactions tabs render. No client fee-store reads remain.
 *
 * Grid: SearchFilterBar-style filter toolbar — free-text search (name /
 *   admission no / roll / class) composed with Class and Status selects
 *   feeding the visible card grid below (first 24 of the filtered set).
 *
 * Drawer: selecting a student opens the student fee account workspace with
 *   THREE top-level tabs (deliberate information architecture):
 *
 *   Account  — the student's current financial position: the per-fee lines
 *              (title, amount, paid, outstanding, due date, status) and
 *              the dues summary with the aging banner.
 *   Payments — recorded PAYMENT history — that student's canonical
 *              transactions, each carrying its A5 dual-copy receipt action
 *              where a receipt was issued.
 *   History  — the auditable account timeline assembled from the canonical
 *              rows (fees assessed · payments collected · verified ·
 *              rejected) — nothing invented.
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, X, Wallet, ChevronRight, ArrowLeft,
  AlertCircle, FileText, History, ShieldCheck, User,
  Ban, BadgeCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useFeeStore } from '@/lib/store/fee-store'
import { formatINR, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FeePanel, FeeStat, FeeStatusBadge, FeeEmptyState, ModeIcon, modeAccent } from './fees-shared'
import { FeeReceiptA5Preview, printReceiptA5, downloadReceiptA5 } from './fee-receipt-a5'
import {
  useCanonicalFees,
  canonicalMethodLabel,
  feeLineStatusDisplay,
  canonicalFeeTypeLabel,
  isVerifiedTxnStatus,
  isRejectedTxnStatus,
  toStoreFeeTxn,
  type CanonicalStudentAccount,
  type CanonicalFeeLine,
} from './use-canonical-fees'
import { CanonicalTxnStatusBadge } from './fees-transactions'
import { toast } from 'sonner'
import { useDismissOnEscape } from '@/hooks/use-dismiss-on-escape'

interface Props {
  onCollect: (studentId: string) => void
  /** Deep-link request from the command palette (fee result) — opens the
   *  matching student's fee account workspace directly. */
  focusStudent?: { name: string; ts: number } | null
}

/**
 * GRID CAP RULE — one consistent rule (documents itself in code, see the
 * visibleAccounts memo): always render the FIRST 24 accounts of the
 * *filtered* result set, whether or not a search query is active.
 * Filtering composes BEFORE the cap, so a narrowed filter set is never
 * truncated unless it exceeds 24 on its own.
 */
const MAX_VISIBLE_ACCOUNTS = 24

/** Status facet options — the canonical per-account status vocabulary. */
const STATUS_FILTERS = ['Paid', 'Partially Paid', 'Due', 'Overdue'] as const

// ─── Local stat tile ─────────────────────────────────────────────────
// Mirrors the shared FeeStat chrome but supports strict right-alignment
// (needed by the account-card minis) and pins the benchmark tile classes:
// rounded-lg bg-muted/40 px-2.5 py-1.5 · text-[9px] uppercase labels ·
// text-sm font-bold tabular-nums values.

const TILE_ACCENTS = {
  default: '',
  emerald: 'text-emerald-600',
  rose: 'text-rose-600',
  amber: 'text-amber-600',
} as const

function StatTile({ label, value, sub, accent = 'default', align = 'left', className }: {
  label: string
  value: string | number
  sub?: string
  accent?: 'default' | 'emerald' | 'rose' | 'amber'
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <div className={cn('rounded-lg bg-muted/40 px-2.5 py-1.5', align === 'right' && 'text-right', className)}>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={cn('text-sm font-bold tabular-nums mt-0.5', TILE_ACCENTS[accent])}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

// Stable empty fallback (Rules of Hooks — hooks run before the gates).
const EMPTY_ACCOUNTS: never[] = []

export function FeesStudentAccountsSection({ onCollect, focusStudent }: Props) {
  const { data, loading, error, refresh } = useCanonicalFees()
  const accounts = data?.students ?? EMPTY_ACCOUNTS

  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  // The drawer keeps the SELECTED STUDENT ID, not an account snapshot —
  // the account object is re-derived from the canonical ledger on every
  // re-fetch, so KPIs, fee lines and payments stay live while the drawer
  // is open.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(
    () => (selectedId ? accounts.find((a) => a.studentId === selectedId) ?? null : null),
    [accounts, selectedId],
  )

  // Consume the deep-link: match by student name (exact → prefix →
  // contains) and open the account drawer; fall back to an honest info
  // toast when the canonical ledger does not include that student. No
  // first-word fallback — matching "Aarav Sharma" to "Aarav Joshi" would
  // open the wrong account.
  const handledFocusTs = useRef<number | null>(null)
  useEffect(() => {
    if (!focusStudent || handledFocusTs.current === focusStudent.ts) return
    handledFocusTs.current = focusStudent.ts
    const name = focusStudent.name.toLowerCase().trim()
    const match =
      accounts.find((a) => a.name.toLowerCase() === name) ??
      accounts.find((a) => name.startsWith(a.name.toLowerCase())) ??
      accounts.find((a) => a.name.toLowerCase().includes(name))
    if (match) {
      setSelectedId(match.studentId)
      toast.success(`Opened ${match.name}'s fee account`, { description: 'Deep-linked from global search' })
    } else {
      toast.info(`${focusStudent.name} — fee directory`, {
        description: 'No fee account found for that student yet — it appears once fee rows exist for them.',
      })
    }
  }, [focusStudent?.ts, accounts])

  // Class facet — unique class display names from the canonical ledger.
  const uniqueClasses = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.className))),
    [accounts],
  )

  // Composed filtering: query match AND class AND status. An empty query
  // merely skips the text predicate.
  const filteredAccounts = useMemo(() => {
    const q = search.toLowerCase().trim()
    return accounts.filter((a) => {
      const matchesQuery =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.studentId.toLowerCase().includes(q) ||
        a.admissionNo.toLowerCase().includes(q) ||
        a.rollNo.toLowerCase().includes(q) ||
        a.className.toLowerCase().includes(q)
      const matchesClass = classFilter === 'all' || a.className === classFilter
      const matchesStatus = statusFilter === 'all' || a.status === statusFilter
      return matchesQuery && matchesClass && matchesStatus
    })
  }, [accounts, search, classFilter, statusFilter])

  // Apply the single grid cap (see MAX_VISIBLE_ACCOUNTS) after composition.
  const visibleAccounts = useMemo(
    () => filteredAccounts.slice(0, MAX_VISIBLE_ACCOUNTS),
    [filteredAccounts],
  )

  const clearFilters = () => {
    setSearch('')
    setClassFilter('all')
    setStatusFilter('all')
  }

  // ── Honest async states ─────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading student accounts">
        <div className="flex flex-col sm:flex-row gap-2">
          <Skeleton className="h-9 flex-1 max-w-md rounded-md" />
          <Skeleton className="h-9 w-[130px] rounded-md" />
          <Skeleton className="h-9 w-[130px] rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <FeePanel title="Student Accounts" subtitle="canonical fee ledger">
        <FeeEmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Could not load the student fee accounts"
          description={error}
          action={<Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refresh()}>Try again</Button>}
        />
      </FeePanel>
    )
  }

  if (accounts.length === 0) {
    return (
      <FeePanel title="Student Accounts" subtitle="canonical fee ledger">
        <FeeEmptyState
          icon={<User className="h-6 w-6" />}
          title="No fee rows yet"
          description="Student accounts appear here as soon as fee rows exist for them."
          action={<Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refresh()}>Refresh</Button>}
        />
      </FeePanel>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter toolbar — SearchFilterBar pattern: search (flex-1 max-w-md,
          Search lucide absolute left-3, pl-9 h-9 text-xs) + Class and Status
          Select facets (h-9 text-[11px] w-[130px] text-xs triggers), with a
          results summary beside the filters (desktop only). */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, admission no, class…"
            className="pl-9 pr-8 h-9 text-xs"
          />
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Results summary — roster size vs rendered count */}
          <span role="status" className="hidden sm:block text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
            {accounts.length} student{accounts.length === 1 ? '' : 's'} with fees · showing {visibleAccounts.length}
          </span>

          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="h-9 text-[11px] w-[130px] text-xs"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {uniqueClasses.map((cls) => (
                <SelectItem key={cls} value={cls}>{cls}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-[11px] w-[130px] text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibleAccounts.map((a, i) => (
          <motion.button
            key={a.studentId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.28) }}
            onClick={() => setSelectedId(a.studentId)}
            aria-label={`Open account for ${a.name}`}
            className="group rounded-xl border border-border bg-card p-4 text-left hover:border-emerald-500/40 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-semibold',
                  a.status === 'Paid' ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                  : a.status === 'Overdue' ? 'bg-gradient-to-br from-rose-500 to-pink-600'
                  : 'bg-gradient-to-br from-amber-500 to-orange-600',
                )}>
                  {a.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{a.admissionNo || '—'} · {a.className}</p>
                </div>
              </div>
              <FeeStatusBadge status={a.status} />
            </div>
            {/* Billed / Paid / Due — numbers strictly right-aligned under
                their text-[9px] uppercase tracking-wider micro-labels; Due
                turns rose when anything is owed and flips to an emerald
                "Clear" state otherwise. */}
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Billed" value={formatINR(a.billed, true)} align="right" className="px-2 py-1.5" />
              <StatTile label="Paid" value={formatINR(a.paid, true)} accent="emerald" align="right" className="px-2 py-1.5" />
              {a.outstanding > 0
                ? <StatTile label="Due" value={formatINR(a.outstanding, true)} accent="rose" align="right" className="px-2 py-1.5" />
                : <StatTile label="Due" value="Clear" accent="emerald" align="right" className="px-2 py-1.5" />}
            </div>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/40 text-[10px] text-muted-foreground">
              {/* The same canonical transactions the Payments tab shows. */}
              <span>{a.txns.length} payment record{a.txns.length === 1 ? '' : 's'}</span>
              <span className="inline-flex items-center gap-0.5 group-hover:text-emerald-600 transition-colors">
                Open Account <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </motion.button>
        ))}
        {visibleAccounts.length === 0 && (
          <div className="col-span-full">
            <FeeEmptyState
              icon={<User className="h-6 w-6" />}
              title="No students match these filters"
              description="Try a different name, admission no, or relax the class / status filters."
              action={(
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            />
          </div>
        )}
      </div>

      {/* Student Fee Account Drawer */}
      <AnimatePresence>
        {selected && (
          <StudentFeeAccountDrawer
            account={selected}
            sessionLabel={data?.sessionLabel}
            onClose={() => setSelectedId(null)}
            onCollect={() => onCollect(selected.studentId)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Student Fee Account Drawer ──────────────────────────────────────

// THREE top-level tabs (see the file-header IA note): Account · Payments ·
// History — one canonical ledger, three honest views of it.
type AccountTab = 'account' | 'payments' | 'history'

function StudentFeeAccountDrawer({ account, sessionLabel, onClose, onCollect }: {
  account: CanonicalStudentAccount
  sessionLabel?: string
  onClose: () => void
  onCollect: () => void
}) {
  const [tab, setTab] = useState<AccountTab>('account')
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null)

  // Escape dismisses the top-most layer: the receipt preview when one is
  // open, otherwise the drawer itself (backdrop click already does both).
  useDismissOnEscape(() => {
    if (selectedReceiptId) setSelectedReceiptId(null)
    else onClose()
  })

  // Receipt chrome (paper size, school header) — a Settings concern, not
  // ledger data; the receipt engine reads its configuration here.
  const receiptSettings = useFeeStore((s) => s.receiptSettings)

  const selectedReceipt = account.txns.find((t) => t.id === selectedReceiptId && t.receiptNo)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Fee account — ${account.name}`}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-stretch justify-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 35 }}
        className="bg-card border-l border-border w-full max-w-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer header — opaque bg-card so scrim/content never bleeds
            through while the drawer body scrolls beneath. */}
        <div className="shrink-0 border-b border-border bg-card px-5 py-3.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={onClose}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <FeeStatusBadge status={account.status} />
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white font-bold',
              account.status === 'Paid' ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
              : account.status === 'Overdue' ? 'bg-gradient-to-br from-rose-500 to-pink-600'
              : 'bg-gradient-to-br from-amber-500 to-orange-600',
            )}>
              {account.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold truncate">{account.name}</h2>
              <p className="text-[11px] text-muted-foreground font-mono">
                {account.admissionNo || '—'}{account.rollNo ? ` · Roll ${account.rollNo}` : ''} · {account.className}
              </p>
              {(account.guardianName || account.guardianPhone) && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Guardian: {account.guardianName || '—'}{account.guardianPhone ? ` · ${account.guardianPhone}` : ''}
                </p>
              )}
            </div>
            {account.outstanding > 0 && (
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shrink-0" onClick={onCollect}>
                <Wallet className="h-3.5 w-3.5" /> Collect
              </Button>
            )}
          </div>
          {/* Summary stat strip — every tile shares the normalized chrome
              (rounded-lg bg-muted/40 px-2.5 py-1.5 · text-[9px] uppercase
              labels · text-sm font-bold tabular-nums values). */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-3">
            <StatTile label="Billed" value={formatINR(account.billed, true)} />
            <StatTile label="Paid" value={formatINR(account.paid, true)} accent="emerald" />
            <StatTile label="Outstanding" value={formatINR(account.outstanding, true)} accent="rose" />
            <StatTile label="Overdue" value={account.overdue > 0 ? formatINR(account.overdue, true) : '—'} accent="amber" />
            <StatTile label="Fee Lines" value={account.fees.length} />
            <StatTile label="Payments" value={account.txns.length} />
          </div>
        </div>

        {/* Tabs — exactly three top-level sections: Account · Payments ·
            History. */}
        <div className="shrink-0 border-b border-border bg-muted/20 px-3 py-1.5 flex items-center gap-0.5 overflow-x-auto">
          {[
            { value: 'account' as const, label: 'Account', icon: <User className="h-3 w-3" /> },
            { value: 'payments' as const, label: 'Payments', icon: <Wallet className="h-3 w-3" /> },
            { value: 'history' as const, label: 'History', icon: <History className="h-3 w-3" /> },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap',
                tab === t.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'account' && <AccountHome account={account} onCollect={onCollect} />}
          {tab === 'payments' && <AccountPayments account={account} onViewReceipt={(id) => setSelectedReceiptId(id)} />}
          {tab === 'history' && <AccountHistory account={account} />}
        </div>

        {/* Receipt preview modal-in-drawer — only issued receipts. */}
        <AnimatePresence>
          {selectedReceipt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-label={`Receipt ${selectedReceipt.receiptNo} preview`}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setSelectedReceiptId(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card border border-border rounded-xl p-4 max-h-[90vh] overflow-y-auto"
              >
                {/* Canonical A5 dual-copy receipt (SaaS-STAGE-1 consolidation) */}
                <FeeReceiptA5Preview
                  transaction={toStoreFeeTxn(selectedReceipt, { admissionNo: account.admissionNo, sessionLabel })}
                  settings={receiptSettings}
                  onClose={() => setSelectedReceiptId(null)}
                  onPrint={() => { printReceiptA5(toStoreFeeTxn(selectedReceipt, { admissionNo: account.admissionNo, sessionLabel }), receiptSettings); toast.success('Print dialog opened') }}
                  onDownload={() => { downloadReceiptA5(toStoreFeeTxn(selectedReceipt, { admissionNo: account.admissionNo, sessionLabel }), receiptSettings); toast.success('Receipt downloaded', { description: `${selectedReceipt.receiptNo}.html` }) }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

// ─── Account tab ──────────────────────────────────────────────────────

/** AccountHome — the Account tab's landing composition. Answers ONE question
 *  for the Principal: "what is this student's financial position?" —
 *  per-fee lines first (the ledger), then the dues summary with aging. */
function AccountHome({ account, onCollect }: { account: CanonicalStudentAccount; onCollect: () => void }) {
  return (
    <div className="space-y-3">
      <AccountFeeHeads account={account} />
      <AccountDues account={account} onCollect={onCollect} />
    </div>
  )
}

/** The per-fee ledger — one row per canonical Fee row: title, type, due
 *  date, billed/paid/outstanding and the status chip. */
function AccountFeeHeads({ account }: { account: CanonicalStudentAccount }) {
  if (account.fees.length === 0) {
    return (
      <FeePanel title="Fee Heads" subtitle="per-fee position">
        <FeeEmptyState icon={<FileText className="h-5 w-5" />} title="No fee rows for this student" description="Fee rows created for this student appear here." />
      </FeePanel>
    )
  }
  return (
    <FeePanel
      title="Fee Heads"
      subtitle={`${account.fees.length} fee row${account.fees.length === 1 ? '' : 's'} · per-head position`}
    >
      <div className="space-y-1.5">
        {account.fees.map((fee) => (
          <FeeLineRow key={fee.id} fee={fee} />
        ))}
      </div>
    </FeePanel>
  )
}

function FeeLineRow({ fee }: { fee: CanonicalFeeLine }) {
  const typeMeta = canonicalFeeTypeLabel(fee.type)
  return (
    <div className="rounded-md border border-border/60 px-2.5 py-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium truncate">{fee.title}</p>
          <p className="text-[9px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', typeMeta.dot)} aria-hidden />
              {typeMeta.label}
            </span>
            {' · '}due {fee.dueDate ? formatDate(fee.dueDate) : '—'}
            {fee.overdue ? ` · ${fee.daysOverdue}d overdue` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] font-bold tabular-nums">{formatINR(fee.amount, true)}</p>
          <p className={cn('text-[9px] tabular-nums', fee.outstanding === 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600')}>
            {fee.outstanding === 0 ? 'Paid' : `${formatINR(fee.outstanding, true)} due`}
          </p>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[9px] text-muted-foreground tabular-nums">{formatINR(fee.paid, true)} paid</span>
        <FeeStatusBadge status={feeLineStatusDisplay(fee)} />
      </div>
    </div>
  )
}

function AccountDues({ account, onCollect }: { account: CanonicalStudentAccount; onCollect: () => void }) {
  return (
    <FeePanel title="Dues & Outstanding" subtitle="canonical fee ledger">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <FeeStat label="Outstanding" value={formatINR(account.outstanding, true)} accent="rose" />
          <FeeStat label="Overdue" value={account.overdue > 0 ? formatINR(account.overdue, true) : '—'} accent="amber" />
          <FeeStat label="Total Due" value={formatINR(account.outstanding, true)} />
        </div>
        {account.daysOverdue > 0 && account.overdue > 0 && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-700 dark:text-rose-300">
              This account is <strong>{account.daysOverdue} days overdue</strong> — {formatINR(account.overdue, true)} of the balance is past its due date.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground">
            Last payment: {account.lastPaymentAt ? formatDate(account.lastPaymentAt) : 'No payments yet'}
          </p>
          {account.outstanding > 0 && (
            <Button size="sm" className="h-7 text-[10px] gap-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white" onClick={onCollect}>
              <Wallet className="h-3 w-3" /> Collect Now
            </Button>
          )}
        </div>
      </div>
    </FeePanel>
  )
}

// ─── Payments tab ─────────────────────────────────────────────────────

function AccountPayments({ account, onViewReceipt }: { account: CanonicalStudentAccount; onViewReceipt: (id: string) => void }) {
  return (
    <FeePanel title="Payment History" subtitle={`${account.txns.length} payment record${account.txns.length === 1 ? '' : 's'} · canonical transactions`} bodyClassName="p-0">
      <div className="overflow-x-auto max-h-[28rem]">
        <table className="w-full text-xs min-w-[32rem]">
          <thead className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_0_hsl(var(--border))]">
            <tr>
              <th className="text-left px-3 py-2 text-[9px] uppercase font-semibold text-muted-foreground">Receipt</th>
              <th className="text-right px-3 py-2 text-[9px] uppercase font-semibold text-muted-foreground">Amount</th>
              <th className="text-center px-3 py-2 text-[9px] uppercase font-semibold text-muted-foreground">Mode</th>
              <th className="text-center px-3 py-2 text-[9px] uppercase font-semibold text-muted-foreground">Status</th>
              <th className="text-left px-3 py-2 text-[9px] uppercase font-semibold text-muted-foreground">Date</th>
              <th className="text-left px-3 py-2 text-[9px] uppercase font-semibold text-muted-foreground">Collected By</th>
              <th className="text-right px-3 py-2 text-[9px] uppercase font-semibold text-muted-foreground"><span className="sr-only">Receipt document</span>A5</th>
            </tr>
          </thead>
          <tbody>
            {account.txns.map((t) => {
              const mode = canonicalMethodLabel(t.method)
              return (
                <tr key={t.id} className="border-t border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-mono text-[10px]">{t.receiptNo ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-600">{formatINR(t.amount)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ring-1', modeAccent(mode))}>
                      <ModeIcon mode={mode} className="h-2.5 w-2.5" />
                      {mode}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center"><CanonicalTxnStatusBadge status={t.status} /></td>
                  <td className="px-3 py-2.5 text-muted-foreground text-[10px]">{formatDate(t.collectedAt ?? t.createdAt)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-[10px]">{t.collectedByName ?? '—'}</td>
                  {/* Receipt belongs to the payment record — rows with an
                      issued receipt carry their A5 dual-copy receipt action
                      (canonical engine, opened via the drawer preview). */}
                  <td className="px-3 py-2.5 text-right">
                    {t.receiptNo ? (
                      <Button
                        size="sm" variant="ghost"
                        className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => onViewReceipt(t.id)}
                        aria-label={`View A5 receipt ${t.receiptNo}`}
                      >
                        <FileText className="h-3 w-3" /> View
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50" title="No receipt issued yet">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {account.txns.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">
                No payments recorded yet. Collections appear here with their receipts as they are recorded.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground border-t border-border/40 px-3 py-2">
        Open any issued receipt to view or print it. Pending collections receive their receipt on verification.
      </p>
    </FeePanel>
  )
}

// ─── History tab ──────────────────────────────────────────────────────

type HistoryEvent = {
  at: string
  icon: React.ReactNode
  title: string
  detail: string
  tone: string
}

/** AccountHistory — the auditable account timeline assembled from the
 *  canonical rows themselves: fees assessed, payments collected,
 *  verifications and rejections with their actors. Nothing invented. */
function AccountHistory({ account }: { account: CanonicalStudentAccount }) {
  const events = useMemo<HistoryEvent[]>(() => {
    const out: HistoryEvent[] = []
    for (const fee of account.fees) {
      out.push({
        at: fee.createdAt,
        icon: <FileText className="h-3 w-3" />,
        title: `Fee assessed — ${fee.title}`,
        detail: `${formatINR(fee.amount, true)}${fee.dueDate ? ` · due ${formatDate(fee.dueDate)}` : ''}`,
        tone: 'bg-emerald-500/10 text-emerald-600',
      })
    }
    for (const t of account.txns) {
      const mode = canonicalMethodLabel(t.method)
      out.push({
        at: t.collectedAt ?? t.createdAt,
        icon: <Wallet className="h-3 w-3" />,
        title: `Payment collected — ${formatINR(t.amount, true)}`,
        detail: `${mode} · by ${t.collectedByName ?? 'the office'}${t.receiptNo ? ` · ${t.receiptNo}` : ''}`,
        tone: 'bg-sky-500/10 text-sky-600',
      })
      if (isVerifiedTxnStatus(t.status) && t.verifiedAt) {
        out.push({
          at: t.verifiedAt,
          icon: <BadgeCheck className="h-3 w-3" />,
          title: `Verified — ${formatINR(t.amount, true)}`,
          detail: `by ${t.verifiedByName ?? 'the Principal'}${t.receiptNo ? ` · receipt ${t.receiptNo} issued` : ''}`,
          tone: 'bg-emerald-500/10 text-emerald-600',
        })
      }
      if (isRejectedTxnStatus(t.status) && t.rejectedAt) {
        out.push({
          at: t.rejectedAt,
          icon: <Ban className="h-3 w-3" />,
          title: `Rejected — ${formatINR(t.amount, true)}`,
          detail: `by ${t.rejectedByName ?? 'the office'}${t.rejectionReason ? ` · “${t.rejectionReason}”` : ''} · the student ledger was never touched`,
          tone: 'bg-rose-500/10 text-rose-600',
        })
      }
    }
    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [account])

  return (
    <FeePanel title="Activity History" subtitle="fees assessed, payments collected, verified and rejected">
      <div className="space-y-2">
        {events.length > 0 ? events.map((ev, i) => (
          <div key={`${ev.at}-${i}`} className="flex items-start gap-2 rounded-md border border-border/40 px-2 py-1.5">
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', ev.tone)}>
              {ev.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium">{ev.title}</p>
              <p className="text-[9px] text-muted-foreground">{ev.detail}</p>
            </div>
            <span className="text-[9px] text-muted-foreground whitespace-nowrap shrink-0">{formatDate(ev.at)}</span>
          </div>
        )) : (
          <FeeEmptyState icon={<ShieldCheck className="h-5 w-5" />} title="No activity yet" description="Fee rows and collections for this student appear here." />
        )}
      </div>
    </FeePanel>
  )
}
