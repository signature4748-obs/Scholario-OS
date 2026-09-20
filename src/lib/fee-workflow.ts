import { db } from '@/lib/db'
import type { AuthUser } from '@/lib/auth'
import type { Prisma } from '@prisma/client'
import { classLabelOf } from '@/lib/teacher-hub'

/**
 * fee-workflow — THE canonical two-stage fee collection workflow.
 *
 *   CLASS TEACHER COLLECTS          PRINCIPAL VERIFIES
 *   ──────────────────────          ───────────────────
 *   FeeTransaction created          same row transitions
 *   status UNDER_VERIFICATION  →    status SUCCESS
 *   source CLASS_TEACHER            receiptNo SCH-YYYY-NNNN
 *   ledger NOT touched yet          Fee.paid += amount (ledger applied)
 *   principal notified              collector notified
 *
 * Core invariants (MASTER TASK §7–§19, §37, §47):
 *   · ONE payment = ONE canonical FeeTransaction row — every screen
 *     (teacher collection table, principal queue, student profile,
 *     receipts) reads the SAME row. No duplicate per-role records.
 *   · A class-teacher collection is NEVER a final verified payment —
 *     the student ledger (Fee.paid) only moves on verification.
 *   · Receipt numbers are database-backed, sequential and unique per
 *     school-year (SCH-2026-000001) — never UI-timestamp based.
 *   · Outstanding = billed − verified paid. Pending collections are
 *     reported SEPARATELY ("awaiting verification"), never as paid.
 */

// ── Vocabulary ────────────────────────────────────────────────────────

export const COLLECTION_SOURCES = [
  'CLASS_TEACHER',
  'PRINCIPAL',
  'SCHOOL_OFFICE',
  'ONLINE',
  'BANK_TRANSFER',
] as const
export type CollectionSource = (typeof COLLECTION_SOURCES)[number]

export const SOURCE_LABEL: Record<string, string> = {
  CLASS_TEACHER: 'Class Teacher',
  PRINCIPAL: 'Principal',
  SCHOOL_OFFICE: 'School Office',
  ONLINE: 'Online',
  BANK_TRANSFER: 'Bank Transfer',
}

/** Payment methods accepted for in-person collection (matches the
 * existing method vocabulary + ReceiptMethod naming of the fee module). */
export const COLLECTION_METHODS = ['CASH', 'UPI', 'CARD', 'NET_BANKING', 'BANK_TRANSFER'] as const
export type CollectionMethod = (typeof COLLECTION_METHODS)[number]

export const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  NET_BANKING: 'Net Banking',
  BANK_TRANSFER: 'Bank Transfer',
}

/** Terminal-ish statuses in the collection workflow. PENDING/FAILED stay
 * gateway-only; the collection workflow uses the rest. */
export const TXN_STATUS = {
  PENDING_VERIFICATION: 'UNDER_VERIFICATION',
  VERIFIED: 'SUCCESS',
  REJECTED: 'REJECTED',
  REFUNDED: 'REFUNDED',
} as const

// ── Receipt numbers ───────────────────────────────────────────────────

/**
 * Mint the next sequential receipt number for this school + calendar
 * year: SCH-2026-000001. Sequential and unique by construction (max+1
 * inside the caller's transaction; SQLite serialises writers, and every
 * mint site runs inside db.$transaction).
 */
export async function mintReceiptNo(
  schoolId: string,
  client: Prisma.TransactionClient = db,
): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `SCH-${year}-`
  const rows = await client.feeTransaction.findMany({
    where: { schoolId, receiptNo: { startsWith: prefix } },
    select: { receiptNo: true },
  })
  let max = 0
  for (const r of rows) {
    const seq = Number((r.receiptNo ?? '').slice(prefix.length))
    if (Number.isFinite(seq) && seq > max) max = seq
  }
  return `${prefix}${String(max + 1).padStart(6, '0')}`
}

// ── Notifications + audit (best-effort, never fail the money action) ──

export async function pushMessage(
  schoolId: string,
  senderId: string,
  recipientId: string,
  subject: string,
  body: string,
): Promise<void> {
  try {
    await db.message.create({ data: { schoolId, senderId, recipientId, subject, body } })
  } catch {
    /* notification failures never break the payment workflow */
  }
}

/** All Principal / Management users of the school — the verification
 * audience for "collection recorded" pings. */
export async function principalUserIds(schoolId: string): Promise<string[]> {
  const rows = await db.user.findMany({
    where: { schoolId, role: { in: ['PRINCIPAL', 'MANAGEMENT'] }, status: 'ACTIVE' },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export async function audit(
  schoolId: string,
  userId: string,
  action: string,
  detail: string,
): Promise<void> {
  try {
    await db.activityLog.create({ data: { schoolId, userId, action, detail } })
  } catch {
    /* audit failures never break the payment workflow */
  }
}

// ── Permission guards (server-side, the ONLY authority) ───────────────

/**
 * The classes this user is currently appointed class teacher of.
 * THE appointment record: Class.classTeacherId stores the User id.
 */
export async function classTeacherClassesOf(user: AuthUser, schoolId: string) {
  return db.class.findMany({ where: { schoolId, classTeacherId: user.id } })
}

/**
 * Assert the signed-in teacher is the class teacher of the student's
 * class — the gate for every fee-collection read/write (MASTER TASK
 * §21–§22: never trust client ids, never frontend-filter).
 * Throws FORBIDDEN when out of scope.
 */
export async function assertClassTeacherOfStudent(user: AuthUser, schoolId: string, studentId: string) {
  const student = await db.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true, classId: true, class: true, user: { select: { name: true } } },
  })
  if (!student) throw new Error('NOT_FOUND')
  if (!student.classId) throw new Error('FORBIDDEN')
  const cls = student.class
  if (!cls || cls.classTeacherId !== user.id) throw new Error('FORBIDDEN')
  return { student, cls }
}

