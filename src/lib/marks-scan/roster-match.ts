/**
 * marks-scan/roster-match — resolves OCR detections against the OFFICIAL
 * class roster and classifies every marks reading.
 *
 * HARD RULES (spec parts 7–9):
 *  · The roster is the source of truth — OCR NEVER creates or modifies
 *    student records. Roll numbers resolve identity; OCR'd names are only
 *    a secondary, fuzzy fallback when the roll is unclear.
 *  · Marks are numeric (0..maxMarks) or the canonical ABSENT marker "AB".
 *    Out-of-range / non-numeric readings are INVALID, never clamped.
 *  · Blank / missing readings stay UNREAD — never silently zero.
 *  · Confidence comes straight from the engine; low-confidence readings
 *    land in REVIEW and can never be submitted without teacher action.
 */

import type {
  CellStatus,
  MatchKind,
  RawRow,
  RosterStudent,
  ScanRow,
} from './types'

/** Marks readings at/above this real engine confidence are CONFIRMED. */
const CONFIRM_ABOVE = 72

/** "Aarav  Sharrma" → "aaravsharrma" (letters only, lowercase). */
function normalizeName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, '')
}

/** Classic normalised Levenshtein similarity 0–1. */
export function nameSimilarity(a: string, b: string): number {
  const s = normalizeName(a)
  const t = normalizeName(b)
  if (!s || !t) return 0
  if (s === t) return 1
  const m = s.length
  const n = t.length
  const dp: number[] = new Array((m + 1) * (n + 1))
  for (let i = 0; i <= m; i += 1) dp[i * (n + 1)] = i
  for (let j = 0; j <= n; j += 1) dp[j] = j
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      dp[i * (n + 1) + j] = Math.min(
        dp[(i - 1) * (n + 1) + j] + 1,
        dp[i * (n + 1) + (j - 1)] + 1,
        dp[(i - 1) * (n + 1) + (j - 1)] + cost,
      )
    }
  }
  const dist = dp[m * (n + 1) + n]
  return 1 - dist / Math.max(m, n)
}

