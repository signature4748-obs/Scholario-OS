'use client'

/**
 * class-hub/detail-drawers — the deep-detail surfaces of the Class
 * Teacher Hub (spec §10/§11/§21/§12): Performance, Ranking, Attendance
 * Report and the printable class Marksheet. One responsive container
 * pattern (right Sheet ≥ sm, bottom Drawer on phones) with internal
 * scrolling and safe-area padding; tables/lists inside, never nested
 * cards (§30). The marksheet prints via a print-only stylesheet and
 * downloads as CSV — always from the canonical ExamMark matrix.
 */

import { useState } from 'react'
import {
  ArrowDownRight, ArrowUpRight, Award, BarChart3, CalendarCheck, Download,
  Loader2, Printer, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Drawer, DrawerContent, DrawerDescription, DrawerTitle,
} from '@/components/ui/drawer'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { GradientAvatar } from '@/components/shared/ui'
import { useClassMarksheet } from './hooks'
import type { HubDetailPayload, MarksheetPayload } from './types'

// ─── one responsive container ──────────────────────────────────────────

function HubSheet({
  open, onOpenChange, title, description, children, wide,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children: React.ReactNode
  wide?: boolean
}) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="max-h-[88dvh] rounded-t-2xl">
          <DrawerTitle className="px-4 pb-1.5 pt-2 text-sm font-semibold">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{description}</DrawerDescription>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn('flex w-full flex-col gap-0 p-0 sm:max-w-xl', wide && 'sm:max-w-3xl')}
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-base">{title}</SheetTitle>
          <SheetDescription className="text-xs">{description}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Performance drawer (§10) ──────────────────────────────────────────

