'use client'

/**
 * Class Attendance (TWC-FE-2) — shared contracts, status recipes and pure
 * helpers for the two-layer attendance model:
 *
 *   · the CLASS TEACHER owns the official daily baseline — the canonical
 *     Attendance rows students and parents see;
 *   · SUBJECT TEACHERS get that baseline prefilled, change only the
 *     exceptions, and explicitly submit their OWN per-subject session
 *     (a separate record — viewing never writes anything).
 *
 * Every value on screen comes from /api/teacher/class-attendance*
 * ({ ok, data } envelopes, TWC-2 routes). Nothing is fabricated or
 * persisted client-side.
 */

import { Check, Clock, Plane, X, type LucideIcon } from 'lucide-react'

// ─── API contracts (mirror of the TWC-2 server routes) ────────────────

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE'

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'LEAVE',
] as const

/** Runtime guard for statuses arriving inside JSON payloads. */
export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return (
    typeof value === 'string' &&
    (ATTENDANCE_STATUSES as readonly unknown[]).includes(value)
  )
}

export interface SubjectRef {
  id: string
  name: string
}

/**
 * A class the teacher may mark attendance for: she is the class teacher of
 * it (baseline authority) and/or teaches subjects in it (subject sessions).
 */
export interface AttendanceClassInfo {
  classId: string
  label: string
  isClassTeacher: boolean
  subjects: SubjectRef[]
}

export interface AttendanceStudent {
  id: string
  rollNo: string
  name: string
}

export interface AttendanceCounts {
  present: number
  absent: number
  late: number
  leave: number
}

/** The class teacher's official daily record for the viewed date. */
export interface BaselineInfo {
  exists: boolean
  entries: Record<string, string>
  markedBy: string | null
  savedAt: string | null
  counts: AttendanceCounts
}

/** The caller's own saved subject session for the viewed date. */
export interface SubjectSessionInfo {
  subjectId: string
  subjectName: string
  savedAt: string
  entries: Record<string, string>
}

export interface AttendanceBoard {
  classId: string
  label: string
  date: string
  isClassTeacher: boolean
  subjects: SubjectRef[]
  students: AttendanceStudent[]
  baseline: BaselineInfo
  mySessions: Record<string, SubjectSessionInfo>
  /** last 10 marked school days (30-day lookback) — absent when server predates it */
  history?: AttendanceHistory
}

// ─── Recent history (last 10 marked school days) ──────────────────────

export interface HistoryDay {
  date: string
  counts: AttendanceCounts
  /** PRESENT / total marked, 0..1 */
  rate: number
  entries: Record<string, string>
}

export interface AttendanceHistory {
  days: HistoryDay[]
}

/** Per-student aggregates over the history window. */
export interface HistoryStat {
  present: number
  absent: number
  late: number
  leave: number
  marked: number
  /** PRESENT / marked, 0..1 (1 when nothing marked — vacuous, never scary) */
  rate: number
}

export function historyStatsFor(
  studentId: string,
  history: AttendanceHistory | undefined,
): HistoryStat {
  const stat: HistoryStat = { present: 0, absent: 0, late: 0, leave: 0, marked: 0, rate: 1 }
  if (!history) return stat
  for (const day of history.days) {
    const status = day.entries[studentId]
    if (!isAttendanceStatus(status)) continue
    stat.marked++
    if (status === 'PRESENT') stat.present++
    else if (status === 'ABSENT') stat.absent++
    else if (status === 'LATE') stat.late++
    else stat.leave++
  }
  stat.rate = stat.marked > 0 ? stat.present / stat.marked : 1
  return stat
}

/** The N most recent marked days' statuses for one student (oldest → newest). */
export function recentStatusesFor(
  studentId: string,
  history: AttendanceHistory | undefined,
  count = 5,
): { date: string; status: AttendanceStatus }[] {
  if (!history || history.days.length === 0) return []
  return history.days
    .slice(-count)
    .filter((d) => isAttendanceStatus(d.entries[studentId]))
    .map((d) => ({ date: d.date, status: d.entries[studentId] as AttendanceStatus }))
}

