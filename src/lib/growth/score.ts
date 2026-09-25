/**
 * growth/score — the ONE transparent Growth Score computation (§19).
 *
 * PURE functions: no db import, no client/server coupling. The service
 * layer preloads canonical rows (Attendance, ExamMark, GrowthEvent) in
 * bulk and calls `computeGrowthScore`; every surface (Teacher Growth
 * module, shared student profile, Directory chips, My Class summary,
 * Principal profile) renders the SAME numbers.
 *
 * DESIGN PRINCIPLES (user spec):
 *   §19 Normalized 0–100 — NEVER a lifetime point sum (older students
 *      would naturally drift to huge scores). The raw point ledger and
 *      the normalized score are two different things.
 *   §21 Fairness — every dimension derives from REAL school records.
 *      Not enough data ⇒ the dimension is null and excluded — a score
 *      is never invented. Fewer than 2 dimensions ⇒ score null
 *      ("Building from attendance and academic records").
 *   §3  Family finances NEVER contribute (no fee input exists here).
 *   §6  LEAVE attendance is never penalized: eligible days are
 *      PRESENT + LATE + ABSENT; LEAVE is excluded from BOTH the
 *      numerator and the denominator (approved absence ≠ truancy).
 *   §16 Six dimensions: Academic, Attendance, Conduct, Participation,
 *      Consistency, Improvement.
 *
 * EXPLAINABILITY: the exact formula per dimension is documented below —
 * a teacher/principal can always answer "why did the score change?".
 */

import type {
  GrowthCategory,
  GrowthDimension,
  GrowthScoreDto,
  GrowthTrendPoint,
} from './shared'

// ── input rows (structurally typed — Prisma rows and fixtures both fit) ──

export interface GrowthAttRow {
  date: Date
  status: string
}

/** One completed exam's per-student average (built by buildExamAverages). */
export interface GrowthExamAvg {
  examId: string
  examName: string
  /** 0–100 average over subjects with finalized marks */
  avgPct: number
  /** the exam's effective date (startDate ?? createdAt) */
  endedAt: Date
}

export interface GrowthEventRow {
  category: string
  points: number
  effectiveAt: Date
}

export interface GrowthComputeInput {
  attendance: GrowthAttRow[]
  /** ordered chronologically (oldest → newest) by endedAt */
  exams: GrowthExamAvg[]
  /** ACTIVE growth events only (the service pre-filters) */
  events: GrowthEventRow[]
  now?: Date
}

// ── week helpers (ISO weeks, Monday–Sunday) ──────────────────────────────

/** Monday 00:00 of the week containing d. */
export function mondayOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

/** ISO week number (1–53). */
export function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

/** "2026-W38" — lexicographically ordered, safe as a period key. */
export function isoWeekKey(d: Date): string {
  return `${d.getFullYear()}-W${String(isoWeekNumber(d)).padStart(2, '0')}`
}

// ── dimension internals ──────────────────────────────────────────────────

/** PRESENT and LATE both count as attended; ABSENT breaks attendance;
 *  LEAVE (approved) is excluded from BOTH sides — never penalized (§6). */
function isEligibleDay(status: string): boolean {
  return status === 'PRESENT' || status === 'LATE' || status === 'ABSENT'
}
function isAttended(status: string): boolean {
  return status === 'PRESENT' || status === 'LATE'
}

const DAY_MS = 24 * 3600 * 1000
/** Point-signal events fade after 90 days — growth is about NOW. */
const EVENT_WINDOW_DAYS = 90

function netPointsIn(
  events: GrowthEventRow[],
  category: GrowthCategory,
  fromMs: number,
  toMs: number,
): { net: number; count: number } {
  let net = 0
  let count = 0
  for (const e of events) {
    if (e.category !== category) continue
    const t = e.effectiveAt.getTime()
    if (t < fromMs || t > toMs) continue
    net += e.points
    count++
  }
  return { net, count }
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v))

/** Small nudge so manual recognition/concerns move the score without
 *  overpowering real records: ±2 per point, capped at ±20. */
function nudgeOf(net: number): number {
  return Math.max(-20, Math.min(20, net * 2))
}

interface AttendanceWindowStats {
  pct: number | null
  eligible: number
  attended: number
  /** weeks (inside the window) with ≥3 eligible days → their pct */
  weeklyPcts: number[]
}

function attendanceWindow(rows: GrowthAttRow[], fromMs: number, toMs: number): AttendanceWindowStats {
  let eligible = 0
  let attended = 0
  const byWeek = new Map<string, { eligible: number; attended: number }>()
  for (const r of rows) {
    const t = r.date.getTime()
    if (t < fromMs || t > toMs) continue
    if (!isEligibleDay(r.status)) continue
    eligible++
    if (isAttended(r.status)) attended++
    const wk = isoWeekKey(r.date)
    const w = byWeek.get(wk) ?? { eligible: 0, attended: 0 }
    w.eligible++
    if (isAttended(r.status)) w.attended++
    byWeek.set(wk, w)
  }
  const weeklyPcts: number[] = []
  for (const w of byWeek.values()) {
    if (w.eligible >= 3) weeklyPcts.push(w.attended / w.eligible)
  }
  return {
    pct: eligible > 0 ? attended / eligible : null,
    eligible,
    attended,
    weeklyPcts,
  }
}

