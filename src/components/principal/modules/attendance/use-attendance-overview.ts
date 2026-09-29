'use client'

/**
 * use-attendance-overview — the canonical school-wide attendance overview
 * feed (attendance-overview-real).
 *
 * GET /api/attendance/overview derives EVERYTHING from the Attendance table
 * (latest recorded day breakdown, 6-day trend, 6-month trend, per
 * grade-group rates, per-date daily series). This hook unwraps the
 * { ok, data } envelope and exposes it as `{ data, loading }`:
 *
 *   · `data` is undefined while the fetch is in flight (or after a silent
 *     failure) — consumers render their existing skeleton / loading tile;
 *   · the fetch is module-level cached — one request per session is shared
 *     by every consumer (Attendance Overview tab, CSV export, dashboard
 *     KPI row, welcome banner); a failed fetch is NOT cached, so a later
 *     mount retries.
 */

import { useEffect, useState } from 'react'

export interface AttendanceOverviewToday {
  present: number
  absent: number
  late: number
  leave: number
  /** distinct students marked on `date` (honest denominator — NOT school size) */
  total: number
  /** (present + late) / total * 100, 1 decimal */
  rate: number
  /** ISO date (YYYY-MM-DD) of the latest RECORDED day; null when no rows */
  date: string | null
  isLatestRecordedDate: boolean
}

export interface AttendanceWeekTrendPoint {
  /** weekday short label of the recorded date ('Mon') */
  day: string
  date: string
  present: number
  rate: number
}

export interface AttendanceMonthlyPoint {
  /** calendar month short label ('Apr') */
  month: string
  rate: number
}

export interface AttendanceClassRate {
  /** grade-group label — "Grade 9" / "Grade 11 (Science)" / "Grade 11 (Commerce)" */
  class: string
  /** rate over ALL the group's attendance rows */
  rate: number
  /** distinct students with rows in the group */
  students: number
  present: number
  absent: number
  late: number
  leave: number
  /** student-day records — the rate's denominator */
  records: number
}

export interface AttendanceDayRecord {
  /** ISO date (YYYY-MM-DD) */
  date: string
  present: number
  absent: number
  late: number
  leave: number
  total: number
  rate: number
}

export interface AttendanceOverviewData {
  today: AttendanceOverviewToday
  weekTrend: AttendanceWeekTrendPoint[]
  monthly: AttendanceMonthlyPoint[]
  byClass: AttendanceClassRate[]
  daily: AttendanceDayRecord[]
}

/** Module-level session cache — one fetch per session, shared by all consumers. */
let cachedOverview: AttendanceOverviewData | null = null
let inflight: Promise<AttendanceOverviewData | null> | null = null

function fetchOverview(): Promise<AttendanceOverviewData | null> {
  if (cachedOverview) return Promise.resolve(cachedOverview)
  if (!inflight) {
    inflight = fetch('/api/attendance/overview', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (res) => {
        let json: unknown = null
        try {
          json = await res.json()
        } catch {
          /* non-JSON error body — handled by the ok check below */
        }
        const envelope = json as { ok?: unknown; data?: AttendanceOverviewData } | null
        if (!res.ok || !envelope || envelope.ok !== true || !envelope.data) {
          throw new Error(`HTTP ${res.status}`)
        }
        return envelope.data
      })
      .then((data) => {
        if (data) cachedOverview = data
        return data
      })
      .catch((e: unknown) => {
        // Silent failure — data stays undefined; consumers keep their
        // loading pattern. The failure is not cached (next mount retries).
        console.warn('[attendance-overview] unavailable, staying on loading state:', e)
        return null
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function useAttendanceOverview(): {
  data: AttendanceOverviewData | undefined
  loading: boolean
} {
  const [data, setData] = useState<AttendanceOverviewData | undefined>(cachedOverview ?? undefined)

  useEffect(() => {
    if (cachedOverview) {
      setData(cachedOverview)
      return
    }
    let cancelled = false
    fetchOverview().then((d) => {
      if (!cancelled && d) setData(d)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading: data === undefined }
}
