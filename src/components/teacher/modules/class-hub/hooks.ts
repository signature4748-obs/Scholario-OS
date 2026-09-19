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
import type { ClassHubPayload } from './types'

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

  return { data, error, reload: () => setReload((r) => r + 1) }
}
