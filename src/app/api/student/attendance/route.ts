import { db } from '@/lib/db'
import { withUser } from '@/lib/api'
import { requireStudent } from '@/lib/learning'

export const runtime = 'nodejs'

/**
 * GET /api/student/attendance — the authenticated student's OWN canonical
 * attendance records, read straight from the server's Attendance rows.
 *
 * PERMISSION MODEL (mirrors /api/student/timetable + dashboard):
 *   · identity resolved server-side (erp_session → user → student) — the
 *     request never supplies a student id;
 *   · rows are filtered to that student only (§41 privacy);
 *   · nothing fabricated — no rows ⇒ empty array (client renders its
 *     honest empty state).
 *
 * These are the SAME rows the Teacher / Principal attendance UI writes
 * (one per Class + Section + Date + Student, dates normalized to midnight
 * UTC), so a correction by staff is what the student sees here.
 *
 * Shape: { records: { date: 'YYYY-MM-DD', status: 'present'|'absent'|
 * 'late'|'leave', markedBy, markedAt }[] } — oldest → newest.
 */
export async function GET() {
  return withUser(async (user) => {
    const ctx = await requireStudent(user)
    const rows = await db.attendance.findMany({
      where: { schoolId: ctx.schoolId, studentId: ctx.studentId },
      orderBy: { date: 'asc' },
      select: { date: true, status: true, markedBy: true, createdAt: true },
    })
    const records = rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      status: r.status.toLowerCase() as 'present' | 'absent' | 'late' | 'leave',
      markedBy: r.markedBy ?? undefined,
      markedAt: r.createdAt.toISOString(),
    }))
    return { records }
  })
}
