import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'

export const runtime = 'nodejs'

interface SaveBody {
  examId?: string
  classId?: string
  subjectId?: string
  entries?: {
    studentId: string
    marks: number | null
    remarks?: string | null
    /** Canonical absent marker (ExamMark.status='ABSENT'): used by the
     *  scan review flow when the teacher confirms "AB". Requires null marks. */
    absent?: boolean
  }[]
}

/**
 * POST /api/teacher/marks-entry/save — save (draft) the marks for one
 * exam × class × subject the teacher teaches. Validation:
 *   • every mark must be a number 0 ≤ m ≤ maxMarks (or null = absent/not
 *     yet entered) — invalid values are rejected, never clamped;
 *   • the roster is re-derived server-side; unknown students are dropped;
 *   • SUBMITTED rows cannot be edited (the module enforces an explicit
 *     submit step; corrections flow through the office).
 * Both the manual roster and the Scan Marks Sheet review grid write
 * through THIS one canonical route — there is no second marks path.
 */
export async function POST(request: Request) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const body = (await request.json().catch(() => null)) as SaveBody | null
      if (!body?.examId || !body?.classId || !body?.subjectId || !Array.isArray(body.entries)) {
        throw new Error('examId, classId, subjectId and entries are required')
      }

      const teacherName = (user.name || '').trim().toLowerCase()
      const ttRow = await db.timetable.findFirst({
        where: { schoolId, classId: body.classId, subjectId: body.subjectId, teacherName: { not: null } },
      })
      if (!ttRow || (ttRow.teacherName || '').trim().toLowerCase() !== teacherName) {
        throw new Error('FORBIDDEN')
      }

      const config = await db.examSubjectConfig.findFirst({
        where: { examId: body.examId, classId: body.classId, subjectId: body.subjectId, exam: { schoolId } },
      })
      if (!config) throw new Error('NOT_FOUND')

      const students = await db.student.findMany({
        where: { classId: body.classId, user: { status: 'ACTIVE' } },
        select: { id: true },
      })
      const rosterIds = new Set(students.map((s) => s.id))

      const existing = await db.examMark.findMany({
        where: { examId: body.examId, classId: body.classId, subjectId: body.subjectId },
        select: { studentId: true, workflowStatus: true },
      })
      const submittedIds = new Set(
        existing.filter((m) => m.workflowStatus === 'SUBMITTED').map((m) => m.studentId)
      )
      // Exam-level lock: once ANY row of this exam × class × subject has been
      // submitted, the whole sheet is locked — including students who had no
      // mark yet. Corrections flow through the exam office, never here.
      if (submittedIds.size > 0) {
        throw new Error('Marks already submitted — corrections flow through the exam office')
      }

      let saved = 0
      for (const e of body.entries) {
        if (!rosterIds.has(e.studentId)) continue
        if (submittedIds.has(e.studentId)) continue
        // Canonical absent: status='ABSENT' with null marks — the same
        // representation the marksheet and outcome engines already read.
        const absent = e.absent === true
        if (absent && e.marks != null) throw new Error('Absent entries cannot carry marks')
        if (e.marks != null) {
          if (typeof e.marks !== 'number' || !Number.isFinite(e.marks)) {
            throw new Error('Invalid marks value')
          }
          if (e.marks < 0 || e.marks > config.maxMarks) {
            throw new Error(`Marks must be between 0 and ${config.maxMarks}`)
          }
        }
        const remarks =
          typeof e.remarks === 'string' && e.remarks.trim() ? e.remarks.trim().slice(0, 200) : null
        await db.examMark.upsert({
          where: {
            examId_classId_subjectId_studentId: {
              examId: body.examId,
              classId: body.classId,
              subjectId: body.subjectId,
              studentId: e.studentId,
            },
          },
          create: {
            examId: body.examId,
            classId: body.classId,
            subjectId: body.subjectId,
            studentId: e.studentId,
            marksObtained: absent ? null : e.marks,
            status: absent ? 'ABSENT' : 'PRESENT',
            workflowStatus: 'DRAFT',
            remarks,
            enteredBy: user.name ?? 'Teacher',
            enteredAt: new Date(),
          },
          update: {
            marksObtained: absent ? null : e.marks,
            status: absent ? 'ABSENT' : 'PRESENT',
            remarks,
            enteredBy: user.name ?? 'Teacher',
            enteredAt: new Date(),
          },
        })
        saved += 1
      }
      return { saved, locked: submittedIds.size }
    },
    { roles: ['TEACHER'] }
  )
}
