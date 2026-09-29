'use client'

/**
 * use-upcoming-exams — REAL upcoming-exam KPI (was the mock
 * "Pre-Board in 12 days" constant). Derives from /api/exams
 * (canonical DB rows): count = status 'SCHEDULED', sub = the nearest
 * upcoming exam's name + day delta.
 */

import { useEffect, useState } from 'react'

export interface UpcomingExamsKpi {
  count: number
  sub: string
}

interface ExamRow {
  id: string
  name: string
  status: string
  startDate: string | null
}

let cached: UpcomingExamsKpi | null = null
let inflight: Promise<UpcomingExamsKpi | null> | null = null

async function fetchUpcoming(): Promise<UpcomingExamsKpi | null> {
  try {
    const res = await fetch('/api/exams', { cache: 'no-store' })
    if (!res.ok) return null
    const envelope = (await res.json()) as { ok?: boolean; data?: unknown }
    const raw = envelope.data
    const rows: ExamRow[] = Array.isArray(raw)
      ? (raw as ExamRow[])
      : Array.isArray((raw as { exams?: ExamRow[] })?.exams)
        ? (raw as { exams: ExamRow[] }).exams
        : []
    const scheduled = rows
      .filter((e) => e.status === 'SCHEDULED')
      .filter((e) => !e.startDate || new Date(e.startDate).getTime() >= Date.now() - 86400000)
    let sub = 'No scheduled exams'
    if (scheduled.length > 0) {
      const next = [...scheduled].sort((a, b) =>
        (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'),
      )[0]
      if (next.startDate) {
        const days = Math.max(
          0,
          Math.round((new Date(next.startDate).getTime() - Date.now()) / 86400000),
        )
        sub = `${next.name} in ${days} day${days === 1 ? '' : 's'}`
      } else {
        sub = `${next.name} · date to be announced`
      }
    }
    const kpi: UpcomingExamsKpi = { count: scheduled.length, sub }
    cached = kpi
    return kpi
  } catch {
    return null
  }
}

export function useUpcomingExams(): UpcomingExamsKpi | null {
  const [kpi, setKpi] = useState<UpcomingExamsKpi | null>(cached)
  useEffect(() => {
    if (cached) return
    if (!inflight) inflight = fetchUpcoming()
    void inflight.then((k) => {
      if (k) setKpi(k)
    })
  }, [])
  return kpi
}
