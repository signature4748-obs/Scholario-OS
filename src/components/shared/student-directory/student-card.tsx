'use client'

/**
 * shared/student-directory/student-card — the ONE student directory card
 * (Task W3-a). Every surface that lists students — the Teacher portal's
 * roster and the Principal's directory / class-details grids — renders
 * this exact three-band card, mapped to the role-agnostic
 * `StudentCardData` DTO:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [Avatar]  Name ············ ✂  [At Risk]     │  identity band
 *   │           Roll 18 · Grade 9 - A              │
 *   │           Adm ADM-2024-018                   │
 *   ├──────────────────────────────────────────────┤
 *   │ ATTENDANCE │ LATEST AVG │ FEES               │  metric band —
 *   │ 95%        │ 84%        │ [Fees clear]       │  equal CSS-grid
 *   │ 65 records │ PA · Mar 25│ 1 fee line         │  columns divided
 *   ├──────────────────────────────────────────────┤  by hairlines
 *   │ 👤 Sharma Family        View profile →       │  footer band
 *   └──────────────────────────────────────────────┘
 *
 * ROLE-SCOPED COLUMNS (one card, honest per-role data):
 *   · FEES      `student.fees === null` ⇒ the fee column does not exist
 *     (a subject-only teacher never receives fee data). No tinted empty
 *     boxes — an omitted column, like an omitted status badge.
 *   · LATEST AVG rendered when marks exist OR no fee column exists (the
 *     teacher roster always carries the academics column). It is omitted
 *     only when there is no exam data AND fees are present — the
 *     principal store (which has no exam data) then shows two honest
 *     columns, Attendance + Fees, instead of a permanent "—".
 *   · ATTENDANCE supporting line shows the record count only when the
 *     caller knows it (`records !== null`); sources without a count
 *     (the principal store) render no supporting line at all.
 *
 * COLLISION-SAFETY — every rule is structural, never cosmetic:
 *   · NAME ✕ BADGE   name is min-w-0 + flex-1 + truncate, the badge is
 *     shrink-0 with a gap between — a long name ("Alexandria Johnson
 *     Kumar" → "Alexandria Johnson…") can never push, overlap or wrap
 *     under the badge, and the badge can never leave the card.
 *   · METRIC CELLS   min-w-0 grid columns; label AND supporting line
 *     truncate; the fee value is a max-w-full chip whose label also
 *     truncates — "Fees clear" / "₹5,400 due" / "Overdue" can never
 *     escape their column, and no padding is wasted on tinted boxes
 *     (hairline dividers keep 100% of each cell usable).
 *   · EQUAL HEIGHTS  the value row carries a fixed min-height so chip
 *     values and numeric values produce the same band height; every
 *     text line is single-line-by-design (truncate), so all cards in a
 *     row align without forcing any fixed card height.
 *   · FOOTER         guardian truncates against a shrink-0
 *     "View profile" affordance; the arrow nudges on hover and can
 *     never be pushed outside the card.
 *
 * The grids that size this card (teacher students-grid, principal
 * directory / class-details) guarantee a minimum card width of 300px via
 * minmax(min(100%,300px),1fr), so the 3-column metric band never drops
 * below ~77px per cell — comfortably above the widest label
 * ("ATTENDANCE" ≈ 68px at 10px semibold).
 */

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, User, Wallet } from 'lucide-react'
import { GradientAvatar, StatusBadge } from '@/components/shared/ui'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/format'

// ─── status thresholds (the single source of truth) ─────────────────────
//
//   AT RISK   attendance < 75%  OR  latest exam average < 40%
//             — each metric only counts when it exists; a student with
//               no attendance records AND no exam marks carries NO status
//               (never a false "At Risk").
//   STEADY    at least one metric exists and neither At Risk rule trips.
//   Top Attendance: attendance ≥ 95%.
//
// These mirror the school-report convention (75% attendance minimum,
// 40% pass line) and are the same numbers the summary cards and the
// teacher profile sheet use — change them here only.

export const AT_RISK_ATTENDANCE_PCT = 75
export const AT_RISK_AVERAGE_PCT = 40
export const TOP_ATTENDANCE_PCT = 95

// ─── fee status presentation (single palette used everywhere) ───────────

export type FeeStatusKey = 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'NONE'

/** Chip classes for one fee status — the single palette used everywhere. */
export const FEE_STATUS_META: Record<FeeStatusKey, { label: string; chip: string; value: string }> = {
  PAID: {
    label: 'Fees clear',
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-600 dark:text-emerald-400',
  },
  PARTIAL: {
    label: 'Partially paid',
    chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    value: 'text-amber-600 dark:text-amber-400',
  },
  UNPAID: {
    label: 'Unpaid',
    chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    value: 'text-amber-600 dark:text-amber-400',
  },
  OVERDUE: {
    label: 'Overdue',
    chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    value: 'text-rose-600 dark:text-rose-400',
  },
  NONE: {
    label: 'No fees',
    chip: 'bg-muted text-muted-foreground',
    value: 'text-muted-foreground',
  },
}

/** The one-line fee label for a student chip (amount only when owed). */
export function feeShortLabel(status: FeeStatusKey, outstanding: number): string {
  if (status === 'PAID') return 'Fees clear'
  if (status === 'NONE') return 'No fees'
  if (status === 'OVERDUE') return `Overdue`
  return `₹${outstanding.toLocaleString('en-IN')} due`
}

/** Tone class for an attendance percentage value. */
export function attendanceToneClass(pct: number | null): string {
  if (pct == null) return 'text-muted-foreground'
  if (pct < AT_RISK_ATTENDANCE_PCT) return 'text-rose-600 dark:text-rose-400'
  if (pct >= TOP_ATTENDANCE_PCT) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-foreground'
}

