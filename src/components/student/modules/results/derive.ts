/**
 * results/derive — the module's LOCAL derivation layer (20-results).
 *
 * The marks universe is the SERVER's: /api/student/results →
 * useMyServerResults() (Exam + Result rows the Principal declares and
 * the Class Teacher writes). This file holds the pure display-derivation
 * helpers the old client store used to export — percentage formatting,
 * the school-configured grade scale, subject-table totals and date
 * labels. Nothing here fabricates data: every function only reshapes
 * what the server already returned.
 */

import type { MyResultExam, MyResultSubject } from '../shared/canonical'

/* ── Grading — the SCHOOL's configured scale (never hardcoded marks) ── */

export interface GradeBand {
  threshold: number
  grade: string
}

/** Defensive fallback — the live one lives in School Settings. */
export const DEFAULT_GRADE_SCALE: GradeBand[] = [
  { threshold: 90, grade: 'A+' },
  { threshold: 80, grade: 'A' },
  { threshold: 70, grade: 'B' },
  { threshold: 60, grade: 'C' },
  { threshold: 50, grade: 'D' },
  { threshold: 0, grade: 'E' },
]

/** Grade for a percentage, from the school's configured scale. */
export function gradeForPct(pct: number, scale: GradeBand[]): string {
  const bands = scale.length > 0 ? scale : DEFAULT_GRADE_SCALE
  for (const band of bands) {
    if (pct >= band.threshold) return band.grade
  }
  return bands[bands.length - 1]?.grade ?? '—'
}

/* ── Percentages & totals — computed from the server's own rows ────── */

/** Raw percentage of obtained/max (0 when max is 0). */
export function pctOf(obtained: number, max: number): number {
  if (max <= 0) return 0
  return (obtained / max) * 100
}

/** Centralized academic rounding — ONE rule everywhere (UI + HTML export). */
export function fmtPct(pct: number): string {
  return pct.toFixed(1)
}

export interface ExamTotals {
  obtained: number
  max: number
  pct: number
}

/**
 * Totals of one server exam — the subject rows sum, with the overall
 * percentage preferring the SERVER-computed pct (the same number the
 * Principal's declaration surface shows) and falling back to the local
 * sum only when the server could not derive one.
 */
export function totalsOfExam(exam: MyResultExam): ExamTotals {
  const obtained = exam.subjects.reduce((sum, s) => sum + s.marks, 0)
  const max = exam.subjects.reduce((sum, s) => sum + s.totalMarks, 0)
  return { obtained, max, pct: exam.pct ?? pctOf(obtained, max) }
}

/** Percentage of one subject row (server marks/totalMarks). */
export function pctOfSubject(s: MyResultSubject): number {
  return pctOf(s.marks, s.totalMarks)
}

/* ── Labels ────────────────────────────────────────────────────────── */

/** Compact x-axis label for a trend point ("Mid-Term Examination" → "Mid-Term Exam"). */
export function shortExamLabel(name: string): string {
  return name
    .replace(/^Unit Test/, 'UT')
    .replace(/Examination$/, 'Exam')
    .trim()
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "08 Sep 2026" from an ISO date/datetime string. */
export function shortDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''} ${iso.slice(0, 4)}`
}

/** "Jan 8" from an ISO date/datetime string (selector chips). */
export function monthDay(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''} ${Number(iso.slice(8, 10))}`
}

/** "8 September 2026" from an ISO date/datetime string. */
export function fullDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MONTHS_FULL[Number(iso.slice(5, 7)) - 1] ?? ''} ${iso.slice(0, 4)}`
}

/* ── Ordering — the hook returns latest-declared-first ─────────────── */

/** Chronological view of the exams array (oldest declared → latest). */
export function chronological(exams: MyResultExam[]): MyResultExam[] {
  return [...exams].reverse()
}

/* ── Trend point (built from the server exams, chronological) ──────── */

export interface TrendPoint {
  examId: string
  label: string
  fullLabel: string
  pct: number
  grade: string
}

/**
 * Trend points from the declared exams — chronological, only exams that
 * actually carry a percentage. One exam ⇒ one point ⇒ the Trend section
 * degrades to its honest "need more assessments" message (no fabricated
 * history).
 */
export function trendPointsOf(exams: MyResultExam[], scale: GradeBand[]): TrendPoint[] {
  return chronological(exams)
    .filter((e) => e.subjects.length > 0 && e.pct != null)
    .map((e) => ({
      examId: e.examId,
      label: shortExamLabel(e.examName),
      fullLabel: e.examName,
      pct: e.pct as number,
      grade: gradeForPct(e.pct as number, scale),
    }))
}

/* ── Exam-type visual keys (crest/colour identities, fallback-safe) ── */

/** Known exam types with a dedicated visual identity. */
export type KnownExamType = 'Unit Test' | 'Mid Term' | 'Final'

/**
 * The server's Exam.type is a free string — map it onto the known visual
 * identities, falling back to the Unit-Test treatment for anything the
 * workspace does not have a dedicated crest for.
 */
export function typeKey(type: string): KnownExamType {
  const t = type.trim().toLowerCase()
  if (t === 'mid term' || t === 'mid-term' || t === 'midterm') return 'Mid Term'
  if (t === 'final' || t === 'final exam' || t === 'final examination') return 'Final'
  return 'Unit Test'
}
