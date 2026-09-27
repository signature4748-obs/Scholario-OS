import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'
import { authorizeScanScope } from '@/lib/marks-scan/server'

export const runtime = 'nodejs'

/**
 * GET /api/teacher/marks-entry/scan-draft?examId=&classId=&subjectId=
 *   → the teacher's saved scan review draft for exactly this grid, or null.
 * DELETE (same query) → discard the draft (called on explicit discard or
 * after a successful canonical submission).
 *
 * Authorization mirrors the manual save route: the teacher must teach this
 * class × subject and the exam must configure it — a crafted request for
 * another teacher's class returns FORBIDDEN before any draft row is read.
 */

function scopeFromQuery(url: URL) {
  const examId = url.searchParams.get('examId')
  const classId = url.searchParams.get('classId')
  const subjectId = url.searchParams.get('subjectId')
  if (!examId || !classId || !subjectId) throw new Error('examId, classId and subjectId are required')
  return { examId, classId, subjectId }
}

export async function GET(req: NextRequest) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const scope = scopeFromQuery(new URL(req.url))
      await authorizeScanScope(user, schoolId, scope) // FORBIDDEN guard first

      const draft = await db.marksScanDraft.findUnique({
        where: {
          schoolId_teacherId_examId_classId_subjectId: {
            schoolId,
            teacherId: user.id,
            examId: scope.examId,
            classId: scope.classId,
            subjectId: scope.subjectId,
          },
        },
      })
      if (!draft) return null
      return {
        maxMarks: draft.maxMarks,
        rows: safeJson(draft.rowsJson, []),
        pages: safeJson(draft.pagesJson, []),
        savedAt: draft.updatedAt.toISOString(),
      }
    },
    { roles: ['TEACHER'] },
  )
}

export async function DELETE(req: NextRequest) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const scope = scopeFromQuery(new URL(req.url))
      await authorizeScanScope(user, schoolId, scope)

      await db.marksScanDraft.deleteMany({
        where: {
          schoolId,
          teacherId: user.id,
          examId: scope.examId,
          classId: scope.classId,
          subjectId: scope.subjectId,
        },
      })
      return { discarded: true }
    },
    { roles: ['TEACHER'] },
  )
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
