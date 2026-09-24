import { db } from '@/lib/db'
import { withUser } from '@/lib/api'
import { requireStudent } from '@/lib/learning'

export const runtime = 'nodejs'

/**
 * GET /api/student/fees — the authenticated student's OWN canonical fee
 * ledger, read from the SAME Fee + FeeTransaction rows the Principal's
 * Fee Management and the Class Teacher's Fee Collection modules use.
 *
 * PERMISSION MODEL (mirrors /api/student/attendance + dashboard):
 *   · identity resolved server-side (erp_session → user → student) — the
 *     request never supplies a student id;
 *   · rows are filtered to that student only;
 *   · nothing fabricated — no fees ⇒ empty ledger (client renders its
 *     honest empty state).
 *
 * Arithmetics (ONE canonical financial ledger, §16):
 *   outstanding      = Σ fee.amount − fee.paid  (per row, floor 0)
 *   billed           = Σ fee.amount
 *   paid             = Σ min(fee.amount, fee.paid)  (only VERIFIED money
 *                       moves `paid`; pending txns are surfaced separately)
 *   pendingAmount    = Σ FeeTransaction[PENDING_VERIFICATION | UNDER_VERIFICATION]
 *
 * The student never sees a pending transaction as final paid — the same
 * verification semantics the Principal applies.
 *
 * Shape:
 * {
 *   totals: { billed, paid, pendingVerification, outstanding, overdue },
 *   fees:   { id, title, amount, paid, outstanding, status, dueDate }[],
 *   transactions: { receiptNo, amount, status, method, collectedByName,
 *                   verifiedByName, collectedAt, note }[]
 * }
 */
export async function GET() {
  return withUser(async (user) => {
    const ctx = await requireStudent(user)
    const today = new Date()
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

    const [feeRows, txnRows] = await Promise.all([
      db.fee.findMany({
        where: { studentId: ctx.studentId },
        orderBy: [{ dueDate: 'asc' }],
      }),
      db.feeTransaction.findMany({
        where: { studentId: ctx.studentId },
        orderBy: { collectedAt: 'desc' },
        take: 100,
      }),
    ])

    const fees = feeRows.map((f) => {
      const outstanding = Math.max(0, f.amount - f.paid)
      const status =
        outstanding <= 0 ? 'PAID'
        : f.dueDate && f.dueDate < endOfToday ? 'OVERDUE'
        : f.paid > 0 ? 'PARTIAL' : 'UNPAID'
      return {
        id: f.id,
        title: f.title,
        amount: Math.round(f.amount),
        paid: Math.round(f.paid),
        outstanding: Math.round(outstanding),
        status,
        dueDate: f.dueDate ? f.dueDate.toISOString().slice(0, 10) : null,
      }
    })

    const totals = {
      billed: fees.reduce((s, f) => s + f.amount, 0),
      paid: fees.reduce((s, f) => s + Math.min(f.amount, f.paid), 0),
      pendingVerification: txnRows
        .filter((t) => t.status === 'PENDING_VERIFICATION' || t.status === 'UNDER_VERIFICATION')
        .reduce((s, t) => s + t.amount, 0),
      outstanding: fees.reduce((s, f) => s + f.outstanding, 0),
      overdue: fees.filter((f) => f.status === 'OVERDUE').reduce((s, f) => s + f.outstanding, 0),
    }

    const transactions = txnRows.map((t) => ({
      receiptNo: t.receiptNo,
      amount: Math.round(t.amount),
      status: t.status,
      method: t.method,
      collectedByName: t.collectedByName,
      verifiedByName: t.verifiedByName,
      collectedAt: (t.collectedAt ?? t.createdAt).toISOString(),
      note: t.note,
    }))

    return { totals, fees, transactions }
  })
}
