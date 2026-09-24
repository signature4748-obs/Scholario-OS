'use client'

/**
 * Attendance module data layer — CANONICAL SERVER SOURCE.
 *
 * Every number rendered by the Principal's Attendance module comes from
 * `GET /api/principal/attendance` (derived server-side from the school's
 * real Attendance rows — the same rows teachers write and students read).
 * The legacy 1,842-student / Class 2-A / December-2025 mock universe is
 * retired: no `@/lib/mock/attendance` importers remain in this module.
 *
 * What lives here:
 *   - Response types mirroring the API payload
 *   - usePrincipalAttendance(date)  → snapshot for a day (+ session trends)
 *   - useStudentDrill(studentId)    → per-student history (?studentId=)
 *   - buildMonthCalendar(...)       → heatmap geometry with REAL rates only
 *     (the bundled school-calendar is used for weekend/holiday GEOMETRY
 *     only — never for rates, which come exclusively from weekTrend)
 *   - getSchoolInfo()               → cached school name + academic session
 *     label (for the header strip + PDF exports)
 */

import { useCallback, useEffect, useState } from 'react'
import { isWeekend, getHoliday, type Holiday } from '@/lib/mock/school-calendar'

/* ──────────────────────────────────────────────────────────
   Canonical response types (mirror of /api/principal/attendance)
   ────────────────────────────────────────────────────────── */

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave'
export type RosterStatus = AttendanceStatus | null

export interface AttendanceSummary {
  present: number
  absent: number
  late: number
  leave: number
  recorded: number
  /** (present + late) / recorded · 1dp · 0 when recorded === 0 */
  rate: number
}

export interface ClassBreakdown {
  classId: string
  classLabel: string
  students: number
  present: number
  absent: number
  late: number
  leave: number
  recorded: number
  /** null when the class has no rows for the day */
  rate: number | null
}

export interface TrendPoint {
  /** YYYY-MM-DD */
  date: string
  rate: number
  recorded: number
}

export interface MonthPoint {
  /** YYYY-MM */
  month: string
  rate: number
  recorded: number
}

export interface RosterEntry {
  studentId: string
  rollNo: string
  name: string
  /** 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | null (not marked) */
  status: string | null
}

export interface ClassSectionSnapshot {
  classId: string
  classLabel: string
  roster: RosterEntry[]
}

export interface StudentDrill {
  studentId: string
  name: string
  classLabel: string | null
  rollNo: string | null
  records: { date: string; status: string }[]
  present: number
  late: number
  absent: number
  leave: number
  rate: number
}

export interface AttendanceSnapshot {
  date: string
  summary: AttendanceSummary
  byClass: ClassBreakdown[]
  weekTrend: TrendPoint[]
  monthTrend: MonthPoint[]
  sections: ClassSectionSnapshot[]
  student: StudentDrill | null
}

/* ──────────────────────────────────────────────────────────
   usePrincipalAttendance — the module's single server source
   ────────────────────────────────────────────────────────── */

export interface PrincipalAttendanceState {
  snapshot: AttendanceSnapshot | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Fetch the canonical attendance snapshot.
 *
 * @param date 'YYYY-MM-DD' or null — null lets the SERVER decide "today"
 *             (the response's `date` field is the authoritative today).
 */
export function usePrincipalAttendance(date: string | null): PrincipalAttendanceState {
  const [snapshot, setSnapshot] = useState<AttendanceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const qs = date ? `?date=${encodeURIComponent(date)}` : ''
    fetch(`/api/principal/attendance${qs}`, { credentials: 'same-origin' })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: AttendanceSnapshot; error?: string }
          | null
        if (cancelled) return
        if (!res.ok || !json?.ok || !json.data) {
          throw new Error(json?.error || `Request failed (${res.status})`)
        }
        setSnapshot(json.data)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setSnapshot(null)
        setError(e instanceof Error ? e.message : 'Unable to load attendance')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [date, reloadKey])

  return { snapshot, loading, error, reload }
}

/* ──────────────────────────────────────────────────────────
   useStudentDrill — per-student history (?studentId=)
   ────────────────────────────────────────────────────────── */

export interface StudentDrillState {
  drill: StudentDrill | null
  loading: boolean
  error: string | null
}

/**
 * Fetch one student's canonical attendance history.
 * Only fetches when `open` is true (dialog mounted).
 */
export function useStudentDrill(
  studentId: string | null,
  date: string | null,
  open: boolean,
): StudentDrillState {
  const [drill, setDrill] = useState<StudentDrill | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !studentId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({ studentId })
    if (date) qs.set('date', date)
    fetch(`/api/principal/attendance?${qs.toString()}`, { credentials: 'same-origin' })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: AttendanceSnapshot; error?: string }
          | null
        if (cancelled) return
        if (!res.ok || !json?.ok || !json.data) {
          throw new Error(json?.error || `Request failed (${res.status})`)
        }
        setDrill(json.data.student)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setDrill(null)
        setError(e instanceof Error ? e.message : 'Unable to load student attendance')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [studentId, date, open])

  // Reset when the dialog closes so a previously-shown student never
  // flashes when opening a different one.
  useEffect(() => {
    if (!open) {
      setDrill(null)
      setError(null)
      setLoading(false)
    }
  }, [open])

  return { drill, loading, error }
}

