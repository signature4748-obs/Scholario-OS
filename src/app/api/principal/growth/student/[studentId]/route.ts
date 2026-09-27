import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'
import { growthScoresFor, toGrowthEventItem } from '@/lib/growth/service'

export const runtime = 'nodejs'

/**
 * GET /api/principal/growth/student/[studentId] — the Principal's view of
 * ONE student's growth (§30): the canonical score, the full point ledger
 * (manual + automatic + corrections) and the fee standing. The Principal
 * sees the whole school — no teacher-scope restriction — but the data is
 * the SAME derivation every teacher surface renders.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const { studentId } = await params

      const student = await db.student.findFirst({
        where: { id: studentId, schoolId },
        include: {
          class: { select: { name: true, section: true } },
          user: { select: { name: true } },
        },
      })
      if (!student) throw new Error('Student not found')

      const [scores, eventRows] = await Promise.all([
        growthScoresFor(schoolId, [student.id]),
        db.growthEvent.findMany({
          where: { schoolId, studentId: student.id },
          include: {
            createdBy: { select: { id: true, name: true } },
            student: {
              select: {
                id: true,
                user: { select: { name: true } },
                class: { select: { name: true, section: true } },
              },
            },
          },
          orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
          take: 40,
        }),
      ])

      return {
        student: {
          id: student.id,
          name: student.user?.name ?? 'Student',
          classLabel: student.class
            ? student.class.section && !student.class.name.endsWith(` ${student.class.section}`)
              ? `${student.class.name} - ${student.class.section}`
              : student.class.name
            : 'Unassigned',
        },
        score: scores.get(student.id) ?? null,
        events: eventRows.map(toGrowthEventItem),
      }
    },
    { roles: ['PRINCIPAL'] },
  )
}