/** Tailwind recipe for one history dot / insight tone by status. */
export const HISTORY_DOT: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-500',
  ABSENT: 'bg-rose-500',
  LATE: 'bg-amber-500',
  LEAVE: 'bg-info',
}

/** Present-rate tone: emerald ≥ 90%, amber ≥ 75%, rose below. */
export function rateTone(rate: number): { text: string; chip: string; bar: string } {
  if (rate >= 0.9) {
    return { text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-500/10 text-emerald-600', bar: 'bg-emerald-500' }
  }
  if (rate >= 0.75) {
    return { text: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-500/10 text-amber-600', bar: 'bg-amber-500' }
  }
  return { text: 'text-rose-600 dark:text-rose-400', chip: 'bg-rose-500/10 text-rose-600', bar: 'bg-rose-500' }
}

/** One status per roster student, keyed by studentId. */
export type AttendanceDraft = Record<string, AttendanceStatus>

export type SaveCounts = AttendanceCounts

export interface SaveBaselineResult {
  saved: number
  counts: SaveCounts
}

export interface SaveSessionResult {
  saved: number
  subjectName: string
  counts: SaveCounts
}

// ─── Status recipes (visual language of the previous module, verbatim) ─

export interface StatusRecipe {
  label: string
  icon: LucideIcon
  /** selected: filled bg + white text */
  active: string
  /** unselected: outline tint */
  inactive: string
  /** quiet row tint while this status is selected */
  row: string
  /** left border accent for the hairline roster rows */
  accent: string
}

export const STATUS_CONFIG: Record<AttendanceStatus, StatusRecipe> = {
  PRESENT: {
    label: 'Present',
    icon: Check,
    active: 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/30',
    inactive: 'text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/30',
    row: 'border-emerald-500/20 bg-emerald-500/5',
    accent: 'border-l-emerald-500',
  },
  ABSENT: {
    label: 'Absent',
    icon: X,
    active: 'bg-rose-500 text-white border-rose-500 shadow-sm shadow-rose-500/30',
    inactive: 'text-rose-600 hover:bg-rose-500/10 border-rose-500/30',
    row: 'border-rose-500/20 bg-rose-500/5',
    accent: 'border-l-rose-500',
  },
  LATE: {
    label: 'Late',
    icon: Clock,
    active: 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/30',
    inactive: 'text-amber-600 hover:bg-amber-500/10 border-amber-500/30',
    row: 'border-amber-500/20 bg-amber-500/5',
    accent: 'border-l-amber-500',
  },
  LEAVE: {
    label: 'Leave',
    icon: Plane,
    active: 'bg-info text-white border-info shadow-sm',
    inactive: 'text-info hover:bg-info/10 border-info/30',
    row: 'border-info/20 bg-info/5',
    accent: 'border-l-info',
  },
}

// ─── Date helpers (LOCAL time — never UTC, avoids off-by-one days) ────

/** Date → calendar-day key "YYYY-MM-DD" in local time. */
export function toDayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** "YYYY-MM-DD" for today (local). */
export function todayKey(): string {
  return toDayKey(new Date())
}

/** Parse "YYYY-MM-DD" as a LOCAL date (midnight, never UTC). */
export function parseDayKey(key: string): Date {
  return new Date(`${key}T00:00:00`)
}

/** Shift a local day key by n days (n may be negative). */
export function shiftDayKey(key: string, n: number): string {
  const d = parseDayKey(key)
  d.setDate(d.getDate() + n)
  return toDayKey(d)
}

/** The Monday–Sunday week (7 day keys) containing the given key. */
export function weekOf(key: string): string[] {
  const d = parseDayKey(key)
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  const monday = shiftDayKey(key, -dow)
  return Array.from({ length: 7 }, (_, i) => shiftDayKey(monday, i))
}

/** "M"/"T"/"W"… one-letter weekday for the week strip. */
export function weekdayLetter(key: string): string {
  const d = parseDayKey(key)
  return Number.isNaN(d.getTime())
    ? '·'
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S'][(d.getDay() + 6) % 7]
}

/** "Thursday, 17 September 2026" — the toolbar context date. */
export function longDate(key: string): string {
  const d = parseDayKey(key)
  return Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
}

/** "17 Sep" — quiet in-sentence date. */
export function shortDate(key: string): string {
  const d = parseDayKey(key)
  return Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** "10:42 AM" when saved the same calendar day, else "16 Sep, 10:42 AM". */
export function savedAtLabel(iso: string, dateKey: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  const day = toDayKey(d)
  return day === dateKey ? time : `${shortDate(day)}, ${time}`
}

// ─── Draft construction (server truth → editable draft) ───────────────

export type PrefillSource = 'session' | 'baseline' | 'present'

function allPresent(students: readonly AttendanceStudent[]): AttendanceDraft {
  const draft: AttendanceDraft = {}
  for (const s of students) draft[s.id] = 'PRESENT'
  return draft
}

function overlay(
  students: readonly AttendanceStudent[],
  incoming: Record<string, string>,
): AttendanceDraft {
  const draft = allPresent(students)
  for (const s of students) {
    const v = incoming[s.id]
    if (isAttendanceStatus(v)) draft[s.id] = v
  }
  return draft
}

/**
 * Prefill priority:
 *   class teacher  → baseline.entries (her official record), else all-PRESENT;
 *   subject teacher → her saved session for the subject, else the class
 *                    teacher's baseline (change only exceptions),
 *                    else all-PRESENT.
 */
export function buildDraft(
  board: AttendanceBoard,
  subjectId: string | null,
): { draft: AttendanceDraft; source: PrefillSource } {
  if (board.isClassTeacher) {
    return board.baseline.exists
      ? { draft: overlay(board.students, board.baseline.entries), source: 'baseline' }
      : { draft: allPresent(board.students), source: 'present' }
  }
  if (subjectId) {
    const session = board.mySessions[subjectId]
    if (session) return { draft: overlay(board.students, session.entries), source: 'session' }
  }
  return board.baseline.exists
    ? { draft: overlay(board.students, board.baseline.entries), source: 'baseline' }
    : { draft: allPresent(board.students), source: 'present' }
}

/**
 * The one quiet context line under the roster header — mode + prefill
 * truth. Never a badge wall, never the module name.
 */
export function rosterContextLine(
  board: AttendanceBoard,
  subjectId: string | null,
  source: PrefillSource,
): string {
  const isToday = board.date === todayKey()
  if (board.isClassTeacher) {
    if (source === 'baseline') {
      return `Official record · marked by ${board.baseline.markedBy ?? 'the class teacher'}`
    }
    return isToday
      ? "Today's attendance hasn't been marked yet"
      : `Attendance for ${shortDate(board.date)} hasn't been marked yet`
  }
  if (source === 'session' && subjectId) {
    const session = board.mySessions[subjectId]
    const name = session?.subjectName ?? 'subject'
    const at = session ? savedAtLabel(session.savedAt, board.date) : ''
    return at ? `Your ${name} session · saved ${at}` : `Your ${name} session`
  }
  if (source === 'baseline') {
    return "Prefilled from the class teacher's attendance — change only exceptions"
  }
  return isToday
    ? "Class teacher hasn't marked today yet"
    : `Class teacher hasn't marked ${shortDate(board.date)} yet`
}

// ─── Counts ───────────────────────────────────────────────────────────

/** Live draft counts over the roster (missing keys count as PRESENT). */
export function draftCounts(
  students: readonly AttendanceStudent[],
  draft: AttendanceDraft,
): AttendanceCounts {
  const counts: AttendanceCounts = { present: 0, absent: 0, late: 0, leave: 0 }
  for (const s of students) {
    const status = draft[s.id] ?? 'PRESENT'
    if (status === 'PRESENT') counts.present++
    else if (status === 'ABSENT') counts.absent++
    else if (status === 'LATE') counts.late++
    else counts.leave++
  }
  return counts
}

/** "9 present · 1 absent · 1 late · 1 on leave" — zero parts omitted. */
export function countsParts(counts: AttendanceCounts): string[] {
  const parts: string[] = []
  if (counts.present > 0) parts.push(`${counts.present} present`)
  if (counts.absent > 0) parts.push(`${counts.absent} absent`)
  if (counts.late > 0) parts.push(`${counts.late} late`)
  if (counts.leave > 0) parts.push(`${counts.leave} on leave`)
  return parts
}
