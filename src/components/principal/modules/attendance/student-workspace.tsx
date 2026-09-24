'use client'

/**
 * StudentWorkspace (Overview tab) — canonical server data.
 *
 * The snapshot for the selected date (server "today" by default) drives
 * EVERYTHING: KPI cards, day breakdown, week/month trends, heatmap,
 * class-wise table and the live class snapshot. When the selected day
 * has no Attendance rows (e.g. today before any teacher has marked),
 * the summary collapses to an honest "No attendance recorded for this
 * date" state — the trends + heatmap below still show real history.
 */

import { useEffect, useMemo, useState } from 'react'
import { Filter, CalendarCheck, UserCheck, UserX, Clock, ArrowUpRight, ArrowDownRight, Download, CalendarOff, AlertCircle, RotateCw } from 'lucide-react'
import { PageTransition, GlassCard } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DatePicker } from '@/components/ui/date-picker'
import { formatNumber } from '@/lib/format'
import { ModuleHeader } from '../shared/module-header'
import { OverviewCharts } from './overview-charts'
import { AttendanceHeatmap } from './heatmap'
import { ClassReport } from './class-report'
import { AttendanceInsights } from './insights'
import { StudentDrillDialog } from './shared'
import {
  getSchoolInfo,
  formatDateLabel,
  type AttendanceSnapshot,
  type RosterEntry,
} from './data'

interface StudentWorkspaceProps {
  snapshot: AttendanceSnapshot | null
  loading: boolean
  error: string | null
  reload: () => void
  /** null = not picked yet → follows the server "today" */
  selectedDate: string | null
  onDateChange: (date: string) => void
  classFilter: string
  setClassFilter: (v: string) => void
  onExport: () => void
  onViewFullAttendance: (dateStr: string) => void
}

