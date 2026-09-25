import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'
import { growthScoresFor } from '@/lib/growth/service'
import { bandOf } from '@/lib/growth/shared'

export const runtime = 'nodejs'

/**
 * GET /api/principal/growth/overview — the school-wide Growth picture
 * (§30): average score, improving/steady/needs-attention counts and the
 * most recent point events across the whole school. The teacher
 * experience stays scope-focused; this endpoint powers the Principal's
 * institution view only.
 */
export async function GET() {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)

      const students = await db.student.findMany({
        where: { schoolId, user: { status: 'ACTIVE' } },
        select: { id: true },
      })
      const scores = await growthScoresFor(schoolId, students.map((s) => s.id))

      const withScore = [...scores.values()].filter((g) => g.score != null)
      const bands = [...scores.values()].map((g) => bandOf(g.score, g.monthDelta))

      const recentEvents = await db.growthEvent.findMany({
        where: { schoolId, status: 'ACTIVE' },
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
        take: 8,
      })

      return {
        studentCount: students.length,
        scoredCount: withScore.length,
        average:
          withScore.length > 0
            ? Math.round(withScore.reduce((sum, g) => sum + g.score!, 0) / withScore.length)
            : null,
        improving: bands.filter((b) => b === 'IMPROVING').length,
        steady: bands.filter((b) => b === 'STEADY').length,
        needsAttention: bands.filter((b) => b === 'NEEDS_ATTENTION').length,
        building: bands.filter((b) => b === 'BUILDING').length,
        monthPoints: [...scores.values()].reduce((sum, g) => sum + g.monthDelta, 0),
        recentEvents: recentEvents.map((r) => ({
          id: r.id,
          studentId: r.studentId,
          studentName: r.student?.user?.name ?? 'Student',
          points: r.points,
          reason: r.reason,
          source: r.source,
          createdBy: r.createdBy?.name ?? null,
          effectiveAt: r.effectiveAt.toISOString(),
        })),
      }
    },
    { roles: ['PRINCIPAL'] },
  )
}
