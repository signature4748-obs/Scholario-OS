'use client'

/**
 * OverviewCharts — editorial analytics rows (structure preserved).
 *
 * Row 1: Day Breakdown (compact) + Weekly Trend (last 7 RECORDED days)
 * Row 2: Monthly Trend (full-width)
 *
 * All series come from the canonical snapshot: `summary` for the selected
 * day, `weekTrend` / `monthTrend` for the session trends. When the
 * selected day has no Attendance rows, the breakdown renders the honest
 * "No attendance recorded for this date" state — never zeros-as-data.
 */

import { CalendarOff } from 'lucide-react'
import {
  TrendLine,
  TodayBreakdownStack,
  InsightBadge,
  deriveTrendInsight,
  ATTENDANCE_PALETTE,
} from './attendance-charts'
import {
  formatDayTick,
  formatMonthTick,
  type AttendanceSummary,
  type TrendPoint,
  type MonthPoint,
} from './data'

interface OverviewChartsProps {
  /** "16 Sep 2026" — label of the selected snapshot day */
  dateLabel: string
  summary: AttendanceSummary
  weeklyTrend: TrendPoint[]
  monthlyTrend: MonthPoint[]
}

export function OverviewCharts({
  dateLabel, summary, weeklyTrend, monthlyTrend,
}: OverviewChartsProps) {
  const weeklyInsight = deriveTrendInsight(weeklyTrend.map((d) => d.rate))
  const monthlyInsight = deriveTrendInsight(monthlyTrend.map((m) => m.rate))

  const monthlyAvg = monthlyTrend.reduce((s, m) => s + m.rate, 0) / Math.max(monthlyTrend.length, 1)
  const latestMonthly = monthlyTrend[monthlyTrend.length - 1]?.rate ?? 0

  const hasDayData = summary.recorded > 0

  const breakdownData = [
    { name: 'Present', value: summary.present, color: ATTENDANCE_PALETTE.present },
    { name: 'Late',    value: summary.late,    color: ATTENDANCE_PALETTE.late },
    { name: 'Absent',  value: summary.absent,  color: ATTENDANCE_PALETTE.absent },
    { name: 'Leave',   value: summary.leave,   color: ATTENDANCE_PALETTE.leave },
  ]

  return (
    <>
      {/* Row 1: Day Breakdown (compact) + Weekly Trend — side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Day Breakdown — compact, no oversized card */}
        <section className="py-2">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                Day Breakdown
              </h3>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                Attendance composition · {dateLabel}
              </p>
            </div>
          </div>
          {hasDayData ? (
            <TodayBreakdownStack
              data={breakdownData}
              centerValue={`${summary.rate}%`}
              centerLabel="Present"
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 flex items-center gap-3">
              <CalendarOff className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">No attendance recorded for this date</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Pick a recorded day from the heatmap — the trends below show real history.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Weekly Trend — thin divider on the left for lg+, no card */}
        <section className="py-2 lg:border-l lg:border-border/40 lg:pl-6">
          <div className="flex items-baseline justify-between gap-2 mb-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                Weekly Trend
              </h3>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                Attendance rate · last {weeklyTrend.length || 0} recorded {weeklyTrend.length === 1 ? 'day' : 'days'}
              </p>
            </div>
            {weeklyTrend.length > 0 && <InsightBadge insight={weeklyInsight} />}
          </div>
          {weeklyTrend.length > 0 ? (
            <TrendLine
              data={weeklyTrend.map((d) => ({ name: formatDayTick(d.date), value: d.rate }))}
              xKey="name"
              yKey="value"
              color={ATTENDANCE_PALETTE.trend}
              height={170}
              yDomain={[80, 100]}
            />
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">
              No attendance days recorded yet.
            </p>
          )}
        </section>
      </div>

      {/* Thin horizontal divider — subtle, no heavy container */}
      <div className="border-t border-border/40 my-2" />

      {/* Row 2: Monthly Trend — full width, sits naturally on the page */}
      <section className="py-2">
        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
              Monthly Trend
            </h3>
            <p className="text-[10px] text-muted-foreground/80 mt-0.5">
              {monthlyTrend.length > 0
                ? `${monthlyTrend.length}-month attendance rate · session to date`
                : 'Monthly attendance rate · session to date'}
            </p>
          </div>
          <div className="flex items-baseline gap-3 text-[10px] text-muted-foreground">
            {monthlyTrend.length > 0 && (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono">avg</span>
                  <span className="font-display font-bold tabular-nums text-foreground">{monthlyAvg.toFixed(1)}%</span>
                </div>
                <span className="text-muted-foreground/40">·</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono">Latest</span>
                  <span className="font-display font-bold tabular-nums text-foreground">{latestMonthly}%</span>
                </div>
                <span className="text-muted-foreground/40">·</span>
              </>
            )}
            <InsightBadge insight={monthlyInsight} />
          </div>
        </div>
        {monthlyTrend.length > 0 ? (
          <TrendLine
            data={monthlyTrend.map((m) => ({ name: formatMonthTick(m.month), value: m.rate }))}
            xKey="name"
            yKey="value"
            color={ATTENDANCE_PALETTE.monthly}
            height={160}
            yDomain={[88, 100]}
            averageValue={monthlyAvg}
          />
        ) : (
          <p className="text-xs text-muted-foreground py-8 text-center">
            No attendance months recorded yet.
          </p>
        )}
      </section>
    </>
  )
}