export function PerformanceDrawer({
  open, onOpenChange, detail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: HubDetailPayload | null
}) {
  const p = detail?.performance ?? null
  return (
    <HubSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Class Performance"
      description={
        p?.latestExam
          ? `Subject averages and trends from ${p.latestExam.examName} — canonical exam marks.`
          : 'Academic performance from canonical exam marks.'
      }
    >
      {!p || p.subjectAverages.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No exam marks for this class yet.</p>
      ) : (
        <div className="space-y-6">
          {/* trend */}
          {p.trend.length > 1 && (
            <section aria-label="Exam trend">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Class average per exam
              </h4>
              <ul className="space-y-2">
                {p.trend.map((t) => {
                  const prev = p.trend.indexOf(t) > 0 ? p.trend[p.trend.indexOf(t) - 1].avgPct : null
                  const delta = prev != null ? t.avgPct - prev : null
                  return (
                    <li key={t.examId} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm">{t.examName}</span>
                      <span className="text-sm font-bold tabular-nums">{t.avgPct}%</span>
                      {delta != null && delta !== 0 && (
                        <span
                          className={cn(
                            'flex w-14 items-center justify-end gap-0.5 text-[11px] font-semibold tabular-nums',
                            delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                          )}
                        >
                          {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {Math.abs(delta)}%
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          {/* subject table */}
          <section aria-label="Subject averages">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subject averages · {p.latestExam?.examName}
            </h4>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/60">
                {p.subjectAverages.map((s) => (
                  <tr key={s.subjectId}>
                    <td className="py-2 pr-3 font-medium">{s.subjectName}</td>
                    <td className="py-2">
                      <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            s.avgPct >= 75 ? 'bg-emerald-500' : s.avgPct >= 50 ? 'bg-amber-500' : 'bg-rose-500',
                          )}
                          style={{ width: `${Math.min(100, s.avgPct)}%` }}
                        />
                      </span>
                    </td>
                    <td className="w-14 py-2 text-right font-bold tabular-nums">{s.avgPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {/* top + attention lists */}
          <div className="grid gap-6 sm:grid-cols-2">
            <section aria-label="Top performers">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Award className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" /> Top performers
              </h4>
              <ul className="divide-y divide-border/60">
                {p.topPerformers.map((t) => (
                  <li key={t.studentId} className="flex items-center gap-2.5 py-2">
                    <span className="w-4 text-xs font-bold tabular-nums text-muted-foreground">{t.rank}</span>
                    <GradientAvatar name={t.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                    <span className="text-sm font-bold tabular-nums">{t.pct}%</span>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-label="Students needing attention">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 rotate-180 text-rose-500" aria-hidden="true" /> Needs attention
              </h4>
              {p.needsAttention.length === 0 ? (
                <p className="py-3 text-xs text-muted-foreground">No one is significantly below the class average.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {p.needsAttention.map((t) => (
                    <li key={t.studentId} className="flex items-center gap-2.5 py-2">
                      <GradientAvatar name={t.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                      <span className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">{t.pct}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </HubSheet>
  )
}

// ─── Ranking drawer (§11) ──────────────────────────────────────────────

export function RankingDrawer({
  open, onOpenChange, detail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: HubDetailPayload | null
}) {
  const exams = detail?.ranking.exams ?? []
  const [examId, setExamId] = useState<string | null>(null)
  const active = examId ?? exams[0]?.examId ?? null
  const rows = active ? detail?.ranking.rowsByExam[active] ?? [] : []
  return (
    <HubSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Class Ranking"
      description="Academic ranking from canonical exam marks — never the growth score."
    >
      {exams.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No exams with marks for this class yet.</p>
      ) : (
        <div className="space-y-4">
          <div role="tablist" aria-label="Choose exam" className="flex flex-wrap gap-1.5">
            {exams.map((e) => (
              <button
                key={e.examId}
                type="button"
                role="tab"
                aria-selected={active === e.examId}
                onClick={() => setExamId(e.examId)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active === e.examId
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {e.examName}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li key={r.studentId} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                    r.rank === 1 && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                    r.rank === 2 && 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
                    r.rank === 3 && 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
                    r.rank > 3 && 'bg-muted text-muted-foreground',
                  )}
                >
                  {r.rank}
                </span>
                <GradientAvatar name={r.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">Roll {r.rollNo ?? '—'}</p>
                </div>
                {r.total != null && r.maxTotal != null && (
                  <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:block">
                    {r.total}/{r.maxTotal}
                  </span>
                )}
                <span className="w-12 text-right text-sm font-bold tabular-nums">{r.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </HubSheet>
  )
}

// ─── Attendance report drawer (§21) ────────────────────────────────────

export function ReportDrawer({
  open, onOpenChange, detail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: HubDetailPayload | null
}) {
  const r = detail?.attendanceReport ?? null
  const monthLabel = (m: string) => {
    const [y, mo] = m.split('-')
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-IN', { month: 'short' })
  }
  const weekLabel = (w: string) => {
    const d = new Date(`${w}T00:00:00.000Z`)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  }
  return (
    <HubSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Attendance Report"
      description="Overall, monthly and weekly attendance from the canonical daily records."
    >
      {!r || (r.overall.ratePct == null && r.overall.markedDays === 0) ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No attendance data for this class yet.</p>
      ) : (
        <div className="space-y-6">
          {/* headline */}
          <div className="flex items-center gap-3 rounded-xl bg-muted/30 px-4 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {r.overall.ratePct != null ? `${r.overall.ratePct}% average` : 'No rate yet'}
                <span className="font-normal text-muted-foreground"> · last 30 days</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {r.overall.markedDays} marked day{r.overall.markedDays === 1 ? '' : 's'} · {r.overall.present} present ·{' '}
                {r.overall.absent} absent · {r.overall.late} late · {r.overall.leave} on leave
              </p>
            </div>
          </div>
          {/* monthly */}
          {r.monthly.length > 0 && (
            <section aria-label="Monthly attendance">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly rate</h4>
              <div className="flex items-end gap-3">
                {r.monthly.map((m) => (
                  <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${m.month}: ${m.ratePct ?? '—'}%`}>
                    <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{m.ratePct ?? '—'}</span>
                    <div className="flex h-24 w-full items-end justify-center">
                      <div
                        className={cn(
                          'w-full max-w-8 rounded-t-md',
                          (m.ratePct ?? 0) >= 90 ? 'bg-emerald-500' : (m.ratePct ?? 0) >= 75 ? 'bg-amber-500' : 'bg-rose-500',
                        )}
                        style={{ height: `${Math.max(m.ratePct ?? 4, 4)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">{monthLabel(m.month)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {/* weekly */}
          {r.weekly.length > 0 && (
            <section aria-label="Weekly attendance trend">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weekly trend</h4>
              <ul className="space-y-2">
                {r.weekly.map((w) => (
                  <li key={w.week} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-[11px] text-muted-foreground">W/C {weekLabel(w.week)}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          'block h-full rounded-full',
                          (w.ratePct ?? 0) >= 90 ? 'bg-emerald-500' : (w.ratePct ?? 0) >= 75 ? 'bg-amber-500' : 'bg-rose-500',
                        )}
                        style={{ width: `${Math.min(100, w.ratePct ?? 0)}%` }}
                      />
                    </span>
                    <span className="w-9 text-right text-xs font-bold tabular-nums">{w.ratePct ?? '—'}%</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {/* below threshold */}
          <section aria-label="Students below threshold">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Below 85% threshold
            </h4>
            {r.belowThreshold.length === 0 ? (
              <p className="py-3 text-xs text-muted-foreground">Every student is at or above the threshold.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {r.belowThreshold.map((b) => (
                  <li key={b.studentId} className="flex items-center gap-2.5 py-2">
                    <GradientAvatar name={b.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {b.absentDays} absence{b.absentDays === 1 ? '' : 's'} in {b.markedDays} marked days
                      </p>
                    </div>
                    <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      {b.ratePct}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </HubSheet>
  )
}

// ─── Marksheet viewer (§12) — matrix + print + CSV ─────────────────────

export function MarksheetDrawer({
  open, onOpenChange, classId, examId, examName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: string | null
  examId: string | null
  examName: string | null
}) {
  const { data, error, loading } = useClassMarksheet(open ? classId : null, open ? examId : null)

  const downloadCsv = () => {
    if (!data) return
    const header = ['Roll No', 'Admission No', 'Student', ...data.subjects.map((s) => `${s.subjectName} (/${s.maxMarks})`), 'Total', 'Percent', 'Rank']
    const lines = data.rows.map((r) => [
      r.rollNo ?? '',
      r.admissionNo ?? '',
      r.name,
      ...data.subjects.map((s) => {
        const m = r.marks[s.subjectId]
        return m ? String(m.obtained ?? (m.status === 'ABSENT' ? 'AB' : '')) : ''
      }),
      String(r.total),
      String(r.pct),
      r.rank != null ? String(r.rank) : '',
    ])
    const csv = [header, ...lines].map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.classLabel.replace(/\s+/g, '-')} — ${data.exam.examName.replace(/\s+/g, '-')}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <HubSheet
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={`Marksheet · ${examName ?? ''}`}
      description="The canonical exam marks for this class — the same numbers every other module uses."
    >
      {/* Print stylesheet — mounted ONLY while this sheet is open, so
          printing any other page stays untouched. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #marksheet-print-area, #marksheet-print-area * { visibility: visible !important; }
          #marksheet-print-header, #marksheet-print-header * { visibility: visible !important; }
          #marksheet-print-area {
            position: absolute !important;
            left: 0; top: 70px;
            width: 100%;
            border: none !important;
            font-size: 10px;
            overflow: visible !important;
          }
          #marksheet-print-header { position: absolute !important; left: 0; top: 12px; width: 100%; visibility: visible !important; }
        }
      `}</style>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading marksheet…
        </div>
      ) : error ? (
        <p className="py-10 text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : !data ? null : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{data.classLabel} · {data.exam.examName}</p>
              <p className="text-xs text-muted-foreground">
                {data.exam.session ?? ''}{data.exam.examDate ? ` · ${data.exam.examDate}` : ''}
                {data.classAveragePct != null && ` · class average ${data.classAveragePct}%`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={downloadCsv}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download CSV
              </Button>
              <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" aria-hidden="true" /> Print
              </Button>
            </div>
          </div>

          {/* print-only header */}
          <div id="marksheet-print-header" className="hidden print:block">
            <h2 className="text-lg font-bold">{data.classLabel} — {data.exam.examName}</h2>
            <p className="text-xs">
              Greenwood High School{data.room ? ` · Room ${data.room}` : ''} · Class Teacher Copy ·{' '}
              {new Date().toLocaleDateString('en-IN')}
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border" id="marksheet-print-area">
            <table className="w-full min-w-[540px] text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-3 py-2">Roll</th>
                  <th scope="col" className="px-3 py-2">Student</th>
                  {data.subjects.map((s) => (
                    <th key={s.subjectId} scope="col" className="px-2 py-2 text-center" title={`${s.subjectName} · max ${s.maxMarks}`}>
                      {s.subjectName.slice(0, 9)}
                      <span className="block font-normal normal-case text-[9px]">/{s.maxMarks}</span>
                    </th>
                  ))}
                  <th scope="col" className="px-2 py-2 text-center">Total</th>
                  <th scope="col" className="px-2 py-2 text-center">%</th>
                  <th scope="col" className="px-3 py-2 text-center">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.rows.map((r) => (
                  <tr key={r.studentId} className="hover:bg-accent/30">
                    <td className="px-3 py-2 font-semibold tabular-nums text-muted-foreground">{r.rollNo ?? '—'}</td>
                    <td className="max-w-[10rem] truncate px-3 py-2 font-medium">{r.name}</td>
                    {data.subjects.map((s) => {
                      const m = r.marks[s.subjectId]
                      return (
                        <td key={s.subjectId} className="px-2 py-2 text-center tabular-nums">
                          {m ? (m.obtained != null ? m.obtained : <span className="text-[10px] text-rose-500">AB</span>) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-2 py-2 text-center font-semibold tabular-nums">{r.total}</td>
                    <td className="px-2 py-2 text-center font-semibold tabular-nums">{r.pct}%</td>
                    <td className="px-3 py-2 text-center font-bold tabular-nums">{r.rank ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground print:hidden">
            AB = absent on exam day · — = not assessed. Rank is by total marks from the canonical entries.
          </p>
        </div>
      )}
    </HubSheet>
  )
}

/** Kept for the composition root — the style lives inside the drawer so
 *  it applies only while the marksheet is open (printing other pages of
 *  the app is never affected). */
export function MarksheetPrintStyle() {
  return null
}
