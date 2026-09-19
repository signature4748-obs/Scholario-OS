'use client'

import { create } from 'zustand'
import { teachers as mockTeachers } from '@/lib/mock/teachers'

/**
 * teacher-roster-store — the school's REAL teacher roster (server truth),
 * mock-seeded for instant first paint.
 *
 * The Principal's timetable workspace uses this for its teacher picker,
 * faculty filters, conflict labels and auto-scheduler — so every teacher
 * the editor can assign is a teacher who actually exists at the school
 * (GET /api/teachers → Teacher rows joined with their User identity).
 * Until the fetch resolves (or if it fails) the demo mock roster serves
 * as an honest fallback — ids stay internally consistent either way
 * because consumers hydrate AFTER ensure() settles.
 */

export interface TeacherPick {
  /** Stable id — server Teacher.id once synced, mock id on the fallback. */
  id: string
  employeeId: string
  name: string
  avatar: string
  department: string
  /** Comma-split subject codes/names (server stores one string column). */
  subjects: string[]
}

interface ServerTeacherRow {
  id: string
  employeeId: string | null
  department: string | null
  subjects: string | null
  user: { name: string; email?: string | null }
}

/** "Mrs. Kavita Sharma" → "KS", "Rohan Mehta" → "RM", "Socrates" → "S". */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  const last = words[words.length - 1]
  const prev = words[words.length - 2]
  return `${prev[0]}${last[0]}`.toUpperCase()
}

const mockPicks: TeacherPick[] = mockTeachers
  .filter((t) => !t.archived && t.status === 'Active')
  .map((t) => ({
    id: t.id,
    employeeId: t.employeeId,
    name: t.name,
    avatar: t.avatar,
    department: t.department,
    subjects: t.subjects ?? [],
  }))

interface TeacherRosterState {
  /** Server roster once synced; mock roster until then. */
  teachers: TeacherPick[]
  /** 'mock' until /api/teachers resolves; 'server' afterwards. */
  source: 'mock' | 'server'
  /** ensure() in-flight promise guard (idempotent across consumers). */
  loading: boolean
  ensure: () => Promise<void>
}

let inflight: Promise<void> | null = null

export const useTeacherRosterStore = create<TeacherRosterState>((set) => ({
  teachers: mockPicks,
  source: 'mock',
  loading: false,
  ensure: () => {
    if (inflight) return inflight
    set({ loading: true })
    inflight = (async () => {
      try {
        const res = await fetch('/api/teachers', {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        const json = (await res.json().catch(() => null)) as
          | { ok?: unknown; data?: unknown }
          | null
        if (!res.ok || !json || json.ok !== true) throw new Error('roster sync failed')
        const rows = Array.isArray(json.data) ? (json.data as ServerTeacherRow[]) : []
        if (rows.length === 0) throw new Error('empty roster')
        const picks: TeacherPick[] = rows.map((r) => ({
          id: r.id,
          employeeId: r.employeeId ?? '—',
          name: r.user?.name ?? 'Unnamed teacher',
          avatar: initialsOf(r.user?.name ?? '?'),
          department: r.department ?? 'Faculty',
          subjects: (r.subjects ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }))
        set({ teachers: picks, source: 'server' })
      } catch {
        /* keep the mock fallback — ids stay consistent for this session */
      } finally {
        set({ loading: false })
      }
    })()
    return inflight
  },
}))

/** Imperative lookup (non-React modules: PDF builder etc.). */
export const teacherById = (id: string): TeacherPick | undefined =>
  useTeacherRosterStore.getState().teachers.find((t) => t.id === id)

/** Imperative name-by-id with fallback (mirrors the old getTeacherById). */
export const teacherNameById = (id: string): string | undefined => teacherById(id)?.name
