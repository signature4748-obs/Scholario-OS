'use client'

/**
 * Attendance shared presentational pieces.
 *
 * CalendarLegend — compact color legend strip (real-rate bands + honest
 *   "no record" state + weekend/holiday geometry).
 * SelectedDayPanel — real per-day summary for the heatmap: shows the
 *   recorded rate/count when the day has Attendance rows, the honest
 *   "no record" state when it doesn't, and the holiday state.
 * StudentDrillDialog — per-student canonical history (?studentId= fetch)
 *   used by the Overview roster + History rows.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, CalendarOff, CalendarSearch } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Holiday } from '@/lib/mock/school-calendar'
import {
  useStudentDrill,
  formatDateLong,
  formatDateLabel,
} from './data'
import { metaFor } from './attendance-status'

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-muted-foreground pt-2.5 mt-2.5 border-t border-border">
      <span className="font-medium">Legend:</span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/85 border border-emerald-600" /> ≥95%
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400/60 border border-emerald-500" /> 90–94%
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-amber-400/70 border border-amber-500" /> 85–89%
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-rose-400/70 border border-rose-500" /> &lt;85%
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-muted/40 border border-border" /> No record
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-violet-500/15 border border-violet-500/40" /> Holiday
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-muted/40 border border-dashed border-border" /> Weekend
      </span>
    </div>
  )
}

/**
 * SelectedDayPanel — real summary for the picked heatmap day.
 *
 * `dayRecord` is the day's REAL aggregate from the snapshot's weekTrend
 * ({ rate, recorded }) or null when the school has no Attendance rows
 * for that day. Nothing is derived or fabricated here.
 */
export function SelectedDayPanel({
  selectedDay,
  dateStr,
  holiday,
  dayRecord,
  onViewFullAttendance,
}: {
  selectedDay: number
  dateStr: string
  holiday: Holiday | null
  dayRecord: { rate: number; recorded: number } | null
  onViewFullAttendance?: () => void
}) {
  const reduce = useReducedMotion()

  const dateLabel = formatDateLong(dateStr)

  // Holiday display — no attendance counts
  if (holiday) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 6, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/5 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-violet-500/20 bg-violet-500/5">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wider font-semibold text-violet-600 dark:text-violet-400">
              Selected Day · School Holiday
            </p>
            <p className="text-xs font-semibold text-foreground truncate">{dateLabel}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <CalendarOff className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
              {holiday.name}
            </span>
          </div>
        </div>
        <div className="px-3 py-2">
          <p className="text-[10px] text-muted-foreground italic">
            No attendance marked on school holidays.
          </p>
        </div>
      </motion.div>
    )
  }

  // Real recorded day
  if (dayRecord) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 6, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mt-3 rounded-lg border border-primary/30 bg-primary/5 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-primary/20 bg-primary/5">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wider font-semibold text-primary">Selected Day</p>
            <p className="text-xs font-semibold text-foreground truncate">{dateLabel}</p>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-display text-2xl font-bold tabular-nums text-primary">{dayRecord.rate}%</span>
            <span className="text-[10px] text-muted-foreground">attendance</span>
          </div>
        </div>
        <div className="px-3 py-2 border-t border-primary/10">
          <p className="text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{dayRecord.recorded}</span>{' '}
            attendance {dayRecord.recorded === 1 ? 'row' : 'rows'} recorded this day.
          </p>
          {onViewFullAttendance && (
            <button
              onClick={onViewFullAttendance}
              className="mt-1 text-[11px] font-semibold text-primary hover:underline underline-offset-2 flex items-center gap-1 transition-colors"
            >
              View full attendance
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  // Working day with no Attendance rows — honest state
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mt-3 rounded-lg border border-border bg-muted/30 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border/60">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Selected Day</p>
          <p className="text-xs font-semibold text-foreground truncate">{dateLabel}</p>
        </div>
        <CalendarSearch className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
      <div className="px-3 py-2">
        <p className="text-[10px] text-muted-foreground">
          No attendance recorded for this day.
        </p>
        {onViewFullAttendance && (
          <button
            onClick={onViewFullAttendance}
            className="mt-1 text-[11px] font-semibold text-primary hover:underline underline-offset-2 flex items-center gap-1 transition-colors"
          >
            View day in History
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

/* ──────────────────────────────────────────────────────────
   StudentDrillDialog — canonical per-student history
   (fetched live via ?studentId=; used by Overview roster + History)
   ────────────────────────────────────────────────────────── */

export function StudentDrillDialog({
  student,
  date,
  onClose,
}: {
  student: { studentId: string; name: string; rollNo: string; classLabel?: string } | null
  date: string | null
  onClose: () => void
}) {
  const { drill, loading, error } = useStudentDrill(student?.studentId ?? null, date, !!student)

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
          <DialogTitle className="text-sm font-semibold">
            {student?.name ?? 'Student'}
          </DialogTitle>
          <DialogDescription className="text-[10px]">
            Attendance history · canonical records
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          )}

          {!loading && error && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
          )}

          {!loading && !error && drill && (
            <>
              <div className="rounded-lg border border-border bg-card p-2.5">
                <p className="text-[10px] text-muted-foreground">
                  {drill.classLabel ?? '—'}
                  {drill.rollNo ? ` · Roll ${drill.rollNo}` : ''}
                </p>
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-semibold text-primary">Attendance Rate</p>
                    <p className="font-display text-2xl font-bold tabular-nums text-primary">{drill.rate}%</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-right">
                    {drill.records.length} record{drill.records.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <DrillStat label="Present" value={drill.present} color="text-emerald-600 dark:text-emerald-400" />
                <DrillStat label="Late" value={drill.late} color="text-amber-600 dark:text-amber-400" />
                <DrillStat label="Absent" value={drill.absent} color="text-rose-600 dark:text-rose-400" />
                <DrillStat label="Leave" value={drill.leave} color="text-sky-600 dark:text-sky-400" />
              </div>

              {drill.records.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
                    <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Recorded days (latest first)</p>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {[...drill.records]
                      .sort((a, b) => (a.date < b.date ? 1 : -1))
                      .slice(0, 60)
                      .map((r) => {
                        const meta = metaFor(
                          r.status === 'PRESENT' ? 'present'
                            : r.status === 'LATE' ? 'late'
                            : r.status === 'ABSENT' ? 'absent'
                            : r.status === 'LEAVE' ? 'leave'
                            : null,
                        )
                        return (
                          <div key={r.date} className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/40 last:border-0 text-xs">
                            <span className="font-mono tabular-nums text-muted-foreground">{formatDateLabel(r.date)}</span>
                            <span className={`inline-flex items-center gap-1 font-semibold ${meta.text}`}>
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                              {meta.label}
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </>
          )}

          {!loading && !error && !drill && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No attendance records found for this student.
            </p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border flex justify-end">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DrillStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
      <p className={`font-display text-base font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
