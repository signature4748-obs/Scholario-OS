'use client'

/**
 * student-attendance — shared TYPES + pure helpers for the student
 * attendance surfaces (My Attendance, Profile snapshot, Report Card).
 *
 * SOURCE OF TRUTH: the SERVER's canonical Attendance rows, fetched by
 * `useMyServerAttendance` (/api/student/attendance — identity resolved
 * server-side, one row per Class + Section + Date + Student). There is
 * NO client-side attendance dataset any more: every number (percentage,
 * present/absent/late counts, trends) derives from those server records,
 * so a correction by Teacher/Principal is what the student sees.
 *
 * Percentage policy (the school's convention, unchanged):
 *   attended = Present + Late (late counts as attended)
 *   applicable days = RECORDED school days only — holidays, weekends and
 *   unrecorded days never reduce attendance, and "No Record" never
 *   silently becomes Absent.
 */

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave'

export interface StudentAttendanceRecord {
  studentId: string
  /** YYYY-MM-DD */
  date: string
  status: AttendanceStatus
  /** Optional reason/note recorded by the marker. */
  note?: string
  /** Who marked the record (teacher/principal display name). */
  markedBy?: string
  /** ISO timestamp of the last write to this record. */
  markedAt: string
}

/* ─── Derived helpers (pure — usable outside React) ─────────────────── */

export interface AttendanceStats {
  total: number
  present: number
  late: number
  absent: number
  leave: number
  /** Days attended (present + late — late arrivals count as attended). */
  attended: number
  /** Attendance percentage over recorded days (0 when no records). */
  percent: number
}

export function computeStats(records: StudentAttendanceRecord[]): AttendanceStats {
  const s: AttendanceStats = { total: 0, present: 0, late: 0, absent: 0, leave: 0, attended: 0, percent: 0 }
  for (const r of records) {
    s.total++
    s[r.status]++
  }
  s.attended = s.present + s.late
  s.percent = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0
  return s
}

/** Records for one student, oldest → newest. */
export function studentRecords(all: StudentAttendanceRecord[], studentId: string): StudentAttendanceRecord[] {
  return all.filter((r) => r.studentId === studentId).sort((a, b) => (a.date < b.date ? -1 : 1))
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Weekly aggregation → the honest "improving or declining?" curve.
 * One point per ISO week (Mon-based) that has records, oldest → newest,
 * labeled by the week's Monday ("10 Nov"). NO synthetic history — weeks
 * without records simply do not appear. Late arrivals count as attended
 * (same convention as computeStats).
 */
export function weeklyTrend(records: StudentAttendanceRecord[], weeks = 8): { name: string; v: number }[] {
  if (records.length === 0) return []
  const byWeek = new Map<string, { attended: number; total: number }>()
  for (const r of records) {
    const d = new Date(`${r.date}T00:00:00`)
    if (Number.isNaN(d.getTime())) continue
    // ISO week start (Monday)
    const dow = (d.getDay() + 6) % 7
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow)
    const key = isoDate(monday)
    const agg = byWeek.get(key) ?? { attended: 0, total: 0 }
    agg.total++
    if (r.status === 'present' || r.status === 'late') agg.attended++
    byWeek.set(key, agg)
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-weeks)
    .map(([key, agg]) => ({
      name: new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      v: Math.round((agg.attended / agg.total) * 100),
    }))
}
