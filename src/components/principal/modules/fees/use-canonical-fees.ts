'use client'

/**
 * use-canonical-fees — the Fee Management module's canonical DB reader.
 *
 * The Principal's fee surfaces (Overview · Transactions · Student Accounts ·
 * Payments summary) render from the ONE server fee ledger:
 *
 *   GET /api/fees               → Fee rows (title/amount/paid/dueDate/status
 *                                 + the student snapshot + per-fee payments)
 *   GET /api/fees/transactions  → FeeTransaction rows (the payment ledger:
 *                                 receipts, verification trail, gateways)
 *   GET /api/classes            → classId → display-name resolution
 *
 * One shared, coalesced fetch (module-level cache) feeds every consumer —
 * the same numbers render on every tab. The hook exposes loading / error /
 * refresh, and a `scholario:canonical-fees-refresh` window event lets write
 * surfaces (e.g. the collect modal, after the DB records a payment) ask
 * every mounted reader to re-sync.
 *
 * Derivations (all pure, all from the fetched rows — nothing fabricated):
 *   · totals               — billed / collected / outstanding / overdue /
 *                            students-with-fees / pending-verification
 *   · byHead               — per fee title: billed / paid / outstanding
 *   · byClass              — per student class: expected / collected /
 *                            outstanding + rate
 *   · monthly              — verified collections (+ pending) bucketed by
 *                            month over a 3-month window ending at the
 *                            latest recorded month; empty months show 0
 *   · students             — per-student accounts: billed/paid/outstanding,
 *                            per-fee lines (status/dueDate), that student's
 *                            transactions
 *
 * Overdue = outstanding on a fee whose dueDate falls before the end of
 * today. Money is never invented: a month without transactions renders ₹0.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { FeeTransaction as StoreFeeTransaction, PaymentMode, CollectorRole } from '@/lib/store/fee-store'
import { useCurrentUser } from '@/lib/store/current-user-store'

// ─── Payload types (mirror the API serialization) ─────────────────────

export interface CanonicalFeePayment {
  id: string
  feeId: string
  amount: number
  method: string
  status: string
  transactionId: string | null
  note: string | null
  createdAt: string
}

export interface CanonicalFeeStudent {
  id: string
  classId: string
  rollNo: string | null
  admissionNo: string | null
  guardianName: string | null
  guardianPhone: string | null
  user: { name: string } | null
}

export interface CanonicalFeeRow {
  id: string
  schoolId: string
  studentId: string
  title: string
  amount: number
  paid: number
  type: string
  dueDate: string | null
  status: string
  method: string | null
  paidDate: string | null
  createdAt: string
  student: CanonicalFeeStudent
  payments: CanonicalFeePayment[]
}

export interface CanonicalTxn {
  id: string
  schoolId: string
  studentId: string | null
  studentName: string | null
  className: string | null
  structureId: string | null
  feeHeadName: string | null
  amount: number
  method: string
  status: string
  source: string | null
  feeId: string | null
  collectedById: string | null
  collectedByName: string | null
  collectedAt: string | null
  verifiedById: string | null
  verifiedByName: string | null
  verifiedAt: string | null
  rejectedById: string | null
  rejectedByName: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  referenceNumber: string | null
  gatewayOrderId: string | null
  gatewayPaymentId: string | null
  gatewaySignature: string | null
  gatewayName: string | null
  settlementId: string | null
  reconciliationStatus: string | null
  reconciliationNote: string | null
  reconciledAt: string | null
  reconciledBy: string | null
  receiptNo: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}

interface ClassRow {
  id: string
  name: string
  section?: string | null
}

// ─── Derived types ────────────────────────────────────────────────────

/** One fee row, ledger-normalised for display. */
export interface CanonicalFeeLine {
  id: string
  title: string
  type: string
  amount: number
  paid: number
  outstanding: number
  dueDate: string | null
  status: string
  overdue: boolean
  daysOverdue: number
  /** When the fee row was created (History timeline). */
  createdAt: string
}

export type CanonicalAccountStatus = 'Paid' | 'Partially Paid' | 'Due' | 'Overdue'

