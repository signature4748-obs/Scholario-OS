/**
 * growth/shared — the shared DTO contract + client-safe config for the
 * Student Growth system (the Student Behavior redesign).
 *
 * Pure types + tiny config maps: NO server imports — safe for client
 * components. Server routes in /api/** serialize rows into these shapes;
 * frontend modules consume them verbatim.
 *
 * TERMINOLOGY (§1): the module is STUDENT GROWTH. Never "behavior score",
 * "discipline score" or "good student score" — the system tracks growth,
 * it does not judge students as people.
 */

// ---------- categories (§16 — small & meaningful, never 20+) ----------

export const GROWTH_CATEGORIES = [
  'ACADEMIC',
  'ATTENDANCE',
  'CONDUCT',
  'PARTICIPATION',
  'IMPROVEMENT',
  'CONSISTENCY',
] as const

export type GrowthCategory = (typeof GROWTH_CATEGORIES)[number]

export interface GrowthCategoryConfig {
  label: string
  /** tailwind text tone for chips/values */
  text: string
  /** tailwind bg for soft chips */
  chip: string
  /** solid dot colour for list accents */
  dot: string
}

export const GROWTH_CATEGORY_CONFIG: Record<GrowthCategory, GrowthCategoryConfig> = {
  ACADEMIC: {
    label: 'Academic',
    text: 'text-teal-700 dark:text-teal-300',
    chip: 'bg-teal-500/[0.08] border-teal-500/20',
    dot: 'bg-teal-500',
  },
  ATTENDANCE: {
    label: 'Attendance',
    text: 'text-sky-700 dark:text-sky-300',
    chip: 'bg-sky-500/[0.08] border-sky-500/20',
    dot: 'bg-sky-500',
  },
  CONDUCT: {
    label: 'Conduct',
    text: 'text-violet-700 dark:text-violet-300',
    chip: 'bg-violet-500/[0.08] border-violet-500/20',
    dot: 'bg-violet-500',
  },
  PARTICIPATION: {
    label: 'Participation',
    text: 'text-amber-700 dark:text-amber-300',
    chip: 'bg-amber-500/[0.08] border-amber-500/20',
    dot: 'bg-amber-500',
  },
  IMPROVEMENT: {
    label: 'Improvement',
    text: 'text-emerald-700 dark:text-emerald-300',
    chip: 'bg-emerald-500/[0.08] border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  CONSISTENCY: {
    label: 'Consistency',
    text: 'text-rose-700 dark:text-rose-300',
    chip: 'bg-rose-500/[0.08] border-rose-500/20',
    dot: 'bg-rose-500',
  },
}

export function isGrowthCategory(v: string): v is GrowthCategory {
  return (GROWTH_CATEGORIES as readonly string[]).includes(v)
}

export function growthCategoryOf(v: string): GrowthCategory {
  return isGrowthCategory(v) ? v : 'CONDUCT'
}

// ---------- sources (§28) ----------

export const GROWTH_SOURCES = ['MANUAL', 'ATTENDANCE', 'ACADEMIC'] as const
export type GrowthEventSource = (typeof GROWTH_SOURCES)[number]

export const SOURCE_LABELS: Record<GrowthEventSource, string> = {
  MANUAL: 'Manual',
  ATTENDANCE: 'Automatic',
  ACADEMIC: 'Automatic',
}

export function isAutomaticSource(s: string): boolean {
  return s === 'ATTENDANCE' || s === 'ACADEMIC'
}

// ---------- event DTO (the point ledger row) ----------

export type GrowthEventStatus = 'ACTIVE' | 'SUPERSEDED' | 'REVOKED'

export interface GrowthEventItem {
  id: string
  studentId: string
  studentName: string
  classLabel: string
  points: number
  category: GrowthCategory
  reason: string
  note: string | null
  source: GrowthEventSource
  sourceRef: string | null
  period: string | null
  status: GrowthEventStatus
  /** correction chain (§29) — set on correction events */
  correctsId: string | null
  correctionNote: string | null
  createdBy: { id: string; name: string } | null
  createdAt: string
  /** the date the event refers to (week end / exam date / manual moment) */
  effectiveAt: string
}

// ---------- score DTOs (§19 — normalized, never a lifetime sum) ----------

export interface GrowthDimension {
  category: GrowthCategory
  /** 0–100 subscore; null = not enough data (§21 — never invented) */
  value: number | null
  /** human hint for null values e.g. "No marks yet" */
  hint?: string
  /** for IMPROVEMENT — the exam-over-exam delta e.g. "+12" */
  deltaLabel?: string | null
}

export interface GrowthTrendPoint {
  /** week label e.g. "W38" or "18 Sep" */
  label: string
  /** score snapshot at week end; null = no data yet that week */
  value: number | null
}

