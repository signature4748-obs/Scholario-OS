'use client'

/**
 * use-school-stats — one fetch of /api/dashboard (principal/management
 * school overview) per session. Used by the dashboard surfaces that
 * need REAL school-wide figures (teacher count, …) instead of the
 * retired mock constants (production data reduction 2026-10).
 */

import { useEffect, useState } from 'react'

export interface SchoolStats {
  students: number
  teachers: number
  classes: number
}

let cached: SchoolStats | null = null
let inflight: Promise<SchoolStats | null> | null = null

async function fetchStats(): Promise<SchoolStats | null> {
  try {
    const res = await fetch('/api/dashboard', { cache: 'no-store' })
    if (!res.ok) return null
    const envelope = (await res.json()) as {
      ok?: boolean
      data?: { stats?: Partial<SchoolStats>; teachers?: number; students?: number; classes?: number }
    }
    const data = envelope.data
    const stats = data?.stats ?? data
    if (!stats || typeof stats.teachers !== 'number') return null
    const out: SchoolStats = {
      students: stats.students ?? 0,
      teachers: stats.teachers ?? 0,
      classes: stats.classes ?? 0,
    }
    cached = out
    return out
  } catch {
    return null
  }
}

export function useSchoolStats(): SchoolStats | null {
  const [stats, setStats] = useState<SchoolStats | null>(cached)
  useEffect(() => {
    if (cached) return
    if (!inflight) inflight = fetchStats()
    void inflight.then((s) => {
      if (s) setStats(s)
    })
  }, [])
  return stats
}
