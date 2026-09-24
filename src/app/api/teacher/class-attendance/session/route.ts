import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'
import { parseDateParam, resolveClassScope, isValidStatus } from '@/lib/class-attendance'

export const runtime = 'nodejs'

interface SessionBody {
  classId?: string
  subjectId?: string
  date?: string
  entries?: { studentId: string; status: string }[]
}

/**
 * POST /api/teacher/class-attendance/session — an authorized SUBJECT
 * teacher takes class attendance for a class she teaches.
 *
 * CANONICAL ATTENDANCE IDENTITY (spec §K): the record this writes is the
 * SAME official daily record the class teacher's baseline writes — one
 * row per Class + Section + Date + Student (unique per student+date).
 * There is NO separate teacher/subject-specific attendance record: a
 * subject teacher who opens the roster sees the class teacher's saved
 * baseline for that date (prefill) and, when she saves, updates the same
 * canonical rows (marked-by carries her name + subject for provenance).
 *
 * Authorization: the teacher must actually teach the posted subject for
 * this class (timetable ∩ ACTIVE ClassSubjectAssignment — resolved
 * server-side; a teacher can never touch a class she isn't assigned to).
 */
export async function POST(request: Request) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const body = (await request.json().catch(() => null)) as SessionBody | null
      if (!body?.classId || !body?.subjectId || !body?.date || !Array.isArray(body.entries) || body.entries.length === 0) {
        throw new Error('classId, subjectId, date and entries are required')
      }
      const day = parseDateParam(body.date)
      if (day.getTime() > Date.now() + 86_400_000) throw new Error('Future dates cannot be marked')

      const { subjects } = await resolveClassScope(user, schoolId, body.classId)
      const teaches = subjects.find((s) => s.id === body.subjectId)
      if (!teaches) throw new Error('FORBIDDEN — you do not teach this subject for this class')

      const students = await db.student.findMany({
        where: { classId: body.classId, user: { status: 'ACTIVE' } },
        select: { id: true },
      })
      const rosterIds = new Set(students.map((s) => s.id))
      const entries = body.entries.filter((e) => rosterIds.has(e.studentId) && isValidStatus(e.status))
      if (entries.length !== rosterIds.size) {
        throw new Error('Every student needs a valid status')
      }

      // ONE canonical record per class-day (same as the class-teacher
      // baseline): replace the day window and write one row per student.
      // The marked-by line keeps the honest provenance of this save.
      const nextDay = new Date(day.getTime() + 86_400_000)
      await db.attendance.deleteMany({
        where: { classId: body.classId, date: { gte: day, lt: nextDay } },
      })
      const markedBy = `${user.name ?? 'Subject Teacher'} · ${teaches.name}`
      for (const e of entries) {
        await db.attendance.create({
          data: {
            schoolId,
            studentId: e.studentId,
            classId: body.classId,
            date: day,
            status: e.status,
            markedBy,
          },
        })
      }

      const counts = {
        present: entries.filter((e) => e.status === 'PRESENT').length,
        absent: entries.filter((e) => e.status === 'ABSENT').length,
        late: entries.filter((e) => e.status === 'LATE').length,
        leave: entries.filter((e) => e.status === 'LEAVE').length,
      }
      return { saved: entries.length, subjectName: teaches.name, canonical: true, counts }
    },
    { roles: ['TEACHER'] }
  )
}
