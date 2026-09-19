import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'
import { classLabelOf } from '@/lib/teacher-hub'

export const runtime = 'nodejs'

/**
 * GET /api/timetable — the school's master Timetable rows (flat shape).
 *
 * School-scoped via the session (any authenticated role of the school);
 * optional ?classId= narrows to one class. Returns the flat ServerSlot
 * shape shared with /api/student/timetable (id, day, period, times,
 * subject, teacherName, room, className) so every client maps rows with
 * the ONE shared ladder-aware mapping (@/lib/timetable/server-mapping).
 */
export async function GET(req: NextRequest) {
  return withUser(async (user) => {
    const schoolId = schoolScoped(user)
    const { searchParams } = new URL(req.url)
    const classId = searchParams.get('classId')
    const rows = await db.timetable.findMany({
      where: { schoolId, ...(classId ? { classId } : {}) },
      include: {
        class: { select: { name: true, section: true } },
        subject: { select: { name: true } },
      },
      orderBy: [{ day: 'asc' }, { period: 'asc' }],
    })
    return rows.map((r) => ({
      id: r.id,
      day: r.day,
      period: r.period,
      startTime: r.startTime,
      endTime: r.endTime,
      subject: r.subject?.name ?? 'Period',
      teacherName: r.teacherName ?? '',
      room: r.room,
      className: classLabelOf(r.class),
    }))
  })
}
