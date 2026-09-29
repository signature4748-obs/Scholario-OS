'use client'

/**
 * marks-hooks — the REAL data layer for the Principal's marks section.
 *
 * iq3000-2b: the paper-level marks workflow operates on the canonical
 * ExamMark rows in the database through /api/exams/[id]/* — never on the
 * mock marks store. This module holds the three hooks that do NOT already
 * exist in `@/lib/exams/use-exams` (which supplies useMarks, useSetMark,
 * useSubmitMarks, useVerifyMarks, useLockMarks, useDeclareResults,
 * useClassResults and useAuditLogs):
 *
 *  - useExamMarksAll    loads the marks of EVERY class of an examination.
 *                       The backend has no single "all marks of an exam"
 *                       route, so this fans out to one
 *                       /api/exams/[id]/results/class/[classId] request
 *                       per exam class (the class-level marks surface) and
 *                       aggregates the marks rows. Partial failures keep
 *                       the classes that DID load and surface the first
 *                       error honestly.
 *  - usePublishResults  POSTs the exam-level publish flow
 *                       (/api/exams/[id]/publish) with notification flags.
 *  - useTeacherDirectory  loads /api/teachers (principal-only route) so the
 *                       "Entered By" column can resolve ExamMark.enteredBy
 *                       user ids to real teacher names.
 */

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/exams/api-client'
import type { ExamDTO, ExamMarkDTO } from '@/lib/exams/types'
import type { ClassResultsDTO } from '@/lib/exams/use-exams'

// ─── All marks of an examination (one request per exam class) ──────────

export interface ExamMarksAllState {
  /** Every ExamMark row of the exam (all classes × all subjects). */
  allMarks: ExamMarkDTO[]
  /** Per-class results payloads keyed by classId (students/subjects/marks/results/analytics). */
  classResults: Record<string, ClassResultsDTO>
  loading: boolean
  /** First error across the per-class fetches (null when every class loaded). */
  error: string | null
  reload: () => void
}

export function useExamMarksAll(exam: ExamDTO | null): ExamMarksAllState {
  const examId = exam?.id ?? null
  // Join the class ids once so the effect dependency is a stable primitive.
  const classKey = (exam?.classes ?? []).map((c) => c.classId).join(',')

  const [allMarks, setAllMarks] = useState<ExamMarkDTO[]>([])
  const [classResults, setClassResults] = useState<Record<string, ClassResultsDTO>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    const classIds = classKey ? classKey.split(',') : []
    if (!examId || classIds.length === 0) {
      setAllMarks([])
      setClassResults({})
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all(
      classIds.map((classId) =>
        api<ClassResultsDTO>(`/api/exams/${examId}/results/class/${classId}`)
          .then((d) => ({ classId, d, err: null as string | null }))
          .catch((e: unknown) => ({
            classId,
            d: null,
            err: e instanceof Error ? e.message : 'Marks could not be loaded',
          })),
      ),
    )
      .then((rows) => {
        if (cancelled) return
        const marks: ExamMarkDTO[] = []
        const byClass: Record<string, ClassResultsDTO> = {}
        let firstErr: string | null = null
        for (const r of rows) {
          if (r.d) {
            byClass[r.classId] = r.d
            marks.push(...r.d.marks)
          } else if (firstErr === null) {
            firstErr = r.err
          }
        }
        setAllMarks(marks)
        setClassResults(byClass)
        setError(firstErr)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [examId, classKey, tick])

  return { allMarks, classResults, loading, error, reload }
}

// ─── Publish results (exam-level) ──────────────────────────────────────

export function usePublishResults() {
  const [loading, setLoading] = useState(false)
  const publish = useCallback(
    async (
      examId: string,
      options: { notifyStudents?: boolean; notifyParents?: boolean } = {},
    ): Promise<{ published: boolean; notificationsSent: number }> => {
      setLoading(true)
      try {
        return await api<{ published: boolean; notificationsSent: number }>(`/api/exams/${examId}/publish`, {
          method: 'POST',
          json: options,
        })
      } finally {
        setLoading(false)
      }
    },
    [],
  )
  return { publish, loading }
}

// ─── Teacher directory (resolve enteredBy ids to names) ────────────────

export interface TeacherDirectoryEntry {
  /** Teacher row id. */
  id: string
  /** User id — ExamMark.enteredBy stores this. */
  userId: string | null
  name: string | null
}

/**
 * GET /api/teachers — the real staff directory (PRINCIPAL/MANAGEMENT only).
 * Failures are swallowed: the directory only powers the cosmetic
 * "Entered By" column, and an honest "—" is shown without it.
 */
export function useTeacherDirectory(): TeacherDirectoryEntry[] {
  const [teachers, setTeachers] = useState<TeacherDirectoryEntry[]>([])
  useEffect(() => {
    let cancelled = false
    api<Array<{ id: string; userId: string | null; user?: { name: string | null } }>>('/api/teachers')
      .then((rows) => {
        if (cancelled) return
        setTeachers(rows.map((t) => ({ id: t.id, userId: t.userId, name: t.user?.name ?? null })))
      })
      .catch(() => {
        /* directory is display-only — leave empty */
      })
    return () => {
      cancelled = true
    }
  }, [])
  return teachers
}

/**
 * Build a lookup map (teacher id + user id → display name) for resolving
 * ExamMark.enteredBy values.
 */
export function buildTeacherNameMap(teachers: TeacherDirectoryEntry[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const t of teachers) {
    if (!t.name) continue
    m.set(t.id, t.name)
    if (t.userId) m.set(t.userId, t.name)
  }
  return m
}

/**
 * Resolve an `enteredBy` value to a display name. Real rows store a user id
 * (resolvable via the directory); legacy seeded rows stored the teacher's
 * name directly (contains whitespace) — shown as-is. Unresolvable ids map
 * to null so the UI can render an honest "—".
 */
export function resolveEnteredBy(enteredBy: string | null | undefined, nameMap: Map<string, string>): string | null {
  if (!enteredBy) return null
  const resolved = nameMap.get(enteredBy)
  if (resolved) return resolved
  // Legacy seeds stored display names; cuid-style ids never contain spaces.
  if (/\s/.test(enteredBy)) return enteredBy
  return null
}
