'use client'

/**
 * fee-collection/hooks — the module's data layer.
 *
 * ONE fetch to GET /api/teacher/fee-collection[?month=YYYY-MM] returns
 * every appointed class with its rosters, ledgers, month sheet and the
 * canonical transaction history. collect() posts STAGE 1 of the
 * two-stage workflow; the caller refetches on success so every figure
 * (tiles, table, ledger) re-derives from the server — the client never
 * fabricates money state.
 *
 * Fetch discipline: house pattern (no-store + same-origin, { ok, data }
 * envelope, single-trip 401 sign-out).
 */

import { useCallback, useEffect, useState } from 'react'
import { signOut } from '@/lib/signout'
import type { CollectResult, FeeCollectionPayload } from './types'

let sessionExpiredInFlight = false

function handleExpiredSession(): void {
  if (sessionExpiredInFlight) return
  sessionExpiredInFlight = true
  void signOut().finally(() => {
    window.setTimeout(() => { sessionExpiredInFlight = false }, 2000)
  })
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...init })
  if (res.status === 401) {
    handleExpiredSession()
    throw new Error('Your session has expired. Please sign in again.')
  }
  const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; data?: T } | null
  if (!res.ok || !json || json.ok !== true) {
    const message = json && typeof json.error === 'string' && json.error ? json.error : `Request failed (${res.status})`
    throw new Error(message)
  }
  return json.data as T
}

export function useFeeCollection() {
  const [month, setMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [data, setData] = useState<FeeCollectionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (m: string) => {
    try {
      setError(null)
      const payload = await call<FeeCollectionPayload>(`/api/teacher/fee-collection?month=${m}`)
      setData(payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the fee workspace.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(month) }, [load, month])

  const changeMonth = useCallback((delta: number) => {
    setMonth((prev) => {
      const [y, m] = prev.split('-').map(Number)
      const d = new Date(y, m - 1 + delta, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }, [])

  const collect = useCallback(
    async (body: {
      studentId: string
      feeId: string
      amount: number
      method: string
      referenceNumber?: string
      notes?: string
    }): Promise<CollectResult> => {
      const result = await call<CollectResult>('/api/teacher/fee-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await load(month)
      return result
    },
    [load, month],
  )

  return { data, loading, error, month, changeMonth, reload: () => load(month), collect }
}
