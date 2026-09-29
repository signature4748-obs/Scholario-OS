import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'

export const runtime = 'nodejs'

/**
 * GET /api/attendance/overview — canonical school-wide attendance overview,
 * derived 100% from the Attendance table (no mock numbers).
 *
 * Shapes (consumed by the principal Attendance module + dashboard via
 * use-attendance-overview):
 *
 *   today     — breakdown for the LATEST RECORDED date (today itself may
 *               have no rows yet; total = distinct students marked that
 *               date, NOT school size — an honest denominator), rate =
 *               (present + late) / total * 100, 1 decimal.
 *   weekTrend — last 6 RECORDED dates: { day: 'Mon', present, rate }.
 *   monthly   — last 6 calendar months having rows: { month: 'Apr', rate }.
 *   byClass   — per GRADE-GROUP (Class rows grouped by gradeLevel + stream):
 *               rate over ALL their attendance rows, sorted by grade.
 *   daily     — every recorded date with its full breakdown (drives the
 *               Overview heatmap + selected-day panel with real rates).
 *
 * Zero-row schools get an all-zero today + empty arrays — never a crash.
 */

interface DayBreakdown {
  present: number
  absent: number
  late: number
  leave: number
  /** distinct students marked that day (honest denominator) */
  total: number
  rate: number
}

interface ClassRow {
  id: string
  gradeLevel: string | null
  stream: string | null
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function rateOf(present: number, late: number, total: number): number {
  if (total <= 0) return 0
  return Math.round(((present + late) / total) * 1000) / 10
}

/** Group label: "Grade 9" / "Grade 11 (Science)" / "Grade 11 (Commerce)". */
function gradeGroupLabel(c: ClassRow): string {
  const grade = (c.gradeLevel ?? '').trim() || '—'
  const stream = (c.stream ?? '').trim()
  return stream && stream !== 'General' ? `Grade ${grade} (${stream})` : `Grade ${grade}`
}

function gradeSortKey(label: string): number {
  const m = /Grade (\d+)/.exec(label)
  return m ? Number(m[1]) : 999
}

export async function GET(_req: NextRequest) {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)

      const [rows, classes] = await Promise.all([
        db.attendance.findMany({
          where: { schoolId },
          select: { studentId: true, classId: true, date: true, status: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
        db.class.findMany({
          where: { schoolId },
          select: { id: true, gradeLevel: true, stream: true },
        }),
      ])

      const classById = new Map(classes.map((c) => [c.id, c]))

      // ── Per (student, calendar day) dedup — the unique constraint is on
      // the exact DateTime, so a re-marked day can carry several rows; the
      // LATEST write per student-day is the current status (last-write-wins,
      // matching the audit-log convention). Days are normalized to the UTC
      // calendar date so seeded time components don't split a day.
      const latestByStudentDay = new Map<string, { status: string; classId: string | null; studentId: string; day: string }>()
      for (const r of rows) {
        const day = r.date.toISOString().slice(0, 10)
        latestByStudentDay.set(`${day}|${r.studentId}`, {
          status: r.status,
          classId: r.classId,
          studentId: r.studentId,
          day,
        })
      }

      // ── Daily aggregation (every recorded date) ─────────────────────────
      const dailyMap = new Map<string, { present: number; absent: number; late: number; leave: number; total: number }>()
      for (const rec of latestByStudentDay.values()) {
        const entry = dailyMap.get(rec.day) ?? { present: 0, absent: 0, late: 0, leave: 0, total: 0 }
        if (rec.status === 'PRESENT') entry.present++
        else if (rec.status === 'LATE') entry.late++
        else if (rec.status === 'ABSENT') entry.absent++
        else if (rec.status === 'LEAVE') entry.leave++
        // any other status still counts as a recorded student (honest denominator)
        entry.total++
        dailyMap.set(rec.day, entry)
      }
      const daily: (DayBreakdown & { date: string })[] = []
      for (const [day, entry] of [...dailyMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        daily.push({
          date: day,
          present: entry.present,
          absent: entry.absent,
          late: entry.late,
          leave: entry.leave,
          total: entry.total,
          rate: rateOf(entry.present, entry.late, entry.total),
        })
      }

      // ── today = latest recorded date (today itself may have no rows yet) ─
      const latest = daily[daily.length - 1]
      const today = latest
        ? {
            present: latest.present,
            absent: latest.absent,
            late: latest.late,
            leave: latest.leave,
            total: latest.total,
            rate: latest.rate,
            date: latest.date,
            isLatestRecordedDate: true as const,
          }
        : {
            present: 0,
            absent: 0,
            late: 0,
            leave: 0,
            total: 0,
            rate: 0,
            date: null,
            isLatestRecordedDate: false as const,
          }

      // ── weekTrend: last 6 recorded dates ────────────────────────────────
      const weekTrend = daily.slice(-6).map((d) => {
        const [y, m, dd] = d.date.split('-').map(Number)
        const dow = new Date(Date.UTC(y, m - 1, dd)).getUTCDay()
        return { day: WEEKDAY_LABELS[dow] ?? '—', date: d.date, present: d.present, rate: d.rate }
      })

      // ── monthly: last 6 calendar months having rows ─────────────────────
      const monthlyMap = new Map<string, { present: number; late: number; total: number }>()
      for (const d of daily) {
        const monthKey = d.date.slice(0, 7) // YYYY-MM
        const agg = monthlyMap.get(monthKey) ?? { present: 0, late: 0, total: 0 }
        agg.present += d.present
        agg.late += d.late
        agg.total += d.total
        monthlyMap.set(monthKey, agg)
      }
      const monthly = [...monthlyMap.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .slice(-6)
        .map(([monthKey, agg]) => ({
          month: MONTH_LABELS[Number(monthKey.slice(5, 7)) - 1] ?? monthKey,
          rate: rateOf(agg.present, agg.late, agg.total),
        }))

      // ── byClass: per grade-group, rate over ALL their attendance rows ────
      const groupAgg = new Map<
        string,
        { label: string; present: number; absent: number; late: number; leave: number; records: number; students: Set<string> }
      >()
      for (const rec of latestByStudentDay.values()) {
        const cls = rec.classId ? classById.get(rec.classId) : undefined
        if (!cls) continue // rows without a resolvable Class row can't be grouped
        const label = gradeGroupLabel(cls)
        const agg = groupAgg.get(label) ?? {
          label,
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
          records: 0,
          students: new Set<string>(),
        }
        if (rec.status === 'PRESENT') agg.present++
        else if (rec.status === 'LATE') agg.late++
        else if (rec.status === 'ABSENT') agg.absent++
        else if (rec.status === 'LEAVE') agg.leave++
        agg.records++
        agg.students.add(rec.studentId)
        groupAgg.set(label, agg)
      }
      const byClass = [...groupAgg.values()]
        .sort((a, b) => gradeSortKey(a.label) - gradeSortKey(b.label) || a.label.localeCompare(b.label))
        .map((g) => ({
          class: g.label,
          rate: rateOf(g.present, g.late, g.records),
          students: g.students.size,
          present: g.present,
          absent: g.absent,
          late: g.late,
          leave: g.leave,
          records: g.records,
        }))

      return { today, weekTrend, monthly, byClass, daily }
    },
    // Same role surface as /api/attendance (Audit §11 — staff-only rosters).
    { roles: ['PRINCIPAL', 'MANAGEMENT', 'TEACHER'] },
  )
}
