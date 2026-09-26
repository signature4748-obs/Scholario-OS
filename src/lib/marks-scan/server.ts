import { db } from '@/lib/db'
import type { AuthUser } from '@/lib/auth'

/**
 * marks-scan/server — SERVER-ONLY authorization for the scan workflow.
 *
 * The exact same rules as the canonical manual Marks Entry save/submit
 * routes: a teacher may scan/submit marks only for a class × subject she
 * teaches (validated against the ACTIVE ClassSubjectAssignments via her
 * Timetable row) AND an exam that actually configures that pair. Frontend
 * dropdowns are never trusted.
 */

export interface ScanScope {
  examId: string
  classId: string
  subjectId: string
}

export interface AuthorizedScanScope {
  scope: ScanScope
  schoolId: string
  teacherId: string
  maxMarks: number
  passMarks: number
  session: string | null
  roster: { id: string; rollNo: string; name: string }[]
}

/** Throws FORBIDDEN / NOT_FOUND — never returns a partial scope. */
export async function authorizeScanScope(
  user: AuthUser,
  schoolId: string,
  scope: ScanScope,
): Promise<AuthorizedScanScope> {
  const teacherName = (user.name || '').trim().toLowerCase()
  const ttRow = await db.timetable.findFirst({
    where: { schoolId, classId: scope.classId, subjectId: scope.subjectId, teacherName: { not: null } },
  })
  if (!ttRow || (ttRow.teacherName || '').trim().toLowerCase() !== teacherName) {
    throw new Error('FORBIDDEN')
  }

  const config = await db.examSubjectConfig.findFirst({
    where: { examId: scope.examId, classId: scope.classId, subjectId: scope.subjectId, exam: { schoolId } },
    include: { exam: { select: { session: true } } },
  })
  if (!config) throw new Error('NOT_FOUND')

  const students = await db.student.findMany({
    where: { classId: scope.classId, user: { status: 'ACTIVE' } },
    select: { id: true, rollNo: true, user: { select: { name: true } } },
    orderBy: { rollNo: 'asc' },
  })

  return {
    scope,
    schoolId,
    teacherId: user.id,
    maxMarks: config.maxMarks,
    passMarks: Math.round(config.passMarks),
    session: config.exam.session,
    roster: students.map((s) => ({ id: s.id, rollNo: s.rollNo ?? '', name: s.user?.name ?? '' })),
  }
}

/** Parse + sanity-check the draft rows payload (server-side re-validation). */
export interface DraftRowInput {
  studentId: string
  rollNo: string
  name: string
  value: string
  status: string
  confidence: number | null
  match: string
  detectedName?: string
  box?: unknown
  pageId?: string | null
  duplicate?: boolean
  duplicatePages?: number[]
  touched?: boolean
  note?: string
}

export function parseDraftRows(raw: unknown): DraftRowInput[] {
  if (!Array.isArray(raw)) throw new Error('rows must be an array')
  if (raw.length > 500) throw new Error('Too many rows')
  return raw.map((r) => {
    const row = r as Record<string, unknown>
    return {
      studentId: typeof row.studentId === 'string' ? row.studentId : '',
      rollNo: typeof row.rollNo === 'string' ? row.rollNo.slice(0, 12) : '',
      name: typeof row.name === 'string' ? row.name.slice(0, 120) : '',
      value: typeof row.value === 'string' ? row.value.slice(0, 8) : '',
      status: typeof row.status === 'string' ? row.status : 'UNREAD',
      confidence:
        typeof row.confidence === 'number' && Number.isFinite(row.confidence)
          ? Math.max(-1, Math.min(100, row.confidence))
          : null,
      match: typeof row.match === 'string' ? row.match : 'ROLL',
      box: row.box ?? null,
      pageId: typeof row.pageId === 'string' ? row.pageId : null,
      duplicate: row.duplicate === true,
      duplicatePages: Array.isArray(row.duplicatePages) ? row.duplicatePages : [],
      touched: row.touched === true,
      note: typeof row.note === 'string' ? row.note.slice(0, 300) : '',
    }
  })
}

/** Preview images are capped server-side (drafts hold ~150–350 KB pages). */
export const MAX_DRAFT_BYTES = 6 * 1024 * 1024

export function parseDraftPages(raw: unknown): unknown {
  if (!Array.isArray(raw)) throw new Error('pages must be an array')
  if (raw.length > 10) throw new Error('Too many pages')
  const total = JSON.stringify(raw).length
  if (total > MAX_DRAFT_BYTES) throw new Error('Draft pages too large — re-scan with fewer pages')
  return raw
}
