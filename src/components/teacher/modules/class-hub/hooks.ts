'use client'

/**
 * Class Hub — the module's data hook. ONE fetch to
 * GET /api/teacher/class-hub returns the full control-room payload for
 * every class the signed-in teacher is class teacher of (the server
 * returns classes: [] for anyone else — the module is not reachable for
 * them through the sidebar anyway).
 *
 * Fetch discipline mirrors the house pattern (students/marks): no-store,
 * same-origin, { ok, data } envelope, single signOut on a dead session.
 */

import { useEffect, useState } from 'react'
import { signOut } from '@/lib/signout'
import type { ClassHubPayload, HubDetailPayload, MarksheetPayload } from './types'

let sessionExpiredInFlight = false

async function classHubFetch(): Promise<ClassHubPayload> {
  const res = await fetch('/api/teacher/class-hub', {
    cache: 'no-store',
    credentials: 'same-origin',
  })
  if (res.status === 401) {
    if (!sessionExpiredInFlight) {
      sessionExpiredInFlight = true
      void signOut().finally(() => {
        window.setTimeout(() => {
          sessionExpiredInFlight = false
        }, 2000)
      })
    }
    throw new Error('Your session has expired. Please sign in again.')
  }
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON error body */
  }
  const envelope = json as { ok?: unknown; error?: unknown; data?: ClassHubPayload } | null
  if (!res.ok || !envelope || envelope.ok !== true) {
    const message =
      envelope && typeof envelope.error === 'string' && envelope.error
        ? envelope.error
        : `Request failed (${res.status})`
    throw new Error(message)
  }
  return envelope.data as ClassHubPayload
}

/** Shared envelope fetch for the detail/marksheet endpoints. */
async function hubDetailFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' })
  if (res.status === 401) {
    if (!sessionExpiredInFlight) {
      sessionExpiredInFlight = true
      void signOut().finally(() => {
        window.setTimeout(() => {
          sessionExpiredInFlight = false
        }, 2000)
      })
    }
    throw new Error('Your session has expired. Please sign in again.')
  }
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON error body */
  }
  const envelope = json as { ok?: unknown; error?: unknown; data?: T } | null
  if (!res.ok || !envelope || envelope.ok !== true) {
    const message =
      envelope && typeof envelope.error === 'string' && envelope.error
        ? envelope.error
        : `Request failed (${res.status})`
    throw new Error(message)
  }
  return envelope.data as T
}

export function useClassHub() {
  const [data, setData] = useState<ClassHubPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    classHubFetch()
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  // Automatic role synchronization (spec §31): a Principal appointment
  // change must update My Class automatically. A quiet refetch on window
  // focus keeps the class list in sync with the server truth (the same
  // natural-refresh contract as the sidebar's role hook). Existing data
  // stays on screen while the refresh resolves — no flicker.
  useEffect(() => {
    const onFocus = () => {
      classHubFetch()
        .then((payload) => {
          setData(payload)
          setError(null)
        })
        .catch(() => {
          /* keep the current data — the explicit reload surfaces errors */
        })
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return { data, error, reload: () => setReload((r) => r + 1) }
}

/**
 * The FULL management payload for ONE class-teacher class — directory,
 * performance, ranking, attendance report, marksheets, taught subjects.
 * Refetches when the hub switches class or reloads.
 */
export function useClassHubDetail(classId: string | null, reloadTick: number) {
  const [data, setData] = useState<HubDetailPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!classId) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setData(null)
    setError(null)
    hubDetailFetch<HubDetailPayload>(
      `/api/teacher/class-hub/detail?classId=${encodeURIComponent(classId)}`,
    )
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [classId, reloadTick, tick])

  return {
    data,
    error,
    reload: () => setTick((t) => t + 1),
  }
}

/** The marksheet matrix for one exam (fetched when the viewer opens). */
export function useClassMarksheet(classId: string | null, examId: string | null) {
  const [data, setData] = useState<MarksheetPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!classId || !examId) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    hubDetailFetch<MarksheetPayload>(
      `/api/teacher/class-hub/marksheet?classId=${encodeURIComponent(classId)}&examId=${encodeURIComponent(examId)}`,
    )
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [classId, examId])

  return { data, error, loading }
}