export interface GrowthScoreDto {
  /** 0–100 normalized; null = building (fewer than 2 dimensions have data) */
  score: number | null
  /** net ledger points earned in the current calendar month */
  monthDelta: number
  /** net ledger points earned in the previous calendar month */
  prevMonthDelta: number
  dimensions: GrowthDimension[]
  /** last 8 complete weeks (oldest → newest) */
  trend: GrowthTrendPoint[]
  /** total ledger points (the raw ledger number, §19) */
  totalPoints: number
  /** count of ledger events */
  eventCount: number
}

/** Fee/Administrative standing (§23) — ALWAYS separate from growth. */
export type FeeStanding = 'FULLY_PAID' | 'DUE' | 'OVERDUE' | 'AWAITING_VERIFICATION' | 'NO_FEES'

export interface FeeStandingDto {
  standing: FeeStanding
  label: string
  /** one-line human explanation (never a judgment — administrative only) */
  detail: string
}

// ---------- manual quick-pick presets (§5/§34) ----------

export interface GrowthPreset {
  key: string
  label: string
  category: GrowthCategory
  points: number
}

export const DEFAULT_POSITIVE_PRESETS: GrowthPreset[] = [
  { key: 'manual_participation', label: 'Participation', category: 'PARTICIPATION', points: 2 },
  { key: 'manual_helping_others', label: 'Helping Others', category: 'CONDUCT', points: 2 },
  { key: 'manual_leadership', label: 'Leadership', category: 'PARTICIPATION', points: 3 },
  { key: 'manual_assignment', label: 'Consistent Work', category: 'ACADEMIC', points: 2 },
  { key: 'manual_good_conduct', label: 'Good Conduct', category: 'CONDUCT', points: 2 },
  { key: 'manual_improvement', label: 'Outstanding Improvement', category: 'IMPROVEMENT', points: 3 },
]

export const DEFAULT_NEGATIVE_PRESETS: GrowthPreset[] = [
  { key: 'manual_minor_concern', label: 'Minor Concern', category: 'CONDUCT', points: -1 },
  { key: 'manual_disruption', label: 'Repeated Disruption', category: 'CONDUCT', points: -2 },
  { key: 'manual_incomplete_work', label: 'Incomplete Work', category: 'ACADEMIC', points: -2 },
  { key: 'manual_lateness', label: 'Repeated Lateness', category: 'ATTENDANCE', points: -3 },
]

// ---------- settings DTO (§18) ----------

export interface GrowthSettingsDto {
  enabled: boolean
  negativeEnabled: boolean
  minManualPoints: number
  maxManualPoints: number
  customReasons: boolean
  studentVisibility: boolean
  feePunctualityPoints: boolean
}

// ---------- scope summaries ----------

export interface StudentGrowthSummary {
  studentId: string
  name: string
  classLabel: string
  score: number | null
  monthDelta: number
}

/** Classification for class/scope summaries (§14/§20 — supportive language). */
export type GrowthBand = 'IMPROVING' | 'STEADY' | 'NEEDS_ATTENTION' | 'BUILDING'

export const GROWTH_BAND_LABELS: Record<GrowthBand, string> = {
  IMPROVING: 'Improving',
  STEADY: 'Steady',
  NEEDS_ATTENTION: 'Needs attention',
  BUILDING: 'Building',
}

export function bandOf(score: number | null, monthDelta: number): GrowthBand {
  if (score == null) return 'BUILDING'
  if (score < 55 || monthDelta <= -4) return 'NEEDS_ATTENTION'
  if (monthDelta >= 3) return 'IMPROVING'
  return 'STEADY'
}

// ---------- the Growth workspace payload (module aggregate) ----------

export interface GrowthClassSummary {
  classId: string
  label: string
  isClassTeacher: boolean
  studentCount: number
  /** average score over students with data; null when none have data */
  average: number | null
  improving: number
  steady: number
  needsAttention: number
  building: number
  /** net ledger points across the class this calendar month */
  monthPoints: number
  /** this class's average weekly trend (last 8 complete weeks) */
  trend: GrowthTrendPoint[]
}

export interface GrowthScopeSummary {
  studentCount: number
  average: number | null
  improving: number
  steady: number
  needsAttention: number
  building: number
  /** net ledger points across the scope this calendar month */
  monthPoints: number
}

export interface GrowthWorkspacePayload {
  scopeLabel: string
  settings: GrowthSettingsDto
  presets: { positive: GrowthPreset[]; negative: GrowthPreset[] }
  classes: GrowthClassSummary[]
  /** students the teacher may award points to */
  students: { id: string; name: string; rollNo: string | null; classLabel: string; classId: string | null }[]
  events: GrowthEventItem[]
  summary: GrowthScopeSummary
  /** scope-average weekly trend (last 8 complete weeks) */
  trend: GrowthTrendPoint[]
}
