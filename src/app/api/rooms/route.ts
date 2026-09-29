import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'

export const runtime = 'nodejs'

/**
 * /api/rooms — the school's canonical Room registry (IQ3000 Phase 1).
 *
 *   GET  — any staff member of the school (the Classes module, timetable
 *          pickers and Facilities settings all read this one registry).
 *          ?active=1 filters to assignment-eligible rooms only.
 *   POST — PRINCIPAL/MANAGEMENT only. Creates a room (name unique within
 *          the school — enforced at the DB level).
 *
 * Rooms are school master data: School A's rooms never appear for School B
 * (every query is school-scoped via the session).
 */

const ROOM_TYPES = [
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

export async function GET(req: NextRequest) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const activeOnly = new URL(req.url).searchParams.get('active') === '1'
      const rooms = await db.room.findMany({
        where: { schoolId, ...(activeOnly ? { active: true } : {}) },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        include: {
          _count: { select: { classes: true } },
        },
      })
      return rooms.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        building: r.building,
        floor: r.floor,
        capacity: r.capacity,
        type: r.type,
        active: r.active,
        assignedClassCount: r._count.classes,
        createdAt: r.createdAt.toISOString(),
      }))
    },
    { roles: ['PRINCIPAL', 'MANAGEMENT', 'TEACHER'] },
  )
}

export async function POST(req: NextRequest) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const body = await req.json().catch(() => ({}))
      const name = String(body.name || '').trim()
      if (!name) throw new Error('Room name is required')

      const type = ROOM_TYPES.includes(body.type) ? body.type : 'Classroom'
      const capacity = Number.isFinite(Number(body.capacity)) && Number(body.capacity) > 0
        ? Math.round(Number(body.capacity))
        : null

      const clash = await db.room.findFirst({
        where: { schoolId, name: { equals: name } },
        select: { id: true },
      })
      if (clash) throw new Error(`Room "${name}" already exists in this school`)

      const room = await db.room.create({
        data: {
          schoolId,
          name,
          code: String(body.code || '').trim() || null,
          building: String(body.building || '').trim() || null,
          floor: String(body.floor || '').trim() || null,
          capacity,
          type,
          active: true,
        },
      })
      await db.activityLog.create({
        data: {
          schoolId,
          userId: user.id,
          action: 'ROOM_CREATED',
          detail: `Room "${room.name}" (${room.type}) added to the school registry`,
        },
      })
      return { id: room.id, name: room.name }
    },
    { roles: ['PRINCIPAL', 'MANAGEMENT'] },
  )
}
