import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'
import { classLabelOf } from '@/lib/teacher-hub'

export const runtime = 'nodejs'

/**
 * GET /api/teacher/students — the Student Directory payload: the classes
 * this teacher works with (class-teacher of ∪ teaches a subject in, from
 * the timetable) and every class's real roster with profile fields,
 * attendance derived from the canonical Attendance records, and the latest
 * exam marks for the student's class.
 *
 * PERMISSION MODEL (all server-decided, school-scoped):
 *   · classes — only the ones this teacher is class teacher of or teaches
 *     a subject in (timetable rows carry teacherName, the same permission
 *     source as Lesson Planner / Marks Entry);
 *   · rosters — only ACTIVE students of those classes;
 *   · guardian name/phone — visible to any teacher with an authorized
 *     class (the pre-existing server decision for this route, kept);
 *   · academic performance — the latest exam that has entered marks for
 *     the student's class, per-subject marks + percentage average. Both
 *     DRAFT and SUBMITTED rows count ("marks exist" = marksObtained set);
 *     nothing is fabricated — no exam ⇒ latestExam is null;
 *   · FEE RECORDS — visible ONLY for the classes this teacher is class
 *     teacher of (the user-facing rule: a subject teacher never sees a
 *     family's money; the class teacher owns their class's fee picture).
 *     Students of subject-only classes carry fees: null and those classes
 *     carry no feeSummary — the client cannot ask for them.
 */
