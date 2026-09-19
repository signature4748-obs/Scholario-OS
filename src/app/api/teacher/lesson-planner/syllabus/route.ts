import { withUser } from '@/lib/api'
import { mergeSyllabusTemplate } from '@/lib/lesson-planner'

export const runtime = 'nodejs'

// POST /api/teacher/lesson-planner/syllabus — merge every topic from the
// school's board syllabus template (CBSE / UP Board) that the teacher's
// plan is still missing. Body: { classId, subjectId }. Idempotent.
export async function POST(request: Request) {
  return withUser(
    async (user) => {
      const body = (await request.json().catch(() => null)) as {
        classId?: string
        subjectId?: string
      } | null
      if (!body?.classId || !body.subjectId) {
        throw new Error('classId and subjectId are required')
      }
      const result = await mergeSyllabusTemplate(user, body.classId, body.subjectId)
      return result
    },
    { roles: ['TEACHER'] }
  )
}
