import { db } from '@/lib/db'
import { withUser } from '@/lib/api'
import { requireStudent } from '@/lib/learning'
import { classLabelOf } from '@/lib/teacher-hub'

export const runtime = 'nodejs'

/**
 * GET /api/student/timetable — the student's OWN class schedule + the
 * school's master timetable, both from the server's Timetable rows.
 *
 * PERMISSION MODEL (server-decided, school-scoped — mirrors the teacher
 * route and the student dashboard):
 *   · the class is resolved from the signed-in student's enrollment
 *     (never from the request);
 *   · mySlots     — rows of THAT class only;
 *   · masterSlots — every row of the school (read-only master sheet for
 *     the SCHOOL view; carries no teacher identity beyond what the
 *     master sheet legitimately shows);
 *   · nothing is fabricated — no rows ⇒ empty arrays and the client
 *     renders its honest empty state.
 *
 * Shape (raw rows; the client maps them onto its period-ladder-aware
 * rendering model):
 *   {
 *     classLabel, section,
 *     mySlots:     ServerSlot[],
 *     masterSlots: ServerSlot[],
 *     schoolDays:  string[]   // canonical Monday..Saturday order
 *   }
 */

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

interface ServerSlot {
  id: string
  day: string
  /** Teaching-period number as stored (breaks are NOT rows). */
  period: number
  startTime: string | null
  endTime: string | null
  subject: string
  teacherName: string
  room: string | null
  className: string
}

export async function GET() {
  return withUser(async (user) => {
    const ctx = await requireStudent(user)

    const allRows = await db.timetable.findMany({
      where: { schoolId: ctx.schoolId },
      include: {
        class: { select: { name: true, section: true } },
        subject: { select: { name: true } },
      },
      orderBy: [{ day: 'asc' }, { period: 'asc' }],
    })

    const toSlot = (r: (typeof allRows)[number]): ServerSlot => ({
      id: r.id,
      day: r.day,
      period: r.period,
      startTime: r.startTime,
      endTime: r.endTime,
      subject: r.subject?.name ?? 'Period',
      teacherName: r.teacherName ?? '',
      room: r.room,
      className: classLabelOf(r.class),
    })

    const masterSlots = allRows.map(toSlot)
    const myRows = ctx.classId ? allRows.filter((r) => r.classId === ctx.classId) : []
    const mySlots = myRows.map(toSlot)

    const seenDays = new Set(allRows.map((r) => r.day))
    const schoolDays = DAY_ORDER.filter((d) => seenDays.has(d))

    const myClass = myRows[0]?.class ?? null

    return {
      classLabel: myClass ? classLabelOf(myClass) : ctx.classLabel,
      section: myClass?.section ?? null,
      mySlots,
      masterSlots,
      schoolDays,
    }
  })
}
