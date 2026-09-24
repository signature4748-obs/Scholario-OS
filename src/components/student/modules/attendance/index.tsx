'use client'

/**
 * AttendanceModule — Student "My Attendance" (SECOND-GENERATION redesign).
 *
 * READ-ONLY personal attendance record: every number derives from the
 * SERVER's canonical Attendance rows via /api/student/attendance — the
 * same records the Teacher / Principal attendance UI writes. When staff
 * correct a record, the student sees the updated status here (on reload
 * / next visit). Identity is resolved server-side — never a hardcoded
 * student id, never a client-side attendance seed.
 *
 * Resolution chain: authenticated student (server) → enrollment (class +
 * section, never chosen) → active academic session (school settings) →
 * this student's records only (§41 privacy — the server filter is by
 * student id).
 *
 * Percentage policy (the school's existing convention, unchanged):
 *   attended = Present + Late (late counts as attended)
 *   applicable days = RECORDED school days only
 *   → holidays, weekends and unrecorded days never reduce attendance,
 *     and "No Record" never silently becomes Absent.
 *
 * Reading rhythm (§35): hero summary → calendar + records → trend.
 * LR-1 — no module title: the sidebar + top bar already say
 * "Attendance"; the Snapshot's "Overall · <window>" line is the page's
 * one scope line, so class/section/session never repeat below (§5/§32).
 */

import { useMemo, useState } from 'react'
import { CalendarOff, AlertTriangle, RefreshCw } from 'lucide-react'
import { GlassCard, PageTransition } from '@/components/shared/ui'
import {
  computeStats,
  weeklyTrend,
  type StudentAttendanceRecord,
} from '@/lib/store/student-attendance-store'
import { useMyServerAttendance } from '@/hooks/use-my-attendance'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import { useCurrentUser } from '@/lib/store/current-user-store'
import { Snapshot, type TodayStatus } from './snapshot'
import { CalendarView } from './calendar-view'
import { MonthRecords } from './month-records'
import { Trend } from './trend'
import {
  buildMonthGrid,
  defaultSelection,
  formatWindow,
  isoOf,
  monthIndex,
  pad,
  resolveDay,
  shiftMonth,
  workingDaysInMonth,
  type MonthCursor,
} from './date-utils'

