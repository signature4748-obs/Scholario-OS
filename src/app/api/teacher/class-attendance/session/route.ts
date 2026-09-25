import { withUser, schoolScoped } from '@/lib/api'
import { parseDateParam, resolveClassScopeOrNull } from '@/lib/class-attendance'

export const runtime = 'nodejs'

interface SessionBody {
  classId?: string
  subjectId?: string
  date?: string
  entries?: { studentId: string; status: string }[]
}

/**
 * POST /api/teacher/class-attendance/session — RETIRED.
 *
 * Attendance ownership is FINAL (spec §7–§10): the CLASS TEACHER owns and
 * manages the ONE canonical daily record (CLASS + DATE + STUDENT). A
 * SUBJECT TEACHER HAS VIEW-ONLY ACCESS — she can never create, save or
 * submit attendance, not even for her own subject. There is no subject
 * dimension in the canonical record, hence no subject session to save.
 *
 * This endpoint stays mounted so legacy callers receive the honest,
 * explicit rejection instead of a 404 — and so the rule is enforced at
 * the API layer, not just hidden in the UI (§30).
 */
export async function POST(request: Request) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const body = (await request.json().catch(() => null)) as SessionBody | null
      if (body?.classId && body?.date) {
        try {
          parseDateParam(body.date)
        } catch {
          /* fall through to the ownership answer below */
        }
        // Resolve the scope ONLY to name the class teacher honestly in the
        // rejection copy. Reading never writes.
        const scope = await resolveClassScopeOrNull(user, schoolId, body.classId)
        const who = scope?.classTeacherName
        throw new Error(
          who
            ? `Attendance is managed by the class teacher (${who}). Subject teachers have view-only access.`
            : 'Attendance is managed by the class teacher. Subject teachers have view-only access.',
        )
      }
      throw new Error('Attendance is managed by the class teacher. Subject teachers have view-only access.')
    },
    { roles: ['TEACHER'] }
  )
}
