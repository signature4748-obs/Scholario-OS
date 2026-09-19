'use client'

/**
 * Student Timetable — server-row → TimetableSlot mapping.
 *
 * The server stores TEACHING periods only (breaks are not rows) and
 * numbers them 1..7 consecutively, while the canonical rendering ladder
 * (`@/lib/timetable/config` PERIODS) reserves numbers 4 and 7 for the
 * Short Break and Lunch Break. Mapping therefore matches each row's
 * start TIME against the ladder (authoritative), falling back to the
 * nth non-break ladder period, and finally to a synthesized time when
 * neither matches — never a wrong-by-construction slot.
 */

import { PERIODS, type TimetableSlot } from '@/lib/timetable/config'
import { parsePeriodTime } from './time-utils'

/** Raw row shape returned by GET /api/student/timetable. */
export interface ServerSlot {
  id: string
  day: string
  period: number
  startTime: string | null
  endTime: string | null
  subject: string
  teacherName: string
  room: string | null
  className: string
}

/** Non-break ladder periods in order (the teaching ladder). */
const TEACHING_LADDER = PERIODS.filter((p) => !p.isBreak)

/** "HH:MM" (24h) → minutes since midnight; null when unparseable. */
function hhmmToMinutes(t: string | null): number | null {
  if (!t) return null
  const m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Minutes since midnight → "hh:MM AM - hh:MM AM" ladder-style range. */
function minutesToRange(startMin: number, endMin: number): string {
  const label = (min: number) => {
    const h24 = Math.floor(min / 60)
    const mm = String(min % 60).padStart(2, '0')
    const mer = h24 >= 12 ? 'PM' : 'AM'
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    return `${h12}:${mm} ${mer}`
  }
  return `${label(startMin)} - ${label(endMin)}`
}

/** Day string → TimetableSlot['day'] (Saturday default keeps the type honest). */
function asDay(day: string): TimetableSlot['day'] {
  const d = day.trim()
  return (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const).includes(
    d as TimetableSlot['day'],
  )
    ? (d as TimetableSlot['day'])
    : 'Saturday'
}

export function serverRowsToSlots(rows: ServerSlot[]): TimetableSlot[] {
  // Ladder lookup by start minute (e.g. 11:00 → ladder period 5).
  const byStartMin = new Map<number, (typeof TEACHING_LADDER)[number]>()
  for (const p of TEACHING_LADDER) {
    const parsed = parsePeriodTime(p.time)
    if (parsed) byStartMin.set(parsed.startMin, p)
  }

  return rows.map((r) => {
    const startMin = hhmmToMinutes(r.startTime)
    const endMin = hhmmToMinutes(r.endTime)

    // 1 — time match against the canonical ladder.
    let ladder = startMin !== null ? byStartMin.get(startMin) : undefined
    // 2 — nth teaching period fallback.
    if (!ladder && r.period >= 1 && r.period <= TEACHING_LADDER.length) {
      ladder = TEACHING_LADDER[r.period - 1]
    }

    const time =
      ladder?.time ??
      (startMin !== null && endMin !== null ? minutesToRange(startMin, endMin) : '')

    return {
      id: r.id,
      day: asDay(r.day),
      period: ladder?.number ?? r.period,
      time,
      className: r.className,
      subject: r.subject,
      teacherId: '',
      teacherName: r.teacherName,
      room: r.room ?? '',
      type: 'Lecture',
    }
  })
}
