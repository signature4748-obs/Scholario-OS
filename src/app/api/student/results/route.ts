import { db } from '@/lib/db'
import { withUser } from '@/lib/api'
import { requireStudent } from '@/lib/learning'

export const runtime = 'nodejs'

/**
 * GET /api/student/results — the authenticated student's OWN canonical
 * exam history, read from the SAME Exam + Result rows the Principal's
 * Marks/Results module declares and the Class Teacher's Marks Entry
 * writes. ONE marks universe — never a client-side seeded ledger.
 *
 * PERMISSION MODEL (mirrors /api/student/attendance + dashboard):
 *   · identity resolved server-side (erp_session → user → student);
 *   · rows are filtered to that student only;
 *   · only DECLARED exams are returned (resultStatus 'Declared' with a
 *     declaredAt) — an exam pending declaration is not the student's to
 *     see yet;
 *   · nothing fabricated — no declared results ⇒ empty history (client
 *     renders its honest empty state).
 *
 * Shape:
 * {
 *   exams: {
 *     examId, examName, type, declaredAt,
 *     subjects: { subject, marks, totalMarks, grade, remarks }[],
 *     pct,                      // overall percentage (1 decimal)
 *     rank: { position, assessedCount } | null
 *   }[],
 *   upcoming: { examName, startsAt, endsAt } | null
 * }
 */
export async function GET() {
  return withUser(async (user) => {
    const ctx = await requireStudent(user)
    if (!ctx.classId) return { exams: [], upcoming: null }

    const examRows = await db.exam.findMany({
      where: { schoolId: ctx.schoolId, classId: ctx.classId },
      orderBy: [{ declaredAt: 'desc' }, { endDate: 'desc' }],
    })
    const declared = examRows.filter((e) => e.resultStatus === 'Declared' && e.declaredAt)

    const exams: {
      examId: string
      examName: string
      type: string
      declaredAt: string
      subjects: { subject: string; marks: number; totalMarks: number; grade: string; remarks: string | null }[]
      pct: number | null
      rank: { position: number; assessedCount: number } | null
    }[] = []
    for (const exam of declared) {
      const [myResults, classResults] = await Promise.all([
        db.result.findMany({
          where: { examId: exam.id, studentId: ctx.studentId },
          include: { subject: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        }),
        db.result.findMany({
          where: { examId: exam.id },
          select: { studentId: true, marks: true, totalMarks: true },
        }),
      ])
      if (myResults.length === 0) continue

      const subjects = myResults.map((r) => ({
        subject: r.subject?.name ?? 'Subject',
        marks: r.marks,
        totalMarks: r.totalMarks,
        grade: r.grade ?? '',
        remarks: r.remarks ?? null,
      }))
      const totalMarks = subjects.reduce((s, x) => s + x.totalMarks, 0)
      const obtained = subjects.reduce((s, x) => s + x.marks, 0)
      const pct = totalMarks > 0 ? Math.round((obtained / totalMarks) * 1000) / 10 : null

      // Honest class rank: average % per student across THIS exam —
      // only students who actually have results are ranked.
      const byStudent = new Map<string, { obtained: number; total: number }>()
      for (const r of classResults) {
        const b = byStudent.get(r.studentId) ?? { obtained: 0, total: 0 }
        b.obtained += r.marks
        b.total += r.totalMarks
        byStudent.set(r.studentId, b)
      }
      const standings = [...byStudent.entries()]
        .map(([sid, b]) => ({ studentId: sid, pct: b.total > 0 ? (b.obtained / b.total) * 100 : 0 }))
        .sort((a, b) => b.pct - a.pct)
      const rankIdx = standings.findIndex((s) => s.studentId === ctx.studentId)
      const rank =
        rankIdx >= 0 && standings.length > 1
          ? { position: rankIdx + 1, assessedCount: standings.length }
          : null

      exams.push({
        examId: exam.id,
        examName: exam.name,
        type: exam.type,
        declaredAt: exam.declaredAt!.toISOString(),
        subjects,
        pct,
        rank,
      })
    }

    const upcoming = examRows
      .filter((e) => e.resultStatus !== 'Declared' && e.startDate && new Date(e.startDate) > new Date())
      .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())[0]

    return {
      exams,
      upcoming: upcoming
        ? { examName: upcoming.name, startsAt: upcoming.startDate!.toISOString(), endsAt: upcoming.endDate?.toISOString() ?? null }
        : null,
    }
  })
}