export function StudentWorkspace({
  snapshot, loading, error, reload, selectedDate, onDateChange,
  classFilter, setClassFilter, onExport, onViewFullAttendance,
}: StudentWorkspaceProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [drillStudent, setDrillStudent] = useState<RosterEntry | null>(null)
  const [sessionLabel, setSessionLabel] = useState<string>('')

  // School academic session (header strip + exports) — canonical fetch.
  useEffect(() => {
    let cancelled = false
    getSchoolInfo()
      .then((info) => { if (!cancelled && info.sessionLabel) setSessionLabel(info.sessionLabel) })
      .catch(() => { /* header degrades to the date + class meta */ })
    return () => { cancelled = true }
  }, [])

  // Brief §10: ALL metrics respect the classFilter
  const isAllClasses = classFilter === 'all'
  const effectiveDate = selectedDate ?? snapshot?.date ?? null

  const scoped = useMemo(() => {
    if (!snapshot) return null
    if (isAllClasses) {
      const { summary } = snapshot
      const students = snapshot.byClass.reduce((s, c) => s + c.students, 0)
      return { ...summary, students }
    }
    const row = snapshot.byClass.find((c) => c.classId === classFilter)
    return row ?? null
  }, [snapshot, isAllClasses, classFilter])

  const classOptions = snapshot?.byClass ?? []
  const sectionLabel = isAllClasses
    ? 'All Classes'
    : classOptions.find((c) => c.classId === classFilter)?.classLabel ?? ''

  const weekTrend = snapshot?.weekTrend ?? []
  const latestRecorded = weekTrend.length > 0 ? weekTrend[weekTrend.length - 1] : null

  if (loading && !snapshot) {
    return (
      <PageTransition className="space-y-4">
        <OverviewSkeleton />
      </PageTransition>
    )
  }

  if (error && !snapshot) {
    return (
      <PageTransition className="space-y-4">
        <GlassCard className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Unable to load attendance</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 mt-3 rounded-lg" onClick={reload}>
                <RotateCw className="h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          </div>
        </GlassCard>
      </PageTransition>
    )
  }

  if (!snapshot || !scoped || !effectiveDate) return null

  const { present, absent, late, leave, recorded, students } = scoped
  const hasDayData = recorded > 0
  // Normalized summary for the charts (a no-record class has rate null —
  // the charts key off `recorded`, never off a null rate).
  const scopedSummary = {
    present, absent, late, leave, recorded,
    rate: hasDayData ? (scoped.rate ?? 0) : 0,
  }

  // Delta vs the previous recorded day (real weekTrend only)
  const prevTrend = [...weekTrend].reverse().find((t) => t.date < effectiveDate) ?? null
  const wowDelta = hasDayData && prevTrend ? +(scopedSummary.rate - prevTrend.rate).toFixed(1) : null
  const absentPct = recorded > 0 ? +((absent + leave) / recorded * 100).toFixed(1) : 0
  const latePct = recorded > 0 ? +((late) / recorded * 100).toFixed(1) : 0

  return (
    <PageTransition className="space-y-4">
      {/* Header: session + class context · date picker + class filter + real CSV export */}
      <ModuleHeader
        meta={[
          ...(sessionLabel ? [`Session ${sessionLabel}`] : []),
          isAllClasses ? 'All Classes' : sectionLabel,
          formatDateLabel(effectiveDate),
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <DatePicker
              value={effectiveDate}
              onChange={onDateChange}
              maxDate={snapshot.date}
              compact
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={onExport}
              title="Export the class-wise summary table as CSV"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger size="sm" className="w-[150px] text-xs hidden sm:flex rounded-lg">
                <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classOptions.map((c) => (
                  <SelectItem key={c.classId} value={c.classId}>{c.classLabel}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Summary: real numbers, or the honest no-record state */}
      {hasDayData ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <RefinedKpi
            label="Attendance Rate"
            value={`${scopedSummary.rate}%`}
            icon={<CalendarCheck className="h-3.5 w-3.5" />}
            tone="emerald"
            indicator={wowDelta == null ? undefined : wowDelta >= 0 ? 'up' : 'down'}
            indicatorValue={wowDelta != null
              ? `${Math.abs(wowDelta)}% vs previous recorded day`
              : `${recorded} recorded`}
          />
          <RefinedKpi
            label="Present"
            value={formatNumber(present)}
            icon={<UserCheck className="h-3.5 w-3.5" />}
            tone="cyan"
            indicatorValue={`of ${formatNumber(recorded)} recorded`}
          />
          <RefinedKpi
            label="Absent + Leave"
            value={formatNumber(absent + leave)}
            icon={<UserX className="h-3.5 w-3.5" />}
            tone="rose"
            indicatorValue={`${absentPct}% of recorded`}
          />
          <RefinedKpi
            label="Late Arrivals"
            value={formatNumber(late)}
            icon={<Clock className="h-3.5 w-3.5" />}
            tone="amber"
            indicatorValue={`${latePct}% of recorded`}
          />
        </div>
      ) : (
        <GlassCard className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0">
              <CalendarOff className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                No attendance recorded for {formatDateLabel(effectiveDate)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAllClasses
                  ? `No class has marked attendance for this date yet — ${students} students on roll.`
                  : `${sectionLabel} has no attendance rows for this date — ${students} students on roll.`}
                {' '}The week trend and heatmap below show the real recorded history.
              </p>
            </div>
            {latestRecorded && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs rounded-lg shrink-0"
                onClick={() => onDateChange(latestRecorded.date)}
              >
                Latest recorded day · {formatDateLabel(latestRecorded.date)}
              </Button>
            )}
          </div>
        </GlassCard>
      )}

      {/* Charts row — real session trends */}
      <OverviewCharts
        dateLabel={formatDateLabel(effectiveDate)}
        summary={scopedSummary}
        weeklyTrend={weekTrend}
        monthlyTrend={snapshot.monthTrend}
      />

      <AttendanceHeatmap
        weekTrend={weekTrend}
        todayStr={snapshot.date}
        selectedDate={effectiveDate}
        selectedDay={selectedDay}
        setSelectedDay={setSelectedDay}
        onViewFullAttendance={onViewFullAttendance}
      />

      <ClassReport byClass={snapshot.byClass} classFilter={classFilter} date={effectiveDate} />

      <AttendanceInsights
        byClass={snapshot.byClass}
        sections={snapshot.sections}
        summary={snapshot.summary}
        date={effectiveDate}
        classFilter={classFilter}
        onViewAllClasses={() => setClassFilter('all')}
        onStudentClick={(entry) => setDrillStudent(entry)}
      />

      {/* Per-student canonical history drill */}
      <StudentDrillDialog
        student={drillStudent ? {
          studentId: drillStudent.studentId,
          name: drillStudent.name,
          rollNo: drillStudent.rollNo,
        } : null}
        date={effectiveDate}
        onClose={() => setDrillStudent(null)}
      />
    </PageTransition>
  )
}

/* ──────────────────────────────────────────────────────────
   OverviewSkeleton — module-shaped loading state
   ────────────────────────────────────────────────────────── */
function OverviewSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-56 rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </>
  )
}

/* ──────────────────────────────────────────────────────────
   RefinedKpi — compact KPI card with contextual indicator
   ────────────────────────────────────────────────────────── */
type KpiTone = 'emerald' | 'cyan' | 'rose' | 'amber'

const TONE_CLASSES: Record<KpiTone, { text: string; bg: string; border: string }> = {
  emerald: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-border hover:border-emerald-500/40' },
  cyan:    { text: 'text-cyan-600 dark:text-cyan-400',       bg: 'bg-cyan-500/5',    border: 'border-border hover:border-cyan-500/40' },
  rose:    { text: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-500/5',     border: 'border-border hover:border-rose-500/40' },
  amber:   { text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/5',    border: 'border-border hover:border-amber-500/40' },
}

function RefinedKpi({
  label, value, icon, tone, indicator, indicatorValue,
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone: KpiTone
  indicator?: 'up' | 'down'
  indicatorValue: string
}) {
  const t = TONE_CLASSES[tone]
  return (
    <div className={`rounded-xl border p-3 sm:p-4 transition-colors ${t.bg} ${t.border}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</span>
        <span className="text-muted-foreground/60">{icon}</span>
      </div>
      <p className={`font-display text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${t.text}`}>
        {value}
      </p>
      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
        {indicator === 'up' && <ArrowUpRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
        {indicator === 'down' && <ArrowDownRight className="h-3 w-3 text-rose-600 dark:text-rose-400" />}
        <span className="truncate">{indicatorValue}</span>
      </div>
    </div>
  )
}
