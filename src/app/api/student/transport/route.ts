import { db } from '@/lib/db'
import { withUser } from '@/lib/api'
import { requireStudent } from '@/lib/learning'

export const runtime = 'nodejs'

/**
 * GET /api/student/transport — the authenticated student's OWN transport
 * assignment, read from the SAME Route + Vehicle rows the Principal's
 * Transport module configures. No client-side mock routes.
 *
 * PERMISSION MODEL (mirrors /api/student/attendance):
 *   · identity resolved server-side (erp_session → user → student);
 *   · a student without a route assignment gets { assigned: false } —
 *     the client renders its honest empty state;
 *   · stops derive from the canonical Route.stops pipe-separated column.
 *
 * Shape:
 * {
 *   assigned: boolean,
 *   route: { id, name, stops: string[], fare, startTime, endTime,
 *            vehicleNo, driverName, driverPhone } | null
 * }
 */
export async function GET() {
  return withUser(async (user) => {
    const ctx = await requireStudent(user)

    const student = await db.student.findUnique({
      where: { id: ctx.studentId },
      include: {
        route: { include: { vehicles: { include: { driver: { include: { user: { select: { name: true } } } } } } } },
      },
    })
    const route = student?.route
    if (!route) return { assigned: false, route: null }

    const vehicle = route.vehicles[0]
    return {
      assigned: true,
      route: {
        id: route.id,
        name: route.name,
        stops: route.stops ? route.stops.split('|').map((s) => s.trim()).filter(Boolean) : [],
        fare: route.fare,
        startTime: route.startTime,
        endTime: route.endTime,
        vehicleNo: vehicle?.number ?? null,
        driverName: vehicle?.driver?.user?.name ?? null,
        driverPhone: vehicle?.driver?.phone ?? null,
      },
    }
  })
}
