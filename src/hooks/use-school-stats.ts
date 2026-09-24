'use client'

/**
 * useSchoolStats — the principal's SCHOOL-WIDE dashboard stats, fetched
 * from GET /api/dashboard (server truth: real counts, real attendance
 * rate, real fee totals/trend, real upcoming exams).
 *
 * This is what kills the mock dashboard universe: the KPI cards, welcome
 * banner meta strip, charts and exam/event cards all read THESE numbers —
 * the same canonical rows every other module uses (spec §8: one school,
 * one reality; §18: no fake dashboard numbers).
 *
 * States: loading → (stats | error). While loading, consumers render
 * their honest placeholders (skeleton/—), never stale mock values.
 */
import { useCallback, useEffect, useState } from 'react'

export interface SchoolStats {
  students: number
  teachers: number
  classes: number
  subjects: number
  exams: number
  notifications: number
  feesTotal: number
  feesPaid: number
  overdue: number
  attendanceRate: number
}

export interface UpcomingExam {
  id: string
  name: string
  type: string
  status: string
  startDate: string | null
  class: { name: string } | null
}

export interface SchoolDashboardPayload {
  stats: SchoolStats
  attendance: { present: number; absent: number; late: number }
  trend: { month: string; amount: number }[]
  upcomingExams: UpcomingExam[]
}

export interface SchoolStatsState {
  data: SchoolDashboardPayload | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useSchoolStats(): SchoolStatsState {
  const [data, setData] = useState<SchoolDashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/dashboard', { credentials: 'same-origin' })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: SchoolDashboardPayload; error?: string }
          | null
        if (cancelled) return
        if (!res.ok || !json?.ok || !json.data?.stats) {
          throw new Error(json?.error || `Request failed (${res.status})`)
        }
        setData(json.data)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Unable to load school stats')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return { data, loading, error, reload }
}
