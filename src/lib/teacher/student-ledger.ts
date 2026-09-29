/**
 * teacher/student-ledger — the ONE canonical per-student fee + attendance
 * derivation used by every Teacher surface (Student Directory, the shared
 * Student Profile, Fees & Payments). Pure functions: no db import, no
 * client/server coupling — the routes fetch rows their own (batched) way
 * and every module renders the SAME numbers (master task §11/§22).
 */

// ── DTO types (server-computed, client-rendered) ─────────────────────

export interface FeeItemDto {
  id: string
  title: string
  amount: number
  paid: number
  outstanding: number
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE'
  dueDate: string | null
  method: string | null
}

/** ONE payment history entry — canonical FeeTransaction rows (with
 * source / verification / receipt) UNION pre-workflow legacy Payment
 * rows (no transactionId — they predate the workflow and are tagged as
 * office records). Every surface renders this same union. */
export interface StudentPaymentDto {
  id: string
  txnId: string | null
  feeTitle: string
  amount: number
  method: string | null
  status: string
  createdAt: string
  source: string | null
  sourceLabel: string | null
  receiptNo: string | null
  collectedBy: string | null
  verifiedBy: string | null
  rejectionReason: string | null
}

export interface StudentFeesDto {
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'NONE'
  totalBilled: number
  totalPaid: number
  outstanding: number
  awaitingVerification: number
  lastPaymentAt: string | null
  items: FeeItemDto[]
  payments: StudentPaymentDto[]
}

export interface AttendanceSummaryDto {
  pct: number | null
  records: number
  present: number
  absent: number
  late: number
  leave: number
  /** newest-first, capped by the caller */
  recent: { date: string; status: string }[]
}

// ── inputs (structurally typed — both Prisma rows and test fixtures fit) ──

interface FeeRowInput {
  id: string
  title: string
  amount: number
  paid: number
  dueDate: Date | null
  method: string | null
}

interface LegacyPaymentInput {
  id: string
  feeId: string | null
  amount: number
  method: string | null
  status: string
  createdAt: Date
  transactionId: string | null
}

interface TxnRowInput {
  id: string
  feeHeadName: string | null
  feeId: string | null
  amount: number
  method: string
  status: string
  source: string | null
  receiptNo: string | null
  collectedByName: string | null
  collectedAt: Date | null
  createdAt: Date
  verifiedByName: string | null
  rejectionReason: string | null
}

interface AttRowInput {
  date: Date
  status: string
}

// ── derivations ──────────────────────────────────────────────────────

const PENDING_STATUSES = ['PENDING_VERIFICATION', 'UNDER_VERIFICATION', 'PENDING']

/**
 * The canonical per-student fee ledger. `feeRows` = the student's Fee rows
 * (with their legacy Payment children); `txnRows` = the student's canonical
 * FeeTransaction rows (any source). Both must be school-scoped and
 * student-scoped by the CALLER — this function never queries.
 */
export function deriveStudentFees(
  feeRows: (FeeRowInput & { payments: LegacyPaymentInput[] })[],
  txnRows: TxnRowInput[],
  endOfToday: Date,
): StudentFeesDto {
  if (feeRows.length === 0) {
    return {
      status: 'NONE',
      totalBilled: 0,
      totalPaid: 0,
      outstanding: 0,
      awaitingVerification: 0,
      lastPaymentAt: null,
      items: [],
      payments: [],
    }
  }
  const feeTitleByFeeId = new Map(feeRows.map((f) => [f.id, f.title]))
  const items: FeeItemDto[] = feeRows.map((f) => {
    const outstanding = Math.max(0, f.amount - f.paid)
    const status: FeeItemDto['status'] =
      outstanding <= 0
        ? 'PAID'
        : f.dueDate && f.dueDate < endOfToday
          ? 'OVERDUE'
          : f.paid > 0
            ? 'PARTIAL'
            : 'UNPAID'
    return {
      id: f.id,
      title: f.title,
      amount: f.amount,
      paid: f.paid,
      outstanding,
      status,
      dueDate: f.dueDate ? f.dueDate.toISOString().slice(0, 10) : null,
      method: f.method,
    }
  })
  // history = canonical transactions ∪ pre-workflow legacy office payments
  const legacyPayments: StudentPaymentDto[] = feeRows.flatMap((f) =>
    f.payments
      .filter((p) => !p.transactionId)
      .map((p) => ({
        id: p.id,
        txnId: null,
        feeTitle: p.feeId ? feeTitleByFeeId.get(p.feeId) ?? f.title : f.title,
        amount: p.amount,
        method: p.method,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        source: 'SCHOOL_OFFICE',
        sourceLabel: 'School Office record',
        receiptNo: null,
        collectedBy: null,
        verifiedBy: null,
        rejectionReason: null,
      })),
  )
  const txnPayments: StudentPaymentDto[] = txnRows.map((t) => ({
    id: t.id,
    txnId: t.id,
    feeTitle: t.feeHeadName ?? (t.feeId ? feeTitleByFeeId.get(t.feeId) ?? 'Fee' : 'Fee'),
    amount: t.amount,
    method: t.method,
    status: t.status,
    createdAt: (t.collectedAt ?? t.createdAt).toISOString(),
    source: t.source,
    sourceLabel: null,
    receiptNo: t.receiptNo,
    collectedBy: t.collectedByName,
    verifiedBy: t.verifiedByName,
    rejectionReason: t.rejectionReason,
  }))
  const payments = [...txnPayments, ...legacyPayments]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 12)
  const outstanding = items.reduce((sum, i) => sum + i.outstanding, 0)
  const status: StudentFeesDto['status'] =
    outstanding <= 0
      ? 'PAID'
      : items.some((i) => i.status === 'OVERDUE')
        ? 'OVERDUE'
        : items.some((i) => i.paid > 0)
          ? 'PARTIAL'
          : 'UNPAID'
  return {
    status,
    totalBilled: feeRows.reduce((sum, f) => sum + f.amount, 0),
    totalPaid: feeRows.reduce((sum, f) => sum + Math.min(f.amount, f.paid), 0),
    outstanding,
    awaitingVerification: txnRows
      .filter((t) => PENDING_STATUSES.includes(t.status))
      .reduce((sum, t) => sum + t.amount, 0),
    lastPaymentAt: payments[0]?.createdAt ?? null,
    items: items.slice(0, 8),
    payments,
  }
}

/** The canonical per-student attendance summary (PRESENT + LATE attend).
 *  Rows must arrive newest-first; `recentLimit` caps the recent list. */
export function deriveAttendanceSummary(attRows: AttRowInput[], recentLimit = 8): AttendanceSummaryDto {
  let attended = 0
  let present = 0
  let absent = 0
  let late = 0
  let leave = 0
  const recent: { date: string; status: string }[] = []
  for (const row of attRows) {
    if (row.status === 'PRESENT' || row.status === 'LATE') attended += 1
    if (row.status === 'PRESENT') present += 1
    else if (row.status === 'ABSENT') absent += 1
    else if (row.status === 'LATE') late += 1
    else if (row.status === 'LEAVE') leave += 1
    if (recent.length < recentLimit) {
      recent.push({ date: row.date.toISOString().slice(0, 10), status: row.status })
    }
  }
  return {
    pct: attRows.length > 0 ? Math.round((attended / attRows.length) * 100) : null,
    records: attRows.length,
    present,
    absent,
    late,
    leave,
    recent,
  }
}
