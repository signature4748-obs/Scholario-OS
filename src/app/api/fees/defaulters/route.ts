import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'

export const runtime = 'nodejs'

/**
 * GET /api/fees/defaulters — the fee-defaulter outreach list.
 *
 * Server-truth aggregation over Fee rows where paid < amount, grouped by
 * student: outstanding balance, per-line breakdown, the earliest outstanding
 * due date, an honest days-overdue figure, guardian contact and the last
 * reminder message the student received (matched by the stable
 * "Fee Reminder" subject prefix — same prefix the remind endpoint writes).
 *
 * Roles: PRINCIPAL / MANAGEMENT (the fee operations roles — same policy as
 * POST /api/fees).
 */
export async function GET(_req: NextRequest) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const now = new Date()

      // Outstanding fee lines (paid < amount is not expressible as a Prisma
      // where-clause comparing two columns — filter in JS over the school's
      // non-PAID rows; statuses are maintained by the fee APIs).
      const feeRows = await db.fee.findMany({
        where: { schoolId, status: { not: 'PAID' } },
        select: {
          id: true, studentId: true, title: true, amount: true, paid: true,
          dueDate: true, status: true,
          student: {
            select: {
              id: true, userId: true, rollNo: true, guardianName: true, guardianPhone: true,
              user: { select: { name: true } },
              class: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 2000,
      })

      interface Bucket {
        studentId: string
        userId: string
        name: string
        className: string | null
        rollNo: string | null
        guardianName: string | null
        guardianPhone: string | null
        outstanding: number
        feeLines: Array<{ id: string; title: string; amount: number; paid: number; dueDate: string | null; status: string }>
        oldestDueAt: string | null
      }
      const byStudent = new Map<string, Bucket>()

      for (const f of feeRows) {
        const outstanding = f.amount - f.paid
        if (outstanding <= 0) continue
        let b = byStudent.get(f.studentId)
        if (!b) {
          b = {
            studentId: f.studentId,
            userId: f.student.userId,
            name: f.student.user.name ?? 'Unknown student',
            className: f.student.class?.name ?? null,
            rollNo: f.student.rollNo ?? null,
            guardianName: f.student.guardianName ?? null,
            guardianPhone: f.student.guardianPhone ?? null,
            outstanding: 0,
            feeLines: [],
            oldestDueAt: null,
          }
          byStudent.set(f.studentId, b)
        }
        b.outstanding += outstanding
        b.feeLines.push({
          id: f.id,
          title: f.title,
          amount: f.amount,
          paid: f.paid,
          dueDate: f.dueDate ? f.dueDate.toISOString() : null,
          status: f.status,
        })
        if (f.dueDate) {
          const iso = f.dueDate.toISOString()
          if (!b.oldestDueAt || iso < b.oldestDueAt) b.oldestDueAt = iso
        }
      }

      const defaulters = [...byStudent.values()].map((b) => {
        let daysOverdue: number | null = null
        if (b.oldestDueAt) {
          const ms = now.getTime() - new Date(b.oldestDueAt).getTime()
          daysOverdue = ms > 0 ? Math.floor(ms / 86_400_000) : null
        }
        return { ...b, daysOverdue }
      }).sort((a, b) => b.outstanding - a.outstanding)

      // Last reminder per student — Message rows with the stable subject
      // prefix written by POST /api/fees/defaulters/remind.
      const userIds = defaulters.map((d) => d.userId)
      const reminderMessages = userIds.length
        ? await db.message.findMany({
            where: {
              recipientId: { in: userIds },
              subject: { startsWith: 'Fee Reminder' },
            },
            select: { recipientId: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 400,
          })
        : []
      const lastRemindedByUser = new Map<string, Date>()
      for (const m of reminderMessages) {
        if (m.recipientId && !lastRemindedByUser.has(m.recipientId)) {
          lastRemindedByUser.set(m.recipientId, m.createdAt)
        }
      }

      const weekAgo = new Date(now.getTime() - 7 * 86_400_000)
      let remindedThisWeek = 0
      const withReminders = defaulters.map((d) => {
        const at = lastRemindedByUser.get(d.userId) ?? null
        if (at && at > weekAgo) remindedThisWeek++
        return { ...d, lastRemindedAt: at ? at.toISOString() : null }
      })

      const totalOutstanding = withReminders.reduce((s, d) => s + d.outstanding, 0)
      const overdueCount = withReminders.filter((d) => d.daysOverdue !== null).length

      return {
        defaulters: withReminders,
        summary: {
          totalOutstanding,
          defaulterCount: withReminders.length,
          overdueCount,
          remindedThisWeek,
        },
      }
    },
    { roles: ['PRINCIPAL', 'MANAGEMENT'] },
  )
}
