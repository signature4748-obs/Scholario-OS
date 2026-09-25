import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser } from '@/lib/api'
import { requireTeacher, assertStudentInScope, classLabelOf } from '@/lib/teacher-hub'

export const runtime = 'nodejs'

/**
 * GET /api/teacher/students/[studentId]/marksheet?examId= — the PERSONAL
 * DIGITAL MARKSHEET document for ONE student + ONE examination (digital
 * record §7–§12). A pure READ surface over the canonical rows — the SAME
 * ExamMark / ExamSubjectConfig / Attendance / School records Marks Entry,
 * Academics, Results Submission and every report use. There is no second
 * marks table and no manually generated duplicate result: when teachers
 * submit more subject marks, this document updates automatically.
 *
 * HONESTY RULES (§8/§11):
 *   · every subject configured for the exam + class is listed — a subject
 *     without an outcome for this student renders "—", never an invented
 *     mark;
 *   · total / percentage are computed over SUBMITTED subjects only and
 *     are labeled PARTIAL while required subjects are still pending;
 *   · state machine: NOT_STARTED → IN_PROGRESS → READY (all subjects
 *     in) → FINALIZED (exam resultStatus "Declared"). Print / PDF is
 *     unlocked only when every required subject is in (§12 history row)
 *     and the document's RESULT STATUS line always states the truth.
 *
 * PERMISSIONS (§13): the teacher must have this student in scope
 * (assertStudentInScope — class teacher ∪ subject-taught ∪ hub
 * relations); fee data is never part of this document, so the
 * class-teacher-only boundary is untouched.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  return withUser(
    async (user) => {
      const ctx = await requireTeacher(user)
      const { studentId } = await params
      const student = await assertStudentInScope(ctx, studentId)
      const examId = new URL(request.url).searchParams.get('examId')
      if (!examId) throw new Error('examId is required')
      if (!student.classId) throw new Error('Student is not assigned to a class')

      // the exam must belong to the student's class (ExamClass link) —
      // the same canonical link every class results surface uses
      const link = await db.examClass.findFirst({
        where: { examId, classId: student.classId },
        select: {
          exam: {
            select: {
              id: true, name: true, type: true, session: true,
              startDate: true, resultStatus: true, declaredAt: true,
            },
          },
        },
      })
      if (!link) throw new Error('This examination is not configured for the student’s class')
      const exam = link.exam

      const [cfgRows, markRows, csaRows, school, principalUser] = await Promise.all([
        db.examSubjectConfig.findMany({
          where: { examId, classId: student.classId },
          select: {
            subjectId: true, maxMarks: true, sortOrder: true,
            subject: { select: { id: true, name: true, fullMarks: true } },
          },
        }),
        db.examMark.findMany({
          where: { examId, studentId: student.id },
          select: { subjectId: true, marksObtained: true, status: true },
        }),
        db.classSubjectAssignment.findMany({
          where: { classId: student.classId, isActive: true },
          select: { subjectId: true, displayOrder: true },
        }),
        db.school.findUnique({
          where: { id: ctx.schoolId },
          select: {
            name: true, address: true, city: true, phone: true, email: true,
            academicYear: true, board: true, logoUrl: true,
          },
        }),
        db.user.findFirst({
          where: { schoolId: ctx.schoolId, role: 'PRINCIPAL', status: 'ACTIVE' },
          select: { name: true },
        }),
      ])

      // required subjects: the exam's configured set; honest fallback for
      // exams without a config = the subjects the CLASS has marks in
      let required: { subjectId: string; subjectName: string; maxMarks: number }[]
      if (cfgRows.length > 0) {
        required = cfgRows.map((c) => ({
          subjectId: c.subjectId,
          subjectName: c.subject.name,
          maxMarks: c.maxMarks,
        }))
      } else {
        const classRows = await db.examMark.findMany({
          where: { examId, classId: student.classId, marksObtained: { not: null } },
          select: { subjectId: true, subject: { select: { name: true, fullMarks: true } } },
        })
        const seen = new Map<string, { subjectId: string; subjectName: string; maxMarks: number }>()
        for (const r of classRows) {
          if (!seen.has(r.subjectId)) {
            seen.set(r.subjectId, {
              subjectId: r.subjectId,
              subjectName: r.subject.name,
              maxMarks: r.subject.fullMarks ?? 100,
            })
          }
        }
        required = [...seen.values()]
      }

      // class display order first (same order the class marksheet uses),
      // then the config's own sort, then name
      const csaOrder = new Map(csaRows.map((c) => [c.subjectId, c.displayOrder]))
      const cfgOrder = new Map(cfgRows.map((c) => [c.subjectId, c.sortOrder]))
      required.sort(
        (a, b) =>
          (csaOrder.get(a.subjectId) ?? 999) - (csaOrder.get(b.subjectId) ?? 999) ||
          (cfgOrder.get(a.subjectId) ?? 999) - (cfgOrder.get(b.subjectId) ?? 999) ||
          a.subjectName.localeCompare(b.subjectName),
      )

      const ownBySubject = new Map(markRows.map((r) => [r.subjectId, r]))
      const subjects = required.map((s) => {
        const row = ownBySubject.get(s.subjectId)
        const isSubmitted = !!row && (row.marksObtained != null || row.status === 'ABSENT')
        return {
          subjectId: s.subjectId,
          subjectName: s.subjectName,
          maxMarks: s.maxMarks,
          obtained: row?.marksObtained ?? null,
          /** PRESENT / ABSENT / … — the canonical mark row status */
          markStatus: row?.status ?? null,
          isSubmitted,
        }
      })

      const subjectsSubmitted = subjects.filter((s) => s.isSubmitted).length
      const subjectsTotal = subjects.length
      const total = subjects.reduce((sum, s) => sum + (s.isSubmitted ? s.obtained ?? 0 : 0), 0)
      const maxTotal = subjects.reduce((sum, s) => sum + (s.isSubmitted ? s.maxMarks : 0), 0)
      const percentage = subjectsSubmitted > 0 && maxTotal > 0 ? Math.round((total / maxTotal) * 1000) / 10 : null
      // the canonical declare flow writes "Result Declared"; the seeded /
      // student-results convention is "Declared" — both mean the official
      // final result is out
      const isDeclared = exam.resultStatus === 'Declared' || exam.resultStatus === 'Result Declared'
      const state =
        subjectsSubmitted === 0 || subjectsTotal === 0
          ? 'NOT_STARTED'
          : subjectsSubmitted < subjectsTotal
            ? 'IN_PROGRESS'
            : isDeclared
              ? 'FINALIZED'
              : 'READY'

      // canonical attendance % (same derivation as the profile header)
      const attRows = await db.attendance.findMany({
        where: { studentId: student.id },
        select: { status: true },
      })
      const attended = attRows.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length
      const attendancePct = attRows.length > 0 ? Math.round((attended / attRows.length) * 100) : null

      return {
        school: {
          name: school?.name ?? 'School',
          address: school?.address ?? null,
          city: school?.city ?? null,
          phone: school?.phone ?? null,
          email: school?.email ?? null,
          academicYear: school?.academicYear ?? exam.session ?? null,
          board: school?.board ?? null,
          logoUrl: school?.logoUrl ?? null,
        },
        student: {
          name: student.user?.name ?? 'Student',
          admissionNo: student.admissionNo,
          rollNo: student.rollNo,
          classLabel: classLabelOf(student.class),
        },
        exam: {
          examId: exam.id,
          examName: exam.name,
          type: exam.type,
          session: exam.session,
          examDate: exam.startDate ? exam.startDate.toISOString().slice(0, 10) : null,
          resultStatus: exam.resultStatus,
          declaredAt: exam.declaredAt ? exam.declaredAt.toISOString().slice(0, 10) : null,
        },
        subjects,
        summary: {
          state,
          subjectsSubmitted,
          subjectsTotal,
          total,
          maxTotal,
          percentage,
          /** honest flag: required subjects are still pending */
          partial: subjectsSubmitted > 0 && subjectsSubmitted < subjectsTotal,
          pendingSubjects: Math.max(0, subjectsTotal - subjectsSubmitted),
          /** print / PDF unlocked only when every required subject is in */
          canPrint: subjectsTotal > 0 && subjectsSubmitted === subjectsTotal,
        },
        attendancePct,
        principalName: principalUser?.name ?? null,
        generatedAt: new Date().toISOString(),
      }
    },
    { roles: ['TEACHER'] },
  )
}
