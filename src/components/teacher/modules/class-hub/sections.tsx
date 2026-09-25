'use client'

/**
 * class-hub/sections — the OVERVIEW sections of the Class Teacher Hub
 * (FINAL UX refinement §12: Overview = the command center). Every section
 * has ONE distinct purpose — no number is repeated in multiple large
 * cards. Anatomy: SectionCard header + hairline rows/lists inside
 * (§30 — tables and lists for students, payments, marks, rankings and
 * reports; cards only for the KPI row). All numbers come from the
 * canonical payloads:
 *   · overview  (GET /api/teacher/class-hub)        — today / fees / growth
 *   · detail    (GET /api/teacher/class-hub/detail) — directory /
 *     performance / attendance report / growth trend
 *
 * THE CONTEXT RULE: every "View …" action stays INSIDE My Class — it
 * switches to the class-scoped tab or opens a class-scoped drawer. The
 * ONE exception is attendance MARKING, which belongs to the global Class
 * Attendance module and is reached only through a small contextual link.
 */

import { useMemo } from 'react'
import {
  AlertTriangle, ArrowRight, Award, BarChart3, CalendarCheck,
  CheckCircle2, ChevronRight, Clock, FileText, IndianRupee,
  TrendingUp, Wallet,
} from 'lucide-react'
import { GradientAvatar } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SectionCard } from '../shared/section-card'
import { HubEmptyState } from '../shared/hub-stat-cards'
import type {
  ClassHubClass, HubDetailPayload,
} from './types'

/** The shared "View …" header action — one quiet link-styled button. */
export function ViewLink({ label, onClick, icon: Icon }: { label: string; onClick: () => void; icon?: typeof ArrowRight }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
    >
      {label}
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  )
}

