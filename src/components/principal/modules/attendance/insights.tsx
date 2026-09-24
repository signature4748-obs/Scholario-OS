'use client'

/**
 * AttendanceInsights — derived insight cards + Live Class Snapshot.
 *
 * Everything here derives from the canonical snapshot for the selected
 * date: best/needs-attention classes come from `byClass` (only classes
 * that actually have Attendance rows), the school average from
 * `summary`. When nothing is recorded, the cards collapse to honest
 * '—' states — never fabricated numbers.
 *
 * Live Class Snapshot is context-aware:
 *   - All Classes → LIVE CLASS OVERVIEW (top classes by real rate)
 *   - Specific class → that class's REAL roster with per-student status
 *     (clicking a student opens their canonical history drill)
 */

import { motion, useReducedMotion } from 'framer-motion'
import { TrendingUp, UserX, CalendarCheck, UserCheck, ArrowRight } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { Badge } from '@/components/ui/badge'
import {
  formatDateLabel,
  type ClassBreakdown,
  type ClassSectionSnapshot,
  type AttendanceSummary,
  type RosterEntry,
} from './data'
import { ATTENDANCE_PALETTE } from './attendance-charts'
import { metaFor } from './attendance-status'

export function AttendanceInsights({
  byClass,
  sections,
  summary,
  date,
  classFilter,
  onViewAllClasses,
  onStudentClick,
}: {
  byClass: ClassBreakdown[]
  sections: ClassSectionSnapshot[]
  summary: AttendanceSummary
  date: string
  classFilter: string
  onViewAllClasses?: () => void
  onStudentClick?: (entry: RosterEntry) => void
}) {
  const totalStudents = byClass.reduce((s, c) => s + c.students, 0)
  const rated = byClass.filter((c) => c.rate !== null)
  const best = rated.length > 0
    ? rated.reduce((a, b) => ((b.rate ?? 0) > (a.rate ?? 0) ? b : a))
    : null
  const needs = rated.length > 1
    ? rated.reduce((a, b) => ((b.rate ?? 0) < (a.rate ?? 0) ? b : a))
    : null
  const hasDayData = summary.recorded > 0

  const section = sections.find((s) => s.classId === classFilter) ?? null

  return (
    <>
      {/* Three compact insight cards — derived from real data only */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <InsightCard
          icon={<TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          title="Best Performing Class"
          value={best ? best.classLabel : '—'}
          rate={best?.rate ?? null}
          color={ATTENDANCE_PALETTE.present}
          sub={best
            ? `${best.rate}% · ${best.recorded} recorded of ${best.students} students`
            : `No class recorded on ${formatDateLabel(date)}`}
        />
        <InsightCard
          icon={<UserX className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
          title="Needs Attention"
          value={needs ? needs.classLabel : '—'}
          rate={needs?.rate ?? null}
          color={ATTENDANCE_PALETTE.absent}
          sub={needs
            ? `${needs.rate}% · ${needs.recorded} recorded of ${needs.students} students`
            : rated.length === 1
            ? 'Only one class recorded for this date'
            : 'No class recorded for this date'}
        />
        <InsightCard
          icon={<CalendarCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
          title="School Average"
          value={hasDayData ? `${summary.rate}%` : '—'}
          rate={hasDayData ? summary.rate : null}
          color={ATTENDANCE_PALETTE.late}
          sub={`${byClass.length} classes · ${totalStudents} students · ${formatDateLabel(date)}`}
        />
      </div>

      {/* Live Class Snapshot — context-aware */}
      {classFilter === 'all' ? (
        <LiveClassOverview byClass={byClass} onViewAll={onViewAllClasses} date={date} />
      ) : (
        <LiveClassRoster section={section} byClass={byClass} date={date} onStudentClick={onStudentClick} />
      )}
    </>
  )
}

/* ──────────────────────────────────────────────────────────
   InsightCard — compact card with thin micro-progress
   ────────────────────────────────────────────────────────── */
function InsightCard({
  icon, title, value, rate, color, sub,
}: {
  icon: React.ReactNode
  title: string
  value: string
  rate: number | null
  color: string
  sub: string
}) {
  const reduce = useReducedMotion()
  return (
    <GlassCard className="p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{title}</h4>
      </div>
      <div className="flex items-end justify-between gap-2 mb-2.5">
        <p className="font-display text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">{value}</p>
        {rate !== null && (
          <span className="font-display text-sm font-bold tabular-nums shrink-0" style={{ color }}>{rate}%</span>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mb-2 truncate">{sub}</p>
      <div className="h-1 rounded-full bg-muted/60 overflow-hidden">
        <motion.div
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${rate ?? 0}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </GlassCard>
  )
}

/* ──────────────────────────────────────────────────────────
   LiveClassOverview — top classes by REAL rate for the date
   ────────────────────────────────────────────────────────── */
function LiveClassOverview({
  byClass, onViewAll, date,
}: {
  byClass: ClassBreakdown[]
  onViewAll?: () => void
  date: string
}) {
  const reduce = useReducedMotion()
  const rated = byClass.filter((c) => c.rate !== null)
  const topClasses = [...rated].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)).slice(0, 6)

  if (rated.length === 0) {
    return (
      <GlassCard className="p-3 sm:p-4 lg:p-5">
        <div className="flex items-center gap-2 mb-2">
          <UserCheck className="h-4 w-4 text-primary shrink-0" />
          <h3 className="font-semibold text-sm">Live Class Overview</h3>
        </div>
        <p className="text-xs text-muted-foreground text-center py-8">
          No class has attendance recorded for {formatDateLabel(date)} yet.
        </p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-3 sm:p-4 lg:p-5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary shrink-0" />
            Live Class Overview
          </h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            Top {topClasses.length} classes by attendance rate · {formatDateLabel(date)}
          </p>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-[11px] font-semibold text-primary hover:underline underline-offset-2 flex items-center gap-1 transition-colors"
          >
            View all classes
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {topClasses.map((s, i) => (
          <motion.div
            key={s.classId}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.3 }}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{s.classLabel}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {s.recorded} of {s.students} students recorded
                </p>
              </div>
              <span className="font-display text-sm font-bold tabular-nums" style={{
                color: (s.rate ?? 0) >= 95 ? ATTENDANCE_PALETTE.present
                  : (s.rate ?? 0) >= 90 ? ATTENDANCE_PALETTE.late
                  : ATTENDANCE_PALETTE.absent,
              }}>
                {s.rate}%
              </span>
            </div>
            <div className="h-1 rounded-full bg-muted/60 overflow-hidden mb-2">
              <motion.div
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${s.rate ?? 0}%` }}
                transition={{ duration: 0.6, delay: Math.min(i * 0.05, 0.3) + 0.1 }}
                className="h-full rounded-full"
                style={{
                  background: (s.rate ?? 0) >= 95 ? ATTENDANCE_PALETTE.present
                    : (s.rate ?? 0) >= 90 ? ATTENDANCE_PALETTE.late
                    : ATTENDANCE_PALETTE.absent,
                }}
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span><span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{s.present}</span> present</span>
              <span className="text-muted-foreground/40">·</span>
              <span><span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{s.late}</span> late</span>
              <span className="text-muted-foreground/40">·</span>
              <span><span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">{s.absent}</span> absent</span>
              <span className="text-muted-foreground/40">·</span>
              <span><span className="font-semibold text-sky-600 dark:text-sky-400 tabular-nums">{s.leave}</span> leave</span>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  )
}

/* ──────────────────────────────────────────────────────────
   LiveClassRoster — the class's REAL roster for the date,
   with per-student status (click → canonical history drill)
   ────────────────────────────────────────────────────────── */
function LiveClassRoster({
  section, byClass, date, onStudentClick,
}: {
  section: ClassSectionSnapshot | null
  byClass: ClassBreakdown[]
  date: string
  onStudentClick?: (entry: RosterEntry) => void
}) {
  const reduce = useReducedMotion()

  if (!section) {
    return (
      <GlassCard className="p-3 sm:p-4 lg:p-5">
        <p className="text-xs text-muted-foreground text-center py-8">
          No roster available for this class.
        </p>
      </GlassCard>
    )
  }

  const breakdown = byClass.find((c) => c.classId === section.classId)
  const counts = { present: 0, late: 0, absent: 0, leave: 0, unmarked: 0 }
  for (const s of section.roster) {
    if (s.status === 'PRESENT') counts.present++
    else if (s.status === 'LATE') counts.late++
    else if (s.status === 'ABSENT') counts.absent++
    else if (s.status === 'LEAVE') counts.leave++
    else counts.unmarked++
  }
  const rate = breakdown?.rate ?? null

  return (
    <GlassCard className="p-3 sm:p-4 lg:p-5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary shrink-0" />
            Live Class Snapshot — {section.classLabel}
          </h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            {formatDateLabel(date)} · {section.roster.length} students · tap a tile for history
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-[10px] flex-wrap">
            <StatusPill label="Present" count={counts.present} status="present" />
            <StatusPill label="Late" count={counts.late} status="late" />
            <StatusPill label="Absent" count={counts.absent} status="absent" />
            <StatusPill label="Leave" count={counts.leave} status="leave" />
            {counts.unmarked > 0 && <StatusPill label="Not marked" count={counts.unmarked} status="unmarked" />}
          </div>
          {rate !== null && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold">
              {rate}% present
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-1.5 sm:gap-2">
        {section.roster.map((s, i) => {
          const meta = metaFor(
            s.status === 'PRESENT' ? 'present'
              : s.status === 'LATE' ? 'late'
              : s.status === 'ABSENT' ? 'absent'
              : s.status === 'LEAVE' ? 'leave'
              : null,
          )
          return (
            <motion.button
              key={`${s.studentId}-${i}`}
              type="button"
              initial={reduce ? false : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.3 }}
              whileHover={!reduce ? { scale: 1.04, y: -1 } : undefined}
              onClick={() => onStudentClick?.(s)}
              title={`${s.name} · Roll ${s.rollNo} · ${meta.label}`}
              aria-label={`${s.name}, roll ${s.rollNo}, ${meta.label}. View attendance history`}
              className={`rounded-lg border p-1.5 text-center transition-colors ${meta.bg} ${meta.border} ${meta.text} hover:brightness-105`}
            >
              <p className="text-[9px] font-mono opacity-70 tabular-nums">#{s.rollNo}</p>
              <p className="text-[10px] font-semibold truncate leading-tight mt-0.5">{s.name.split(' ')[0]}</p>
            </motion.button>
          )
        })}
      </div>
    </GlassCard>
  )
}

function StatusPill({
  label, count, status,
}: {
  label: string
  count: number
  status: 'present' | 'late' | 'absent' | 'leave' | 'unmarked'
}) {
  const meta = metaFor(
    status === 'unmarked' ? null : status,
  )
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${meta.bg} ${meta.border} ${meta.text}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      <span className="font-medium">{label}</span>
      <span className="font-bold tabular-nums">{count}</span>
    </span>
  )
}
