'use client'

/**
 * academic-config/client — the Principal-side bridge to the AUTHORITATIVE
 * academic configuration (GET/POST /api/principal/academic).
 *
 * SINGLE SOURCE OF TRUTH (architecture):
 *   The server DB (Class · ClassSubjectAssignment · Subject ·
 *   Class.classTeacherId) is the ONLY authoritative school data. Teacher
 *   modules (My Timetable, Lesson Planner, Marks Entry, My Class,
 *   Attendance) all read IT. This client gives the Principal's UI the
 *   same server data — every mutation goes through the API and the
 *   refreshed server state REPLACES local state (never the reverse).
 *
 * The legacy Students & Classes Zustand mock universe (Class 2 / KG / …
 * with its own subject registry) remains for classes that have no
 * server-side record; `resolveDbClassFor` links a mock class card to its
 * server class so the Subjects / Teachers tabs can operate on the real
 * record for exactly the classes that have one.
 */

import { create } from 'zustand'
import type { ClassRecord } from '@/lib/store/students-store'

// ── Server payload types ───────────────────────────────────────────────

export interface DbSubjectInfo {
  subjectId: string
  name: string
  code: string | null
  isCore: boolean
  examinable: boolean
  periodsPerWeek: number
  teachers: string[]
}

export interface DbClassInfo {
  id: string
  name: string
  section: string | null
  label: string
  room: string | null
  classTeacher: { id: string; name: string } | null
  subjects: DbSubjectInfo[]
}

export interface DbCatalogSubject {
  id: string
  name: string
  code: string | null
  status: string
}

export interface AcademicConfig {
  academicSession: string | null
  catalog: DbCatalogSubject[]
  teachers: { id: string; name: string; email: string }[]
  classes: DbClassInfo[]
}

// ── Store ──────────────────────────────────────────────────────────────

interface AcademicConfigState {
  config: AcademicConfig | null
  loading: boolean
  error: string | null
  /** Bumped after every successful mutation — consumers refetch. */
  version: number
  fetch: (force?: boolean) => Promise<void>
  act: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
}

export const useAcademicConfigStore = create<AcademicConfigState>()((set, get) => ({
  config: null,
  loading: false,
  error: null,
  version: 0,

  fetch: async (force = false) => {
    if (get().loading) return
    if (!force && get().config) return
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/principal/academic', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Server responded ${res.status}`)
      // API envelope: { ok, data } — unwrap to the configuration payload.
      const payload = (await res.json()) as { ok?: boolean; data?: AcademicConfig }
      const data = payload?.data ?? (payload as AcademicConfig)
      if (!data || !Array.isArray(data.classes)) throw new Error('Malformed academic configuration payload')
      set({ config: data, loading: false, version: get().version + 1 })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Failed to load academic configuration' })
    }
  },

  act: async (payload) => {
    const res = await fetch('/api/principal/academic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : `Action failed (${res.status})`)
    }
    // Server is truth — pull the refreshed configuration.
    set({ loading: false, error: null })
    await get().fetch(true)
    return data
  },
}))

/** Convenience hook — exposes the cached config + loaders. */
export function useAcademicConfig() {
  const config = useAcademicConfigStore((s) => s.config)
  const loading = useAcademicConfigStore((s) => s.loading)
  const error = useAcademicConfigStore((s) => s.error)
  const fetcher = useAcademicConfigStore((s) => s.fetch)
  return { config, loading, error, refetch: fetcher }
}

// ── Mock → server class resolution ─────────────────────────────────────

/**
 * Links a mock Students & Classes card to its server class.
 *
 * Rule (demo school mapping):
 *   · mock grade 6–10 → the unique server class of that grade
 *     ("Class 9" → "Grade 9 - A");
 *   · mock grade 11/12 streams → PCM → section A, PCB → section B;
 *   · Pre-Primary / Primary demo classes (Pre-Nursery, KG, Class 2,
 *     Class 4) have no server record → null (the card keeps its legacy
 *     mock behaviour, clearly labelled).
 */
export function resolveDbClassFor(
  mock: Pick<ClassRecord, 'grade' | 'stream'>,
  classes: DbClassInfo[],
): DbClassInfo | null {
  if (!classes.length) return null
  const grade = mock.grade
  if (grade < 5) return null // Pre-Primary / Primary demo classes — no server record

  const gradeNum = (c: DbClassInfo) => Number(c.name.match(/\d{1,2}/)?.[0] ?? -1)
  const ofGrade = classes.filter((c) => gradeNum(c) === grade)
  if (ofGrade.length === 0) return null
  if (ofGrade.length === 1) return ofGrade[0]

  // Senior secondary: two server classes (A · Science, B · Commerce).
  // PCM (first stream) → A; PCB (second stream) → B.
  const wantSection = mock.stream === 'PCB' ? 'B' : 'A'
  return ofGrade.find((c) => (c.section ?? 'A') === wantSection) ?? ofGrade[0]
}