/* ──────────────────────────────────────────────────────────
   School info (header session label + PDF exports)
   ────────────────────────────────────────────────────────── */

export interface SchoolInfo {
  name: string
  /** e.g. '2026-2027' */
  academicYear: string
  /** e.g. '2026-27' (short form for the header strip) */
  sessionLabel: string
}

let schoolInfoCache: SchoolInfo | null = null

/** '2026-2027' → '2026-27' (falls back to the raw value when unparsable). */
export function shortSessionLabel(academicYear: string): string {
  const m = academicYear.match(/^(\d{4})-(\d{4})$/)
  if (m) return `${m[1]}-${m[2].slice(2)}`
  return academicYear
}

/** Cached fetch of the caller's school (name + academic session). */
export async function getSchoolInfo(): Promise<SchoolInfo> {
  if (schoolInfoCache) return schoolInfoCache
  const res = await fetch('/api/schools', { credentials: 'same-origin' })
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: { name?: string; academicYear?: string }[] }
    | null
  const name = json?.data?.[0]?.name || 'Scholario'
  const academicYear = json?.data?.[0]?.academicYear || ''
  schoolInfoCache = {
    name,
    academicYear,
    sessionLabel: academicYear ? shortSessionLabel(academicYear) : academicYear,
  }
  return schoolInfoCache
}

/* ──────────────────────────────────────────────────────────
   Heatmap calendar — geometry real, rates REAL-only
   ────────────────────────────────────────────────────────── */

export interface CalendarCell {
  /** ISO date string (YYYY-MM-DD) — '' for empty leading cells. */
  dateStr: string
  /** Day-of-month number (1-31), or null for empty leading cells. */
  day: number | null
  /** REAL attendance rate (%) — null when no Attendance rows exist. */
  rate: number | null
  /** Rows recorded that day (only meaningful when rate != null). */
  recorded: number
  /** True if Saturday or Sunday (calendar geometry). */
  isWeekend: boolean
  /** True if a declared school holiday (calendar geometry). */
  isHoliday: boolean
  /** Holiday details (name + type), if applicable. */
  holiday: Holiday | null
  /** True when the date is after the canonical "today". */
  isFuture: boolean
}

/**
 * Build a calendar grid for a month. Rates come EXCLUSIVELY from
 * `rateByDate` (the snapshot's weekTrend — the 7 most recent days with
 * rows); every other day renders as an honest "no record" cell.
 * NO fabricated fluctuations.
 */
export function buildMonthCalendar(
  year: number,
  month: number,
  rateByDate: Map<string, { rate: number; recorded: number }>,
  todayStr: string,
): CalendarCell[] {
  const days: CalendarCell[] = []
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push({
      dateStr: '', day: null, rate: null, recorded: 0,
      isWeekend: false, isHoliday: false, holiday: null, isFuture: false,
    })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const weekend = isWeekend(dateStr)
    const holidayDetails = getHoliday(dateStr)
    const rec = rateByDate.get(dateStr) ?? null
    days.push({
      dateStr,
      day: d,
      rate: rec?.rate ?? null,
      recorded: rec?.recorded ?? 0,
      isWeekend: weekend,
      isHoliday: holidayDetails !== null,
      holiday: holidayDetails,
      isFuture: dateStr > todayStr,
    })
  }

  return days
}

/** Rate → heatmap cell color (recorded days only). */
export function rateColor(rate: number | null): string {
  if (rate === null) return 'bg-muted/40 border-border'
  if (rate >= 95) return 'bg-emerald-500/85 border-emerald-600 text-white'
  if (rate >= 90) return 'bg-emerald-400/60 border-emerald-500 text-emerald-950'
  if (rate >= 85) return 'bg-amber-400/70 border-amber-500 text-amber-950'
  return 'bg-rose-400/70 border-rose-500 text-rose-950'
}

/** Holiday cell color — distinct from attendance intensity. */
export const HOLIDAY_CELL_COLOR = 'bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300'

/* ──────────────────────────────────────────────────────────
   Date label helpers
   ────────────────────────────────────────────────────────── */

/** "16 Sep 2026" — compact date label. */
export function formatDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

/** "Tuesday, 16 September 2026" — long date label. */
export function formatDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** "Sep 16" — trend axis tick label. */
export function formatDayTick(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number)
  if (!m || !d) return isoDate
  return new Date(2020, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** "Sep 2026" — month tick/summary label. */
export function formatMonthTick(monthValue: string): string {
  const [y, m] = monthValue.split('-').map(Number)
  if (!y || !m) return monthValue
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/** "September 2026" — heatmap month title. */
export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/** "SEP 2026" — compact heatmap header label. */
export function formatMonthLabelCompact(year: number, month: number): string {
  return new Date(year, month - 1, 1)
    .toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    .toUpperCase()
}

/** Map a server roster status ('PRESENT'…) to the module status key. */
export function normalizeStatus(status: string | null): RosterStatus {
  if (status === 'PRESENT') return 'present'
  if (status === 'LATE') return 'late'
  if (status === 'ABSENT') return 'absent'
  if (status === 'LEAVE') return 'leave'
  return null
}
