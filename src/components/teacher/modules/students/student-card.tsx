'use client'

/**
 * students/student-card — one student in the directory roster.
 *
 * ARCHITECTURE (responsive redesign): the card is a fixed three-band
 * structure so every card in a grid row renders with identical rhythm:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [Avatar]  Name ············ ✂  [At Risk]     │  identity band
 *   │           Roll 18 · Grade 9 - A              │
 *   │           Adm ADM-2024-018                   │
 *   ├──────────────────────────────────────────────┤
 *   │ ATTENDANCE │ LATEST AVG │ GROWTH │ FEES       │  metric band —
 *   │ 95%        │ 84%        │ 82 ↑   │ [Fees clr]│  equal CSS-grid
 *   │ 65 records │ PA · Mar 25│ +6 mo  │ 1 fee line│  columns divided
 *   ├──────────────────────────────────────────────┤  by hairlines
 *   │ 👤 Sharma Family        View profile →       │  footer band
 *   └──────────────────────────────────────────────┘
 *
 * The growth cell (§15) is a VERY small indicator — score + trend glyph
 * — never a dashboard. The grid guarantees ≥64px per cell at the card
 * minimum (300px / 4 columns with fees, / 3 without), and every label
 * truncates structurally.
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
 * The grid that sizes this card (./students-grid) guarantees a minimum
 * card width of 300px via minmax(), so the 4-column metric band never
 * drops below ~64px per cell — every label truncates structurally, so
 * even the widest ("ATTENDANCE" ≈ 68px at 10px semibold) cannot overflow.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, TrendingUp, User, Wallet } from 'lucide-react'
import { GradientAvatar, StatusBadge } from '@/components/shared/ui'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/format'
import {
  FEE_STATUS_META,
  attendanceToneClass,
  averageToneClass,
  feeShortLabel,
  statusOf,
} from './shared'
import type { DirectoryStudent } from './types'

/** One metric cell — LABEL / VALUE / SUPPORTING, overflow-proof at any
 *  cell width: every text line truncates, the value row has a fixed
 *  min-height (chip values and numeric values render the same height). */
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
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{supporting}</p>
    </div>
  )
}

export function StudentCard({
  student: s,
  index,
  onSelect,
}: {
  student: DirectoryStudent
  index: number
  onSelect: (s: DirectoryStudent) => void
}) {
  const reduce = useReducedMotion()
  const status = statusOf(s)
  const att = s.attendance.pct
  const avg = s.latestExam?.averagePct ?? null
  // Fee data exists ONLY for classes the signed-in teacher is class
  // teacher of — the server never sends it for subject-only classes,
  // so the third metric column simply does not exist in that view.
  const fees = s.fees

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
        <GradientAvatar name={s.name} size="lg" />
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
          fees ? 'grid-cols-4' : 'grid-cols-3',
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
          supporting={s.attendance.records > 0 ? `${s.attendance.records} records` : 'No records yet'}
        />
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
          supporting={s.latestExam ? s.latestExam.examName : 'No marks yet'}
        />
        {/* growth — a VERY small indicator (§15): score + this-month trend */}
        <MetricCell
          label={
            <span className="flex items-center gap-1">
              <TrendingUp className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              Growth
            </span>
          }
          value={
            <span
              className={cn(
                'font-display text-lg font-bold leading-none tabular-nums',
                s.growth?.score == null
                  ? 'text-muted-foreground/60'
                  : s.growth.score >= 75
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : s.growth.score >= 55
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400',
              )}
            >
              {s.growth?.score ?? '—'}
            </span>
          }
          supporting={
            s.growth?.score == null
              ? 'Building'
              : s.growth.monthDelta > 0
            ? `↑ +${s.growth.monthDelta} this month`
            : s.growth.monthDelta < 0
              ? `↓ ${s.growth.monthDelta} this month`
              : 'Holding steady'
          }
        />
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
                : fees.items.length > 0
                  ? `${fees.items.length} fee line${fees.items.length === 1 ? '' : 's'}`
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