// ── Duplicate reference detection (MASTER TASK §29-8) ─────────────────

export async function assertReferenceUnique(schoolId: string, referenceNumber: string) {
  const ref = referenceNumber.trim()
  if (!ref) return
  const dup = await db.feeTransaction.findFirst({
    where: { schoolId, referenceNumber: ref },
    select: { id: true, receiptNo: true, studentName: true },
  })
  if (dup) {
    throw new Error(
      `Reference number ${ref} is already recorded${dup.studentName ? ` for ${dup.studentName}` : ''}${dup.receiptNo ? ` (receipt ${dup.receiptNo})` : ''}. A payment cannot be recorded twice with the same reference.`,
    )
  }
}

// ── Ledger application (verification time — the ONLY ledger writer) ───

export interface LedgerApplyInput {
  txnId: string
  schoolId: string
  feeId: string | null
  amount: number
  method: string
}

/**
 * Apply a VERIFIED payment to the student's fee ledger, inside the
 * caller's transaction:
 *   · Fee.paid += amount, status PAID/PARTIAL, paidDate stamped;
 *   · a legacy Payment mirror row is created (status SUCCESS, note
 *     linking the canonical txn) so every existing ledger view keeps
 *     working from the same numbers.
 * Returns the updated Fee totals for the response payload.
 */
export async function applyPaymentToLedger(
  tx: Prisma.TransactionClient,
  input: LedgerApplyInput,
) {
  if (!input.feeId) return null
  const fee = await tx.fee.findUnique({ where: { id: input.feeId } })
  if (!fee || fee.schoolId !== input.schoolId) return null
  const newPaid = Math.min(fee.amount, fee.paid + input.amount)
  const status = newPaid >= fee.amount ? 'PAID' : newPaid > 0 ? 'PARTIAL' : fee.status
  await tx.fee.update({
    where: { id: fee.id },
    data: { paid: newPaid, status, method: input.method, paidDate: new Date() },
  })
  await tx.payment.create({
    data: {
      feeId: fee.id,
      amount: input.amount,
      method: input.method,
      status: 'SUCCESS',
      transactionId: input.txnId,
      note: `Canonical payment ${input.txnId} — applied on verification`,
    },
  })
  return { feeId: fee.id, paid: newPaid, outstanding: Math.max(0, fee.amount - newPaid), status }
}

// ── Shared DTO shape (teacher + principal + receipt views) ────────────

export interface FeeTxnDto {
  id: string
  studentId: string | null
  studentName: string | null
  className: string | null
  feeId: string | null
  feeHeadName: string | null
  amount: number
  method: string
  status: string
  source: string | null
  referenceNumber: string | null
  note: string | null
  receiptNo: string | null
  collectedBy: string | null
  collectedAt: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  rejectedBy: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  createdAt: string
}

type TxnRow = {
  id: string
  studentId: string | null
  studentName: string | null
  className: string | null
  feeId: string | null
  feeHeadName: string | null
  amount: number
  method: string
  status: string
  source: string | null
  referenceNumber: string | null
  note: string | null
  receiptNo: string | null
  collectedByName: string | null
  collectedAt: Date | null
  verifiedByName: string | null
  verifiedAt: Date | null
  rejectedByName: string | null
  rejectedAt: Date | null
  rejectionReason: string | null
  createdAt: Date
}

/** The one DTO every surface renders — teacher collection table,
 * principal queue, student profile history, receipt modal. */
export function toFeeTxnDto(t: TxnRow): FeeTxnDto {
  return {
    id: t.id,
    studentId: t.studentId,
    studentName: t.studentName,
    className: t.className,
    feeId: t.feeId,
    feeHeadName: t.feeHeadName,
    amount: t.amount,
    method: t.method,
    status: t.status,
    source: t.source,
    referenceNumber: t.referenceNumber,
    note: t.note,
    receiptNo: t.receiptNo,
    collectedBy: t.collectedByName,
    collectedAt: t.collectedAt ? t.collectedAt.toISOString() : null,
    verifiedBy: t.verifiedByName,
    verifiedAt: t.verifiedAt ? t.verifiedAt.toISOString() : null,
    rejectedBy: t.rejectedByName,
    rejectedAt: t.rejectedAt ? t.rejectedAt.toISOString() : null,
    rejectionReason: t.rejectionReason,
    createdAt: t.createdAt.toISOString(),
  }
}

/** Fee rows the collection workflow considers (in-person money), i.e.
 * FeeTransactions that carry a collection source. Gateway orders
 * (gatewayOrderId set, source ONLINE) are excluded from the class
 * teacher's table but keep flowing through the gateway module. */
export function isCollectionTxn(t: { source: string | null }) {
  return !!t.source
}

export { classLabelOf }