function StatTile({ label, value, tone, className }: { label: string; value: string | number; tone: string; className?: string }) {
  return (
    <div className={cn('bg-card px-4 py-3', className)}>
      <p className={cn('font-display text-xl font-bold tabular-nums', tone)}>{value}</p>
      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}

// ─── 1. ATTENDANCE — today's summary + 30-day rate + trend (§12) ──────
// A READ-ONLY summary of the canonical records. Marking happens in the
// global Class Attendance module — reachable here through ONE small
// contextual action when today is still unmarked.

export function AttendanceSection({
  cls, report, onOpenReport, onNavigate,
}: {
  cls: ClassHubClass
  report: HubDetailPayload['attendanceReport'] | null
  /** stays INSIDE My Class — switches to the Attendance REPORT tab */
  onOpenReport: () => void
  /** ONE small contextual action — opens the GLOBAL Class Attendance
   *  module, the ONE place attendance is created/edited/submitted */
  onNavigate: (moduleKey: string) => void
}) {
  const att = cls.attendanceToday
  const rate = report?.overall.ratePct ?? null
  const weekly = report?.weekly ?? []
  return (
    <SectionCard
      icon={CalendarCheck}
      title="Attendance"
      subtitle={
        att.marked
          ? `Today · ${att.present + att.late} of ${cls.studentCount} attended${rate != null ? ` · ${rate}% last 30 days` : ''}`
          : "Today's attendance hasn't been marked yet"
      }
      actions={<ViewLink label="View report" onClick={onOpenReport} />}
      contentClassName=""
    >
      <div className="divide-y divide-border/50">
        <div className="grid grid-cols-2 gap-px bg-border/50 sm:grid-cols-5">
          {att.marked ? (
            <>
              <StatTile label="Present" value={att.present} tone="text-emerald-600 dark:text-emerald-400" />
              <StatTile label="Absent" value={att.absent} tone="text-rose-600 dark:text-rose-400" />
              <StatTile label="Late" value={att.late} tone="text-amber-600 dark:text-amber-400" />
              <StatTile label="On Leave" value={att.leave} tone="text-sky-600 dark:text-sky-400" />
              <StatTile
                label="30-day rate"
                value={rate != null ? `${rate}%` : '—'}
                tone="text-foreground"
                className="col-span-2 sm:col-span-1"
              />
            </>
          ) : (
            <>
              <StatTile label="Students" value={cls.studentCount} tone="text-foreground" />
              <StatTile label="30-day rate" value={rate != null ? `${rate}%` : '—'} tone="text-foreground" />
              <div className="col-span-2 flex flex-col justify-center gap-1.5 bg-card px-4 py-3 sm:col-span-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Attendance is marked in Class Attendance — this workspace reports on the same records.
                </p>
                <Button size="sm" onClick={() => onNavigate('attendance')} className="h-8 shrink-0 text-xs">
                  <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mark in Class Attendance
                </Button>
              </div>
            </>
          )}
        </div>
        {/* weekly trend — the same 8-week series the report tab shows */}
        {weekly.length > 1 && (
          <div className="flex items-end gap-1 px-4 py-3" aria-label="Weekly attendance trend">
            {weekly.map((w) => (
              <div
                key={w.week}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                title={`Week of ${w.week} — ${w.ratePct != null ? `${w.ratePct}%` : 'no data'}`}
              >
                <div className="flex h-9 w-full items-end justify-center">
                  <div
                    className={cn(
                      'w-full max-w-6 rounded-t',
                      (w.ratePct ?? 0) >= 90
                        ? 'bg-emerald-500/80'
                        : (w.ratePct ?? 0) >= 75
                          ? 'bg-amber-500/80'
                          : 'bg-rose-500/80',
                    )}
                    style={{ height: `${Math.max(w.ratePct ?? 6, 6)}%` }}
                  />
                </div>
                <span className="text-[9px] font-medium tabular-nums text-muted-foreground">{w.ratePct ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── 2. ACADEMIC PERFORMANCE — class average + subject comparison ─────

export function PerformanceSection({
  detail, onOpenAcademics,
}: {
  detail: HubDetailPayload | null
  /** stays INSIDE My Class — switches to the Academics tab */
  onOpenAcademics: () => void
}) {
  const p = detail?.performance ?? null
  return (
    <SectionCard
      icon={BarChart3}
      title="Academic Performance"
      subtitle={
        p?.latestExam
          ? `${p.latestExam.examName} · class average ${p.overallAvgPct != null ? `${p.overallAvgPct}%` : '—'}`
          : 'Academic averages appear once exam marks are entered'
      }
      actions={p && p.subjectAverages.length > 0 ? <ViewLink label="View academics" onClick={onOpenAcademics} /> : undefined}
      contentClassName=""
    >
      {!p || p.subjectAverages.length === 0 ? (
        <HubEmptyState
          icon={BarChart3}
          title="No exam marks yet"
          hint="Subject averages and trends come from the marks your subject teachers enter."
          className="py-8"
        />
      ) : (
        <div className="divide-y divide-border/50">
          {/* subject averages — hairline rows with hairline bars */}
          <ul className="px-4 py-3">
            {p.subjectAverages.slice(0, 5).map((s) => (
              <li key={s.subjectId} className="flex items-center gap-3 py-1.5">
                <span className="w-24 min-w-0 truncate text-xs font-medium sm:w-32">{s.subjectName}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      s.avgPct >= 75 ? 'bg-emerald-500' : s.avgPct >= 50 ? 'bg-amber-500' : 'bg-rose-500',
                    )}
                    style={{ width: `${Math.min(100, s.avgPct)}%` }}
                  />
                </span>
                <span className="w-10 text-right text-xs font-bold tabular-nums">{s.avgPct}%</span>
              </li>
            ))}
          </ul>
          <div className="grid gap-px bg-border/50 sm:grid-cols-2">
            <div className="bg-card px-4 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Award className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" /> Top performers
              </p>
              <ul className="space-y-1.5">
                {p.topPerformers.slice(0, 3).map((t) => (
                  <li key={t.studentId} className="flex items-center gap-2 text-xs">
                    <span className="w-4 font-bold tabular-nums text-muted-foreground">{t.rank}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                    <span className="font-semibold tabular-nums">{t.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card px-4 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" /> Needs attention
              </p>
              {p.needsAttention.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">No one is significantly below the class average.</p>
              ) : (
                <ul className="space-y-1.5">
                  {p.needsAttention.slice(0, 3).map((t) => (
                    <li key={t.studentId} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                      <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">{t.pct}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── 3. FEE STATUS — collection + outstanding + verification (§12) ────

export function FeesSection({
  cls, onOpenFees, onOpenProfile,
}: {
  cls: ClassHubClass
  /** stays INSIDE My Class — switches to the Fees tab */
  onOpenFees: () => void
  onOpenProfile: (studentId: string) => void
}) {
  const f = cls.fees
  const collectionPct = f.totalBilled > 0 ? Math.round((f.totalCollected / f.totalBilled) * 100) : null
  return (
    <SectionCard
      icon={Wallet}
      title="Fee Status"
      subtitle={
        f.awaitingVerificationCount > 0
          ? `${formatINR(f.awaitingVerificationAmount)} awaiting the Principal's verification`
          : collectionPct != null
            ? `${collectionPct}% of ${formatINR(f.totalBilled)} collected`
            : 'No fees billed for this class yet'
      }
      actions={<ViewLink label="Manage fees" onClick={onOpenFees} />}
      contentClassName=""
    >
      <div className="grid grid-cols-2 gap-px bg-border/50 sm:grid-cols-4">
        <StatTile label="Billed" value={formatINR(f.totalBilled)} tone="text-foreground" />
        <StatTile label="Collected" value={formatINR(f.totalCollected)} tone="text-emerald-600 dark:text-emerald-400" />
        <StatTile
          label="Outstanding"
          value={formatINR(f.outstanding)}
          tone="text-rose-600 dark:text-rose-400"
        />
        <StatTile
          label="Fully paid"
          value={`${f.fullyPaidStudents}/${f.studentsWithFees}`}
          tone="text-foreground"
        />
      </div>
      {f.defaulters.length > 0 && (
        <ul className="divide-y divide-border/50 border-t border-border">
          {f.defaulters.slice(0, 3).map((d) => (
            <li key={d.studentId}>
              <button
                type="button"
                onClick={() => onOpenProfile(d.studentId)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/40"
              >
                <GradientAvatar name={d.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Roll {d.rollNo ?? '—'}
                    {d.hasOverdue && <span className="ml-1.5 font-semibold text-rose-600 dark:text-rose-400">Overdue</span>}
                  </p>
                </div>
                <span className={cn(
                  'shrink-0 text-sm font-bold tabular-nums',
                  d.hasOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400',
                )}>
                  {formatINR(d.outstanding)}
                </span>
              </button>
            </li>
          ))}
          {f.defaulters.length > 3 && (
            <li className="px-4 py-2 text-center text-[11px] text-muted-foreground">
              + {f.defaulters.length - 3} more student{f.defaulters.length - 3 === 1 ? '' : 's'} with outstanding fees
            </li>
          )}
        </ul>
      )}
    </SectionCard>
  )
}

// ─── 4. STUDENT GROWTH — class growth summary + trend (§12/§14) ───────

export function GrowthSection({
  cls,
  detail,
  onOpenGrowth,
}: {
  cls: ClassHubClass
  detail: HubDetailPayload | null
  /** stays INSIDE My Class — opens the class-scoped growth drawer */
  onOpenGrowth: () => void
}) {
  const g = cls.growth
  const trend = detail?.growthTrend ?? []
  const topImproving = useMemo(
    () =>
      (detail?.directory ?? [])
        .filter((r) => r.growthMonthDelta > 0)
        .sort((a, b) => b.growthMonthDelta - a.growthMonthDelta)[0],
    [detail],
  )
  return (
    <SectionCard
      icon={TrendingUp}
      title="Student Growth"
      subtitle={
        g.average != null
          ? `${g.average} class growth${g.scoredCount < cls.studentCount ? ` · ${g.scoredCount} of ${cls.studentCount} scored` : ` · all ${cls.studentCount} scored`}`
          : 'Growth scores build as attendance and marks accumulate'
      }
      actions={<ViewLink label="Class growth" onClick={onOpenGrowth} />}
      contentClassName=""
    >
      <div className="grid grid-cols-2 gap-px bg-border/50 sm:grid-cols-4">
        <StatTile
          label="Class average"
          value={g.average != null ? g.average : '—'}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <StatTile label="Improving" value={g.improving} tone="text-emerald-600 dark:text-emerald-400" />
        <StatTile label="Steady" value={g.steady} tone="text-amber-600 dark:text-amber-400" />
        <StatTile label="Need attention" value={g.needsAttention} tone="text-rose-600 dark:text-rose-400" />
      </div>
      {/* 8-week trend — a compact inline sparkline, no second fetch */}
      {trend.length > 1 && (
        <div className="flex items-end gap-1 border-t border-border px-4 py-3" aria-label="8-week class growth trend">
          {trend.map((p) => (
            <div
              key={p.label}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
              title={`${p.label} — ${p.value != null ? p.value : 'no data'}`}
            >
              <div className="flex h-10 w-full items-end justify-center">
                <div
                  className={cn(
                    'w-full max-w-6 rounded-t',
                    p.value == null ? 'bg-muted' : p.value >= 75 ? 'bg-emerald-500/80' : p.value >= 55 ? 'bg-amber-500/80' : 'bg-rose-500/80',
                  )}
                  style={{ height: `${p.value != null ? Math.max(p.value, 6) : 6}%` }}
                />
              </div>
              <span className="truncate text-[9px] font-medium text-muted-foreground">{p.label}</span>
            </div>
          ))}
        </div>
      )}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-border bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
        {topImproving ? (
          <>
            <span>
              Top improvement:{' '}
              <span className="font-semibold text-foreground">{topImproving.name}</span>{' '}
              <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">+{topImproving.growthMonthDelta}</span>
            </span>
            <span aria-hidden>·</span>
          </>
        ) : null}
        <span>
          {g.needsAttention > 0
            ? `${g.needsAttention} need${g.needsAttention === 1 ? 's' : ''} attention`
            : 'Needs attention: none'}
          {g.monthPoints !== 0 && ` · ${g.monthPoints > 0 ? '+' : ''}${g.monthPoints} ledger points this month`}
        </span>
      </p>
    </SectionCard>
  )
}

// ─── 5. STUDENT ATTENTION — ONE consolidated concern list (§12) ───────
// Flags from four canonical systems, deduplicated per student: attendance
// (below the 85% threshold, ≥3 marked days — server-filtered), academics
// (significantly below the class average), growth (the engine's
// needs-attention band) and fees (overdue). Each student appears ONCE.

export interface ClassAttentionRow {
  studentId: string
  name: string
  rollNo: string | null
  reasons: { label: string; cls: string }[]
}

/** The consolidated attention rows — ONE definition shared by the
 *  Overview "Open Concerns" KPI and the Student Attention section. */
export function classAttentionOf(cls: ClassHubClass, detail: HubDetailPayload | null): ClassAttentionRow[] {
  const byId = new Map<string, ClassAttentionRow>()
  const push = (studentId: string, name: string, rollNo: string | null, reason: { label: string; cls: string }) => {
    const entry = byId.get(studentId) ?? { studentId, name, rollNo, reasons: [] }
    entry.reasons.push(reason)
    byId.set(studentId, entry)
  }
  for (const s of detail?.attendanceReport.belowThreshold ?? []) {
    push(s.studentId, s.name, s.rollNo, {
      label: `Attendance ${s.ratePct}%`,
      cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    })
  }
  for (const s of detail?.performance.needsAttention ?? []) {
    push(s.studentId, s.name, s.rollNo, {
      label: `Academics ${s.pct}%`,
      cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    })
  }
  // the growth engine's needs-attention band, mirrored client-side for
  // display only (same rule as the growth drawer)
  for (const s of detail?.directory ?? []) {
    if (s.growthScore != null && (s.growthScore < 55 || s.growthMonthDelta <= -4)) {
      push(s.studentId, s.name, s.rollNo, {
        label: 'Growth',
        cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      })
    }
  }
  for (const d of cls.fees.defaulters) {
    if (d.hasOverdue) {
      push(d.studentId, d.name, d.rollNo, {
        label: 'Fees overdue',
        cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
      })
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      b.reasons.length - a.reasons.length ||
      (a.rollNo ?? '').localeCompare(b.rollNo ?? '', undefined, { numeric: true }),
  )
}

export function StudentAttentionSection({
  cls, detail, onOpenProfile, onOpenStudents,
}: {
  cls: ClassHubClass
  detail: HubDetailPayload | null
  onOpenProfile: (studentId: string) => void
  /** stays INSIDE My Class — switches to the Students tab */
  onOpenStudents: () => void
}) {
  const rows = useMemo(() => classAttentionOf(cls, detail), [cls, detail])

  return (
    <SectionCard
      icon={AlertTriangle}
      title="Student Attention"
      subtitle={
        rows.length > 0
          ? `${rows.length} student${rows.length === 1 ? '' : 's'} flagged across attendance, academics, growth or fees`
          : 'No open concerns'
      }
      actions={rows.length > 0 ? <ViewLink label="View students" onClick={onOpenStudents} /> : undefined}
      contentClassName=""
    >
      {rows.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Nothing needs your attention right now — attendance, academics, growth and fees are all clear for this class.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {rows.slice(0, 4).map((r) => (
            <li key={r.studentId}>
              <button
                type="button"
                onClick={() => onOpenProfile(r.studentId)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/40"
              >
                <GradientAvatar name={r.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {r.name}
                    <span className="ml-1.5 text-[11px] font-semibold text-muted-foreground">#{r.rollNo ?? '—'}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    {r.reasons.map((reason, i) => (
                      <span key={i} className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', reason.cls)}>
                        {reason.label}
                      </span>
                    ))}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
          {rows.length > 4 && (
            <li className="px-4 py-2 text-center text-[11px] text-muted-foreground">
              + {rows.length - 4} more student{rows.length - 4 === 1 ? '' : 's'} with open concerns
            </li>
          )}
        </ul>
      )}
    </SectionCard>
  )
}

// ─── 6. CLASS REPORTS — 4 class-scoped reports (§12/§15) ──────────────

export function ReportsSection({
  cls,
  detail,
  onOpenReport,
}: {
  cls: ClassHubClass
  detail: HubDetailPayload | null
  /** stays INSIDE My Class — opens the class-scoped report drawer */
  onOpenReport: (kind: 'attendance' | 'academics' | 'fees' | 'growth') => void
}) {
  const report = detail?.attendanceReport ?? null
  const p = detail?.performance ?? null
  const f = cls.fees
  const collectionPct = f.totalBilled > 0 ? Math.round((f.totalCollected / f.totalBilled) * 100) : null
  const g = cls.growth

  const reports = [
    {
      kind: 'attendance' as const,
      icon: CalendarCheck,
      title: 'Attendance Report',
      summary:
        report?.overall.ratePct != null
          ? `${report.overall.ratePct}% over ${report.overall.markedDays} marked days · ${report.belowThreshold.length} below threshold`
          : 'Builds as daily attendance is marked',
      tone: report?.overall.ratePct != null && report.overall.ratePct < 85 ? 'rose' : 'emerald',
    },
    {
      kind: 'academics' as const,
      icon: BarChart3,
      title: 'Academic Report',
      summary:
        p?.overallAvgPct != null
          ? `${p.latestExam?.examName ?? 'Latest exam'} · class average ${p.overallAvgPct}% · ${p.trend.length} exam${p.trend.length === 1 ? '' : 's'} with marks`
          : 'Builds as exam marks are entered',
      tone: p?.overallAvgPct != null && p.overallAvgPct < 60 ? 'rose' : 'emerald',
    },
    {
      kind: 'fees' as const,
      icon: IndianRupee,
      title: 'Fee Report',
      summary:
        collectionPct != null
          ? `${collectionPct}% collected · ${formatINR(f.outstanding)} outstanding · ${f.overdueStudents} overdue`
          : 'No fees billed for this class yet',
      tone: f.overdueStudents > 0 ? 'amber' : 'emerald',
    },
    {
      kind: 'growth' as const,
      icon: TrendingUp,
      title: 'Growth Report',
      summary:
        g.average != null
          ? `${g.average} average · ${g.improving} improving · ${g.needsAttention} need attention`
          : 'Builds as growth scores accumulate',
      tone: g.needsAttention > 0 ? 'amber' : 'emerald',
    },
  ]

  return (
    <SectionCard
      icon={FileText}
      title="Class Reports"
      subtitle={`${cls.label} — class-scoped summaries with trends and exceptions`}
      contentClassName=""
    >
      <ul className="divide-y divide-border/50">
        {reports.map((r) => (
          <li key={r.kind}>
            <button
              type="button"
              onClick={() => onOpenReport(r.kind)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  r.tone === 'rose'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : r.tone === 'amber'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                )}
              >
                <r.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{r.summary}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
