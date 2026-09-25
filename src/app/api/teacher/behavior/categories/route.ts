import { db } from '@/lib/db'
import { withUser } from '@/lib/api'
import { requireTeacher } from '@/lib/teacher-hub'

export const runtime = 'nodejs'

/**
 * GET /api/teacher/behavior/categories — the school's active behavior
 * taxonomy (key / label / kind) for the Record Observation dialog. A
 * lightweight companion to the behavior aggregate so ANY module that
 * opens the shared student profile can record an observation without
 * loading the whole behavior workspace.
 */
export async function GET() {
  return withUser(
    async (user) => {
      const ctx = await requireTeacher(user)
      const categories = await db.behaviorCategory.findMany({
        where: { schoolId: ctx.schoolId, isActive: true },
        select: { key: true, label: true, kind: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      })
      return {
        categories: categories.map((c) => ({
          key: c.key,
          label: c.label,
          kind: (['any', 'positive', 'concern'].includes(c.kind) ? c.kind : 'any') as
            | 'any'
            | 'positive'
            | 'concern',
        })),
      }
    },
    { roles: ['TEACHER'] },
  )
}