export function AttendanceModule() {
  // ── Canonical data — the SAME server rows Teacher/Principal write ──
  const { records: my, loading, error, reload } = useMyServerAttendance()
  const stats = computeStats(my)

  // ── School policy — thresholds drive labels and chips only (§27) ──
  const thresholds = useSchoolSettingsStore((s) => s.academics?.attendanceThresholds)

  // ── Identity — enrollment decides the class (never hardcoded, §38) ──
  // SD-3b — the SERVER session label wins (never disagrees with the sidebar).
  const srvClassLabel = useCurrentUser((s) => s.me?.student?.classLabel)
  const classLabel = srvClassLabel ?? 'My Class'

  // ── Time + month navigation (local-timezone safe) ──
  const todayIso = isoOf(new Date())
  const currentMonth = useMemo<MonthCursor>(
    () => ({ y: Number(todayIso.slice(0, 4)), m: Number(todayIso.slice(5, 7)) }),
    [todayIso],
  )
  const minMonth = useMemo(
    () =>
      my.length > 0
        ? { y: Number(my[0].date.slice(0, 4)), m: Number(my[0].date.slice(5, 7)) }
        : currentMonth,
    [my, currentMonth],
  )
  const [cursor, setCursor] = useState<MonthCursor>(currentMonth)
  const [selected, setSelected] = useState<string | null>(() => defaultSelection(currentMonth, byDateOf(my), todayIso))
  const byDate = useMemo(() => byDateOf(my), [my])
  const canPrev = monthIndex(cursor) > monthIndex(minMonth)
  const canNext = monthIndex(cursor) < monthIndex(currentMonth)

  const handleShift = (delta: number) => {
    const next = shiftMonth(cursor, delta)
    setCursor(next)
    setSelected(defaultSelection(next, byDate, todayIso))
  }

  // ── Month-scoped data (memoized — month nav never refetches, §23) ──
  const grid = useMemo(() => buildMonthGrid(cursor, byDate, todayIso), [cursor, byDate, todayIso])
  const monthPrefix = `${cursor.y}-${pad(cursor.m)}`
  const monthRecords = useMemo(
    () => my.filter((r) => r.date.startsWith(monthPrefix)).reverse(), // newest first
    [my, monthPrefix],
  )
  const monthStats = useMemo(() => computeStats(monthRecords), [monthRecords])
  const workingDays = useMemo(() => workingDaysInMonth(cursor), [cursor])

  // ── Today's status + trend (real records only) ──
  const todayStatus: TodayStatus = useMemo(() => {
    const d = resolveDay(todayIso, byDate, todayIso)
    return { kind: d.kind, holidayName: d.holidayName, record: d.record }
  }, [todayIso, byDate])
  const weekPoints = useMemo(() => weeklyTrend(my), [my])
  const windowLabel = useMemo(
    () => (my.length > 0 ? formatWindow(my[0].date, my[my.length - 1].date) : ''),
    [my],
  )

  /* ── ERROR STATE — honest, retryable (§22 failure isolation) ── */
  if (error && loading === false && my.length === 0) {
    return (
      <PageTransition>
        <GlassCard hover={false} className="on-card px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </div>
          <p className="text-sm font-semibold">Attendance unavailable</p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
          </button>
        </GlassCard>
      </PageTransition>
    )
  }

  /* ── LOADING STATE — first fetch, no data yet ── */
  if (loading) {
    return (
      <PageTransition>
        <div className="space-y-6" aria-busy="true" aria-label="Loading attendance">
          <div className="h-28 animate-pulse rounded-2xl bg-muted/50" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="h-72 animate-pulse rounded-2xl bg-muted/40 lg:col-span-2" style={{ animationDelay: '90ms' }} />
            <div className="h-72 animate-pulse rounded-2xl bg-muted/30" style={{ animationDelay: '180ms' }} />
          </div>
        </div>
      </PageTransition>
    )
  }

  /* ── EMPTY STATE — no records, no fabricated numbers (§44) ── */
  if (my.length === 0) {
    return (
      <PageTransition>
        <div className="space-y-6 sm:space-y-7">
          <GlassCard hover={false} className="on-card px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarOff className="h-6 w-6" aria-hidden />
            </div>
            <p className="text-sm font-semibold">No attendance records for this period</p>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Attendance will appear here once the school records your first school day — your percentage,
              calendar and trend build up automatically.
            </p>
          </GlassCard>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-6 sm:space-y-7">
        {/* LR-1 — no module title: the sidebar + top bar already say
            "Attendance"; the Snapshot below carries the record window
            ("Overall · <window>") as the page's one scope line. */}

        {/* 1 — "How am I doing?" (§20) */}
        <Snapshot stats={stats} windowLabel={windowLabel} thresholds={thresholds} today={todayStatus} />

        {/* 2 — the primary experience: calendar + records (§21–§28) */}
        <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CalendarView
              cursor={cursor}
              isCurrentMonth={monthIndex(cursor) === monthIndex(currentMonth)}
              canPrev={canPrev}
              canNext={canNext}
              onShift={handleShift}
              grid={grid}
              todayIso={todayIso}
              selected={selected}
              onSelect={setSelected}
              classLabel={classLabel}
              monthStats={monthStats}
              workingDays={workingDays}
            />
          </div>
          <MonthRecords
            key={`${cursor.y}-${cursor.m}`}
            cursor={cursor}
            records={monthRecords}
            workingDays={workingDays}
            selected={selected}
            onSelect={setSelected}
          />
        </div>

        {/* 3 — "Is it improving?" (§25) — emerald line, school-policy reference lines */}
        <Trend points={weekPoints} thresholds={thresholds} />
      </div>
    </PageTransition>
  )
}

/** Small helper so the initial selection can read the map before the memo. */
function byDateOf(records: StudentAttendanceRecord[]): Map<string, StudentAttendanceRecord> {
  return new Map(records.map((r) => [r.date, r]))
}
