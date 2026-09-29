'use client'

/**
 * Student Growth — data hooks + API mutations.
 *
 * Same transport discipline as every Teacher Hub module:
 *   · { cache: 'no-store', credentials: 'same-origin' } — the httpOnly
 *     erp_session cookie is the ONLY auth source; ids are never read on
 *     the client, the server resolves teacher / school / scope;
 *   · { ok, data } / { ok: false, error } envelope handling;
 *   · 401 → signOut() exactly once;
 *   · honest error strings + working retry on every surface.
 *
 * Reloads are QUIET: the first load drives the module skeleton; later
 * reloads keep the current data on screen while refreshing in the
 * background.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { signOut } from '@/lib/signout'
import type {
  GrowthEventItem,
  GrowthWorkspacePayload,
} from '@/lib/teacher-hub-types'

// ---------- transport ----------

let reAuthInFlight = false

function handleExpiredSession(): void {
  if (reAuthInFlight) return
  reAuthInFlight = true
  void signOut()
    .catch(() => {
      try {
        window.localStorage.removeItem('scholario-auth')
        window.location.reload()
      } catch {
        /* nothing more we can honestly do here */
      }
    })
    .finally(() => {
      window.setTimeout(() => {
        reAuthInFlight = false
      }, 2000)
    })
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
  })
  if (!r.ok) {
    if (r.status === 401) {
      handleExpiredSession()
      throw new Error('Your session has expired. Please sign in again.')
    }
    let message = `Request failed (${r.status})`
    try {
      const j: unknown = await r.json()
      if (j && typeof j === 'object' && typeof (j as { error?: unknown }).error === 'string') {
        message = (j as { error: string }).error
      }
    } catch {
      /* non-JSON error body — keep the concise fallback */
    }
    throw new Error(message)
  }
  const j: unknown = await r.json()
  if (!j || typeof j !== 'object' || (j as { ok?: unknown }).ok !== true || !('data' in j)) {
    throw new Error('Unexpected response from the server.')
  }
  return (j as { data: T }).data
}

// ---------- aggregate: the whole Growth workspace ----------

export interface GrowthState {
  data: GrowthWorkspacePayload | null
  loading: boolean
  refreshing: boolean
  error: string | null
  reload: () => void
}

export function useGrowth(): GrowthState {
  const [data, setData] = useState<GrowthWorkspacePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const hasData = useRef(false)

  useEffect(() => {
    let cancelled = false
    setError(null)
    if (hasData.current) setRefreshing(true)
    else setLoading(true)
    request<GrowthWorkspacePayload>('/api/teacher/growth')
      .then((d) => {
        hasData.current = true
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Growth records could not load.')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, refreshing, error, reload }
}

// ---------- mutations ----------

export interface AddManualPointBody {
  studentId: string
  /** quick-pick: the preset key — points/reason/category resolve server-side */
  presetKey?: string
  /** custom: explicit points + short reason */
  points?: number
  reason?: string
  note?: string
}

export async function addManualPoint(body: AddManualPointBody): Promise<GrowthEventItem> {
  const { event } = await request<{ event: GrowthEventItem }>('/api/teacher/growth', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return event
}

export interface CorrectPointBody {
  points?: number
  note?: string | null
  correctionNote: string
}

export async function correctGrowthPoint(
  eventId: string,
  body: CorrectPointBody,
): Promise<{ original: GrowthEventItem; correction: GrowthEventItem }> {
  const { original, correction } = await request<{
    original: GrowthEventItem
    correction: GrowthEventItem
  }>(`/api/teacher/growth/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return { original, correction }
}
