/**
 * ics/builder — RFC 5545 calendar (.ics) file generation, shared by the
 * Student and Teacher timetable exports.
 *
 * Pure string assembly with zero dependencies. The pieces of the spec
 * that matter here, implemented honestly:
 *   · CRLF line endings everywhere (§3.1);
 *   · long content lines folded at 75 OCTETS with a single leading
 *     space on continuation lines (§3.1);
 *   · TEXT escaping — backslash, semicolon, comma, line breaks (§3.3.11);
 *   · a fixed-offset VTIMEZONE for Asia/Kolkata (IST, +0530, no DST —
 *     a single STANDARD observance is the whole truth);
 *   · DTSTART/DTEND with TZID, weekly RRULE with COUNT (§3.8.5.3);
 *   · stable UIDs so re-importing updates instead of duplicating.
 *
 * Events are recurring weekly by design: a school timetable IS a weekly
 * recurrence. `firstDate`/`weekday` place the first occurrence; the
 * RRULE repeats it `weeks` times (default 12 — one term ahead, never a
 * calendar polluted forever).
 */

export interface IcsEventInput {
  /** Stable unique id (re-imports update, never duplicate). */
  uid: string
  title: string
  description?: string
  location?: string
  /** Start time — minutes since midnight, local. */
  startMin: number
  /** End time — minutes since midnight, local. */
  endMin: number
  /** Weekday of the recurrence — JS getDay() number (0=Sun..6=Sat). */
  weekday: number
  /** ISO date (yyyy-mm-dd) of the FIRST occurrence. */
  firstDate: string
}

export interface BuildIcsOptions {
  calendarName: string
  calendarDescription?: string
  events: IcsEventInput[]
  /** Weekly recurrence count — default 12. */
  weeks?: number
}

const CRLF = '\r\n'
const PROD_ID = '-//Scholario//Timetable 1.0//EN'

/* ── text escaping (RFC 5545 §3.3.11) ─────────────────────────────── */

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/* ── date-time formatting ─────────────────────────────────────────── */

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

/** Local date-time stamp for TZID-qualified values: 20260921T083000. */
function localStamp(date: string, minutes: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const h = Math.floor(minutes / 60)
  const min = minutes % 60
  return `${pad(y)}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`
}

/** UTC stamp for DTSTAMP: 20260919T041500Z. */
function utcStampNow(): string {
  const d = new Date()
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

/** Next calendar occurrence of a weekday (today counts), ISO yyyy-mm-dd. */
export function nextOccurrenceISO(weekday: number, from: Date = new Date()): string {
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  for (let guard = 0; guard < 8 && cursor.getDay() !== weekday; guard++) {
    cursor.setDate(cursor.getDate() + 1)
  }
  return `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`
}

/* ── line folding (RFC 5545 §3.1) ─────────────────────────────────── */

/** Fold one logical line into ≤75-octet physical lines. */
function fold(line: string): string[] {
  if (line.length <= 75) return [line]
  const out: string[] = []
  let rest = line
  out.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 0) {
    out.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  return out
}

/* ── calendar assembly ────────────────────────────────────────────── */

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Asia/Kolkata',
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:+0530',
  'TZOFFSETTO:+0530',
  'TZNAME:IST',
  'END:STANDARD',
  'END:VTIMEZONE',
].join(CRLF)

export function buildIcs(opts: BuildIcsOptions): string {
  const weeks = Math.max(1, opts.weeks ?? 12)
  const stamp = utcStampNow()
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    `PRODID:${PROD_ID}`,
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(opts.calendarName)}`,
    `X-WR-CALDESC:${escapeIcsText(opts.calendarDescription ?? opts.calendarName)}`,
    'X-WR-TIMEZONE:Asia/Kolkata',
    VTIMEZONE,
  ]

  for (const e of opts.events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Asia/Kolkata:${localStamp(e.firstDate, e.startMin)}`,
      `DTEND;TZID=Asia/Kolkata:${localStamp(e.firstDate, e.endMin)}`,
      `RRULE:FREQ=WEEKLY;COUNT=${weeks}`,
      `SUMMARY:${escapeIcsText(e.title)}`,
    )
    if (e.description) lines.push(`DESCRIPTION:${escapeIcsText(e.description)}`)
    if (e.location) lines.push(`LOCATION:${escapeIcsText(e.location)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  // Fold every logical line, then join with CRLF (VTIMEZONE is pre-folded
  // — all of its lines are far below 75 octets).
  return lines.flatMap((l) => (l.includes(CRLF) ? [l] : fold(l))).join(CRLF) + CRLF
}

/* ── download helper (browser only) ───────────────────────────────── */

/** Trigger a .ics file download in the current browser tab. */
export function downloadIcs(filename: string, content: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}
