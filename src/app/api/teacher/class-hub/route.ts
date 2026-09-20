import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'
import { classLabelOf } from '@/lib/teacher-hub'

export const runtime = 'nodejs'

/**
 * GET /api/teacher/class-hub — the Class Teacher Hub aggregate: everything
 * the appointed class teacher needs to run THEIR class, in ONE payload per
 * class-teacher class (Class.classTeacherId = User.id — the same
 * appointment that gates the module in the sidebar):
 *
 *   · attendanceToday — the canonical Attendance snapshot for today;
 *   · fees — real Fee/Payment totals + the defaulters list (students with
 *     money outstanding, overdue first);
 *   · results — the RESULTS SUBMISSION matrix for the 3 most recent exams
 *     the class is part of: per subject, marks entered / class size,
 *     DRAFT vs SUBMITTED workflow status and the class average — the
 *     class teacher sees the whole submission picture, not just their own
 *     subject;
 *   · behavior — open concerns / monitoring / recent positives from the
 *     canonical BehaviorRecord rows.
 *
 * Nothing is fabricated: empty sections surface as zeros/empty arrays and
 * render as honest empty states. A teacher with zero class-teacher classes
 * gets classes: [] (the module is not reachable for them anyway).
 */
export async function GET() {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)

      const ctClasses = await db.class.findMany({
        where: { schoolId, classTeacherId: user.id },
        select: {
          id: true,
          name: true,
          section: true,
          room: true,
          students: {
            where: { user: { status: 'ACTIVE' } },
            select: {
              id: true,
              rollNo: true,
              guardianName: true,
              guardianPhone: true,
              user: { select: { name: true } },
            },
            orderBy: { rollNo: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      })

      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

      const payload = await Promise.all(
        ctClasses.map(async (c) => {
          const studentIds = c.students.map((s) => s.id)
          const classLabel = classLabelOf(c)

          // ── attendance today ─────────────────────────────────────────
          const attRows = await db.attendance.findMany({
            where: { classId: c.id, date: { gte: todayStart, lte: todayEnd } },
            select: { status: true },
          })
          const attendanceToday = {
            marked: attRows.length > 0,
            present: attRows.filter((r) => r.status === 'PRESENT').length,
            absent: attRows.filter((r) => r.status === 'ABSENT').length,
            late: attRows.filter((r) => r.status === 'LATE').length,
            leave: attRows.filter((r) => r.status === 'LEAVE').length,
          }

          // ── fees ─────────────────────────────────────────────────────
          const feeRows = studentIds.length
            ? await db.fee.findMany({
                where: { studentId: { in: studentIds } },
                select: {
                  studentId: true,
                  amount: true,
                  paid: true,
                  status: true,
                  dueDate: true,
                },
              })
            : []
          const nameByStudent = new Map(c.students.map((s) => [s.id, s.user.name]))
          // Canonical pending collections (two-stage workflow) — the
          // class teacher's own collections still awaiting the
          // Principal's verification.
          const pendingTxns = studentIds.length
            ? await db.feeTransaction.findMany({
                where: {
                  studentId: { in: studentIds },
                  source: { not: null },
                  status: 'UNDER_VERIFICATION',
                },
                select: { amount: true },
              })
            : []
          const feesByStudent = new Map<string, { billed: number; paid: number; outstanding: number; overdue: boolean }>()
          for (const f of feeRows) {
            const entry = feesByStudent.get(f.studentId) ?? { billed: 0, paid: 0, outstanding: 0, overdue: false }
            entry.billed += f.amount
            entry.paid += Math.min(f.amount, f.paid)
            entry.outstanding += Math.max(0, f.amount - f.paid)
            if (f.amount - f.paid > 0 && f.dueDate && f.dueDate < todayEnd) entry.overdue = true
            feesByStudent.set(f.studentId, entry)
          }
          const defaulters = [...feesByStudent.entries()]
            .filter(([, v]) => v.outstanding > 0)
            .map(([studentId, v]) => {
              const stu = c.students.find((s) => s.id === studentId)
              return {
                studentId,
                name: nameByStudent.get(studentId) ?? 'Student',
                rollNo: stu?.rollNo ?? null,
                guardianPhone: stu?.guardianPhone ?? null,
                outstanding: v.outstanding,
                hasOverdue: v.overdue,
              }
            })
            .sort((a, b) => (a.hasOverdue === b.hasOverdue ? b.outstanding - a.outstanding : a.hasOverdue ? -1 : 1))
            .slice(0, 12)
          const fees = {
            totalBilled: feeRows.reduce((sum, f) => sum + f.amount, 0),
            totalCollected: feeRows.reduce((sum, f) => sum + Math.min(f.amount, f.paid), 0),
            outstanding: feeRows.reduce((sum, f) => sum + Math.max(0, f.amount - f.paid), 0),
            fullyPaidStudents: [...feesByStudent.values()].filter((v) => v.outstanding <= 0).length,
            studentsWithFees: feesByStudent.size,
            overdueStudents: [...feesByStudent.values()].filter((v) => v.overdue).length,
            awaitingVerificationCount: pendingTxns.length,
            awaitingVerificationAmount: pendingTxns.reduce((sum, t) => sum + t.amount, 0),
            defaulters,
          }

          // ── results submission (3 most recent exams of this class) ──
          const subjectRows = await db.classSubjectAssignment.findMany({
            where: { classId: c.id, isActive: true },
            select: { subjectId: true, displayOrder: true, subject: { select: { id: true, name: true, fullMarks: true } } },
            orderBy: { displayOrder: 'asc' },
          })
          const examLinks = await db.examClass.findMany({
            where: { classId: c.id },
            select: { examId: true, exam: { select: { id: true, name: true, startDate: true, status: true, resultStatus: true, createdAt: true } } },
          })
          const recentExams = examLinks
            .map((l) => l.exam)
            .sort((a, b) => (b.startDate ?? b.createdAt).getTime() - (a.startDate ?? a.createdAt).getTime())
            .slice(0, 3)
          const examIds = recentExams.map((e) => e.id)
          const markRows = examIds.length
            ? await db.examMark.findMany({
                where: { classId: c.id, examId: { in: examIds }, marksObtained: { not: null } },
                select: { examId: true, subjectId: true, marksObtained: true, workflowStatus: true },
              })
            : []
          const configRows = examIds.length
            ? await db.examSubjectConfig.findMany({
                where: { examId: { in: examIds }, classId: c.id },
                select: { examId: true, subjectId: true, maxMarks: true },
              })
            : []
          const maxMarksByKey = new Map(configRows.map((r) => [`${r.examId}:${r.subjectId}`, r.maxMarks]))
          const results = recentExams.map((exam) => {
            const subjects = subjectRows.map((sr) => {
              const rows = markRows.filter((m) => m.examId === exam.id && m.subjectId === sr.subjectId)
              const maxMarks = maxMarksByKey.get(`${exam.id}:${sr.subjectId}`) ?? sr.subject.fullMarks ?? 100
              const pcts = rows.map((r) => (r.marksObtained ?? 0) / maxMarks * 100)
              return {
                subjectId: sr.subjectId,
                subjectName: sr.subject.name,
                entered: rows.length,
                submitted: rows.filter((r) => r.workflowStatus === 'SUBMITTED').length,
                avgPct: pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
              }
            })
            const enteredSubjects = subjects.filter((s) => s.entered > 0).length
            const submittedSubjects = subjects.filter((s) => s.submitted > 0 && s.submitted >= s.entered).length
            return {
              examId: exam.id,
              examName: exam.name,
              examDate: exam.startDate ? exam.startDate.toISOString().slice(0, 10) : null,
              status: exam.status,
              subjects,
              enteredSubjects,
              submittedSubjects,
              totalSubjects: subjects.length,
            }
          })

          // ── behavior ─────────────────────────────────────────────────
          const behaviorRows = studentIds.length
            ? await db.behaviorRecord.findMany({
                where: { studentId: { in: studentIds } },
                select: { type: true, status: true, date: true },
              })
            : []
          const behavior = {
            openConcerns: behaviorRows.filter((r) => r.type === 'concern' && r.status === 'open').length,
            monitoring: behaviorRows.filter((r) => r.status === 'monitoring').length,
            recentPositive: behaviorRows.filter((r) => r.type === 'positive' && r.date >= thirtyDaysAgo).length,
          }

          return {
            classId: c.id,
            label: classLabel,
            room: c.room,
            studentCount: c.students.length,
            attendanceToday,
            fees,
            results,
            behavior,
          }
        })
      )

      return { classes: payload }
    },
    { roles: ['TEACHER'] }
  )
}
