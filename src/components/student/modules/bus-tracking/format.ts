/**
 * Present the DB's 24-hour "HH:mm" strings (Route.startTime / Route.endTime)
 * as a friendly 12-hour label, e.g. '07:00' → '7:00 AM'. Anything the DB
 * didn't record renders as '—' — never a fabricated time.
 */
export function formatServiceTime(hhmm: string | null | undefined): string {
  if (!hhmm) return '—'
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return hhmm
  const h = Number.parseInt(m[1], 10)
  const min = m[2]
  if (Number.isNaN(h) || h < 0 || h > 23) return hhmm
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${min} ${ampm}`
}
