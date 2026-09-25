import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'
import {
  parseDateParam,
  resolveClassScope,
  isValidStatus,
  attendanceSettingsFor,
  finalizeDraftIfDue,
  istDayKey,
  istMinutesNow,
} from '@/lib/class-attendance'

export const runtime = 'nodejs'

interface DraftBody {
  classId?: string
  date?: string
  /** subjectId — required only when a SUBJECT teacher drafts (provenance) */
  subjectId?: string
  entries?: { studentId: string; status: string }[]
}

/**
 * PUT /api/teacher/class-attendance/draft — persist the teacher's
 * OPEN, NOT-YET-SUBMITTED attendance sheet (spec §19 autosave). This
 * never writes the canonical Attendance rows: a draft is a draft. The
 * roster is validated server-side (entries may be partial — a half-marked
 * sheet is honest progress, it just can never auto-finalize), statuses
 * are validated, and the draft is keyed one-per-class+date. An explicit
 * Save/Submit (baseline/session) deletes the draft; the school's
 * end-of-day boundary finalizes it when policy allows.
 */
export async function PUT(request: Request) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const body = (await request.json().catch(() => null)) as DraftBody | null
      if (!body?.classId || !body?.date || !Array.isArray(body.entries)) {
        throw new Error('classId, date and entries are required')
      }
      const day = parseDateParam(body.date)
      if (day.getTime() > Date.now() + 86_400_000) throw new Error('Future dates cannot be marked')

      const { isClassTeacher, subjects } = await resolveClassScope(user, schoolId, body.classId)
      const subjectTaught = body.subjectId ? subjects.find((s) => s.id === body.subjectId) : undefined
      if (!isClassTeacher && !subjectTaught) {
        throw new Error('FORBIDDEN — you are not assigned to this class')
      }
      const source = isClassTeacher ? 'BASELINE' : 'SUBJECT_SESSION'

      const students = await db.student.findMany({
        where: { classId: body.classId, user: { status: 'ACTIVE' } },
        select: { id: true },
      })
      const rosterIds = new Set(students.map((s) => s.id))
      const seen = new Set<string>()
      const entries = body.entries.filter((e) => {
        if (!rosterIds.has(e.studentId) || !isValidStatus(e.status) || seen.has(e.studentId)) return false
        seen.add(e.studentId)
        return true
      })

      // An empty draft after filtering = nothing worth persisting; clear
      // any previous draft instead of storing junk.
      if (entries.length === 0) {
        await db.attendanceDraft.deleteMany({
          where: { classId: body.classId, date: { gte: day, lt: new Date(day.getTime() + 86_400_000) } },
        })
        return { saved: 0, cleared: true }
      }

      await db.attendanceDraft.upsert({
        where: { classId_date: { classId: body.classId, date: day } },
        create: {
          schoolId,
          classId: body.classId,
          date: day,
          entries: JSON.stringify(entries),
          updatedById: user.id,
          updatedByName: user.name ?? 'Teacher',
          source,
        },
        update: {
          entries: JSON.stringify(entries),
          updatedById: user.id,
          updatedByName: user.name ?? 'Teacher',
          source,
        },
      })
      return { saved: entries.length }
    },
    { roles: ['TEACHER'] }
  )
}

/**
 * POST /api/teacher/class-attendance/draft?classId=&date= — the
 * end-of-school-hours AUTOSAVE (spec §19): finalize an open draft into
 * the canonical record once the school's configured end-of-day boundary
 * has passed (policy permitting). Idempotent — no draft / already
 * submitted / before the boundary all return honest outcomes.
 */
export async function POST(request: Request) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const url = new URL(request.url)
      const classId = url.searchParams.get('classId')
      const date = url.searchParams.get('date')
      if (!classId || !date) throw new Error('classId and date are required')
      parseDateParam(date)

      const { isClassTeacher, subjects } = await resolveClassScope(user, schoolId, classId)
      if (!isClassTeacher && subjects.length === 0) {
        throw new Error('FORBIDDEN — you are not assigned to this class')
      }

      const settings = await attendanceSettingsFor(schoolId)
      const result = await finalizeDraftIfDue({ schoolId, classId, dayKey: date, settings })
      return {
        ...result,
        boundaryPassed:
          date !== istDayKey() || istMinutesNow() >= settings.endOfDayMinutes,
        endOfDayMinutes: settings.endOfDayMinutes,
      }
    },
    { roles: ['TEACHER'] }
  )
}
