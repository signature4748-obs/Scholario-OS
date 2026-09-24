'use client'

/**
 * useMyServerAttendance — the authenticated student's OWN attendance
 * records, fetched from /api/student/attendance (server truth).
 *
 * Canonical source: the server's Attendance rows — the SAME records the
 * Teacher / Principal attendance UI writes. No client-side seed, no
 * hardcoded student id, no second attendance universe.
 *
 * States: loading → (records | error). The empty array is a legitimate
 * result (honest empty state downstream).
 */
import { useCallback, useEffect, useState } from 'react'
import type { StudentAttendanceRecord } from '@/lib/store/student-attendance-store'

export interface MyAttendanceState {
  records: StudentAttendanceRecord[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useMyServerAttendance(): MyAttendanceState {
  const [records, setRecords] = useState<StudentAttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/student/attendance', { credentials: 'same-origin' })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: { records?: unknown }; error?: string }
          | null
        if (cancelled) return
        if (!res.ok || !json?.ok || !Array.isArray(json.data?.records)) {
          throw new Error(json?.error || `Request failed (${res.status})`)
        }
        const rows = json.data.records as Array<{
          date: string
          status: string
          markedBy?: string
          markedAt: string
        }>
        setRecords(
          rows.map((r) => ({
            studentId: 'me',
            date: r.date,
            status: (r.status === 'leave' ? 'leave' : r.status === 'late' ? 'late' : r.status === 'absent' ? 'absent' : 'present') as StudentAttendanceRecord['status'],
            markedBy: r.markedBy,
            markedAt: r.markedAt,
          })),
        )
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Unable to load attendance')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return { records, loading, error, reload }
}