/** Tone class for a latest-exam average percentage value. */
export function averageToneClass(avgPct: number | null): string {
  if (avgPct == null) return 'text-muted-foreground'
  if (avgPct < AT_RISK_AVERAGE_PCT) return 'text-rose-600 dark:text-rose-400'
  return 'text-foreground'
}

// ─── the card DTO ────────────────────────────────────────────────────────

/** Fee picture of one student — the role-scoped third metric column. */
export interface StudentCardFeeData {
  status: FeeStatusKey
  outstanding: number
  itemCount: number
}

/** The role-agnostic student DTO every directory surface maps into. */
export interface StudentCardData {
  id: string
  name: string
  /** pre-computed initials (store avatar); omitted ⇒ derived from the name */
  initials?: string
  classLabel: string
  rollNo: string | null
  admissionNo: string | null
  /** `records: null` ⇒ the caller has no count; no supporting line renders */
  attendance: { pct: number | null; records: number | null }
  /** null ⇒ no exam data on record for this student */
  latestAvg: { pct: number; examName: string } | null
  /** null ⇒ fee column omitted (role/permission-scoped) */
  fees: StudentCardFeeData | null
  guardianName: string | null
  status: { key: 'at-risk' | 'steady'; label: string } | null
}

/** One metric cell — LABEL / VALUE / SUPPORTING, overflow-proof at any
 *  cell width: every text line truncates, the value row has a fixed
 *  min-height (chip values and numeric values render the same height).
 *  An empty `supporting` renders nothing (sources without a count). */
function MetricCell({
  label,
  value,
  supporting,
}: {
  label: React.ReactNode
  value: React.ReactNode
  supporting: string
}) {
  return (
    <div className="min-w-0 [&:not(:first-child)]:pl-3">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex min-h-[26px] min-w-0 items-center">{value}</div>
      {supporting && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{supporting}</p>}
    </div>
  )
}

export function StudentCard({
  student: s,
  index,
  onSelect,
}: {
  student: StudentCardData
  index: number
  onSelect: (s: StudentCardData) => void
}) {
  const reduce = useReducedMotion()
  const status = s.status
  const att = s.attendance.pct
  const avg = s.latestAvg?.pct ?? null
  // Fee data exists ONLY where the signed-in role is authorized for it —
  // a null simply removes the third metric column (see file header).
  const fees = s.fees
  // Latest Avg column: rendered when marks exist OR no fee column exists
  // (the teacher roster always shows academics); omitted only when there
  // is no exam data AND fees are present (two honest columns, not a
  // permanent "—").
  const showAvg = s.latestAvg != null || fees == null

  return (
    <motion.button
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.24), duration: 0.3 }}
      whileHover={reduce ? undefined : { y: -2 }}
      onClick={() => onSelect(s)}
      aria-label={`View ${s.name}'s profile`}
      className="group flex flex-col rounded-xl border border-border bg-card/60 p-4 text-left transition-all hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:p-5"
    >
      {/* ── identity band ─────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <GradientAvatar name={s.name} initials={s.initials} size="lg" />
        <div className="min-w-0 flex-1">
          {/* name + status badge: the name truncates, the badge cannot move */}
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug transition-colors group-hover:text-primary">
              {s.name}
            </p>
            {status && (
              <StatusBadge
                status={status.label}
                variant={status.key === 'at-risk' ? 'danger' : 'success'}
                dot
                className="shrink-0 gap-1 px-2 py-0.5 text-[10px] leading-4"
              />
            )}
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            Roll {s.rollNo ?? '—'} · {s.classLabel}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            Adm {s.admissionNo ?? '—'}
          </p>
        </div>
      </div>

      {/* ── metric band — equal grid columns, hairline dividers ───── */}
      <div
        className={cn(
          'mt-4 grid divide-x divide-border border-t border-border pt-3.5',
          fees ? (showAvg ? 'grid-cols-3' : 'grid-cols-2') : 'grid-cols-2',
        )}
      >
        <MetricCell
          label="Attendance"
          value={
            <span
              className={cn(
                'font-display text-lg font-bold leading-none tabular-nums',
                attendanceToneClass(att),
              )}
            >
              {att != null ? `${att}%` : '—'}
            </span>
          }
          supporting={
            s.attendance.records == null
              ? ''
              : s.attendance.records > 0
                ? `${s.attendance.records} records`
                : 'No records yet'
          }
        />
        {showAvg && (
          <MetricCell
            label="Latest Avg"
            value={
              <span
                className={cn(
                  'font-display text-lg font-bold leading-none tabular-nums',
                  averageToneClass(avg),
                )}
              >
                {avg != null ? `${avg}%` : '—'}
              </span>
            }
            supporting={s.latestAvg ? s.latestAvg.examName : 'No marks yet'}
          />
        )}
        {fees && (
          <MetricCell
            label={
              <span className="flex items-center gap-1">
                <Wallet className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                Fees
              </span>
            }
            value={
              <span
                className={cn(
                  'inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-snug',
                  FEE_STATUS_META[fees.status].chip,
                )}
              >
                <span className="min-w-0 truncate">
                  {feeShortLabel(fees.status, fees.outstanding)}
                </span>
              </span>
            }
            supporting={
              fees.status === 'OVERDUE'
                ? `${formatINR(fees.outstanding, true)} outstanding`
                : fees.itemCount > 0
                  ? `${fees.itemCount} fee line${fees.itemCount === 1 ? '' : 's'}`
                  : 'No fees on record'
            }
          />
        )}
      </div>

      {/* ── footer band — guardian + profile affordance ───────────── */}
      <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <User className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{s.guardianName ?? 'Guardian not recorded'}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary">
          View profile
          <ArrowRight
            className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </motion.button>
  )
}