// ── the score (§19 — normalized, explainable, never invented) ───────────

/** Dimension weights — configurable later via GrowthRule params (§18).
 *  Refinement §2: progress is a first-class outcome — Improvement carries
 *  the same weight as Attendance, so Growth never collapses into "who
 *  has the highest marks" (a 55→72 riser outscores a static 95→96). */
const DIMENSION_WEIGHTS: Record<GrowthCategory, number> = {
  ACADEMIC: 0.25,
  ATTENDANCE: 0.2,
  IMPROVEMENT: 0.2,
  CONDUCT: 0.15,
  PARTICIPATION: 0.1,
  CONSISTENCY: 0.1,
}

export function computeGrowthDimensions(input: GrowthComputeInput): GrowthDimension[] {
  const now = input.now ?? new Date()
  const nowMs = now.getTime()
  const eventFrom = nowMs - EVENT_WINDOW_DAYS * DAY_MS
  const winFrom = nowMs - 8 * 7 * DAY_MS
  const att = attendanceWindow(input.attendance, winFrom, nowMs)

  // — Academic: the latest completed exam average is the primary signal;
  //   manual academic recognition nudges ±2/point (capped ±20). Without
  //   marks, recent academic events alone can carry a soft signal.
  const latestExam = input.exams.length > 0 ? input.exams[input.exams.length - 1] : null
  const academicNet = netPointsIn(input.events, 'ACADEMIC', eventFrom, nowMs)
  let academic: number | null = null
  if (latestExam) academic = clamp(latestExam.avgPct + nudgeOf(academicNet.net))
  else if (academicNet.count > 0) academic = clamp(60 + academicNet.net * 5)

  // — Attendance: trailing-8-week eligible attendance pct (LEAVE never
  //   penalized). Manual attendance points (e.g. repeated lateness)
  //   nudge; they never replace the record itself.
  const attNet = netPointsIn(input.events, 'ATTENDANCE', eventFrom, nowMs)
  let attendanceDim: number | null = null
  if (att.eligible >= 5) attendanceDim = clamp(Math.round(att.pct! * 100) + nudgeOf(attNet.net))
  else if (attNet.count > 0) attendanceDim = clamp(60 + attNet.net * 5)

  // — Conduct & Participation: pure point signal — neutral base 60,
  //   +5/−5 per point (90-day window). No events ⇒ null (excluded),
  //   never a fabricated judgment.
  const conductNet = netPointsIn(input.events, 'CONDUCT', eventFrom, nowMs)
  const conduct: number | null = conductNet.count > 0 ? clamp(60 + conductNet.net * 5) : null
  const partNet = netPointsIn(input.events, 'PARTICIPATION', eventFrom, nowMs)
  const participation: number | null = partNet.count > 0 ? clamp(60 + partNet.net * 5) : null

  // — Consistency: average attendance pct across FULL weeks (≥3 eligible
  //   days) in the trailing 8 weeks. Pure record — attendance variance
  //   the human can verify day by day.
  const consistency: number | null =
    att.weeklyPcts.length >= 2
      ? Math.round((att.weeklyPcts.reduce((s, p) => s + p, 0) / att.weeklyPcts.length) * 100)
      : null

  // — Improvement: exam-over-exam delta (the GROWTH signal — a student
  //   rising 58→72 is rewarded more than a static 92→94). +2.5 per point
  //   of delta around a neutral 50. Manual improvement recognition nudges.
  const improvementNet = netPointsIn(input.events, 'IMPROVEMENT', eventFrom, nowMs)
  let improvement: number | null = null
  let improvementDelta: number | null = null
  if (input.exams.length >= 2) {
    const prev = input.exams[input.exams.length - 2]
    const latest = input.exams[input.exams.length - 1]
    improvementDelta = Math.round(latest.avgPct - prev.avgPct)
    improvement = clamp(Math.round(50 + improvementDelta * 2.5 + nudgeOf(improvementNet.net)))
  } else if (improvementNet.count > 0) {
    improvement = clamp(60 + improvementNet.net * 5)
  }

  const dims: GrowthDimension[] = [
    {
      category: 'ACADEMIC',
      value: academic,
      hint: academic == null ? 'No exam marks yet' : undefined,
    },
    {
      category: 'ATTENDANCE',
      value: attendanceDim,
      hint: attendanceDim == null ? 'Needs 5+ attendance days' : undefined,
    },
    {
      category: 'CONDUCT',
      value: conduct,
      hint: conduct == null ? 'No conduct records yet' : undefined,
    },
    {
      category: 'PARTICIPATION',
      value: participation,
      hint: participation == null ? 'No participation records yet' : undefined,
    },
    {
      category: 'CONSISTENCY',
      value: consistency,
      hint: consistency == null ? 'Needs 2+ full weeks' : undefined,
    },
    {
      category: 'IMPROVEMENT',
      value: improvement,
      hint: improvement == null ? 'Needs two exams' : undefined,
      deltaLabel:
        improvementDelta != null
          ? `${improvementDelta >= 0 ? '+' : ''}${improvementDelta}`
          : null,
    },
  ]
  return dims
}

