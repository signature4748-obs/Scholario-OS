'use client'

/**
 * rooms/client — the Principal-side bridge to the canonical Room registry
 * (GET/POST /api/rooms · PATCH /api/rooms/[id] — IQ3000 Phase 1/2).
 *
 * The server DB (Room + Class.roomId) is the ONLY authoritative source of
 * the school's rooms; this client exposes it to the UI (the Classes
 * module's Rooms manager, the School Settings → Facilities tab and the
 * Add Class room picker). Nothing is persisted client-side: every surface
 * mounts with fresh server truth and refreshes after each mutation, and
 * the server's own verdicts (name clashes, the archive guard's "Assigned
 * to … — reassign or clear it first") surface verbatim.
 *
 * Envelope note: every API response is wrapped { ok, data } by the
 * server's withUser middleware — unwrapped here before it reaches the UI.
 */

import { useCallback, useEffect, useState } from 'react'

// ── payload types (mirror GET /api/rooms) ──────────────────────────────

export interface RoomDto {
  id: string
  name: string
  code: string | null
  building: string | null
  floor: string | null
  capacity: number | null
  type: string
  /** true → available for assignment · false → archived. */
  active: boolean
  assignedClassCount: number
  createdAt: string
}

/** The canonical room-type vocabulary (mirrors the server registry). */
export const ROOM_TYPE_OPTIONS = [
  'Classroom',
  'Science Lab',
  'Computer Lab',
  'Library',
  'Auditorium',
  'Music Room',
  'Art Room',
  'Sports Facility',
  'Staff Room',
  'Other',
] as const

/** Body accepted by POST /api/rooms (name unique within the school). */
export interface RoomCreateInput {
  name: string
  code?: string
  building?: string
  floor?: string
  capacity?: number
  type?: string
}

/** Partial body accepted by PATCH /api/rooms/[id]. */
export interface RoomUpdatePatch extends Partial<RoomCreateInput> {
  /** false → archive (blocked server-side while a class holds the room) · true → reactivate. */
  active?: boolean
}

// ── fetch hook ─────────────────────────────────────────────────────────

interface Envelope<T> {
  ok?: boolean
  data?: T
  error?: string
}

/** Normalise a room type coming off the wire to the canonical vocabulary. */
export function normalizeRoomType(type: string | null | undefined): string {
  return (ROOM_TYPE_OPTIONS as readonly string[]).includes(type ?? '') ? (type as string) : 'Other'
}

async function fetchRooms(activeOnly: boolean): Promise<RoomDto[]> {
  const res = await fetch(`/api/rooms${activeOnly ? '?active=1' : ''}`, { cache: 'no-store' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Envelope<unknown>
    throw new Error(typeof body.error === 'string' ? body.error : `Request failed (${res.status})`)
  }
  const payload = (await res.json()) as Envelope<RoomDto[]> | RoomDto[]
  const rooms = Array.isArray(payload) ? payload : payload.data
  if (!Array.isArray(rooms)) throw new Error('Unexpected rooms payload')
  // The registry's display order — numeric collation keeps "Room 2A"
  // before "Room 10A" (plain string sort would interleave them).
  return [...rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

/**
 * useSchoolRooms — the live Room registry. `activeOnly` asks the server
 * for assignment-eligible rooms only (pickers); management surfaces want
 * the full registry (incl. archived). The first load surfaces a loading
 * state; later refreshes keep the current list while revalidating.
 */
export function useSchoolRooms(activeOnly = false): {
  rooms: RoomDto[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
} {
  const [rooms, setRooms] = useState<RoomDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await fetchRooms(activeOnly)
      setRooms(next)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }, [activeOnly])

  useEffect(() => {
    // Mount / activeOnly change → show the honest first-load state.
    setLoading(true)
    void refresh()
  }, [refresh])

  return { rooms, loading, error, refresh }
}

// ── mutations ──────────────────────────────────────────────────────────

export type RoomMutationResult = { ok: true } | { ok: false; error: string }

async function mutateRoom(
  url: string,
  method: 'POST' | 'PATCH',
  body: unknown,
): Promise<RoomMutationResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as Envelope<unknown>
      return {
        ok: false,
        error: typeof payload.error === 'string' ? payload.error : `Request failed (${res.status})`,
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Network error — could not reach the server.' }
  }
}

/** POST /api/rooms — create a room (PRINCIPAL/MANAGEMENT). */
export function createRoom(input: RoomCreateInput): Promise<RoomMutationResult> {
  return mutateRoom('/api/rooms', 'POST', input)
}

/**
 * PATCH /api/rooms/[id] — edit / archive / reactivate. The SERVER owns the
 * side effects: renames propagate to every assigned class (Class.room
 * display value), and archiving a room a class still holds is rejected
 * with a clear error the UI surfaces verbatim.
 */
export function updateRoom(id: string, patch: RoomUpdatePatch): Promise<RoomMutationResult> {
  return mutateRoom(`/api/rooms/${encodeURIComponent(id)}`, 'PATCH', patch)
}
