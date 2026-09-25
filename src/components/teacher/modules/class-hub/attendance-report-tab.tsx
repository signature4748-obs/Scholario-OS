'use client'

/**
 * class-hub/attendance-report-tab — the CLASS ATTENDANCE REPORT inside My
 * Class (spec §5–§8 of the FINAL UX refinement).
 *
 * THIS IS A REPORT / INSIGHT VIEW — READ-ONLY. Attendance is CREATED /
 * EDITED / SUBMITTED in exactly ONE place: the global Class Attendance
 * module (the class teacher's morning duty). This tab only READS and
 * SUMMARIZES the same canonical CLASS + DATE + STUDENT records used by
 * Class Attendance, Student Directory, Student Profile, Student Growth
 * and the Principal reports — there is no second attendance table, no
 * second attendance state and no editing control of any kind here.
 *
 * Anatomy (all from the ONE detail payload — no extra fetch):
 *   · headline — overall 30-day rate + school days vs marked days +
 *     the Present / Absent / Late / Leave distribution;
 *   · most recent marked day summary (with the honest "today not marked
 *     yet" state and ONE small contextual link into Class Attendance);
 *   · excellent / needs-attention lists (≥ 3 marked-day honesty floor);
 *   · attendance by student — the full roster table (roll order or
 *     lowest-rate-first), row click opens the canonical Student Profile.
 *
 * FINAL UX REFINEMENT (simplification round): the weekly "Attendance
 * trend" and "Monthly rate" bar sections were REMOVED — this is a
 * CLASS ATTENDANCE REPORT, not an analytics dashboard. Numbers, lists
 * and one table; zero decorative charts.
 */

import { useMemo, useState } from 'react'
import {
  ArrowRight, Award, CalendarCheck, Clock, Info, ShieldCheck, Users,
} from 'lucide-react'
import { GradientAvatar } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SectionCard } from '../shared/section-card'
import { HubEmptyState } from '../shared/hub-stat-cards'
import { ViewLink } from './sections'
import type { ClassHubClass, HubDetailPayload } from './types'

type AttReport = HubDetailPayload['attendanceReport']

