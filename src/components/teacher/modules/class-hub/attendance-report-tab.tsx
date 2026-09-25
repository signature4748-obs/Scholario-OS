'use client'

/**
 * class-hub/attendance-report-tab — the READ-ONLY attendance overview
 * inside My Class (FINAL UI POLISH — simplification round).
 *
 * One simple page:
 *   · a compact "Attendance Overview" header — class · students · window;
 *   · ONE very small summary row — Overall | Present | Absent | Late |
 *     On Leave — ALL FIVE cells in a SINGLE row on tablet/desktop
 *     (grid-cols-5 — the four metrics never leave a lone wrapped card),
 *     mobile: overall full-width + the metrics as a clean 2×2;
 *   · "Attendance by student" — the PRIMARY, dominant section: the full
 *     roster table (Student | Attendance | Present | Absent | Late |
 *     Leave | Status), row click opens the canonical Student Profile.
 *
 * REMOVED in this round (each duplicated the table below): the large
 * "Attendance Report" hero, the "Mark in Class Attendance" action, and
 * the "Most recent attendance" / "Excellent attendance" / "Needs
 * attention" cards. Attendance is CREATED / EDITED / SUBMITTED in
 * exactly ONE place — the global Class Attendance module — and this tab
 * only READS the same canonical CLASS + DATE + STUDENT records used by
 * Class Attendance, Student Directory, Student Profile, Student Growth
 * and the Principal reports. No second attendance dataset, no second
 * attendance state, no editing control of any kind here.
 */

import { useMemo, useState } from 'react'
import { CalendarCheck, ShieldCheck, Users } from 'lucide-react'
import { GradientAvatar } from '@/components/shared/ui'
import { cn } from '@/lib/utils'
import { SectionCard } from '../shared/section-card'
import { HubEmptyState } from '../shared/hub-stat-cards'
import type { ClassHubClass, HubDetailPayload } from './types'

type AttReport = HubDetailPayload['attendanceReport']