/** Weighted mean over the dimensions that have data; null when fewer
 *  than 2 dimensions carry data (§21 — "building", never invented).
 *  Refinement §1: the normalized score is ALWAYS clamped to 0–100 —
 *  every input dimension is already clamped, this is defense in depth
 *  so no future weight change can ever leak a raw-points-style value. */
export function overallScoreOf(dims: GrowthDimension[]): number | null {
  const available = dims.filter((d): d is GrowthDimension & { value: number } => d.value != null)
  if (available.length < 2) return null
  const totalWeight = available.reduce((s, d) => s + DIMENSION_WEIGHTS[d.category], 0)
  if (totalWeight <= 0) return null
  const weighted = available.reduce((s, d) => s + d.value * DIMENSION_WEIGHTS[d.category], 0)
  return Math.round(Math.max(0, Math.min(100, weighted / totalWeight)))
}

// ── the full profile: score + month deltas + 8-week trend + ledger sums ──

export function computeGrowthScore(input: GrowthComputeInput): GrowthScoreDto {
  const now = input.now ?? new Date()
  const dims = computeGrowthDimensions(input)
  const score = overallScoreOf(dims)

  // month attribution uses effectiveAt (what the event REFERS to), so a
  // weekly attendance event for the last week of August counts to August
  // even if the engine evaluated it on 1 September.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
  let monthDelta = 0
  let prevMonthDelta = 0
  let totalPoints = 0
  for (const e of input.events) {
    totalPoints += e.points
    const t = e.effectiveAt.getTime()
    if (t >= monthStart) monthDelta += e.points
    else if (t >= prevMonthStart) prevMonthDelta += e.points
  }

  // 8-week trend: the SAME formula evaluated with the data available at
  // each week's end — an honest historical line, not a projection.
  const trend: GrowthTrendPoint[] = []
  const currentMonday = mondayOfWeek(now)
  for (let i = 8; i >= 1; i--) {
    const weekStart = addDays(currentMonday, -7 * i)
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7, 0, 0, -1)
    const cutoff = Math.min(weekEnd.getTime(), now.getTime())
    if (cutoff >= now.getTime() && i > 0 && weekEnd.getTime() > now.getTime()) {
      // future week end (current week) — excluded: only COMPLETE weeks
      continue
    }
    const snapDims = computeGrowthDimensions({
      ...input,
      now: new Date(weekEnd.getTime() + 1),
    })
    trend.push({
      label: `W${isoWeekNumber(weekStart)}`,
      value: overallScoreOf(snapDims),
    })
  }

  return {
    score,
    monthDelta,
    prevMonthDelta,
    dimensions: dims,
    trend,
    totalPoints,
    eventCount: input.events.length,
  }
}

// ── exam averages from raw ExamMark rows (shared by engine + service) ────

export interface RawMarkRow {
  examId: string
  studentId: string
  subjectId: string
  marksObtained: number | null
  workflowStatus: string
  examName: string
  examStartDate: Date | null
  examCreatedAt: Date
  subjectName: string
}

/** Per-student, per-exam averages over FINALIZED marks (SUBMITTED /
 *  VERIFIED — DRAFT rows never influence growth). Exams are returned
 *  chronologically; exams with no finalized marks for a student are
 *  omitted for that student. */
export function buildExamAverages(
  rows: RawMarkRow[],
  maxMarksOf: (examId: string, subjectId: string) => number,
): Map<string, GrowthExamAvg[]> {
  // per student → per exam → subject pcts
  const byStudent = new Map<string, Map<string, { name: string; endedAt: Date; pcts: number[] }>>()
  for (const r of rows) {
    if (r.marksObtained == null) continue
    if (r.workflowStatus !== 'SUBMITTED' && r.workflowStatus !== 'VERIFIED') continue
    let byExam = byStudent.get(r.studentId)
    if (!byExam) {
      byExam = new Map()
      byStudent.set(r.studentId, byExam)
    }
    let ex = byExam.get(r.examId)
    if (!ex) {
      ex = {
        name: r.examName,
        endedAt: r.examStartDate ?? r.examCreatedAt,
        pcts: [],
      }
      byExam.set(r.examId, ex)
    }
    const max = maxMarksOf(r.examId, r.subjectId)
    if (max > 0) ex.pcts.push((r.marksObtained / max) * 100)
  }
  const out = new Map<string, GrowthExamAvg[]>()
  for (const [studentId, byExam] of byStudent) {
    const list = [...byExam.entries()]
      .map(([examId, ex]) => ({
        examId,
        examName: ex.name,
        endedAt: ex.endedAt,
        avgPct: Math.round(ex.pcts.reduce((s, p) => s + p, 0) / ex.pcts.length),
      }))
      .sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime())
    out.set(studentId, list)
  }
  return out
}
