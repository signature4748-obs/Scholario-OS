import { withUser, schoolScoped } from '@/lib/api'
import { listDutyRoster } from '@/lib/exams/service-extended'

export const runtime = 'nodejs'

/**
 * GET /api/exams/duties — the school's REAL invigilation duty roster:
 * every examination with its papers + assigned invigilators, plus every
 * teacher with their duty count. Powers the principal's Invigilation tab
 * (assign → the teacher is notified via a direct Message, live in their
 * notification bell through the :3003 event stream).
 */
export async function GET() {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const roster = await listDutyRoster(schoolId)
      return roster
    },
    { roles: ['PRINCIPAL', 'MANAGEMENT'] },
  )
}
