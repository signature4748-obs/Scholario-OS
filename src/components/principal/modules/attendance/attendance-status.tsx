'use client'

/**
 * attendance-status — universal status system for the Attendance module.
 *
 * The SAME semantic language is used everywhere:
 *   - Student attendance (Overview rosters)
 *   - History records
 *   - (Staff tab: currently an honest empty state — no data configured)
 *
 * Provides:
 *   - STATUS_META: status → label, color, bg, text, border, icon, dot
 *   - UNMARKED_META + metaFor(): honest "no row yet" state for rosters
 *   - StatusBadge: inline badge with icon + text
 *   - StatusDot: tiny colored dot
 *
 * Always icon + text + color (never color alone).
 */

import {
  Check, Clock, X, Coffee, Minus,
  type LucideIcon,
} from 'lucide-react'
import { ATTENDANCE_PALETTE } from './attendance-charts'
import type { AttendanceStatus, RosterStatus } from './data'

export interface StatusMeta {
  label: string
  /** Semantic color (oklch string) — used for inline styles (dots, bars). */
  color: string
  /** Tailwind bg class for soft tinted backgrounds (10% opacity). */
  bg: string
  /** Tailwind text class (semantic color). */
  text: string
  /** Tailwind border class (30% opacity). */
  border: string
  /** Tailwind bg class for stronger filled state (selected buttons). */
  bgFilled: string
  /** Lucide icon component. */
  icon: LucideIcon
}

export const STATUS_META: Record<AttendanceStatus, StatusMeta> = {
  present: {
    label: 'Present',
    color: ATTENDANCE_PALETTE.present,
    bg: 'bg-emerald-500/10',
    bgFilled: 'bg-emerald-500 hover:bg-emerald-600',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    icon: Check,
  },
  late: {
    label: 'Late',
    color: ATTENDANCE_PALETTE.late,
    bg: 'bg-amber-500/10',
    bgFilled: 'bg-amber-500 hover:bg-amber-600',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500/30',
    icon: Clock,
  },
  absent: {
    label: 'Absent',
    color: ATTENDANCE_PALETTE.absent,
    bg: 'bg-rose-500/10',
    bgFilled: 'bg-rose-500 hover:bg-rose-600',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-500/30',
    icon: X,
  },
  leave: {
    label: 'Leave',
    color: ATTENDANCE_PALETTE.leave,
    bg: 'bg-sky-500/10',
    bgFilled: 'bg-sky-500 hover:bg-sky-600',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-500/30',
    icon: Coffee,
  },
}

/** Honest "no Attendance row for this student on this day" state. */
export const UNMARKED_META: StatusMeta = {
  label: 'Not marked',
  color: 'var(--muted-foreground)',
  bg: 'bg-muted/50',
  bgFilled: 'bg-muted hover:bg-muted/80',
  text: 'text-muted-foreground',
  border: 'border-border',
  icon: Minus,
}

export const STATUS_ORDER: AttendanceStatus[] = ['present', 'late', 'absent', 'leave']

/** StatusMeta for a roster status — including the null ("not marked") case. */
export function metaFor(status: RosterStatus): StatusMeta {
  return status === null ? UNMARKED_META : STATUS_META[status]
}

/* ──────────────────────────────────────────────────────────
   StatusBadge — inline badge with icon + text
   ────────────────────────────────────────────────────────── */
export function StatusBadge({
  status,
  size = 'sm',
  showIcon = true,
}: {
  status: AttendanceStatus | 'unmarked'
  size?: 'xs' | 'sm'
  showIcon?: boolean
}) {
  const meta = status === 'unmarked' ? UNMARKED_META : STATUS_META[status]
  const Icon = meta.icon
  const sizeCls = size === 'xs'
    ? 'text-[9px] px-1.5 py-0'
    : 'text-[10px] px-2 py-0.5'
  const iconSize = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${meta.bg} ${meta.border} ${meta.text} ${sizeCls}`}>
      {showIcon && <Icon className={iconSize} />}
      {meta.label}
    </span>
  )
}

/* ──────────────────────────────────────────────────────────
   StatusDot — tiny colored dot (compact lists)
   ────────────────────────────────────────────────────────── */
export function StatusDot({ status, className }: { status: AttendanceStatus | 'unmarked'; className?: string }) {
  const meta = status === 'unmarked' ? UNMARKED_META : STATUS_META[status]
  return <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${className}`} style={{ background: meta.color }} />
}
