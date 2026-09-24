import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'

export const runtime = 'nodejs'

/**
 * GET /api/principal/attendance — the Principal's canonical attendance
 * analytics surface, derived EXCLUSIVELY from the school's Attendance rows
 * (the same rows Teacher class-attendance and the student's My Attendance
 * read/write). The legacy 1,842-student mock universe is retired.
 *
 * PERMISSIONS: PRINCIPAL / MANAGEMENT only (staff analytics). A Teacher
 * or Student session gets 403 (they have their own scoped surfaces).
 *
 * Query params (all optional — defaults to today):
 *   date=YYYY-MM-DD   → the "today" snapshot day (default: server today)
 *   studentId=<id>    → per-student history (a student of THIS school)
 *
 * Response shape:
 * {
 *   date: 'YYYY-MM-DD',
 *   summary: { present, absent, late, leave, recorded, rate },  // school-wide for `date`
 *   byClass: [{ classId, classLabel, students, present, absent, late, leave, recorded, rate }],
 *   weekTrend: [{ date, rate, recorded }],        // last 7 days that have rows (oldest→newest)
 *   monthTrend: [{ month: 'YYYY-MM', rate, recorded }],
 *   sections: [{ classId, classLabel, roster: [{ studentId, rollNo, name, status }] }],  // for `date`
 *   student: { ... } | null                       // when studentId given
 * }
 *
 * SEMANTICS:
 *   · recorded counts only students WITH a row that day; classes without
 *     any row for the date contribute no denominators (never fabricated).
 *   · rate = present / recorded * 100 rounded to 1dp (PRESENT counts full,
 *     LATE counts as present-for-rate in line with the teacher module).
 *   · Nothing is fabricated: empty DB → zeros and empty arrays.
 */
