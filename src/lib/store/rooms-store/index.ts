/**
 * Rooms store — the centralized school room registry (Students & Classes
 * production pass §5).
 *
 * DEPRECATED (IQ3000 Phase 2): the room registry now lives on the SERVER
 * (Prisma Room model + GET/POST /api/rooms · PATCH /api/rooms/[id], with
 * Class.roomId as the canonical link). Every UI consumer (RoomsDialog via
 * the shared RoomsManager, the Facilities settings tab, the RoomSelect
 * picker) reads/writes the server through @/lib/rooms/client — this
 * persisted store is no longer read or written by anything and is kept
 * only for reference. Do NOT add new consumers.
 *
 * ONE source of truth for the school's physical rooms. Rooms are referenced
 * BY NAME from the canonical class/section records (SectionRecord.room /
 * ClassRecord.room) — the registry adds the managed vocabulary: building,
 * floor, capacity, type and lifecycle status. The UI surfaces that let a
 * Principal assign rooms (Manage Rooms dialog, Add Class page) always pick
 * from this registry, so free-text room strings stop appearing from random
 * components.
 *
 * Seeding: rather than inventing rooms, the registry is DERIVED on first
 * use (`ensureSeeded`) from the rooms already assigned to the canonical
 * classes/sections — every existing room becomes a managed record. New
 * rooms are created explicitly through the UI.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useStudentsStore } from '@/lib/store/students-store'
import { migrateLegacyScopedStore, createTenantScopedStorage } from '@/lib/tenant/tenant-storage'
import { DEFAULT_TENANT_ID } from '@/lib/tenant/schools'

migrateLegacyScopedStore('scholario-rooms-v1', DEFAULT_TENANT_ID)

export type RoomStatus = 'Available' | 'Unavailable' | 'Archived'

export type RoomType =
  | 'Classroom'
  | 'Science Lab'
  | 'Computer Lab'
  | 'Library'
  | 'Music Room'
  | 'Art Room'
  | 'Sports Facility'
  | 'Staff Room'
  | 'Other'

export const ROOM_TYPES: RoomType[] = [
  'Classroom',
  'Science Lab',
  'Computer Lab',
  'Library',
  'Music Room',
  'Art Room',
  'Sports Facility',
  'Staff Room',
  'Other',
]

export interface RoomRecord {
  /** Stable id (RM-001 …). */
  id: string
  /** Unique room name/number — the join key used by classes & sections. */
  name: string
  building?: string
  floor?: string
  capacity?: number
  type: RoomType
  status: RoomStatus
}

export interface RoomInput {
  name: string
  building?: string
  floor?: string
  capacity?: number
  type: RoomType
  status?: RoomStatus
}

interface RoomsState {
  rooms: RoomRecord[]
  /** Whether the initial derivation from the canonical classes ran. */
  seeded: boolean
  /** Derive registry rows for every room already used by a class/section.
   *  Idempotent; runs once per tenant (persisted). */
  ensureSeeded: () => void
  addRoom: (input: RoomInput) => { ok: true; room: RoomRecord } | { ok: false; error: string }
  updateRoom: (id: string, patch: Partial<RoomInput>) => { ok: true } | { ok: false; error: string }
  setRoomStatus: (id: string, status: RoomStatus) => { ok: true } | { ok: false; error: string }
}

/** Case-insensitive name collision check (whitespace-trimmed). */
function nameTaken(rooms: RoomRecord[], name: string, exceptId?: string): boolean {
  const n = name.trim().toLowerCase()
  return rooms.some((r) => r.id !== exceptId && r.name.trim().toLowerCase() === n)
}

