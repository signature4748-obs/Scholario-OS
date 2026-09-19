'use client'

import { create } from 'zustand'

/**
 * dues-summary-store — the school's REAL fee-dues position (server truth),
 * powering every surface that deep-links into the Outreach workflow.
 *
 * Round-7 consistency fix: before this store, three surfaces told three
 * different dues stories (dashboard KPI mock ₹1.84 Cr / fees overview
 * ledger ₹2.05 L / Outreach server truth ₹1.05 L). Every card whose
 * numbers are quoted next to an "open Outreach" affordance now reads
 * from THIS store — the same aggregation GET /api/fees/defaulters?summary=1
 * computes — so the number on the button is the number the tab shows.
 *
 * Lineage is honest: `status === 'server'` only after a successful sync —
 * consumers show their legacy values until then and a "live" chip only
 * when the server number is actually on screen. A 60s freshness window
 * keeps numbers from going stale after reminder sends / payments without
 * a refetch storm.
 */

export interface DuesSummaryData {
  totalOutstanding: number
  defaulterCount: number
  overdueCount: number
  remindedThisWeek: number
  classesWithDues: number
  top: { name: string; outstanding: number; className: string | null } | null
  asOf: string
}

export type DuesSummaryStatus = 'idle' | 'loading' | 'server' | 'error'

interface DuesSummaryState {
  /** null until the first successful server sync. */
  summary: DuesSummaryData | null
  status: DuesSummaryStatus
  /** Idempotent fetch — coalesces concurrent consumers, honours the 60s window. */
  ensure: () => Promise<void>
  /** Force a re-sync (after a reminder send, a payment, a manual refresh). */
  refresh: () => Promise<void>
}

let inflight: Promise<void> | null = null
const FRESH_FOR_MS = 60_000

async function fetchSummary(): Promise<DuesSummaryData> {
  const res = await fetch('/api/fees/defaulters?summary=1', {
    cache: 'no-store',
    credentials: 'same-origin',
  })
  const json = (await res.json().catch(() => null)) as
    | { ok?: unknown; data?: { summary?: DuesSummaryData } }
    | null
  if (!res.ok || !json || json.ok !== true) throw new Error('dues summary sync failed')
  const s = json.data?.summary
  if (!s || typeof s.defaulterCount !== 'number') throw new Error('dues summary malformed')
  return s
}

function runFetch(set: (partial: Partial<DuesSummaryState>) => void): Promise<void> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const summary = await fetchSummary()
      set({ summary, status: 'server' })
    } catch {
      set({ status: 'error' })
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export const useDuesSummaryStore = create<DuesSummaryState>((set, get) => ({
  summary: null,
  status: 'idle',
  ensure: () => {
    const { status, summary } = get()
    if (status === 'server' && Date.now() - new Date(summary?.asOf ?? 0).getTime() < FRESH_FOR_MS) {
      return Promise.resolve()
    }
    if (!summary) set({ status: 'loading' })
    return runFetch((p) => set(p))
  },
  refresh: () => {
    set({ status: get().summary ? 'server' : 'loading' })
    return runFetch((p) => set(p))
  },
}))

/** Convenience selector — the live summary, or null while unsynced/failed. */
export const selectLiveDues = (s: DuesSummaryState): DuesSummaryData | null =>
  s.status === 'server' ? s.summary : null