export async function GET(req: Request) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const url = new URL(req.url)
      const dateParam = url.searchParams.get('date') ?? ''
      const studentParam = url.searchParams.get('studentId') ?? ''

      // Resolve the snapshot day (midnight UTC window).
      let day = new Date()
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        day = new Date(`${dateParam}T00:00:00.000Z`)
      }
      const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
      const dayKey = dayStart.toISOString().slice(0, 10)

      // Classes of the school (with student counts).
      const classes = await db.class.findMany({
        where: { schoolId },
        select: { id: true, name: true, section: true },
        orderBy: [{ name: 'asc' }, { section: 'asc' }],
      })
      const students = await db.student.findMany({
        where: { schoolId },
        select: { id: true, classId: true, rollNo: true, user: { select: { name: true } } },
      })
      const nameOf = new Map(students.map((s) => [s.id, s.user?.name ?? 'Student']))
      const classLabelOf = new Map(
        classes.map((c) => {
          const label = c.section && new RegExp(`[-–\\s]${c.section}\\s*$`, 'i').test(c.name)
            ? c.name
            : `${c.name}${c.section ? ` - ${c.section}` : ''}`
          return [c.id, label]
        }),
      )

      // All rows in the ACTIVE-ish window (whole academic session for trends).
      const rows = await db.attendance.findMany({
        where: { schoolId },
        select: { studentId: true, classId: true, date: true, status: true },
        orderBy: { date: 'asc' },
      })
      const dayKeyOf = (d: Date) => d.toISOString().slice(0, 10)

      // ── School-wide summary for the selected day ──────────────────────
      const dayRows = rows.filter((r) => dayKeyOf(r.date) === dayKey)
      const count = (s: string) => dayRows.filter((r) => r.status === s).length
      const present = count('PRESENT')
      const late = count('LATE')
      const absent = count('ABSENT')
      const leave = count('LEAVE')
      const recorded = dayRows.length
      const summary = {
        present, absent, late, leave, recorded,
        rate: recorded > 0 ? Math.round(((present + late) / recorded) * 1000) / 10 : 0,
      }

      // ── Per-class breakdown for the selected day ─────────────────────
      const byClass = classes.map((c) => {
        const cRows = dayRows.filter((r) => r.classId === c.id)
        const cp = cRows.filter((r) => r.status === 'PRESENT').length
        const cl = cRows.filter((r) => r.status === 'LATE').length
        const ca = cRows.filter((r) => r.status === 'ABSENT').length
        const clv = cRows.filter((r) => r.status === 'LEAVE').length
        return {
          classId: c.id,
          classLabel: classLabelOf.get(c.id) ?? c.name,
          students: students.filter((s) => s.classId === c.id).length,
          present: cp, absent: ca, late: cl, leave: clv,
          recorded: cRows.length,
          rate: cRows.length > 0 ? Math.round(((cp + cl) / cRows.length) * 1000) / 10 : null,
        }
      })

      // ── Trends (from real rows) ──────────────────────────────────────
      const byDay = new Map<string, { present: number; recorded: number }>()
      const byMonth = new Map<string, { present: number; recorded: number }>()
      for (const r of rows) {
        const k = dayKeyOf(r.date)
        const d = byDay.get(k) ?? { present: 0, recorded: 0 }
        d.recorded += 1
        if (r.status === 'PRESENT' || r.status === 'LATE') d.present += 1
        byDay.set(k, d)
        const m = k.slice(0, 7)
        const mm = byMonth.get(m) ?? { present: 0, recorded: 0 }
        mm.recorded += 1
        if (r.status === 'PRESENT' || r.status === 'LATE') mm.present += 1
        byMonth.set(m, mm)
      }
      const weekTrend = [...byDay.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .slice(0, 7)
        .reverse()
        .map(([date, d]) => ({
          date,
          rate: d.recorded > 0 ? Math.round((d.present / d.recorded) * 1000) / 10 : 0,
          recorded: d.recorded,
        }))
      const monthTrend = [...byMonth.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([month, d]) => ({
          month,
          rate: d.recorded > 0 ? Math.round((d.present / d.recorded) * 1000) / 10 : 0,
          recorded: d.recorded,
        }))

      // ── Rosters with statuses for the selected day ────────────────────
      const sections = classes.map((c) => {
        const roster = students
          .filter((s) => s.classId === c.id)
          .sort((a, b) => (a.rollNo ?? '').localeCompare(b.rollNo ?? '', undefined, { numeric: true }))
          .map((s) => ({
            studentId: s.id,
            rollNo: s.rollNo ?? '—',
            name: nameOf.get(s.id) ?? 'Student',
            status: dayRows.find((r) => r.studentId === s.id)?.status ?? null,
          }))
        return { classId: c.id, classLabel: classLabelOf.get(c.id) ?? c.name, roster }
      })

      // ── Per-student drill (optional) ─────────────────────────────────
      let student: {
        studentId: string
        name: string
        classLabel: string | null
        rollNo: string | null
        records: { date: string; status: string }[]
        present: number
        late: number
        absent: number
        leave: number
        rate: number
      } | null = null
      if (studentParam) {
        const target = students.find((s) => s.id === studentParam)
        if (target) {
          const tRows = rows
            .filter((r) => r.studentId === studentParam)
            .sort((a, b) => (a.date > b.date ? 1 : -1))
          const tp = tRows.filter((r) => r.status === 'PRESENT').length
          const tl = tRows.filter((r) => r.status === 'LATE').length
          const ta = tRows.filter((r) => r.status === 'ABSENT').length
          const tlv = tRows.filter((r) => r.status === 'LEAVE').length
          student = {
            studentId: target.id,
            name: nameOf.get(target.id) ?? 'Student',
            classLabel: target.classId ? (classLabelOf.get(target.classId) ?? null) : null,
            rollNo: target.rollNo ?? null,
            records: tRows.map((r) => ({ date: dayKeyOf(r.date), status: r.status })),
            present: tp, late: tl, absent: ta, leave: tlv,
            rate: tRows.length > 0 ? Math.round(((tp + tl) / tRows.length) * 1000) / 10 : 0,
          }
        }
      }

      return { date: dayKey, summary, byClass, weekTrend, monthTrend, sections, student }
    },
    { roles: ['PRINCIPAL', 'MANAGEMENT'] }
  )
}
