'use client'

/**
 * marks/scan/api — the fetch helper for the scan workflow. Same envelope
 * discipline as the parent module's hooks ({ ok, data } | error, 401 →
 * shared signOut).
 */

import { signOut } from '@/lib/signout'

let sessionExpiredInFlight = false

export async function marksScanRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: init?.body
      ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
      : init?.headers,
  })
  if (r.status === 401) {
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
    json = await r.json()
  } catch {
    /* non-JSON error body */
  }
  const envelope = json as { ok?: unknown; error?: unknown; data?: T } | null
  if (!r.ok || !envelope || envelope.ok !== true) {
    const message =
      envelope && typeof envelope.error === 'string' ? envelope.error : `Request failed (${r.status})`
    throw new Error(message)
  }
  return envelope.data as T
}