/** Honest display bands — the SAME 85% threshold the report lists use. */
function statusOf(ratePct: number | null, markedDays: number): { label: string; cls: string } {
  if (ratePct == null || markedDays < 3) return { label: 'Building', cls: 'bg-muted text-muted-foreground' }
  if (ratePct >= 95) return { label: 'Excellent', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
  if (ratePct >= 85) return { label: 'Good', cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' }
  return { label: 'Needs attention', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' }
}

export function AttendanceReportTab({
  cls,
  report,
  onOpenProfile,
}: {
  cls: ClassHubClass
  report: AttReport | null
  /** Row click opens the ONE canonical Student Profile (read-only). */
  onOpenProfile: (studentId: string) => void
}) {
  const [sort, setSort] = useState<'roll' | 'lowest'>('roll')

  const rows = useMemo(() => report?.byStudent ?? [], [report])
  const sortedRows = useMemo(() => {
    const copy = [...rows]
    if (sort === 'lowest') {
      copy.sort((a, b) => {
        const ar = a.ratePct ?? 101
        const br = b.ratePct ?? 101
        if (ar !== br) return ar - br
        return (a.rollNo ?? '').localeCompare(b.rollNo ?? '', undefined, { numeric: true })
      })
    }
    return copy
  }, [rows, sort])

  const hasData =
    report != null && (report.overall.markedDays > 0 || report.overall.ratePct != null)

  if (!hasData) {
    return (
      <SectionCard
        icon={CalendarCheck}
        title="Attendance Overview"
        subtitle={`${cls.label} · read-only view of the canonical attendance records`}
        contentClassName=""
      >
        <HubEmptyState
          icon={CalendarCheck}
          title="No attendance data yet"
          hint="This overview fills in automatically as daily attendance is marked in the Class Attendance module — the one place attendance is created and submitted."
          className="py-12"
        />
      </SectionCard>
    )
  }

  const o = report.overall
  const schoolDays = Math.max(o.schoolDays, o.markedDays)

  return (
    <div className="space-y-4">
      {/* ── compact overview header — intentionally NOT a hero card ── */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5 px-1">
        <div>
          <h3 className="text-base font-bold leading-tight">Attendance Overview</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {cls.label} · {rows.length} student{rows.length === 1 ? '' : 's'} · last 30 days · read-only
          </p>
        </div>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {o.markedDays} of {schoolDays} school day{schoolDays === 1 ? '' : 's'} marked
          {schoolDays > o.markedDays && (
            <span className="ml-1 font-medium text-amber-600 dark:text-amber-400">
              · {schoolDays - o.markedDays} unmarked
            </span>
          )}
        </p>
      </div>

      {/* ── ONE very small summary row — Overall + the FOUR metrics stay
             together in a single row on tablet/desktop (never a lone
             "On Leave" dropping into an awkward second row); mobile uses
             overall-full-width + a clean 2×2 for the metrics ── */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border/60 sm:grid-cols-5">
        <SummaryCell
          className="col-span-2 sm:col-span-1"
          value={o.ratePct != null ? `${o.ratePct}%` : '—'}
          label="Overall attendance"
        />
        <SummaryCell value={o.present} label="Present" tone="emerald" />
        <SummaryCell value={o.absent} label="Absent" tone="rose" />
        <SummaryCell value={o.late} label="Late" tone="amber" />
        <SummaryCell value={o.leave} label="On Leave" tone="sky" />
      </div>

      {/* ── attendance by student — the PRIMARY section of this page ── */}
      <SectionCard
        icon={Users}
        title="Attendance by student"
        subtitle={`${cls.label} · ${rows.length} student${rows.length === 1 ? '' : 's'} · last 30 days`}
        actions={
          <div
            role="group"
            aria-label="Sort students"
            className="flex items-center rounded-lg border border-input bg-muted/40 p-0.5"
          >
            {(
              [
                ['roll', 'Roll order'],
                ['lowest', 'Lowest rate'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={sort === key}
                onClick={() => setSort(key)}
                className={cn(
                  'h-7 rounded-[6px] px-2.5 text-[11px] font-medium transition-all',
                  sort === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
        contentClassName=""
      >
        {rows.length === 0 ? (
          <HubEmptyState
            icon={Users}
            title="No students enrolled"
            hint="Active students enrolled in this class will appear here."
            className="py-10"
          />
        ) : (
          <div className="max-h-[calc(100dvh-15rem)] overflow-y-auto">
            {/* table ≥ lg */}
            <table className="hidden w-full text-left lg:table">
              <thead>
                <tr className="sticky top-0 z-[1] border-b border-border bg-muted/95 text-[10px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur">
                  <th scope="col" className="px-4 py-2.5">Student</th>
                  <th scope="col" className="px-3 py-2.5">Attendance</th>
                  <th scope="col" className="px-3 py-2.5 text-center">Present</th>
                  <th scope="col" className="px-3 py-2.5 text-center">Absent</th>
                  <th scope="col" className="px-3 py-2.5 text-center">Late</th>
                  <th scope="col" className="px-3 py-2.5 text-center">Leave</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedRows.map((s) => {
                  const st = statusOf(s.ratePct, s.markedDays)
                  return (
                    <tr
                      key={s.studentId}
                      className="cursor-pointer transition-colors hover:bg-accent/40"
                      onClick={() => onOpenProfile(s.studentId)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onOpenProfile(s.studentId)
                      }}
                      aria-label={`Open ${s.name}'s profile`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <GradientAvatar name={s.name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Roll {s.rollNo ?? '—'} · {s.markedDays} marked day{s.markedDays === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                            s.ratePct == null
                              ? 'bg-muted text-muted-foreground'
                              : s.ratePct >= 95
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : s.ratePct >= 85
                                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                          )}
                        >
                          {s.ratePct != null ? `${s.ratePct}%` : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{s.present}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-semibold tabular-nums text-rose-600 dark:text-rose-400">{s.absent}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">{s.late}</td>
                      <td className="px-3 py-2.5 text-center text-xs font-semibold tabular-nums text-sky-600 dark:text-sky-400">{s.leave}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', st.cls)}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* stacked rows < lg (mobile / tablet) */}
            <ul className="divide-y divide-border/50 lg:hidden">
              {sortedRows.map((s) => {
                const st = statusOf(s.ratePct, s.markedDays)
                return (
                  <li key={s.studentId}>
                    <button
                      type="button"
                      onClick={() => onOpenProfile(s.studentId)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                    >
                      <GradientAvatar name={s.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.name}
                          <span className="ml-1.5 text-[11px] font-semibold text-muted-foreground">
                            #{s.rollNo ?? '—'}
                          </span>
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span className="text-emerald-600 dark:text-emerald-400">{s.present}P</span>
                          <span className="text-rose-600 dark:text-rose-400">{s.absent}A</span>
                          <span className="text-amber-600 dark:text-amber-400">{s.late}L</span>
                          <span className="text-sky-600 dark:text-sky-400">{s.leave}Lv</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-bold tabular-nums">
                          {s.ratePct != null ? `${s.ratePct}%` : '—'}
                        </span>
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', st.cls)}>
                          {st.label}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </SectionCard>

      {/* the one-line provenance footer — canonical, read-only */}
      <p className="flex items-center justify-center gap-1.5 pb-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        Read-only view of the same canonical attendance records used everywhere — marking and editing live in Class Attendance.
      </p>
    </div>
  )
}

/** One compact cell of the single-row summary strip (value + tiny label). */
function SummaryCell({
  value,
  label,
  tone,
  className,
}: {
  value: React.ReactNode
  label: string
  tone?: 'emerald' | 'rose' | 'amber' | 'sky'
  className?: string
}) {
  const toneCls = tone
    ? {
        emerald: 'text-emerald-600 dark:text-emerald-400',
        rose: 'text-rose-600 dark:text-rose-400',
        amber: 'text-amber-600 dark:text-amber-400',
        sky: 'text-sky-600 dark:text-sky-400',
      }[tone]
    : ''
  return (
    <div className={cn('bg-card px-4 py-3', className)}>
      <p className={cn('font-display text-xl font-bold tabular-nums leading-none', toneCls)}>{value}</p>
      <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}