/** Per-student account — the canonical student ledger. */
export interface CanonicalStudentAccount {
  studentId: string
  name: string
  classId: string
  className: string
  rollNo: string
  admissionNo: string
  guardianName: string
  guardianPhone: string
  billed: number
  paid: number
  outstanding: number
  overdue: number
  status: CanonicalAccountStatus
  /** Oldest overdue fee, in days past due (0 when nothing is overdue). */
  daysOverdue: number
  fees: CanonicalFeeLine[]
  txns: CanonicalTxn[]
  lastPaymentAt: string | null
}

export interface CanonicalHeadBreakdown {
  title: string
  billed: number
  paid: number
  outstanding: number
  color: string
}

export interface CanonicalClassBreakdown {
  classId: string
  className: string
  students: number
  billed: number
  collected: number
  outstanding: number
  collectionRate: number
}

export interface CanonicalMonthPoint {
  month: string
  collected: number
  pending: number
}

export interface CanonicalFeeTotals {
  billed: number
  collected: number
  outstanding: number
  overdue: number
  studentsWithFees: number
  studentsWithDues: number
  overdueStudents: number
  pendingCount: number
  pendingAmount: number
}

export interface CanonicalFeesData {
  fees: CanonicalFeeRow[]
  txns: CanonicalTxn[]
  totals: CanonicalFeeTotals
  byHead: CanonicalHeadBreakdown[]
  byClass: CanonicalClassBreakdown[]
  monthly: CanonicalMonthPoint[]
  students: CanonicalStudentAccount[]
  studentsById: Map<string, CanonicalStudentAccount>
  feeById: Map<string, CanonicalFeeRow>
  /** Display label for the academic session, e.g. "2026-27". */
  sessionLabel: string
}

// ─── Status / label helpers (one vocabulary for every tab) ────────────

/** txn statuses that still await the Principal's decision. */
export function isPendingTxnStatus(status: string): boolean {
  return status === 'PENDING_VERIFICATION' || status === 'UNDER_VERIFICATION' || status === 'PENDING'
}

/** txn statuses that represent settled money. */
export function isVerifiedTxnStatus(status: string): boolean {
  return status === 'SUCCESS' || status === 'VERIFIED'
}

/** txn statuses that were returned / never applied to the ledger. */
export function isRejectedTxnStatus(status: string): boolean {
  return status === 'REJECTED' || status === 'FAILED'
}

export interface TxnStatusMeta {
  label: string
  accent: string
}

/** Status badge meta for a canonical FeeTransaction — the module's badge
 *  recipe: VERIFIED = emerald · PENDING/UNDER = amber · REJECTED = rose. */
