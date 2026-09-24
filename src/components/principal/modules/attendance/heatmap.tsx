'use client'

/**
 * AttendanceHeatmap — month calendar with REAL rates only.
 *
 * Calendar geometry (weekends, declared holidays, weekday alignment) is
 * real; attendance colors appear ONLY on days that have Attendance rows
 * (the snapshot's weekTrend — the 7 most recent recorded days). Every
 * other working day renders as an honest neutral "no record" cell —
 * no fabricated rates, ever.
 *
 * Clicking a working day shows the selected-day summary (real rate +
 * recorded count, or the honest no-record state). "View full attendance"
 * jumps to History with that date pre-selected.
 */

import { useState, useMemo, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import {
  buildMonthCalendar,
  rateColor,
  HOLIDAY_CELL_COLOR,
  formatMonthLabel,
  formatMonthLabelCompact,
  type TrendPoint,
} from './data'
import { CalendarLegend, SelectedDayPanel } from './shared'

type HeatmapProps = {
  /** Real per-day aggregates (from the snapshot's weekTrend). */
  weekTrend: TrendPoint[]
  /** The canonical "today" (snapshot date) — bounds future days. */
  todayStr: string
  /** The currently selected snapshot date — the default month follows it. */
  selectedDate: string
  selectedDay: number | null
  setSelectedDay: (d: number | null) => void
  /** Callback fired when user clicks "View full attendance →". */
  onViewFullAttendance?: (dateStr: string) => void
}

interface MonthState {
  year: number
  month: number
}

export function AttendanceHeatmap({
  weekTrend, todayStr, selectedDate, selectedDay, setSelectedDay, onViewFullAttendance,
}: HeatmapProps) {
  const reduce = useReducedMotion()

  // Default month = the selected date's month (follows the date picker).
  const initial = useMemo<MonthState>(() => {
    const [y, m] = (selectedDate || todayStr || '').split('-').map(Number)
    return { year: y || 2026, month: m || 9 }
  }, [selectedDate, todayStr])
  const [monthState, setMonthState] = useState<MonthState>(initial)
  const { year, month } = monthState

  // When the selected date's month changes (date picker / History jump),
  // follow it so the heatmap always opens on the relevant month.
  useEffect(() => {
    setMonthState((prev) => {
      if (prev.year === initial.year && prev.month === initial.month) return prev
      return initial
    })
  }, [initial])

  // REAL per-day rates — only days present in weekTrend get a color.
  const rateByDate = useMemo(() => {
    const map = new Map<string, { rate: number; recorded: number }>()
    for (const t of weekTrend) map.set(t.date, { rate: t.rate, recorded: t.recorded })
    return map
  }, [weekTrend])

  const calendar = useMemo(
    () => buildMonthCalendar(year, month, rateByDate, todayStr),
    [year, month, rateByDate, todayStr],
  )

  // When month changes, clear the selected day if it's no longer valid.
  useEffect(() => {
    setSelectedDay(null)
  }, [year, month, setSelectedDay])

  const goToPreviousMonth = () => {
    setMonthState((prev) => {
      let m = prev.month - 1
      let y = prev.year
      if (m < 1) {
        m = 12
        y -= 1
      }
      return { year: y, month: m }
    })
  }
  const goToNextMonth = () => {
    setMonthState((prev) => {
      let m = prev.month + 1
      let y = prev.year
      if (m > 12) {
        m = 1
        y += 1
      }
      return { year: y, month: m }
    })
  }

  const selectedCell = selectedDay !== null
    ? calendar.find((c) => c.day === selectedDay)
    : null
  const selectedDateStr = selectedCell?.dateStr ?? ''

  const handleViewFullAttendance = () => {
    if (onViewFullAttendance && selectedDateStr) {
      onViewFullAttendance(selectedDateStr)
    }
  }

  return (
    <GlassCard className="p-3 sm:p-4 lg:p-5">
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary shrink-0" />
            {formatMonthLabel(year, month)} — Attendance Heatmap
          </h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            Real rates shown only for days with attendance rows · tap a day for details
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Previous month"
            onClick={goToPreviousMonth}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-semibold font-mono tabular-nums">
            {formatMonthLabelCompact(year, month)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Next month"
            onClick={goToNextMonth}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Calendar grid — recorded days colored by REAL rate */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div
            key={d}
            className="text-center text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
        {calendar.map((cell, idx) => {
          if (cell.day === null) {
            return <div key={`empty-${idx}`} className="h-8 sm:h-9" />
          }
          const isSelected = selectedDay === cell.day
          const isRecorded = cell.rate !== null
          // Working days (incl. no-record days) are selectable; weekends +
          // holidays are not.
          const isInteractive = !cell.isWeekend && !cell.isHoliday
          return (
            <motion.button
              key={cell.dateStr || `day-${cell.day}`}
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(idx * 0.008, 0.3), duration: 0.3 }}
              whileHover={isInteractive && !reduce ? { scale: 1.06, zIndex: 2 } : undefined}
              whileTap={isInteractive && !reduce ? { scale: 0.96 } : undefined}
              onClick={() => isInteractive && setSelectedDay(cell.day)}
              aria-label={
                isRecorded
                  ? `${cell.dateStr}, ${cell.rate}% attendance, ${cell.recorded} recorded`
                  : cell.isHoliday
                  ? `${cell.dateStr}, holiday${cell.holiday ? ` (${cell.holiday.name})` : ''}`
                  : cell.isWeekend
                  ? `${cell.dateStr}, weekend`
                  : cell.isFuture
                  ? `${cell.dateStr}, upcoming`
                  : `${cell.dateStr}, no attendance recorded`
              }
              aria-pressed={isSelected}
              className={`h-8 sm:h-9 rounded-md border flex items-center justify-center text-[10px] sm:text-[11px] font-semibold tabular-nums transition-all ${
                cell.isHoliday
                  ? HOLIDAY_CELL_COLOR
                  : isRecorded
                  ? rateColor(cell.rate)
                  : 'bg-muted/40 border-border text-muted-foreground'
              } ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''} ${
                isInteractive ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'
              }`}
              title={
                isRecorded
                  ? `${cell.recorded} recorded · ${cell.rate}%`
                  : cell.isHoliday && cell.holiday
                  ? cell.holiday.name
                  : undefined
              }
            >
              <span>{cell.day}</span>
            </motion.button>
          )
        })}
      </div>

      <CalendarLegend />

      {/* Selected day details — real data only */}
      {selectedDay !== null && selectedCell && (
        <SelectedDayPanel
          selectedDay={selectedDay}
          dateStr={selectedDateStr}
          holiday={selectedCell.holiday}
          dayRecord={
            selectedCell.rate !== null
              ? { rate: selectedCell.rate, recorded: selectedCell.recorded }
              : null
          }
          onViewFullAttendance={handleViewFullAttendance}
        />
      )}
    </GlassCard>
  )
}
