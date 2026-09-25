'use client'

/**
 * class-hub/sections — the OVERVIEW sections of the Class Teacher Hub
 * (spec §24 structure). Every section follows the ONE anatomy:
 * SectionCard header + hairline rows/lists inside (§30 — tables and
 * lists for students, payments, marks, rankings and reports; cards only
 * for the KPI row). All numbers come from the canonical payloads:
 *   · overview  (GET /api/teacher/class-hub)        — today / fees / growth
 *   · detail    (GET /api/teacher/class-hub/detail) — directory /
 *     performance / ranking / attendance report / marksheets / growth trend
 *
 * THE CONTEXT RULE (§3–§5): every "View …" action stays INSIDE My Class —
 * it switches to the class-scoped tab or opens a class-scoped drawer.
 * Nothing navigates to a global module.
 */

import { useMemo } from 'react'
import {
  ArrowRight, Award, BarChart3, CalendarCheck, CheckCircle2,
  ChevronRight, Clock, FileText, GraduationCap, IndianRupee,
  Search, TrendingUp, Users, Wallet, X,
} from 'lucide-react'
import { GradientAvatar } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCertificatesStore } from '@/lib/store/certificates-store'
import { SectionCard } from '../shared/section-card'
import { HubEmptyState } from '../shared/hub-stat-cards'
import type {
  ClassHubClass, HubDetailPayload, HubDirectoryStudent,
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

/** Quiet percentage chip with tone. */
function PctChip({ pct, tone = 'auto' }: { pct: number | null; tone?: 'auto' | 'emerald' | 'amber' | 'rose' }) {
  if (pct == null) return <span className="text-xs text-muted-foreground/70">—</span>
  const t =
    tone === 'auto'
      ? pct >= 85
        ? 'emerald'
        : pct >= 75
          ? 'amber'
          : 'rose'
      : tone
  const cls =
    t === 'emerald'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : t === 'amber'
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', cls)}>
      {pct}%
    </span>
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

// ─── 1. ATTENDANCE — today's status + 30-day overview (§24) ───────────

export function AttendanceSection({
  cls, report, onOpenAttendance,
}: {
  cls: ClassHubClass
  report: HubDetailPayload['attendanceReport'] | null
  /** stays INSIDE My Class — switches to the Attendance tab */
  onOpenAttendance: () => void
}) {
  const att = cls.attendanceToday
  const rate = report?.overall.ratePct ?? null
  return (
    <SectionCard
      icon={CalendarCheck}
      title="Attendance"
      subtitle={
        att.marked
          ? `Today · ${att.present + att.late} of ${cls.studentCount} attended`
          : "Today's attendance hasn't been marked yet"
      }
      actions={<ViewLink label="View attendance" onClick={onOpenAttendance} />}
      contentClassName=""
    >
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
                As class teacher, marking the daily attendance is your morning duty.
              </p>
              <Button size="sm" onClick={onOpenAttendance} className="h-8 shrink-0 text-xs">
                <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mark attendance
              </Button>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  )
}

// ─── 2. CLASS PERFORMANCE — averages + top + attention (§24) ──────────

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
      title="Class Performance"
      subtitle={
        p?.latestExam
          ? `${p.latestExam.examName} · class average ${p.overallAvgPct != null ? `${p.overallAvgPct}%` : '—'}`
          : 'Academic averages appear once exam marks are entered'
      }
      actions={p && p.subjectAverages.length > 0 ? <ViewLink label="View academic details" onClick={onOpenAcademics} /> : undefined}
      contentClassName=""
    >
      {!p || p.subjectAverages.length === 0 ? (
        <HubEmptyState
          icon={BarChart3}
          title="No exam marks yet"
          hint="Subject averages, top performers and trends come from the marks your subject teachers enter."
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

// ─── 3. STUDENT DIRECTORY — the class preview (§24; full list = Students tab) ──

export function DirectorySection({
  directory,
  search,
  onOpenProfile,
  onOpenStudents,
  preview,
}: {
  directory: HubDirectoryStudent[]
  search: string
  onOpenProfile: (studentId: string) => void
  /** stays INSIDE My Class — switches to the Students tab */
  onOpenStudents: () => void
  /** overview shows a preview; the Students tab renders the full list */
  preview?: number
}) {
  const q = search.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      q
        ? directory.filter(
            (s) => s.name.toLowerCase().includes(q) || (s.rollNo ?? '').toLowerCase().includes(q) || (s.admissionNo ?? '').toLowerCase().includes(q),
          )
        : directory,
    [directory, q],
  )
  const rows = preview != null ? filtered.slice(0, preview) : filtered
  return (
    <SectionCard
      icon={Users}
      title="Student Directory"
      subtitle={
        q
          ? `${filtered.length} of ${directory.length} students match “${search.trim()}”`
          : `${directory.length} students · ${preview != null && filtered.length > preview ? `first ${rows.length} · ` : ''}full authorized class view`
      }
      actions={<ViewLink label="View all students" onClick={onOpenStudents} />}
      contentClassName=""
    >
      {rows.length === 0 ? (
        <HubEmptyState
          icon={Search}
          title={q ? `No students match “${search.trim()}”` : 'No students enrolled'}
          hint={q ? 'Try a different name, roll number or admission number.' : 'Active students enrolled in this class will appear here.'}
          className="py-8"
        />
      ) : (
        <>
          <ul className="divide-y divide-border/50">
            {rows.map((s) => (
              <li key={s.studentId}>
                <button
                  type="button"
                  onClick={() => onOpenProfile(s.studentId)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/40"
                >
                  <GradientAvatar name={s.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {s.name}
                      <span className="ml-1.5 text-[11px] font-semibold text-muted-foreground">#{s.rollNo ?? '—'}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>Att {s.attendancePct != null ? `${s.attendancePct}%` : '—'}</span>
                      <span aria-hidden>·</span>
                      <span>Growth {s.growthScore != null ? s.growthScore : 'Building'}</span>
                      <span aria-hidden>·</span>
                      <span>Acad {s.academicPct != null ? `${s.academicPct}%` : '—'}</span>
                      {s.feeOutstanding > 0 && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={s.feeOverdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'font-semibold text-amber-600 dark:text-amber-400'}>
                            {formatINR(s.feeOutstanding)} due
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {preview != null && filtered.length > preview && (
            <button
              type="button"
              onClick={onOpenStudents}
              className="flex w-full items-center justify-center gap-1 border-t border-border bg-muted/20 px-4 py-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              + {filtered.length - preview} more student{filtered.length - preview === 1 ? '' : 's'} — open the class directory
            </button>
          )}
        </>
      )}
    </SectionCard>
  )
}

// ─── 4. STUDENT RANKING — academic only, NEVER growth (§24) ───────────

export function RankingSection({
  detail, onOpenAcademics,
}: {
  detail: HubDetailPayload | null
  /** stays INSIDE My Class — switches to the Academics tab (full ranking) */
  onOpenAcademics: () => void
}) {
  const exams = detail?.ranking.exams ?? []
  const latest = exams[0]
  const rows = latest ? detail?.ranking.rowsByExam[latest.examId] ?? [] : []
  return (
    <SectionCard
      icon={Award}
      title="Student Ranking"
      subtitle={
        latest
          ? `${latest.examName} · academic performance only`
          : 'Rankings appear once exam marks are entered'
      }
      actions={latest ? <ViewLink label="View ranking" onClick={onOpenAcademics} /> : undefined}
      contentClassName=""
    >
      {rows.length === 0 ? (
        <HubEmptyState
          icon={Award}
          title="No ranked exam yet"
          hint="Rankings use canonical exam marks — the growth score is a different concept and never used here."
          className="py-8"
        />
      ) : (
        <ul className="divide-y divide-border/50">
          {rows.slice(0, 5).map((r) => (
            <li key={r.studentId} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                  r.rank === 1 && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                  r.rank === 2 && 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
                  r.rank === 3 && 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
                  r.rank > 3 && 'bg-muted text-muted-foreground',
                )}
              >
                {String(r.rank).padStart(2, '0')}
              </span>
              <GradientAvatar name={r.name} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</p>
              <span className="text-sm font-bold tabular-nums">{r.pct}%</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

// ─── 5. FEES & PAYMENTS — collection + outstanding + verification (§24) ─

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
      title="Fees & Payments"
      subtitle={
        f.awaitingVerificationCount > 0
          ? `${formatINR(f.awaitingVerificationAmount)} awaiting the Principal's verification`
          : collectionPct != null
            ? `${collectionPct}% of ${formatINR(f.totalBilled)} collected`
            : 'No fees billed for this class yet'
      }
      actions={<ViewLink label="View fee details" onClick={onOpenFees} />}
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
          {f.defaulters.slice(0, 4).map((d) => (
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
          {f.defaulters.length > 4 && (
            <li className="px-4 py-2 text-center text-[11px] text-muted-foreground">
              + {f.defaulters.length - 4} more students with outstanding fees
            </li>
          )}
        </ul>
      )}
    </SectionCard>
  )
}

// ─── 6. CLASS GROWTH — the canonical growth summary + trend (§20–§22) ─

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
      title="Class Growth"
      subtitle={
        g.average != null
          ? `${g.average} average${g.scoredCount < cls.studentCount ? ` · ${g.scoredCount} of ${cls.studentCount} scored` : ` · all ${cls.studentCount} scored`}`
          : 'Growth scores build as attendance and marks accumulate'
      }
      actions={<ViewLink label="View class growth" onClick={onOpenGrowth} />}
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
      {/* 8-week trend (§22) — a compact inline sparkline, no second fetch */}
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

// ─── 7. CLASS REPORTS — 4 class-scoped report summaries (§23/§24) ────

export interface ReportKindInfo {
  key: 'attendance' | 'academics' | 'fees' | 'growth'
}

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
          ? `${p.latestExam?.examName ?? 'Latest exam'} · class average ${p.overallAvgPct}% · ${p.trend.length} exams with marks`
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

// ─── 8. MARKSHEETS & CERTIFICATES (§24; detail = MarksheetDrawer) ─────

export function DocumentsSection({
  detail, onOpenMarksheet, rosterIds,
}: {
  detail: HubDetailPayload | null
  onOpenMarksheet: (examId: string) => void
  rosterIds: string[]
}) {
  const allDocuments = useCertificatesStore((s) => s.documents)
  const documents = useMemo(
    () => allDocuments.filter((d) => d.studentId != null && rosterIds.includes(d.studentId)),
    [allDocuments, rosterIds],
  )
  const marksheets = detail?.marksheets ?? []
  return (
    <SectionCard
      icon={GraduationCap}
      title="Marksheets & Certificates"
      subtitle={
        marksheets.length > 0
          ? `${marksheets.length} exam${marksheets.length === 1 ? '' : 's'} with entered marks${documents.length > 0 ? ` · ${documents.length} certificates issued` : ''}`
          : 'Documents appear once marks are entered'
      }
      contentClassName=""
    >
      {marksheets.length === 0 && documents.length === 0 ? (
        <HubEmptyState
          icon={GraduationCap}
          title="No documents yet"
          hint="Class marksheets build from the canonical exam marks; certificates are issued by the school office."
          className="py-8"
        />
      ) : (
        <div className="divide-y divide-border/50">
          {marksheets.map((m) => (
            <div key={m.examId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.examName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {m.studentsScored} scored · {m.subjectsWithMarks} subject{m.subjectsWithMarks === 1 ? '' : 's'}
                  {m.avgPct != null && ` · avg ${m.avgPct}%`}
                  {m.resultStatus === 'Declared' && ' · results declared'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onOpenMarksheet(m.examId)}>
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" /> View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => onOpenMarksheet(m.examId)}
                  aria-label={`Print ${m.examName} marksheet`}
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Print
                </Button>
              </div>
            </div>
          ))}
          {documents.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 bg-muted/20 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Certificates issued</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {documents.slice(0, 3).map((d) => `${d.studentName} · ${d.docType}`).join(' · ')}
                  {documents.length > 3 && ` · +${documents.length - 3} more`}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {documents.length}
              </span>
            </div>
          )}
          <p className="bg-muted/20 px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Marksheets read the canonical marks — the same numbers every other module uses. Certificate generation stays with the school office.
          </p>
        </div>
      )}
    </SectionCard>
  )
}