export function txnStatusMeta(status: string): TxnStatusMeta {
  if (isVerifiedTxnStatus(status)) {
    return { label: 'Verified', accent: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' }
  }
  if (isPendingTxnStatus(status)) {
    return { label: 'Pending verification', accent: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' }
  }
  if (isRejectedTxnStatus(status)) {
    return { label: 'Rejected', accent: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' }
  }
  if (status === 'REFUNDED') {
    return { label: 'Refunded', accent: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' }
  }
  return { label: status, accent: 'bg-muted text-muted-foreground' }
}

/** Display status for a fee line — matches the shared FeeStatusBadge
 *  accent vocabulary (Paid=emerald · Partially Paid=amber · Overdue=rose). */
export function feeLineStatusDisplay(line: Pick<CanonicalFeeLine, 'status' | 'overdue' | 'outstanding' | 'paid'>): string {
  if (line.outstanding <= 0) return 'Paid'
  if (line.paid > 0 || line.status === 'PARTIAL') return 'Partially Paid'
  return line.overdue ? 'Overdue' : 'Due'
}

/** Canonical DB method ("CASH", "NET_BANKING"…) → the module's PaymentMode
 *  chip vocabulary (feeds ModeIcon / modeAccent). */
export function canonicalMethodLabel(method: string): PaymentMode {
  switch (method?.toUpperCase().replace(/[\s-]+/g, '_')) {
    case 'UPI': return 'UPI'
    case 'CARD':
    case 'DEBIT_CARD':
    case 'CREDIT_CARD': return 'Card'
    case 'NET_BANKING':
    case 'NETBANKING': return 'Net Banking'
    case 'CASH': return 'Cash'
    case 'CHEQUE': return 'Cheque'
    case 'BANK_TRANSFER': return 'Bank Transfer'
    default: return method as PaymentMode
  }
}

/** Operational source → the shared SourceChip collector-role vocabulary
 *  (Office / Teacher / Class Teacher / Student — gateway is a channel). */
export function canonicalSourceRole(source: string | null | undefined): CollectorRole {
  switch (source) {
    case 'TEACHER': return 'teacher'
    case 'CLASS_TEACHER': return 'class_teacher'
    case 'STUDENT':
    case 'SELF':
    case 'ONLINE': return 'self'
    case 'SCHOOL_OFFICE':
    case 'PRINCIPAL':
    default: return 'principal'
  }
}

/** Fee-head colour — the module chart palette keyed by the fee type. */
export function canonicalHeadColor(type: string | null | undefined): string {
  switch (type) {
    case 'TUITION': return 'oklch(0.55 0.14 162)'
    case 'TRANSPORT': return 'oklch(0.65 0.16 75)'
    case 'EXAMINATION':
    case 'EXAM': return 'oklch(0.7 0.15 200)'
    default: return 'oklch(0.65 0.15 250)'
  }
}

/** "TUITION" → Core Fee · "EXAMINATION" → Examination Fee (chip labels). */
export function canonicalFeeTypeLabel(type: string | null | undefined): { label: string; dot: string } {
  switch (type) {
    case 'EXAMINATION':
    case 'EXAM': return { label: 'Examination Fee', dot: 'bg-cyan-500' }
    case 'TRANSPORT':
    case 'TUITION':
    default: return { label: 'Core Fee', dot: 'bg-emerald-500' }
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────

/** End of the current local day — a fee is overdue when dueDate < this. */
export function endOfToday(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

/** Whole days a due date is past (>= 0; 0 = due today / not past). */
export function daysPastDue(dueDate: string | null, ref: Date = endOfToday()): number {
  if (!dueDate) return 0
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return 0
  const ms = ref.getTime() - due.getTime()
  return ms > 0 ? Math.floor(ms / 86_400_000) : 0
}

function latestIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** YYYY-MM-DD slice of an ISO instant (safe for date-only strings). */
export function isoDate(iso: string | null | undefined): string {
  return (iso ?? '').slice(0, 10)
}

// ─── Derivation ───────────────────────────────────────────────────────

function sessionLabelOf(): string {
  // School session from the authenticated user's school profile (server
  // truth); the raw "2026-2027" is shortened to the label "2026-27".
  const year = useCurrentUser.getState().me?.school?.academicYear ?? ''
  if (/^\d{4}-\d{4}$/.test(year)) return `${year.slice(0, 4)}-${year.slice(7, 9)}`
  return year || '—'
}

function derive(fees: CanonicalFeeRow[], txns: CanonicalTxn[], classes: ClassRow[]): CanonicalFeesData {
  const endToday = endOfToday()
  const classNameById = new Map(classes.map((c) => [c.id, c.name]))
  // Txn rows carry a display-ready className ("Grade 9 - A") — prefer it
  // for students that have transacted, it is the same DB relation.
  const classNameByStudent = new Map<string, string>()
  for (const t of txns) {
    if (t.studentId && t.className && !classNameByStudent.has(t.studentId)) classNameByStudent.set(t.studentId, t.className)
  }

  // ── Per-student accounts ──────────────────────────────────────────
  const byStudent = new Map<string, CanonicalStudentAccount>()
  for (const f of fees) {
    const sid = f.studentId
    let acct = byStudent.get(sid)
    if (!acct) {
      acct = {
        studentId: sid,
        name: f.student?.user?.name ?? 'Unknown student',
        classId: f.student?.classId ?? '',
        className: classNameByStudent.get(sid) ?? classNameById.get(f.student?.classId ?? '') ?? f.student?.classId ?? '—',
        rollNo: f.student?.rollNo ?? '',
        admissionNo: f.student?.admissionNo ?? '',
        guardianName: f.student?.guardianName ?? '',
        guardianPhone: f.student?.guardianPhone ?? '',
        billed: 0,
        paid: 0,
        outstanding: 0,
        overdue: 0,
        status: 'Paid',
        daysOverdue: 0,
        fees: [],
        txns: [],
        lastPaymentAt: null,
      }
      byStudent.set(sid, acct)
    }
    const outstanding = Math.max(0, f.amount - f.paid)
    const overdue = outstanding > 0 && daysPastDue(f.dueDate, endToday) > 0
    acct.billed += f.amount
    acct.paid += f.paid
    acct.outstanding += outstanding
    if (overdue) {
      acct.overdue += outstanding
      acct.daysOverdue = Math.max(acct.daysOverdue, daysPastDue(f.dueDate, endToday))
    }
    acct.lastPaymentAt = latestIso(acct.lastPaymentAt, f.paidDate)
    acct.fees.push({
      id: f.id,
      title: f.title,
      type: f.type,
      amount: f.amount,
      paid: f.paid,
      outstanding,
      dueDate: f.dueDate,
      status: f.status,
      overdue,
      daysOverdue: daysPastDue(f.dueDate, endToday),
      createdAt: f.createdAt,
    })
  }
  for (const t of txns) {
    const acct = t.studentId ? byStudent.get(t.studentId) : undefined
    if (!acct) continue
    acct.txns.push(t)
    acct.lastPaymentAt = latestIso(acct.lastPaymentAt, t.collectedAt)
  }
  const students = Array.from(byStudent.values())
  for (const acct of students) {
    // Fee lines read earliest-due-first — the collection worklist order.
    acct.fees.sort((a, b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
      return ad - bd
    })
    acct.txns.sort((a, b) => new Date(b.collectedAt ?? b.createdAt).getTime() - new Date(a.collectedAt ?? a.createdAt).getTime())
    acct.status = acct.overdue > 0
      ? 'Overdue'
      : acct.outstanding > 0
        ? (acct.paid > 0 ? 'Partially Paid' : 'Due')
        : 'Paid'
  }
  students.sort((a, b) => a.name.localeCompare(b.name))

  // ── School totals ─────────────────────────────────────────────────
  const billed = students.reduce((s, a) => s + a.billed, 0)
  const collected = students.reduce((s, a) => s + a.paid, 0)
  const outstanding = students.reduce((s, a) => s + a.outstanding, 0)
  const overdue = students.reduce((s, a) => s + a.overdue, 0)
  const pendingTxns = txns.filter((t) => isPendingTxnStatus(t.status))
  const totals: CanonicalFeeTotals = {
    billed,
    collected,
    outstanding,
    overdue,
    studentsWithFees: students.length,
    studentsWithDues: students.filter((a) => a.outstanding > 0).length,
    overdueStudents: students.filter((a) => a.overdue > 0).length,
    pendingCount: pendingTxns.length,
    pendingAmount: pendingTxns.reduce((s, t) => s + t.amount, 0),
  }

  // ── Per fee head ──────────────────────────────────────────────────
  const headMap = new Map<string, CanonicalHeadBreakdown>()
  for (const f of fees) {
    const existing = headMap.get(f.title) ?? { title: f.title, billed: 0, paid: 0, outstanding: 0, color: canonicalHeadColor(f.type) }
    existing.billed += f.amount
    existing.paid += f.paid
    existing.outstanding += Math.max(0, f.amount - f.paid)
    headMap.set(f.title, existing)
  }
  const byHead = Array.from(headMap.values()).sort((a, b) => b.billed - a.billed)

  // ── Per class ─────────────────────────────────────────────────────
  const classMap = new Map<string, CanonicalClassBreakdown>()
  for (const a of students) {
    const row = classMap.get(a.classId) ?? {
      classId: a.classId,
      className: a.className,
      students: 0,
      billed: 0,
      collected: 0,
      outstanding: 0,
      collectionRate: 0,
    }
    row.students += 1
    row.billed += a.billed
    row.collected += a.paid
    row.outstanding += a.outstanding
    classMap.set(a.classId, row)
  }
  const byClass = Array.from(classMap.values()).map((r) => ({
    ...r,
    collectionRate: r.billed > 0 ? Math.round((r.collected / r.billed) * 1000) / 10 : 0,
  })).sort((a, b) => b.outstanding - a.outstanding)

  // ── Monthly trend (3-month window ending at the latest recorded
  //    month; verified by verifiedAt→collectedAt, pending by
  //    collectedAt; empty months honestly render 0) ──────────────────
  let endRef: { year: number; month: number } | null = null
  for (const t of txns) {
    const stamp = t.verifiedAt ?? t.collectedAt ?? t.createdAt
    const d = new Date(stamp)
    if (Number.isNaN(d.getTime())) continue
    if (!endRef || d.getFullYear() > endRef.year || (d.getFullYear() === endRef.year && d.getMonth() > endRef.month)) {
      endRef = { year: d.getFullYear(), month: d.getMonth() }
    }
  }
  if (!endRef) {
    const now = new Date()
    endRef = { year: now.getFullYear(), month: now.getMonth() }
  }
  const monthly: CanonicalMonthPoint[] = []
  for (let i = 2; i >= 0; i--) {
    const d = new Date(endRef.year, endRef.month - i, 1)
    monthly.push({ month: MONTH_LABELS[d.getMonth()], collected: 0, pending: 0 })
  }
  const bucketIndexOf = (stamp: string | null | undefined): number => {
    if (!stamp) return -1
    const d = new Date(stamp)
    if (Number.isNaN(d.getTime())) return -1
    for (let i = 0; i < monthly.length; i++) {
      const start = new Date(endRef!.year, endRef!.month - (monthly.length - 1 - i), 1)
      const end = new Date(endRef!.year, endRef!.month - (monthly.length - 1 - i) + 1, 1)
      if (d >= start && d < end) return i
    }
    return -1
  }
  for (const t of txns) {
    if (isVerifiedTxnStatus(t.status)) {
      const idx = bucketIndexOf(t.verifiedAt ?? t.collectedAt ?? t.createdAt)
      if (idx >= 0) monthly[idx].collected += t.amount
    } else if (isPendingTxnStatus(t.status)) {
      const idx = bucketIndexOf(t.collectedAt ?? t.createdAt)
      if (idx >= 0) monthly[idx].pending += t.amount
    }
  }

  return {
    fees,
    txns,
    totals,
    byHead,
    byClass,
    monthly,
    students,
    studentsById: new Map(students.map((a) => [a.studentId, a])),
    feeById: new Map(fees.map((f) => [f.id, f])),
    sessionLabel: sessionLabelOf(),
  }
}

// ─── Shared fetch (one per page load, coalesced) ──────────────────────

interface CanonicalFeesState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: CanonicalFeesData | null
  error: string | null
}

let state: CanonicalFeesState = { status: 'idle', data: null, error: null }
let fetchedAt = 0
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
const FRESH_FOR_MS = 60_000

function setState(next: Partial<CanonicalFeesState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

async function load(force = false): Promise<void> {
  if (inflight) return inflight
  if (!force && (state.status === 'ready' || state.status === 'loading')) return
  setState({ status: 'loading', error: null })
  inflight = (async () => {
    try {
      const [feesRes, txnsRes, classesRes] = await Promise.all([
        fetch('/api/fees', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/fees/transactions?limit=500', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/classes', { cache: 'no-store', credentials: 'same-origin' }),
      ])
      if (!feesRes.ok) throw new Error(`Fee ledger request failed (${feesRes.status}).`)
      if (!txnsRes.ok) throw new Error(`Fee transactions request failed (${txnsRes.status}).`)
      // All three endpoints wrap payloads in the { ok, data } envelope —
      // unwrap defensively (raw arrays pass through for safety).
      const unwrap = <T,>(j: unknown): T[] => {
        if (Array.isArray(j)) return j as T[]
        const env = j as { data?: unknown }
        if (Array.isArray(env?.data)) return env.data as T[]
        throw new Error('Unexpected fee ledger response shape.')
      }
      const fees = unwrap<CanonicalFeeRow>(await feesRes.json())
      const txns = unwrap<CanonicalTxn>(await txnsRes.json())
      let classes: ClassRow[] = []
      if (classesRes.ok) {
        const parsed = (await classesRes.json()) as ClassRow[] | { data?: ClassRow[] }
        classes = Array.isArray(parsed) ? parsed : (parsed?.data ?? [])
      }
      fetchedAt = Date.now()
      setState({ status: 'ready', data: derive(fees, txns, classes), error: null })
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : 'Could not load the fee ledger.' })
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** Window event write surfaces dispatch after the DB records a payment —
 *  every mounted canonical reader re-syncs. */
export const CANONICAL_FEES_REFRESH_EVENT = 'scholario:canonical-fees-refresh'

export function notifyCanonicalFeesRefresh() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CANONICAL_FEES_REFRESH_EVENT))
}

// ─── The hook ─────────────────────────────────────────────────────────

export interface UseCanonicalFeesResult extends CanonicalFeesState {
  loading: boolean
  refresh: () => Promise<void>
}

export function useCanonicalFees(): UseCanonicalFeesResult {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb)
    return () => { listeners.delete(cb) }
  }, [])
  const getSnapshot = useCallback(() => state, [])
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Initial fetch on first consumer; quietly re-sync stale data (> 60s).
  useEffect(() => {
    if (state.status === 'idle') void load()
    else if (state.status === 'ready' && Date.now() - fetchedAt > FRESH_FOR_MS) void load(true)
  }, [])

  useEffect(() => {
    const onRefresh = () => { void load(true) }
    window.addEventListener(CANONICAL_FEES_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(CANONICAL_FEES_REFRESH_EVENT, onRefresh)
  }, [])

  const refresh = useCallback(() => load(true), [])

  return { ...snap, loading: snap.status === 'loading', refresh }
}

// ─── Receipt-engine adapter ───────────────────────────────────────────

/**
 * Adapt a canonical FeeTransaction to the store `FeeTransaction` shape the
 * shared A5 receipt engine (fee-receipt-a5.tsx) renders from. Every rupee,
 * receipt number, name and date comes from the canonical row — the adapter
 * only supplies the shape.
 */
export function toStoreFeeTxn(
  t: CanonicalTxn,
  opts?: { admissionNo?: string; sessionLabel?: string },
): StoreFeeTransaction {
  const collectedIso = t.collectedAt ?? t.createdAt
  return {
    id: t.id,
    receiptNo: t.receiptNo ?? '—',
    studentId: t.studentId ?? '',
    studentName: t.studentName ?? '—',
    admissionNo: opts?.admissionNo ?? '',
    className: t.className ?? '',
    classId: '',
    amount: t.amount,
    mode: canonicalMethodLabel(t.method),
    status: isVerifiedTxnStatus(t.status)
      ? 'Success'
      : isRejectedTxnStatus(t.status)
        ? 'Failed'
        : 'Under Verification',
    date: isoDate(collectedIso),
    recordedAt: collectedIso,
    purpose: t.note ?? 'Fee payment',
    feeHead: t.feeHeadName ?? 'Fee',
    collectedBy: t.collectedByName ?? 'School Office',
    verifiedBy: t.verifiedByName,
    verifiedAt: t.verifiedAt,
    referenceNo: t.referenceNumber,
    academicYear: opts?.sessionLabel ?? '',
    gateway: (t.gatewayName as StoreFeeTransaction['gateway']) ?? undefined,
    gatewayPaymentId: t.gatewayPaymentId ?? undefined,
    gatewayOrderId: t.gatewayOrderId ?? undefined,
    settlementId: t.settlementId ?? undefined,
  }
}