export async function GET() {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const teacherName = (user.name || '').trim().toLowerCase()

      // Classes this teacher teaches a subject in (timetable rows carry
      // teacherName — the same permission source as Lesson Planner).
      const ttRows = await db.timetable.findMany({
        where: { schoolId, teacherName: { not: null } },
        select: { classId: true, teacherName: true, subject: { select: { name: true } } },
      })
      const subjectByClass = new Map<string, Set<string>>()
      for (const r of ttRows) {
        if ((r.teacherName || '').trim().toLowerCase() !== teacherName) continue
        const set = subjectByClass.get(r.classId) ?? new Set<string>()
        if (r.subject?.name) set.add(r.subject.name)
        subjectByClass.set(r.classId, set)
      }

      // Classes where this teacher is class teacher.
      const classTeacherOf = await db.class.findMany({
        where: { schoolId, classTeacherId: user.id },
        select: { id: true },
      })
      const classTeacherIds = new Set(classTeacherOf.map((c) => c.id))

      const classIds = new Set<string>([...subjectByClass.keys(), ...classTeacherIds])
      if (classIds.size === 0) {
        return { classes: [], studentsByClass: {} }
      }

      const classes = await db.class.findMany({
        where: { schoolId, id: { in: [...classIds] } },
        select: { id: true, name: true, section: true },
        orderBy: { name: 'asc' },
      })
      const labelByClass = new Map(classes.map((c) => [c.id, classLabelOf(c)]))

      const students = await db.student.findMany({
        where: { classId: { in: [...classIds] }, user: { status: 'ACTIVE' } },
        select: {
          id: true,
          rollNo: true,
          admissionNo: true,
          guardianName: true,
          guardianPhone: true,
          dob: true,
          gender: true,
          bloodGroup: true,
          address: true,
          classId: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: [{ rollNo: 'asc' }],
      })

      // ── Attendance per student (canonical Attendance rows; PRESENT +
      //    LATE count as attended). Null pct when no records — never
      //    fabricated. Recent = newest first, capped for the profile view.
      const attendanceRows = await db.attendance.findMany({
        where: { schoolId, studentId: { in: students.map((s) => s.id) } },
        select: { studentId: true, date: true, status: true },
        orderBy: { date: 'desc' },
      })
      const RECENT_ATTENDANCE_LIMIT = 8
      const attByStudent = new Map<
        string,
        {
          total: number
          attended: number
          present: number
          absent: number
          late: number
          leave: number
          recent: { date: string; status: string }[]
        }
      >()
      for (const row of attendanceRows) {
        let entry = attByStudent.get(row.studentId)
        if (!entry) {
          entry = { total: 0, attended: 0, present: 0, absent: 0, late: 0, leave: 0, recent: [] }
          attByStudent.set(row.studentId, entry)
        }
        entry.total += 1
        if (row.status === 'PRESENT' || row.status === 'LATE') entry.attended += 1
        if (row.status === 'PRESENT') entry.present += 1
        else if (row.status === 'ABSENT') entry.absent += 1
        else if (row.status === 'LATE') entry.late += 1
        else if (row.status === 'LEAVE') entry.leave += 1
        if (entry.recent.length < RECENT_ATTENDANCE_LIMIT) {
          entry.recent.push({ date: row.date.toISOString().slice(0, 10), status: row.status })
        }
      }

      // ── Latest exam with entered marks, per class. "Latest" = greatest
      //    exam date (startDate, falling back to createdAt) among the
      //    exams that have at least one non-null ExamMark row for that
      //    class. Per-subject percentages use ExamSubjectConfig.maxMarks
      //    (fallback: Subject.fullMarks, then 100).
      const markRows = await db.examMark.findMany({
        where: {
          classId: { in: [...classIds] },
          marksObtained: { not: null },
        },
        select: {
          examId: true,
          classId: true,
          subjectId: true,
          studentId: true,
          marksObtained: true,
          exam: { select: { name: true, startDate: true, createdAt: true } },
          subject: { select: { name: true, fullMarks: true } },
        },
      })

      // exam sort key per (classId, examId) — max over each class's exams.
      const examSortKeyByClassExam = new Map<string, { examId: string; sortKey: number }>()
      for (const m of markRows) {
        const sortKey = (m.exam.startDate ?? m.exam.createdAt).getTime()
        const key = `${m.classId}:${m.examId}`
        const cur = examSortKeyByClassExam.get(key)
        if (!cur || sortKey > cur.sortKey) {
          examSortKeyByClassExam.set(key, { examId: m.examId, sortKey })
        }
      }
      // the winning (latest) examId per class
      const latestExamIdByClass = new Map<string, string>()
      for (const [key, v] of examSortKeyByClassExam) {
        const classId = key.slice(0, key.lastIndexOf(':'))
        const cur = latestExamIdByClass.get(classId)
        const curSort = cur ? examSortKeyByClassExam.get(`${classId}:${cur}`)?.sortKey ?? -1 : -1
        if (v.sortKey > curSort) latestExamIdByClass.set(classId, v.examId)
      }

      const involvedExamIds = new Set(markRows.map((m) => m.examId))
      const maxByKey = new Map<string, number>()
      if (involvedExamIds.size > 0) {
        const configRows = await db.examSubjectConfig.findMany({
          where: { examId: { in: [...involvedExamIds] } },
          select: { examId: true, classId: true, subjectId: true, maxMarks: true },
        })
        for (const c of configRows) {
          maxByKey.set(`${c.examId}:${c.classId}:${c.subjectId}`, c.maxMarks)
        }
      }

      // per-class latest-exam rows grouped per student
      const latestByClassStudent = new Map<
        string,
        Map<string, { examId: string; examName: string; subjects: { subjectId: string; subjectName: string; marks: number; maxMarks: number; pct: number }[] }>
      >()
      for (const m of markRows) {
        if (latestExamIdByClass.get(m.classId) !== m.examId) continue
        if (m.marksObtained == null) continue
        let byStudent = latestByClassStudent.get(m.classId)
        if (!byStudent) {
          byStudent = new Map()
          latestByClassStudent.set(m.classId, byStudent)
        }
        let entry = byStudent.get(m.studentId)
        if (!entry) {
          entry = { examId: m.examId, examName: m.exam.name, subjects: [] }
          byStudent.set(m.studentId, entry)
        }
        const maxMarks = maxByKey.get(`${m.examId}:${m.classId}:${m.subjectId}`) ?? m.subject.fullMarks ?? 100
        entry.subjects.push({
          subjectId: m.subjectId,
          subjectName: m.subject.name,
          marks: m.marksObtained,
          maxMarks,
          pct: Math.round((m.marksObtained / maxMarks) * 100),
        })
      }

      const studentsByClass: Record<string, unknown[]> = {}

      // ── Fee records — CLASS TEACHER classes only ─────────────────────
      // Real Fee + Payment rows for the students of the classes this
      // teacher is class teacher of. Subject-only classes get nothing:
      // `fees` stays null on their students and `feeSummary` is absent.
      const ctStudentIds = students
        .filter((s) => s.classId && classTeacherIds.has(s.classId))
        .map((s) => s.id)
      const feeRows = ctStudentIds.length
        ? await db.fee.findMany({
            where: { studentId: { in: ctStudentIds } },
            include: { payments: { orderBy: { createdAt: 'desc' } } },
            orderBy: [{ dueDate: 'asc' }],
          })
        : []

      const today = new Date()
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

      interface FeeItemDto {
        id: string
        title: string
        amount: number
        paid: number
        outstanding: number
        status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE'
        dueDate: string | null
        method: string | null
      }
      interface StudentFeesDto {
        status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'NONE'
        totalBilled: number
        totalPaid: number
        outstanding: number
        lastPaymentAt: string | null
        items: FeeItemDto[]
        payments: { id: string; feeTitle: string; amount: number; method: string | null; status: string; createdAt: string }[]
      }

      const feesByStudent = new Map<string, StudentFeesDto>()
      for (const s of students) {
        if (!s.classId || !classTeacherIds.has(s.classId)) continue
        const rows = feeRows.filter((f) => f.studentId === s.id)
        if (rows.length === 0) {
          feesByStudent.set(s.id, {
            status: 'NONE',
            totalBilled: 0,
            totalPaid: 0,
            outstanding: 0,
            lastPaymentAt: null,
            items: [],
            payments: [],
          })
          continue
        }
        const items: FeeItemDto[] = rows.map((f) => {
          const outstanding = Math.max(0, f.amount - f.paid)
          const status: FeeItemDto['status'] =
            outstanding <= 0
              ? 'PAID'
              : f.dueDate && f.dueDate < endOfToday
                ? 'OVERDUE'
                : f.paid > 0
                  ? 'PARTIAL'
                  : 'UNPAID'
          return {
            id: f.id,
            title: f.title,
            amount: f.amount,
            paid: f.paid,
            outstanding,
            status,
            dueDate: f.dueDate ? f.dueDate.toISOString().slice(0, 10) : null,
            method: f.method,
          }
        })
        const payments = rows
          .flatMap((f) =>
            f.payments.map((p) => ({
              id: p.id,
              feeTitle: f.title,
              amount: p.amount,
              method: p.method,
              status: p.status,
              createdAt: p.createdAt.toISOString(),
            })),
          )
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        const outstanding = items.reduce((sum, i) => sum + i.outstanding, 0)
        const status: StudentFeesDto['status'] =
          outstanding <= 0
            ? 'PAID'
            : items.some((i) => i.status === 'OVERDUE')
              ? 'OVERDUE'
              : items.some((i) => i.paid > 0)
                ? 'PARTIAL'
                : 'UNPAID'
        feesByStudent.set(s.id, {
          status,
          totalBilled: rows.reduce((sum, f) => sum + f.amount, 0),
          totalPaid: rows.reduce((sum, f) => sum + Math.min(f.amount, f.paid), 0),
          outstanding,
          lastPaymentAt: payments[0]?.createdAt ?? null,
          items: items.slice(0, 8),
          payments: payments.slice(0, 5),
        })
      }

      // per-class fee summaries (class-teacher classes only)
      const feeSummaryByClass = new Map<
        string,
        {
          totalBilled: number
          totalCollected: number
          outstanding: number
          studentsWithFees: number
          fullyPaid: number
          pending: number
          overdue: number
        }
      >()
      for (const classId of classTeacherIds) {
        const classStudentFees = students
          .filter((s) => s.classId === classId)
          .map((s) => feesByStudent.get(s.id))
          .filter((f): f is StudentFeesDto => !!f)
        if (classStudentFees.length === 0) continue
        feeSummaryByClass.set(classId, {
          totalBilled: classStudentFees.reduce((sum, f) => sum + f.totalBilled, 0),
          totalCollected: classStudentFees.reduce((sum, f) => sum + f.totalPaid, 0),
          outstanding: classStudentFees.reduce((sum, f) => sum + f.outstanding, 0),
          studentsWithFees: classStudentFees.filter((f) => f.status !== 'NONE').length,
          fullyPaid: classStudentFees.filter((f) => f.status === 'PAID').length,
          pending: classStudentFees.filter((f) => f.status === 'PARTIAL' || f.status === 'UNPAID').length,
          overdue: classStudentFees.filter((f) => f.status === 'OVERDUE').length,
        })
      }

      for (const s of students) {
        if (!s.classId) continue
        const att = attByStudent.get(s.id)
        const latest = latestByClassStudent.get(s.classId)?.get(s.id) ?? null
        const list = studentsByClass[s.classId] ?? []
        list.push({
          id: s.id,
          name: s.user.name,
          email: s.user.email,
          rollNo: s.rollNo,
          admissionNo: s.admissionNo,
          guardianName: s.guardianName,
          guardianPhone: s.guardianPhone,
          dob: s.dob,
          gender: s.gender,
          bloodGroup: s.bloodGroup,
          address: s.address,
          classLabel: labelByClass.get(s.classId) ?? 'Unassigned',
          attendance: {
            pct: att && att.total > 0 ? Math.round((att.attended / att.total) * 100) : null,
            records: att?.total ?? 0,
            present: att?.present ?? 0,
            absent: att?.absent ?? 0,
            late: att?.late ?? 0,
            leave: att?.leave ?? 0,
            recent: att?.recent ?? [],
          },
          latestExam:
            latest && latest.subjects.length > 0
              ? {
                  examId: latest.examId,
                  examName: latest.examName,
                  subjects: latest.subjects,
                  averagePct: Math.round(
                    latest.subjects.reduce((sum, x) => sum + x.pct, 0) / latest.subjects.length,
                  ),
                }
              : null,
          fees: feesByStudent.get(s.id) ?? null,
        })
        studentsByClass[s.classId] = list
      }

      return {
        classes: classes.map((c) => ({
          id: c.id,
          label: classLabelOf(c),
          isClassTeacher: classTeacherIds.has(c.id),
          subjects: [...(subjectByClass.get(c.id) ?? [])].sort(),
          studentCount: (studentsByClass[c.id] ?? []).length,
          feeSummary: feeSummaryByClass.get(c.id) ?? null,
        })),
        studentsByClass,
      }
    },
    { roles: ['TEACHER'] }
  )
}
