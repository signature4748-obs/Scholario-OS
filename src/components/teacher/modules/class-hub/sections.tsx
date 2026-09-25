'use client'

/**
 * class-hub/sections — the management sections of the Class Teacher Hub
 * (spec §5–§13, §21–§29). Every section follows the ONE anatomy:
 * SectionCard header + hairline rows/lists inside (§30 — tables and lists
 * for students, payments, marks, rankings and reports; cards only for
 * the KPI row). All numbers come from the canonical payloads:
 *   · overview  (GET /api/teacher/class-hub)        — today / fees / growth
 *   · detail    (GET /api/teacher/class-hub/detail) — directory /
 *     performance / ranking / attendance report / marksheets
 * Nothing is invented; empty data renders honest empty states.
 */

import { useMemo } from 'react'
import {
  ArrowRight, Award, BadgeCheck, BarChart3, CalendarCheck, CheckCircle2,
  ChevronRight, Clock, FileText, GraduationCap, IndianRupee, Printer,
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

// ─── 1. ATTENDANCE — today's status + monthly overview (§21) ───────────

export function AttendanceSection({
  cls, report, onOpenAttendance,
}: {
  cls: ClassHubClass
  report: HubDetailPayload['attendanceReport'] | null
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
      actions={<ViewLink label="View Attendance" onClick={onOpenAttendance} />}
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

function StatTile({ label, value, tone, className }: { label: string; value: string | number; tone: string; className?: string }) {
  return (
    <div className={cn('bg-card px-4 py-3', className)}>
      <p className={cn('font-display text-xl font-bold tabular-nums', tone)}>{value}</p>
      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</p>
    </div>
  )
}

// ─── 2. CLASS PERFORMANCE — averages + top + attention (§10) ───────────

export function PerformanceSection({
  detail, onOpenPerformance,
}: {
  detail: HubDetailPayload | null
  onOpenPerformance: () => void
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
      actions={p && p.subjectAverages.length > 0 ? <ViewLink label="View detailed performance" onClick={onOpenPerformance} /> : undefined}
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

// ─── 3. STUDENT DIRECTORY — the full authorized class list (§9) ────────

export function DirectorySection({
  directory, search, onOpenProfile, onOpenDirectory, studentCount,
}: {
  directory: HubDirectoryStudent[]
  search: string
  onOpenProfile: (studentId: string) => void
  onOpenDirectory: () => void
  studentCount: number
}) {
  const q = search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      q
        ? directory.filter(
            (s) => s.name.toLowerCase().includes(q) || (s.rollNo ?? '').toLowerCase().includes(q) || (s.admissionNo ?? '').toLowerCase().includes(q),
          )
        : directory,
    [directory, q],
  )
  return (
    <SectionCard
      icon={Users}
      title="Student Directory"
      subtitle={
        q
          ? `${rows.length} of ${directory.length} students match “${search.trim()}”`
          : `${directory.length} students · full class directory`
      }
      actions={<ViewLink label="View all students" onClick={onOpenDirectory} />}
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
        <div className="max-h-[30rem] overflow-y-auto">
          {/* table ≥ lg */}
          <table className="hidden w-full text-left lg:table">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-2.5">Student</th>
                <th scope="col" className="px-3 py-2.5">Roll</th>
                <th scope="col" className="px-3 py-2.5">Adm. No</th>
                <th scope="col" className="px-3 py-2.5">Attendance</th>
                <th scope="col" className="px-3 py-2.5">Growth</th>
                <th scope="col" className="px-3 py-2.5">Academic</th>
                <th scope="col" className="px-3 py-2.5">Fees</th>
                <th scope="col" className="px-4 py-2.5 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((s) => (
                <DirectoryTableRow key={s.studentId} s={s} onOpenProfile={onOpenProfile} />
              ))}
            </tbody>
          </table>
          {/* stacked rows < lg (mobile / tablet) */}
          <ul className="divide-y divide-border/50 lg:hidden">
            {rows.map((s) => (
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
          {studentCount > rows.length && rows.length >= directory.length && (
            <p className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
              Showing the full roster of {directory.length}
            </p>
          )}
        </div>
      )}
    </SectionCard>
  )
}

function DirectoryTableRow({ s, onOpenProfile }: { s: HubDirectoryStudent; onOpenProfile: (id: string) => void }) {
  return (
    <tr
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
            <p className="text-[10px] text-muted-foreground">{s.admissionNo ?? '—'}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs font-semibold tabular-nums text-muted-foreground">{s.rollNo ?? '—'}</td>
      <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground">{s.admissionNo ?? '—'}</td>
      <td className="px-3 py-2.5"><PctChip pct={s.attendancePct} /></td>
      <td className="px-3 py-2.5">
        {s.growthScore != null ? (
          <span className="text-xs font-bold tabular-nums">{s.growthScore}</span>
        ) : (
          <span className="text-xs text-muted-foreground/70">Building</span>
        )}
      </td>
      <td className="px-3 py-2.5"><PctChip pct={s.academicPct} /></td>
      <td className="px-3 py-2.5">
        {s.feeOutstanding > 0 ? (
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
            s.feeOverdue
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          )}>
            {formatINR(s.feeOutstanding)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Paid
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </td>
    </tr>
  )
}

// ─── 4. STUDENT RANKING — academic only, NEVER growth (§11) ────────────

export function RankingSection({
  detail, onOpenRanking,
}: {
  detail: HubDetailPayload | null
  onOpenRanking: () => void
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
      actions={latest ? <ViewLink label="View ranking" onClick={onOpenRanking} /> : undefined}
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

// ─── 5. FEES & PAYMENTS — collection + outstanding + verification (§22) ─

export function FeesSection({
  cls, onOpenFees, onOpenProfile,
}: {
  cls: ClassHubClass
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
      actions={<ViewLink label="View collection" onClick={onOpenFees} />}
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

// ─── 6. RESULTS — submission status by subject (§26/§27) ───────────────

export function ResultsSection({
  cls, taughtSubjects, onOpenMarks,
}: {
  cls: ClassHubClass
  taughtSubjects: { subjectId: string; subjectName: string }[]
  onOpenMarks: () => void
}) {
  const latest = cls.results[0]
  const taughtIds = new Set(taughtSubjects.map((t) => t.subjectId))
  return (
    <SectionCard
      icon={FileText}
      title="Results"
      subtitle={
        latest
          ? `${latest.examName} · ${latest.submittedSubjects}/${latest.totalSubjects} subjects submitted`
          : 'Submission status appears once this class is part of an exam'
      }
      actions={latest ? <ViewLink label="Open Marks Entry" onClick={onOpenMarks} /> : undefined}
      contentClassName=""
    >
      {!latest ? (
        <HubEmptyState
          icon={FileText}
          title="No exams yet"
          hint="The submission matrix shows every subject's marks-entry status for your class's exams."
          className="py-8"
        />
      ) : (
        <ul className="divide-y divide-border/50">
          {latest.subjects.map((s) => {
            const mine = taughtIds.has(s.subjectId)
            const done = s.entered >= cls.studentCount && s.entered > 0
            const submitted = s.submitted >= s.entered && s.submitted > 0
            return (
              <li key={s.subjectId} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {s.subjectName}
                    {mine && (
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="You teach this subject" />
                    )}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-1 w-24 overflow-hidden rounded-full bg-muted sm:w-32">
                      <span
                        className={cn('block h-full rounded-full', submitted ? 'bg-emerald-500' : done ? 'bg-amber-500' : 'bg-muted-foreground/30')}
                        style={{ width: `${cls.studentCount > 0 ? Math.min(100, (s.entered / cls.studentCount) * 100) : 0}%` }}
                      />
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {s.entered}/{cls.studentCount} entered{s.submitted > 0 && ` · ${s.submitted} submitted`}
                    </span>
                  </div>
                </div>
                {submitted ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Submitted
                  </span>
                ) : done ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    <Clock className="h-3 w-3" aria-hidden="true" /> Draft
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    <X className="h-3 w-3" aria-hidden="true" /> Pending
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="border-t border-border bg-muted/20 px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
        {taughtSubjects.length > 0
          ? `You teach ${taughtSubjects.map((t) => t.subjectName).join(', ')} — other subjects show status only; their subject teachers enter the marks.`
          : 'As class teacher you see the full submission picture. Marks entry stays with each subject\u2019s teacher.'}
      </p>
    </SectionCard>
  )
}

// ─── 7. MARKSHEETS & CERTIFICATES (§12/§13) ────────────────────────────

export function DocumentsSection({
  detail, onOpenMarksheet, rosterIds,
}: {
  detail: HubDetailPayload | null
  onOpenMarksheet: (examId: string) => void
  rosterIds: string[]
}) {
  const documents = useCertificatesStore((s) => s.documents)
  const classDocs = useMemo(
    () => documents.filter((d) => d.studentId != null && rosterIds.includes(d.studentId)),
    [documents, rosterIds],
  )
  const marksheets = detail?.marksheets ?? []
  return (
    <SectionCard
      icon={GraduationCap}
      title="Marksheets & Certificates"
      subtitle={
        marksheets.length > 0
          ? `${marksheets.length} exam${marksheets.length === 1 ? '' : 's'} with entered marks${classDocs.length > 0 ? ` · ${classDocs.length} certificates issued` : ''}`
          : 'Documents appear once marks are entered'
      }
      actions={undefined}
      contentClassName=""
    >
      {marksheets.length === 0 && classDocs.length === 0 ? (
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
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Print
                </Button>
              </div>
            </div>
          ))}
          {classDocs.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 bg-muted/20 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Certificates issued</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {classDocs.slice(0, 3).map((d) => `${d.studentName} · ${d.docType}`).join(' · ')}
                  {classDocs.length > 3 && ` · +${classDocs.length - 3} more`}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {classDocs.length}
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

// ─── 8. GROWTH — the canonical growth summary (§24/§25) ────────────────

export function GrowthSection({
  cls, onOpenGrowth,
}: {
  cls: ClassHubClass
  onOpenGrowth: () => void
}) {
  const g = cls.growth
  return (
    <SectionCard
      icon={TrendingUp}
      title="Growth"
      subtitle={
        g.average != null
          ? `${g.average} average${g.scoredCount < cls.studentCount ? ` · ${g.scoredCount} of ${cls.studentCount} scored` : ` · all ${cls.studentCount} scored`}`
          : 'Growth scores build as attendance and marks accumulate'
      }
      actions={<ViewLink label="View Growth" onClick={onOpenGrowth} />}
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
      {g.monthPoints !== 0 && (
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <IndianRupee className="mr-1 inline h-3 w-3" aria-hidden="true" style={{ display: 'none' }} />
          {g.monthPoints > 0 ? `+${g.monthPoints}` : g.monthPoints} ledger points across the class this month
          {g.building > 0 && ` · ${g.building} still building`}
        </p>
      )}
    </SectionCard>
  )
}

// ─── 9. ATTENDANCE REPORT — analytics + threshold (§21) ────────────────

export function ReportSection({
  report, onOpenReport,
}: {
  report: HubDetailPayload['attendanceReport'] | null
  onOpenReport: () => void
}) {
  const o = report?.overall
  const below = report?.belowThreshold ?? []
  return (
    <SectionCard
      icon={BarChart3}
      title="Attendance Report"
      subtitle={
        o && o.ratePct != null
          ? `${o.ratePct}% average over the last 30 days · ${o.markedDays} marked day${o.markedDays === 1 ? '' : 's'}`
          : 'Report builds as attendance is marked'
      }
      actions={o && o.ratePct != null ? <ViewLink label="View report" onClick={onOpenReport} /> : undefined}
      contentClassName=""
    >
      {!o || (o.ratePct == null && o.markedDays === 0) ? (
        <HubEmptyState
          icon={BarChart3}
          title="No attendance data yet"
          hint="Monthly and weekly trends appear once daily attendance is saved for a few days."
          className="py-8"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px bg-border/50 sm:grid-cols-4">
            <StatTile label="Present" value={o.present} tone="text-emerald-600 dark:text-emerald-400" />
            <StatTile label="Absent" value={o.absent} tone="text-rose-600 dark:text-rose-400" />
            <StatTile label="Late" value={o.late} tone="text-amber-600 dark:text-amber-400" />
            <StatTile label="Leave" value={o.leave} tone="text-sky-600 dark:text-sky-400" />
          </div>
          {below.length > 0 && (
            <ul className="divide-y divide-border/50 border-t border-border">
              {below.slice(0, 3).map((b) => (
                <li key={b.studentId} className="flex items-center gap-3 px-4 py-2.5">
                  <GradientAvatar name={b.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {b.absentDays} absence{b.absentDays === 1 ? '' : 's'} in {b.markedDays} marked days
                    </p>
                  </div>
                  <PctChip pct={b.ratePct} tone="rose" />
                </li>
              ))}
              {below.length > 3 && (
                <li className="px-4 py-2 text-center text-[11px] text-muted-foreground">
                  + {below.length - 3} more below the 85% threshold
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </SectionCard>
  )
}
