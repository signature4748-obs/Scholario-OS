import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser } from '@/lib/api'
import {
  requireTeacher,
  assertStudentInScope,
  visibleBehaviorWhere,
  toBehaviorRecordItem,
  toFollowUpItem,
  classLabelOf,
} from '@/lib/teacher-hub'
import { deriveStudentFees, deriveAttendanceSummary, type StudentFeesDto } from '@/lib/teacher/student-ledger'

export const runtime = 'nodejs'

/**
 * GET /api/teacher/students/[studentId] — the ONE shared Teacher student
 * profile payload (master task §6/§25). Opened from the Student Directory,
 * My Class, Fees & Payments and Student Behavior — the same canonical
 * student, the same sections, role-appropriate visibility:
 *
 * PERMISSION MODEL (all server-decided):
 *   · the student must be inside the teacher's authorized scope
 *     (class-teacher class ∪ subject-taught class ∪ hub relations) —
 *     assertStudentInScope re-validates on every request;
 *   · FEE LEDGER — visible ONLY when this teacher is the class teacher of
 *     the student's class (subject teachers never see a family's money);
 *   · BEHAVIOR — only records visible to THIS teacher (her own ∪ records
 *     of students in classes she is responsible for); private notes stay
 *     in the staff surface only;
 *   · academics — the latest exam THIS student has entered marks for
 *     (nothing fabricated; no marks ⇒ null).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  return withUser(
    async (user) => {
      const ctx = await requireTeacher(user)
      const { studentId } = await params
      const student = await assertStudentInScope(ctx, studentId)

      const isClassTeacher = !!student.classId && ctx.classTeacherOf.some((c) => c.id === student.classId)
      const today = new Date()
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

      const [user_, attRows, ownMarkRows, feeRows, txnRows, behaviorRows, behaviorTypeGroups, openConcernCount, followUpRows, conversation, taughtSubjectRows] =
        await Promise.all([
          db.user.findUnique({ where: { id: student.userId }, select: { name: true, email: true } }),
          db.attendance.findMany({
            where: { studentId: student.id },
            select: { date: true, status: true },
            orderBy: { date: 'desc' },
          }),
          db.examMark.findMany({
            where: { studentId: student.id, marksObtained: { not: null } },
            select: {
              examId: true,
              marksObtained: true,
              exam: { select: { name: true, startDate: true, createdAt: true } },
              subject: { select: { id: true, name: true, fullMarks: true } },
            },
          }),
          // Fee rows load ONLY for the class teacher of the student's class.
          isClassTeacher
            ? db.fee.findMany({
                where: { studentId: student.id },
                include: { payments: { orderBy: { createdAt: 'desc' } } },
                orderBy: [{ dueDate: 'asc' }],
              })
            : Promise.resolve([]),
          isClassTeacher
            ? db.feeTransaction.findMany({
                where: { studentId: student.id, source: { not: null } },
                orderBy: { createdAt: 'desc' },
                take: 50,
              })
            : Promise.resolve([]),
          db.behaviorRecord.findMany({
            where: { ...visibleBehaviorWhere(ctx), studentId: student.id },
            include: {
              student: { select: { id: true, rollNo: true, classId: true, class: { select: { name: true, section: true } }, user: { select: { name: true } } } },
              recordedBy: { select: { id: true, name: true } },
            },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            take: 30,
          }),
          db.behaviorRecord.groupBy({
            by: ['type'],
            where: { ...visibleBehaviorWhere(ctx), studentId: student.id },
            _count: { _all: true },
          }),
          db.behaviorRecord.count({
            where: { ...visibleBehaviorWhere(ctx), studentId: student.id, type: 'concern', status: { not: 'resolved' } },
          }),
          db.teacherFollowUp.findMany({
            where: { schoolId: ctx.schoolId, teacherId: ctx.userId, studentId: student.id, status: 'open' },
            include: { student: { select: { id: true, rollNo: true, classId: true, class: { select: { name: true, section: true } }, user: { select: { name: true } } } } },
            orderBy: { dueDate: 'asc' },
            take: 10,
          }),
          db.parentConversation.findFirst({
            where: { teacherId: ctx.userId, studentId: student.id },
            select: { id: true },
          }),
          // subjects this teacher teaches in the student's class
          student.classId
            ? db.timetable.findMany({
                where: { schoolId: ctx.schoolId, classId: student.classId, teacherName: { not: null } },
                select: { teacherName: true, subject: { select: { name: true } } },
                distinct: ['teacherName', 'subjectId'],
              })
            : Promise.resolve([]),
        ])

      // ── latest exam with entered marks for THIS student (same honest
      //    rule as the Directory: no marks ⇒ null).
      let latestExam: {
        examId: string
        examName: string
        subjects: { subjectId: string; subjectName: string; marks: number; maxMarks: number; pct: number }[]
        averagePct: number
      } | null = null
      if (ownMarkRows.length > 0 && student.classId) {
        // the winning exam = greatest (startDate ?? createdAt) among the
        // exams this student has marks for
        let latestExamId: string | null = null
        let latestKey = -1
        const keyOf = new Map<string, number>()
        for (const m of ownMarkRows) {
          const key = (m.exam.startDate ?? m.exam.createdAt).getTime()
          keyOf.set(m.examId, Math.max(keyOf.get(m.examId) ?? -1, key))
          if (keyOf.get(m.examId)! > latestKey) {
            latestKey = keyOf.get(m.examId)!
            latestExamId = m.examId
          }
        }
        if (latestExamId) {
          const cfgRows = await db.examSubjectConfig.findMany({
            where: { examId: latestExamId, classId: student.classId },
            select: { subjectId: true, maxMarks: true },
          })
          const maxByKey = new Map(cfgRows.map((c) => [c.subjectId, c.maxMarks]))
          const rows = ownMarkRows.filter((m) => m.examId === latestExamId)
          const examName = rows[0]?.exam.name ?? 'Exam'
          const subjects = rows.map((m) => {
            const maxMarks = maxByKey.get(m.subject.id) ?? m.subject.fullMarks ?? 100
            return {
              subjectId: m.subject.id,
              subjectName: m.subject.name,
              marks: m.marksObtained ?? 0,
              maxMarks,
              pct: Math.round(((m.marksObtained ?? 0) / maxMarks) * 100),
            }
          })
          latestExam = {
            examId: latestExamId,
            examName,
            subjects,
            averagePct: Math.round(subjects.reduce((sum, x) => sum + x.pct, 0) / subjects.length),
          }
        }
      }

      // ── canonical fee ledger (class teacher only) ─────────────────────
      const fees: StudentFeesDto | null = isClassTeacher
        ? deriveStudentFees(feeRows, txnRows, endOfToday)
        : null

      const teacherNameLc = (ctx.name || '').trim().toLowerCase()
      const taughtSubjects = [
        ...new Set(
          taughtSubjectRows
            .filter((r) => (r.teacherName || '').trim().toLowerCase() === teacherNameLc && r.subject?.name)
            .map((r) => (r.subject?.name ?? '') as string),
        ),
      ].sort()

      const typeCount = (t: string) => behaviorTypeGroups.find((g) => g.type === t)?._count._all ?? 0

      return {
        student: {
          id: student.id,
          name: user_?.name ?? student.user?.name ?? 'Student',
          email: user_?.email ?? null,
          rollNo: student.rollNo,
          admissionNo: student.admissionNo,
          classId: student.classId,
          classLabel: classLabelOf(student.class),
          stream: student.class?.stream ?? null,
          guardianName: student.guardianName,
          guardianPhone: student.guardianPhone,
          gender: student.gender,
          dob: student.dob,
          bloodGroup: student.bloodGroup,
          address: student.address,
        },
        isClassTeacher,
        taughtSubjects,
        attendance: deriveAttendanceSummary(attRows),
        academics: { latestExam },
        fees,
        behavior: {
          records: behaviorRows.map(toBehaviorRecordItem),
          counts: {
            positive: typeCount('positive'),
            observation: typeCount('observation'),
            concern: typeCount('concern'),
            open: openConcernCount,
          },
          followUps: followUpRows.map(toFollowUpItem),
        },
        conversationId: conversation?.id ?? null,
      }
    },
    { roles: ['TEACHER'] },
  )
}