/** Clean a roll reading to bare digits ("0 1" → "01", "Q1" → "1"). */
export function cleanRoll(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

/** Canonical roster lookup: exact roll match, else zero-padded variant. */
function findByRoll(roster: RosterStudent[], roll: string): RosterStudent | null {
  if (!roll) return null
  const direct = roster.find((s) => s.rollNo.trim() === roll)
  if (direct) return direct
  const two = roll.padStart(2, '0')
  return roster.find((s) => s.rollNo.trim() === two) ?? null
}

/** Best fuzzy roster match by name (secondary mechanism only). */
function findByName(roster: RosterStudent[], name: string): { student: RosterStudent; score: number } | null {
  if (normalizeName(name).length < 4) return null
  let best: RosterStudent | null = null
  let bestScore = 0
  for (const s of roster) {
    const score = nameSimilarity(name, s.name)
    if (score > bestScore) {
      bestScore = score
      best = s
    }
  }
  if (best && bestScore >= 0.62) return { student: best, score: bestScore }
  return null
}

export interface ValueClassification {
  status: CellStatus
  /** Normalised grid value: digits, 'AB', or '' — never a silent zero. */
  value: string
  note: string
}

/**
 * Classify one marks reading against the real maximum. Examples
 * (maxMarks 100): '78'→CONFIRMED/78 · '8?'→REVIEW/8 · '108'→INVALID ·
 * 'AB'→REVIEW-absent/'AB' · '-2'/'abc'→INVALID · ''→UNREAD.
 */
export function classifyMarks(
  raw: string,
  confidence: number | null,
  maxMarks: number,
): ValueClassification {
  const text = raw.trim()
  if (text === '') {
    return { status: 'UNREAD', value: '', note: 'No mark detected' }
  }
  const upper = text.toUpperCase().replace(/[^A-Z]/g, '')
  if (upper === 'AB' || upper === 'A' || text.trim() === '--') {
    return {
      status: 'REVIEW',
      value: 'AB',
      note: `Read as “${text}” — confirm this student was absent`,
    }
  }
  // Numeric reading — strip stray punctuation Tesseract sometimes emits
  // around digits (e.g. '8?' → '8', '.78.' → '78').
  const hasDigit = /[0-9]/.test(text)
  if (!hasDigit) {
    return { status: 'INVALID', value: text, note: `Unreadable value “${text}”` }
  }
  const digits = text.replace(/[^0-9]/g, '')
  const n = Number.parseInt(digits, 10)
  if (Number.isNaN(n)) {
    return { status: 'INVALID', value: text, note: `Unreadable value “${text}”` }
  }
  const cleaned = digits !== text // e.g. '8?' or '78.'
  if (n < 0 || n > maxMarks) {
    return {
      status: 'INVALID',
      value: digits,
      note: `${n} is outside 0–${maxMarks}`,
    }
  }
  if (confidence != null && confidence < CONFIRM_ABOVE) {
    return {
      status: 'REVIEW',
      value: digits,
      note: `Low confidence (${Math.round(confidence)}%) — read as “${text}”`,
    }
  }
  if (cleaned && confidence != null && confidence < 88) {
    // Stray punctuation + middling confidence → needs an eye.
    return {
      status: 'REVIEW',
      value: digits,
      note: `Read as “${text}” — verify`,
    }
  }
  return { status: 'CONFIRMED', value: digits, note: '' }
}

export interface MatchResult {
  rows: ScanRow[]
  /** Roll numbers detected on more than one page (or twice on one page). */
  duplicateRolls: { roll: string; pages: number[] }[]
  /** Detections that could not be tied to the roster at all. */
  unmatchedCount: number
}

/**
 * Build the review dataset: the FULL official roster + best detection per
 * student, duplicate rolls flagged, extra sheet rows appended as
 * UNMATCHED (never creating students).
 */
export function matchRowsToRoster(
  rawRows: RawRow[],
  roster: RosterStudent[],
  maxMarks: number,
): MatchResult {
  // 1) Resolve every raw detection to a roster student.
  const usedStudentIds = new Set<string>()
  const byStudent = new Map<string, { raw: RawRow; match: MatchKind }>()
  const unmatched: RawRow[] = []
  const rollDetections = new Map<string, number[]>() // rollRaw → page indexes

  for (const raw of rawRows) {
    const roll = cleanRoll(raw.rollRaw)
    if (roll) {
      const pages = rollDetections.get(roll) ?? []
      pages.push(pageIndexOf(raw))
      rollDetections.set(roll, pages)
    }
  }

  for (const raw of rawRows) {
    const roll = cleanRoll(raw.rollRaw)
    if (roll) {
      // A read roll number is authoritative: it either resolves to the
      // roster or the row is an extra (never name-matched around it).
      const student = findByRoll(roster, roll)
      if (student && !byStudent.has(student.id)) {
        byStudent.set(student.id, { raw, match: 'ROLL' as MatchKind })
        usedStudentIds.add(student.id)
      } else if (!student) {
        unmatched.push(raw)
      }
      // Same student twice → the duplicate-roll flag below surfaces it.
    } else {
      // Roll missing/unclear → SECONDARY mechanism: fuzzy name match.
      const fuzzy = findByName(roster, raw.nameRaw)
      if (fuzzy && !usedStudentIds.has(fuzzy.student.id)) {
        byStudent.set(fuzzy.student.id, { raw, match: 'NAME' as MatchKind })
        usedStudentIds.add(fuzzy.student.id)
      } else {
        unmatched.push(raw)
      }
    }
  }

  const duplicateRolls: MatchResult['duplicateRolls'] = []
  for (const [roll, pages] of rollDetections) {
    if (new Set(pages).size > 1 || pages.length > 1) {
      duplicateRolls.push({ roll, pages: [...new Set(pages)].sort((a, b) => a - b) })
    }
  }
  const duplicateRollSet = new Set(duplicateRolls.map((d) => d.roll))

  // 2) Roster rows (source of truth) — in roster order.
  const rows: ScanRow[] = roster.map((student) => {
    const hit = byStudent.get(student.id)
    if (!hit) {
      return {
        studentId: student.id,
        rollNo: student.rollNo,
        name: student.name,
        value: '',
        status: 'UNREAD' as CellStatus,
        confidence: null,
        match: 'ROLL' as MatchKind,
        detectedName: '',
        box: null,
        pageId: null,
        duplicate: false,
        duplicatePages: [],
        touched: false,
        note: 'Not detected on any page',
      }
    }
    const cls = classifyMarks(hit.raw.marksRaw, hit.raw.marksConfidence, maxMarks)
    const roll = cleanRoll(hit.raw.rollRaw)
    const duplicate = duplicateRollSet.has(roll)
    const noteBits = [cls.note]
    if (hit.match === 'NAME') {
      noteBits.push(`Matched by name “${hit.raw.nameRaw}” — roll no unclear`)
    }
    if (duplicate) {
      const pages = [...new Set(rollDetections.get(roll) ?? [])].sort((a, b) => a - b)
      noteBits.push(
        pages.length > 1
          ? `Roll ${roll} detected on pages ${pages.join(' & ')} — keep the correct value`
          : `Roll ${roll} detected twice on page ${pages[0] ?? 1} — keep the correct value`,
      )
    }
    return {
      studentId: student.id,
      rollNo: student.rollNo,
      name: student.name,
      value: cls.value,
      status: cls.status,
      confidence: hit.raw.marksConfidence,
      match: hit.match,
      detectedName: hit.raw.nameRaw,
      box: hit.raw.box,
      pageId: hit.raw.pageId,
      duplicate,
      duplicatePages: duplicate ? (rollDetections.get(roll) ?? []) : [],
      touched: false,
      note: noteBits.filter(Boolean).join(' · '),
    }
  })

  // 3) Extra sheet rows (rolls/names not in the roster) — visible, flagged,
  //    never turned into students.
  for (const raw of unmatched) {
    const cls = classifyMarks(raw.marksRaw, raw.marksConfidence, maxMarks)
    rows.push({
      studentId: '',
      rollNo: cleanRoll(raw.rollRaw) || '?',
      name: raw.nameRaw || 'Unknown row',
      value: cls.value,
      status: cls.status,
      confidence: raw.marksConfidence,
      match: 'UNMATCHED',
      detectedName: raw.nameRaw,
      box: raw.box,
      pageId: raw.pageId,
      duplicate: false,
      duplicatePages: [],
      touched: false,
      note: `Roll ${cleanRoll(raw.rollRaw) || '?'} is not in the official roster${cls.note ? ' · ' + cls.note : ''}`,
    })
  }

  return { rows, duplicateRolls, unmatchedCount: unmatched.length }
}

function pageIndexOf(raw: RawRow): number {
  // pageId format: 'p{n}-…' — see use-scan.ts
  const m = /^p(\d+)-/.exec(raw.pageId)
  return m ? Number(m[1]) : 1
}

/** A value is submittable when it is a valid number or the AB marker. */
export function isSubmittableValue(value: string, maxMarks: number): boolean {
  if (value === 'AB') return true
  if (value === '') return true // blank = not entered (same as manual entry)
  if (!/^\d{1,3}$/.test(value)) return false
  const n = Number.parseInt(value, 10)
  return n >= 0 && n <= maxMarks
}

/**
 * Pre-submission validation summary (spec part 15). Submit is blocked
 * while any INVALID cell or unresolved REVIEW cell or unresolved duplicate
 * exists; UNREAD students may stay blank exactly like manual entry.
 */
export interface ValidationSummary {
  ready: number
  review: number
  invalid: number
  unread: number
  absent: number
  duplicates: number
  unmatched: number
  edited: number
  blockers: string[]
  canSubmit: boolean
}

export function validateRows(rows: ScanRow[], maxMarks: number): ValidationSummary {
  const s: ValidationSummary = {
    ready: 0,
    review: 0,
    invalid: 0,
    unread: 0,
    absent: 0,
    duplicates: 0,
    unmatched: 0,
    edited: 0,
    blockers: [],
    canSubmit: false,
  }
  for (const r of rows) {
    if (r.match === 'UNMATCHED') {
      if (r.touched || r.value !== '') s.unmatched += 1
      continue
    }
    if (r.touched) s.edited += 1
    if (r.duplicate && !r.touched) s.duplicates += 1
    if (r.value === 'AB') s.absent += 1
    switch (r.status) {
      case 'CONFIRMED':
        if (r.value !== '') s.ready += 1
        else s.unread += 1
        break
      case 'REVIEW':
        s.review += 1
        break
      case 'INVALID':
        s.invalid += 1
        break
      case 'UNREAD':
        s.unread += 1
        break
    }
  }
  if (s.invalid > 0) s.blockers.push(`${s.invalid} value${s.invalid > 1 ? 's are' : ' is'} invalid — fix or clear ${s.invalid > 1 ? 'them' : 'it'}`)
  if (s.review > 0) s.blockers.push(`${s.review} value${s.review > 1 ? 's need' : ' needs'} review — edit or confirm ${s.review > 1 ? 'them' : 'it'}`)
  if (s.duplicates > 0) s.blockers.push(`${s.duplicates} duplicate roll row${s.duplicates > 1 ? 's' : ''} — keep the correct value`)
  if (s.unmatched > 0) s.blockers.push(`${s.unmatched} row${s.unmatched > 1 ? 's are' : ' is'} not in the official roster — clear ${s.unmatched > 1 ? 'them' : 'it'}`)
  s.canSubmit =
    s.blockers.length === 0 &&
    rows.some((r) => r.match !== 'UNMATCHED' && r.value !== '') &&
    rows.every((r) => r.match === 'UNMATCHED' || isSubmittableValue(r.value, maxMarks))
  return s
}