/** Honest display bands — the SAME 85% threshold the report lists use. */
function statusOf(ratePct: number | null, markedDays: number): { label: string; cls: string } {
  if (ratePct == null || markedDays < 3) return { label: 'Building', cls: 'bg-muted text-muted-foreground' }
  if (ratePct >= 95) return { label: 'Excellent', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
  if (ratePct >= 85) return { label: 'Good', cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' }
  return { label: 'Needs attention', cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' }
}

function dayLabel(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`)
  const today = new Date()
  const todayKey = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  )
    .toISOString()
    .slice(0, 10)
  if (dayKey === todayKey) return 'Today'
  const yesterday = new Date(todayKey)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  if (dayKey === yesterday.toISOString().slice(0, 10)) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function AttendanceReportTab({
  cls,
  report,
  onNavigate,
  onOpenProfile,
}: {
  cls: ClassHubClass
  report: AttReport | null
  /** ONE small contextual action — opens the GLOBAL Class Attendance
   *  module where attendance is actually marked (spec §5/§6) */
  onNavigate: (moduleKey: string) => void
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

  const excellent = useMemo(
    () =>
      rows
        .filter((r) => r.ratePct != null && r.ratePct >= 95 && r.markedDays >= 3)
        .sort((a, b) => (b.ratePct ?? 0) - (a.ratePct ?? 0))
        .slice(0, 5),
    [rows],
  )
  const attention = report?.belowThreshold ?? []

  const hasData =
    report != null && (report.overall.markedDays > 0 || report.overall.ratePct != null)

  if (!hasData) {
    return (
      <SectionCard
        icon={CalendarCheck}
        title="Attendance Report"
        subtitle={`${cls.label} · read-only insights from the canonical attendance records`}
        contentClassName=""
      >
        <HubEmptyState
          icon={CalendarCheck}
          title="No attendance data yet"
          hint="This report fills in as daily attendance is marked in the Class Attendance module — the one place attendance is created and submitted."
          className="py-12"
          action={
            <Button size="sm" onClick={() => onNavigate('attendance')}>
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" /> Open Class Attendance
            </Button>
          }
        />
      </SectionCard>
    )
  }

  const o = report.overall
  const totalMarked = o.present + o.absent + o.late + o.leave
  const share = (n: number) => (totalMarked > 0 ? Math.round((n / totalMarked) * 100) : 0)

  return (
    <div className="space-y-4">
      <SectionCard
        icon={CalendarCheck}
        title="Attendance Report"
        subtitle={`${cls.label} · read-only insights from the canonical attendance records`}
        actions={
          <ViewLink label="Mark in Class Attendance" icon={ArrowRight} onClick={() => onNavigate('attendance')} />
        }
        contentClassName=""
      >
        {/* ── headline: overall rate + days + status distribution ─────── */}
        <div className="grid grid-cols-2 gap-px bg-border/50 sm:grid-cols-3 xl:grid-cols-6">
          <div className="col-span-2 bg-card px-4 py-3.5 sm:col-span-3 xl:col-span-2">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CalendarCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-2xl font-bold tabular-nums leading-none">
                  {o.ratePct != null ? `${o.ratePct}%` : '—'}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Overall attendance · last 30 days
                </p>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {o.markedDays} of {Math.max(o.schoolDays, o.markedDays)} school day{o.schoolDays === 1 ? '' : 's'} marked
              {o.schoolDays > o.markedDays && (
                <span className="ml-1 font-medium text-amber-600 dark:text-amber-400">
                  · {o.schoolDays - o.markedDays} unmarked
                </span>
              )}
            </p>
          </div>
          <DistributionTile label="Present" count={o.present} pct={share(o.present)} tone="emerald" />
          <DistributionTile label="Absent" count={o.absent} pct={share(o.absent)} tone="rose" />
          <DistributionTile label="Late" count={o.late} pct={share(o.late)} tone="amber" />
          <DistributionTile label="On Leave" count={o.leave} pct={share(o.leave)} tone="sky" />
        </div>
      </SectionCard>

      {/* ── most recent day + excellent + needs attention ───────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          icon={Clock}
          title="Most recent attendance"
          subtitle="The latest marked class day"
          contentClassName="px-4 py-3.5"
        >
          {report.latestDay ? (
            <>
              <p className="text-sm font-semibold">{dayLabel(report.latestDay.date)}</p>
              <ul className="mt-2.5 grid grid-cols-2 gap-2">
                {(
                  [
                    ['Present', report.latestDay.present, 'text-emerald-600 dark:text-emerald-400'],
                    ['Absent', report.latestDay.absent, 'text-rose-600 dark:text-rose-400'],
                    ['Late', report.latestDay.late, 'text-amber-600 dark:text-amber-400'],
                    ['On leave', report.latestDay.leave, 'text-sky-600 dark:text-sky-400'],
                  ] as const
                ).map(([label, value, tone]) => (
                  <li key={label} className="rounded-lg bg-muted/40 px-2.5 py-2">
                    <p className={cn('text-base font-bold tabular-nums leading-none', tone)}>{value}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                {report.latestDay.present + report.latestDay.late} of {cls.studentCount} students attended.
              </p>
            </>
          ) : (
            <p className="py-3 text-xs text-muted-foreground">No class day has been marked yet.</p>
          )}
          {!cls.attendanceToday.marked && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                Today hasn&apos;t been marked yet.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('attendance')}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
              >
                Mark in Class Attendance <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={Award}
          title="Excellent attendance"
          subtitle="95% and above · at least 3 marked days"
          contentClassName=""
        >
          {excellent.length === 0 ? (
            <p className="px-4 py-4 text-xs text-muted-foreground">
              No student has crossed 95% with enough marked days yet.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {excellent.map((s) => (
                <li key={s.studentId}>
                  <button
                    type="button"
                    onClick={() => onOpenProfile(s.studentId)}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-accent/40"
                  >
                    <GradientAvatar name={s.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Roll {s.rollNo ?? '—'} · {s.present} present · {s.absent} absent
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {s.ratePct}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          icon={Info}
          title="Needs attention"
          subtitle="Below the 85% threshold · at least 3 marked days"
          contentClassName=""
        >
          {attention.length === 0 ? (
            <p className="px-4 py-4 text-xs text-muted-foreground">
              Every student is at or above the threshold — nothing to flag.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {attention.map((s) => (
                <li key={s.studentId}>
                  <button
                    type="button"
                    onClick={() => onOpenProfile(s.studentId)}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-accent/40"
                  >
                    <GradientAvatar name={s.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.absentDays} absence{s.absentDays === 1 ? '' : 's'} in {s.markedDays} marked days
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-rose-600 dark:text-rose-400">
                      {s.ratePct}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* ── attendance by student — the full roster breakdown ────────── */}
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
          <div className="max-h-[calc(100dvh-19rem)] overflow-y-auto">
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
        Reads the same canonical attendance records as every other module — marking and editing live in Class Attendance.
      </p>
    </div>
  )
}

/** One status tile of the distribution row (count + share of records). */
function DistributionTile({
  label,
  count,
  pct,
  tone,
}: {
  label: string
  count: number
  pct: number
  tone: 'emerald' | 'rose' | 'amber' | 'sky'
}) {
  const toneCls = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    rose: 'text-rose-600 dark:text-rose-400',
    amber: 'text-amber-600 dark:text-amber-400',
    sky: 'text-sky-600 dark:text-sky-400',
  }[tone]
  return (
    <div className="bg-card px-4 py-3.5">
      <p className={cn('font-display text-xl font-bold tabular-nums leading-none', toneCls)}>{pct}%</p>
      <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{count} record{count === 1 ? '' : 's'}</p>
    </div>
  )
}
