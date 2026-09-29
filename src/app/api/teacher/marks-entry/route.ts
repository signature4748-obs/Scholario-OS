import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'
import { classLabelOf } from '@/lib/teacher-hub'
import { getTeacherSubjectAssignments } from '@/lib/teacher-scope'

export const runtime = 'nodejs'

/**
 * GET /api/teacher/marks-entry — exams this teacher can enter marks for:
 * every exam with an ExamClass for one of her classes, restricted to the
 * subjects she is APPOINTED to teach (canonical CSA teacherUserId — with
 * the timetable fallback during migration; see lib/teacher-scope).
 *
 * IQ3000 Phase 8: the class-teacher role alone does NOT grant subject
 * marks entry — only actual subject assignments do.
 */
export async function GET() {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)

      // The teacher's (class, subject) teaching assignments — the SHARED
      // scope resolver (CSA appointments + timetable fallback), validated
      // against the Principal's ACTIVE ClassSubjectAssignments.
      const mine = await getTeacherSubjectAssignments(user, schoolId)
      if (mine.length === 0) return { exams: [] }
      const mineSet = new Set(mine.map((a) => `${a.classId}|${a.subjectId}`))

      const classes = await db.class.findMany({
        where: { schoolId, id: { in: mine.map((a) => a.classId) } },
        select: { id: true, name: true, section: true },
      })
      const classLabels = new Map(classes.map((c) => [c.id, c]))

      const examClasses = await db.examClass.findMany({
        where: { exam: { schoolId } },
        include: {
          exam: { select: { id: true, name: true, type: true, status: true, resultStatus: true, startDate: true, endDate: true } },
        },
      })
      const configs = await db.examSubjectConfig.findMany({
        where: { exam: { schoolId } },
        include: { subject: { select: { name: true } } },
      })

      const examMap = new Map<
        string,
        {
          id: string
          name: string
          type: string
          status: string
          resultStatus: string
          dateLabel: string
          classes: {
            classId: string
            label: string
            subjects: { id: string; name: string; maxMarks: number; passMarks: number }[]
          }[]
        }
      >()

      for (const ec of examClasses) {
        const label = classLabels.get(ec.classId)
        if (!label) continue // class outside the teacher's scope
        const clsLabel = classLabelOf(label)
        const subjects = configs
          .filter((c) => c.examId === ec.examId && c.classId === ec.classId && mineSet.has(`${ec.classId}|${c.subjectId}`))
          .sort((a, b) => a.subject.name.localeCompare(b.subject.name))
          .map((c) => ({ id: c.subjectId, name: c.subject.name, maxMarks: c.maxMarks, passMarks: Math.round(c.passMarks) }))
        if (subjects.length === 0) continue

        let exam = examMap.get(ec.examId)
        if (!exam) {
          const e = ec.exam
          const fmt = (d: Date | null) => (d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '')
          exam = {
            id: e.id,
            name: e.name,
            type: e.type,
            status: e.status,
            resultStatus: e.resultStatus,
            dateLabel: [fmt(e.startDate), fmt(e.endDate)].filter(Boolean).join(' – '),
            classes: [],
          }
          examMap.set(ec.examId, exam)
        }
        exam.classes.push({ classId: ec.classId, label: clsLabel, subjects })
      }

      return { exams: [...examMap.values()] }
    },
    { roles: ['TEACHER'] }
  )
}
