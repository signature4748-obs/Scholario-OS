import { withUser } from '@/lib/api'
import { addCustomTopic, updateCustomTopic, deleteCustomTopic } from '@/lib/lesson-planner'

export const runtime = 'nodejs'

// POST /api/teacher/lesson-planner/topics — add a topic to the teacher's own
// class+subject plan. Body:
//   { classId, subjectId, unitNo?: number|null, unitName?: string|null,
//     topicName: string, description?: string|null, periodsNeeded?: number }
// unitNo = an existing unit's number; omit/null to append a brand-new unit
// (its name comes from unitName).
export async function POST(request: Request) {
  return withUser(
    async (user) => {
      const body = (await request.json().catch(() => null)) as {
        classId?: string
        subjectId?: string
        unitNo?: number | null
        unitName?: string | null
        topicName?: string
        description?: string | null
        periodsNeeded?: number
      } | null
      if (!body?.classId || !body.subjectId || !body.topicName?.trim()) {
        throw new Error('classId, subjectId and topicName are required')
      }
      const topicId = await addCustomTopic(user, {
        classId: body.classId,
        subjectId: body.subjectId,
        unitNo: typeof body.unitNo === 'number' ? body.unitNo : null,
        unitName: body.unitName ?? null,
        topicName: body.topicName,
        description: body.description ?? null,
        periodsNeeded: typeof body.periodsNeeded === 'number' ? body.periodsNeeded : 4,
      })
      return { topicId }
    },
    { roles: ['TEACHER'] }
  )
}

// PATCH /api/teacher/lesson-planner/topics — edit one topic. Body:
//   { topicId, topicName?, description?, periodsNeeded?, unitNo? }
// unitNo may only point at an existing unit of the same plan.
export async function PATCH(request: Request) {
  return withUser(
    async (user) => {
      const body = (await request.json().catch(() => null)) as {
        topicId?: string
        topicName?: string
        description?: string | null
        periodsNeeded?: number
        unitNo?: number
      } | null
      if (!body?.topicId) throw new Error('topicId is required')
      await updateCustomTopic(user, {
        topicId: body.topicId,
        topicName: body.topicName,
        description: body.description,
        periodsNeeded: body.periodsNeeded,
        unitNo: body.unitNo,
      })
      return { ok: true }
    },
    { roles: ['TEACHER'] }
  )
}

// DELETE /api/teacher/lesson-planner/topics?topicId= — remove a topic.
// Completed topics are protected (undo the completion first).
export async function DELETE(request: Request) {
  return withUser(
    async (user) => {
      const topicId = new URL(request.url).searchParams.get('topicId')
      if (!topicId) throw new Error('topicId is required')
      await deleteCustomTopic(user, topicId)
      return { ok: true }
    },
    { roles: ['TEACHER'] }
  )
}
