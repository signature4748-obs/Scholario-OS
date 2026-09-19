/**
 * timetable/server-mapping — the DB ⇄ TimetableSlot mapping, shared by the
 * Student timetable (DB → slots) and the Principal publish sync (slots → DB).
 *
 * The server stores TEACHING periods only (breaks are not rows) and numbers
 * them consecutively from 1, while the canonical rendering ladder
 * (`./config` PERIODS) reserves numbers 4 and 7 for Short Break / Lunch
 * Break. Both directions therefore map through START-TIME matching against
 * the ladder (authoritative), with positional fallbacks — never a
 * wrong-by-construction slot.
 *
 * Pure functions, no React, no 'use client' — importable from route handlers.
 */

import { PERIODS, DAYS, type TimetableSlot, type DayType } from './config'

/** Raw DB row shape (as served by GET /api/timetable & /api/student/timetable). */
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

/** Slot shape accepted by POST /api/timetable/publish (principal → server). */
export interface PublishableSlot {
  day: string
  /** Ladder period number (breaks reserved: 4, 7). */
  period: number
  /** Ladder-style range, e.g. "08:30 AM - 09:15 AM". */
  time: string
  className: string
  subject: string
  teacherName: string
  room: string
}

/* ── time helpers ──────────────────────────────────────────────────── */

/** "08:30 AM - 09:15 AM" (or "08:30-09:15") → minutes since midnight. */
export function parseRangeMinutes(time: string): { startMin: number; endMin: number } | null {
  const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!m) return null
  const toMin = (h: string, min: string, mer?: string) => {
    let hour = Number(h)
    const mins = Number(min)
    if (mer) {
      const merU = mer.toUpperCase()
      if (merU === 'PM' && hour !== 12) hour += 12
      if (merU === 'AM' && hour === 12) hour = 0
    }
    return hour * 60 + mins
  }
  return { startMin: toMin(m[1], m[2], m[3]), endMin: toMin(m[4], m[5], m[6]) }
}

/** "HH:MM" (24h) → minutes since midnight; null when unparseable. */
export function hhmmToMinutes(t: string | null): number | null {
  if (!t) return null
  const m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Minutes since midnight → "HH:MM" 24h (DB storage format). */
function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h < 10 ? `0${h}` : h}:${m < 10 ? `0${m}` : m}`
}

/** Minutes since midnight → "h:MM AM/PM" (12h, no leading zero). */
function minutesTo12h(min: number): string {
  const h24 = Math.floor(min / 60)
  const mm = String(min % 60).padStart(2, '0')
  const mer = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${mm} ${mer}`
}

/** Day string → canonical DayType (Saturday default keeps the type honest). */
function asDay(day: string): DayType {
  const d = day.trim()
  return (DAYS as readonly string[]).includes(d) ? (d as DayType) : 'Saturday'
}

/** Teaching ladder (non-break periods) in canonical order. */
const TEACHING_LADDER = PERIODS.filter((p) => !p.isBreak)

/** Ladder lookup by start minute (e.g. 11:00 → ladder period 5). */
const LADDER_BY_START = new Map<number, (typeof TEACHING_LADDER)[number]>()
for (const p of TEACHING_LADDER) {
  const parsed = parseRangeMinutes(p.time)
  if (parsed) LADDER_BY_START.set(parsed.startMin, p)
}

/* ── DB rows → TimetableSlot (Student + Principal hydration) ──────── */

export function serverRowsToSlots(rows: ServerSlot[]): TimetableSlot[] {
  return rows.map((r) => {
    const startMin = hhmmToMinutes(r.startTime)
    const endMin = hhmmToMinutes(r.endTime)

    // 1 — time match against the canonical ladder.
    let ladder = startMin !== null ? LADDER_BY_START.get(startMin) : undefined
    // 2 — nth teaching period fallback.
    if (!ladder && r.period >= 1 && r.period <= TEACHING_LADDER.length) {
      ladder = TEACHING_LADDER[r.period - 1]
    }

    const time =
      ladder?.time ??
      (startMin !== null && endMin !== null
        ? `${minutesTo12h(startMin)} - ${minutesTo12h(endMin)}`
        : '')

    return {
      id: `srv-${r.id}`,
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

/* ── TimetableSlot → DB row fields (Principal publish sync) ───────── */

export interface ServerRowDraft {
  day: string
  /** DB teaching-period number (consecutive from 1; breaks skipped). */
  period: number
  startTime: string
  endTime: string
  className: string
  subject: string
  teacherName: string
  room: string
}

/**
 * Map published slots onto DB row drafts:
 *   - day → canonical DayType;
 *   - ladder period → DB teaching period via start-time match, falling back
 *     to the ladder position (period 5 → 4th teaching period → DB 4);
 *   - time string → "HH:MM" startTime/endTime (DB storage format).
 */
export function slotsToServerRows(slots: PublishableSlot[]): ServerRowDraft[] {
  const out: ServerRowDraft[] = []
  for (const s of slots) {
    const parsed = parseRangeMinutes(s.time)
    if (!parsed) continue

    let teachingNo: number
    const ladder = LADDER_BY_START.get(parsed.startMin)
    if (ladder) {
      teachingNo = TEACHING_LADDER.findIndex((p) => p.number === ladder.number) + 1
    } else {
      const idx = TEACHING_LADDER.findIndex((p) => p.number === s.period)
      teachingNo = idx >= 0 ? idx + 1 : s.period
    }

    out.push({
      day: asDay(s.day),
      period: Math.max(1, teachingNo),
      startTime: minutesToHHMM(parsed.startMin),
      endTime: minutesToHHMM(parsed.endMin),
      className: s.className.trim(),
      subject: s.subject.trim(),
      teacherName: s.teacherName.trim(),
      room: (s.room ?? '').trim(),
    })
  }
  return out
}
