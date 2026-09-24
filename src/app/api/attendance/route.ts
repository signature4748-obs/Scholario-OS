import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'
import { parseDateParam, isValidStatus } from '@/lib/class-attendance'

export const runtime = 'nodejs'

/**
 * /api/attendance — legacy bulk attendance endpoint.
 *
 * CANONICAL ATTENDANCE IDENTITY: one row per Class + Section + Date +
 * Student (DB-unique on studentId + date, dates ALWAYS stored as midnight
 * UTC so the constraint holds). Writes use the same day-window
 * replace semantics as the class-attendance baseline/session routes —
 * a save can never create a second record for the same student-day
 * (the historical duplicate-row bug this hardens against).
 */
export async function GET(req: NextRequest) {
  return withUser(async (user) => {
    const schoolId = schoolScoped(user)
    const { searchParams } = new URL(req.url)
    const classId = searchParams.get('classId')
    const date = searchParams.get('date')
    const where: Record<string, unknown> = { schoolId }
    if (classId) where.classId = classId
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // Day window (not exact-timestamp): catches every row of that
      // calendar day regardless of any legacy time component.
      const day = parseDateParam(date)
      where.date = { gte: day, lt: new Date(day.getTime() + 86_400_000) }
    }
    const rows = await db.attendance.findMany({
      where,
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { date: 'desc' },
      take: 500,
    })
    return rows
  })
}

// bulk mark attendance for a class on a date (day-window replace)
export async function POST(req: NextRequest) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const body = await req.json().catch(() => ({}))
      const classId = body.classId as string | undefined
      const dateRaw = body.date as string | undefined
      if (!classId) throw new Error('classId and entries[] required')

      // Normalize to midnight UTC — the canonical storage format. Accepts
      // YYYY-MM-DD or a full ISO timestamp (legacy callers); the calendar
      // day is what matters. NEVER defaults to `new Date()` (that wrote
      // timestamped rows which bypassed the unique constraint — fixed).
      let day: Date
      if (dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
        day = parseDateParam(dateRaw)
      } else if (dateRaw) {
        const parsed = new Date(dateRaw)
        if (Number.isNaN(parsed.getTime())) throw new Error('Invalid date')
        day = new Date(`${parsed.toISOString().slice(0, 10)}T00:00:00.000Z`)
      } else {
        day = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
      }
      if (day.getTime() > Date.now() + 86_400_000) throw new Error('Future dates cannot be marked')

      const entries: Array<{ studentId: string; status: string }> = (body.entries || []).filter(
        (e: { studentId?: string; status?: string }) =>
          e?.studentId && e?.status && isValidStatus(e.status)
      )
      if (!entries.length) throw new Error('classId and entries[] required')

      // Roster truth from the server — a save can only mark students who
      // are actually enrolled in this class.
      const students = await db.student.findMany({
        where: { classId, user: { status: 'ACTIVE' } },
        select: { id: true },
      })
      const rosterIds = new Set(students.map((s) => s.id))
      const valid = entries.filter((e) => rosterIds.has(e.studentId))
      if (valid.length !== entries.length) throw new Error('entries reference students outside this class')
      if (valid.length !== rosterIds.size) throw new Error('Every student needs a valid status')

      // Day-window replace (same semantics as the baseline route): any
      // legacy rows with time components on this day are removed too.
      const nextDay = new Date(day.getTime() + 86_400_000)
      await db.attendance.deleteMany({
        where: { classId, date: { gte: day, lt: nextDay } },
      })
      for (const e of valid) {
        await db.attendance.create({
          data: {
            schoolId,
            studentId: e.studentId,
            classId,
            date: day,
            status: e.status,
            markedBy: user.name ?? user.id,
          },
        })
      }
      return { marked: valid.length, date: day }
    },
    { roles: ['PRINCIPAL', 'MANAGEMENT', 'TEACHER'] }
  )
}