function nextRoomId(rooms: RoomRecord[]): string {
  let max = 0
  for (const r of rooms) {
    const m = /^RM-(\d+)$/.exec(r.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `RM-${String(max + 1).padStart(3, '0')}`
}

/** Guess a floor label from a room name like "F2-09" → "2", "G-01" → "G". */
function floorFromName(name: string): string | undefined {
  const m = /^([A-Z])(\d)-/.exec(name.trim())
  if (!m) return undefined
  return m[1] === 'F' ? m[2] : m[1]
}

export const useRoomsStore = create<RoomsState>()(
  persist(
    (set, get) => ({
      rooms: [],
      seeded: false,

      ensureSeeded: () => {
        if (get().seeded) return
        const classes = useStudentsStore.getState().classes
        const derived = new Map<string, RoomRecord>()
        for (const c of classes) {
          if (c.status !== 'Active') continue
          for (const name of [c.room, ...c.sections.map((s) => s.room)]) {
            const key = name.trim()
            if (!key || derived.has(key.toLowerCase())) continue
            derived.set(key.toLowerCase(), {
              id: nextRoomId([...derived.values()]),
              name: key,
              floor: floorFromName(key),
              capacity: c.capacity,
              type: 'Classroom',
              status: 'Available',
            })
          }
        }
        set({ rooms: [...derived.values()], seeded: true })
      },

      addRoom: (input) => {
        const name = input.name.trim()
        if (!name) return { ok: false, error: 'Room name is required.' }
        if (nameTaken(get().rooms, name)) return { ok: false, error: `Room "${name}" already exists.` }
        const room: RoomRecord = {
          id: nextRoomId(get().rooms),
          name,
          building: input.building?.trim() || undefined,
          floor: input.floor?.trim() || undefined,
          capacity: input.capacity && input.capacity > 0 ? input.capacity : undefined,
          type: input.type,
          status: input.status ?? 'Available',
        }
        set((s) => ({ rooms: [...s.rooms, room] }))
        return { ok: true, room }
      },

      updateRoom: (id, patch) => {
        const room = get().rooms.find((r) => r.id === id)
        if (!room) return { ok: false, error: 'Room not found.' }
        if (patch.status === 'Archived' && room.status !== 'Archived') {
          // Same guard as setRoomStatus — a room in active use can not be
          // archived through the edit form either.
          const inUse = roomInUseBy(room.name, useStudentsStore.getState().classes)
          if (inUse) return { ok: false, error: `Assigned to ${inUse} — reassign or clear it before archiving.` }
        }
        if (patch.name !== undefined) {
          const name = patch.name.trim()
          if (!name) return { ok: false, error: 'Room name is required.' }
          if (nameTaken(get().rooms, name, id)) return { ok: false, error: `Room "${name}" already exists.` }
          // The room NAME is the join key used by class/section records —
          // keep every consumer in sync when it changes (§5/§6).
          if (name !== room.name) useStudentsStore.getState().renameRoomEverywhere(room.name, name)
        }
        set((s) => ({
          rooms: s.rooms.map((r) =>
            r.id === id
              ? {
                  ...r,
                  name: patch.name !== undefined ? patch.name.trim() : r.name,
                  building: patch.building !== undefined ? (patch.building.trim() || undefined) : r.building,
                  floor: patch.floor !== undefined ? (patch.floor.trim() || undefined) : r.floor,
                  capacity: patch.capacity !== undefined ? (patch.capacity > 0 ? patch.capacity : undefined) : r.capacity,
                  type: patch.type ?? r.type,
                  status: patch.status ?? r.status,
                }
              : r,
          ),
        }))
        return { ok: true }
      },

      setRoomStatus: (id, status) => {
        const room = get().rooms.find((r) => r.id === id)
        if (!room) return { ok: false, error: 'Room not found.' }
        if (status === 'Archived') {
          // §5 — a room still assigned to a live section can not be
          // archived; the assignment must move first.
          const inUse = roomInUseBy(room.name, useStudentsStore.getState().classes)
          if (inUse) {
            return { ok: false, error: `Assigned to ${inUse} — reassign or clear it before archiving.` }
          }
        }
        set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, status } : r)) }))
        return { ok: true }
      },
    }),
    {
      name: 'scholario-rooms-v1',
      storage: createTenantScopedStorage('scholario-rooms-v1'),
      partialize: (s) => ({ rooms: s.rooms, seeded: s.seeded }) as unknown as RoomsState,
    },
  ),
)

// ─── derived helpers (pure — usable anywhere) ─────────────────────────────

export interface RoomOccupancy {
  classId: string
  className: string
  sectionId: string
  sectionName: string
  label: string
}

/** Minimal shape consumed by the helpers (satisfied by ClassRecord). */
export interface OccupancyClass {
  id: string
  name: string
  status: string
  sections: { id: string; name: string; room: string }[]
}

/** Which live class·section is currently assigned to `roomName`? */
export function roomInUseBy(roomName: string, classes: OccupancyClass[]): string | null {
  const key = roomName.trim().toLowerCase()
  for (const c of classes) {
    if (c.status !== 'Active') continue
    for (const s of c.sections) {
      if (s.room.trim().toLowerCase() === key) return `${c.name} · ${s.name}`
    }
  }
  return null
}

/** Full occupancy index: room name (lowercased) → occupant list. */
export function buildOccupancyIndex(classes: OccupancyClass[]): Map<string, RoomOccupancy[]> {
  const map = new Map<string, RoomOccupancy[]>()
  for (const c of classes) {
    if (c.status !== 'Active') continue
    for (const s of c.sections) {
      const key = s.room.trim().toLowerCase()
      if (!key) continue
      const list = map.get(key) ?? []
      list.push({ classId: c.id, className: c.name, sectionId: s.id, sectionName: s.name, label: `${c.name} · ${s.name}` })
      map.set(key, list)
    }
  }
  return map
}
