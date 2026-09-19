import { NextRequest } from 'next/server'
import { withUser, schoolScoped } from '@/lib/api'
import { listTeachers, assignInvigilator } from '@/lib/exams/service-extended'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withUser(async (user) => {
    const schoolId = schoolScoped(user)
    const teachers = await listTeachers(schoolId)
    return teachers
  })
}

// POST /api/exams/[id]/invigilator  body: { scheduleItemId, teacherId }
// teacherId = null → release the assigned invigilator from that paper.
// Assigning creates a direct Message notification for the teacher (their
// "Examination duty" preference is honored server-side).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const { id } = await params
      const body = await req.json().catch(() => ({}))
      const teacherId =
        body.teacherId === null || body.teacherId === undefined || body.teacherId === ''
          ? null
          : String(body.teacherId)
      const result = await assignInvigilator(id, body.scheduleItemId, schoolId, user, teacherId)
      return result
    },
    { roles: ['PRINCIPAL', 'MANAGEMENT'] }
  )
}
