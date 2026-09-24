'use client'

/**
 * FeesOverviewSection — the Fee Management landing view: a FINANCIAL
 * COMMAND CENTRE. The Principal grasps the school's position in seconds:
 *
 *   1. KPI cards (Total Expected · Collected · Outstanding · Students
 *      With Dues [+ Pending Verification while collections await the
 *      Principal's decision]) — clickable, wired to Outreach/Accounts/
 *      Transactions/Payments.
 *   2. LEFT COLUMN (2/3): Collection Trend (OPEN chart) with Class-wise
 *      Collection DIRECTLY UNDERNEATH. RIGHT COLUMN (1/3): Breakdown
 *      (expected obligation by fee head, thin CSS bars).
 *   3. Outstanding Dues + Needs Attention — one two-column grid of
 *      ACTIONABLE panels.
 *   4. Recent Payments (summary only) + Payment Modes mix.
 *
 * CANONICAL DATA SOURCE: every number derives from useCanonicalFees() —
 * the same /api/fees + /api/fees/transactions ledger the Transactions
 * tab and Student Accounts render. The Students With Dues card keeps the
 * LIVE server aggregation (dues-summary-store → /api/fees/defaulters
 * summary) it has always shown. No client fee-store reads remain.
 */

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Wallet, CheckCircle2, AlertCircle, Users, ArrowRight, CheckCheck, Banknote, Send, Clock3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDuesSummaryStore, selectLiveDues } from '@/lib/store/dues-summary-store'
import type { PaymentMode } from '@/lib/store/fee-store'
import { formatINR, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SummaryCard, SummaryCardGrid } from '../shared/summary-card'
import { LiveChip } from '../shared/live-chip'
import { Panel } from '../shared/panel'
import { OpenChartSection } from '../shared/open-chart-section'
import { FeeEmptyState, ModeIcon, modeAccent } from './fees-shared'
import { MiniAreaChart, FEES_CHART_PALETTE } from './fees-charts'
import { useCanonicalFees, canonicalMethodLabel } from './use-canonical-fees'
import type { FeeTab } from './fees-shared'

interface Props {
  onNavigate: (tab: FeeTab) => void
}

/** Avatar initials for student rows ("Aarav Sharma" → "AS"). */
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => (p[0] ?? '').toUpperCase()).join('')
}

/** Minimal days-overdue chip (spec chip recipe: emerald/amber/rose/slate tints).
 *  Escalation: Due soon → slate · ≤30d → amber · >30d → rose. */
function OverdueChip({ days }: { days: number }) {
  const tone =
    days <= 0 ? 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
      : days <= 30 ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap', tone)}>
      {days <= 0 ? 'Due soon' : `${days}d overdue`}
    </span>
  )
}

// Stable empty fallbacks so every hook below the gates runs
// unconditionally (Rules of Hooks) even before data resolves.
const EMPTY_STUDENTS: never[] = []
const EMPTY_TXNS: never[] = []
const EMPTY_HEADS: never[] = []
const EMPTY_CLASSES: never[] = []
const EMPTY_MONTHLY: never[] = []

export function FeesOverviewSection({ onNavigate }: Props) {
  const { data, loading, error, refresh } = useCanonicalFees()

  // Round-7 — the Outreach-facing KPI reads the LIVE server aggregation
  // (same numbers the Outreach tab shows); every other card reads the
  // canonical fee ledger. Sync is idempotent — this module and the
  // dashboard KPI share one fetch.
  const dues = useDuesSummaryStore(selectLiveDues)
  const ensureDues = useDuesSummaryStore((s) => s.ensure)
  useEffect(() => { void ensureDues() }, [ensureDues])

  // ── Derivations (all hooks run before the state gates below) ────────
  const students = data?.students ?? EMPTY_STUDENTS
  const txns = data?.txns ?? EMPTY_TXNS
  const byHead = data?.byHead ?? EMPTY_HEADS
  const byClass = data?.byClass ?? EMPTY_CLASSES
  const monthly = data?.monthly ?? EMPTY_MONTHLY

  // Largest outstanding balances — the collection worklist (max 25 kept,
  // scroll cap shows ~5 at a time).
  const topDues = useMemo(
    () => [...students].filter((a) => a.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 25),
    [students],
  )

  // Classes with students carrying dues (KPI sub-line).
  const classesWithDues = useMemo(
    () => byClass.filter((c) => c.outstanding > 0).length,
    [byClass],
  )

  // Oldest overdue first — the follow-up worklist (max 8).
  const needsAttention = useMemo(
    () => [...students]
      .filter((a) => a.overdue > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstanding - a.outstanding)
      .slice(0, 8),
    [students],
  )

  // Recent verified payments — a concise activity SUMMARY (the complete
  // authoritative history lives in the Transactions section).
  const recentPayments = useMemo(
    () =>
      [...txns]
        .filter((t) => t.status === 'SUCCESS' || t.status === 'VERIFIED')
        .sort((a, b) => new Date(b.collectedAt ?? b.createdAt).getTime() - new Date(a.collectedAt ?? a.createdAt).getTime())
        .slice(0, 6),
    [txns],
  )

  // Payment mode mix — share of verified collection amount.
  const modeMix = useMemo(() => {
    const totalsByMode = new Map<PaymentMode, number>()
    let sum = 0
    for (const t of txns) {
      if (t.status !== 'SUCCESS' && t.status !== 'VERIFIED') continue
      const mode = canonicalMethodLabel(t.method)
      totalsByMode.set(mode, (totalsByMode.get(mode) ?? 0) + t.amount)
      sum += t.amount
    }
    return Array.from(totalsByMode.entries())
      .map(([mode, value]) => ({ mode, value, pct: sum > 0 ? Math.round((value / sum) * 100) : 0 }))
      .sort((a, b) => b.value - a.value)
  }, [txns])

  // Breakdown — expected obligation per fee head (byHead pre-sorts desc).
  const catTotal = useMemo(() => byHead.reduce((sum, c) => sum + c.billed, 0), [byHead])
  const catMax = byHead[0]?.billed ?? 0
  const visibleCategories = byHead.slice(0, 6)
  const hiddenCategories = Math.max(0, byHead.length - visibleCategories.length)

  const trendHasData = monthly.some((m) => m.collected > 0 || m.pending > 0)

  // Class-wise collection progress — canonical per-class figures from the
  // fee ledger. Most-relevant first: largest outstanding balance at top.
  // Initially the top 5 rows keep the section compact; "View all"
  // expands every class with a scroll cap.
  const [allClasses, setAllClasses] = useState(false)
  const CLASSWISE_PREVIEW = 5
  const classRows = byClass
  const visibleClassRows = allClasses ? classRows : classRows.slice(0, CLASSWISE_PREVIEW)
  const hiddenClassCount = Math.max(0, classRows.length - visibleClassRows.length)

  // ── Honest async states ─────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading fee overview">
        <SummaryCardGrid columns={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border p-4 space-y-2.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </SummaryCardGrid>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-[188px] w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <Panel title="Fee Overview" subtitle="canonical fee ledger">
        <FeeEmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Could not load the fee ledger"
          description={error}
          action={<Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refresh()}>Try again</Button>}
        />
      </Panel>
    )
  }

  if (!data || data.fees.length === 0) {
    return (
      <Panel title="Fee Overview" subtitle="canonical fee ledger">
        <FeeEmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="No fee rows yet"
          description="Fee rows created for students appear here — totals, breakdowns, trends and dues all follow."
          action={<Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refresh()}>Refresh</Button>}
        />
      </Panel>
    )
  }

  const { totals, sessionLabel } = data

  // Collection rate — one decimal (e.g. 80.0%).
  const collectionRate = totals.billed > 0 ? Math.round((totals.collected / totals.billed) * 1000) / 10 : 0

  /* Shared row anatomy — avatar + identity + right-aligned amount/chip. */
  const listPanelBtnClass =
    'w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors text-left focus:outline-none focus-visible:bg-muted/40'

  return (
    <div className="space-y-4">
      {/* 1 — KPI cards: the Principal's four questions (+ pending
          verification while collections await the decision). */}
      <SummaryCardGrid columns={totals.pendingCount > 0 ? 5 : 4}>
        <SummaryCard
          icon={<Wallet className="h-4 w-4" />}
          label="Total Expected"
          value={formatINR(totals.billed, true)}
          sub={`${totals.studentsWithFees} students with fees`}
          tone="slate"
          delay={0}
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Collected"
          value={formatINR(totals.collected, true)}
          sub={`${collectionRate}% collected`}
          tone="emerald"
          delay={0.05}
          onClick={() => onNavigate('transactions')}
        />
        <SummaryCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="Outstanding"
          value={formatINR(totals.outstanding, true)}
          sub={`${totals.overdueStudents} student${totals.overdueStudents === 1 ? '' : 's'} overdue`}
          tone="rose"
          delay={0.1}
          onClick={() => onNavigate('accounts')}
        />
        <SummaryCard
          icon={<Users className="h-4 w-4" />}
          label="Students With Dues"
          value={dues ? dues.defaulterCount : totals.studentsWithDues}
          sub={
            dues
              ? `across ${dues.classesWithDues} classes · ${formatINR(dues.totalOutstanding, true)} outstanding`
              : `across ${classesWithDues} classes · reminders ready`
          }
          chip={dues ? <LiveChip /> : undefined}
          tone="amber"
          delay={0.15}
          onClick={() => onNavigate('outreach')}
        />
        {totals.pendingCount > 0 && (
          <SummaryCard
            icon={<Clock3 className="h-4 w-4" />}
            label="Pending Verification"
            value={formatINR(totals.pendingAmount, true)}
            sub={`${totals.pendingCount} collection${totals.pendingCount === 1 ? '' : 's'} awaiting review`}
            tone="violet"
            delay={0.2}
            onClick={() => onNavigate('payments')}
          />
        )}
      </SummaryCardGrid>

      {/* 2 — ONE composed dashboard row. LEFT (2/3): Collection Trend
          (open chart, trimmed height) + Class-wise Collection packed
          DIRECTLY underneath. RIGHT (1/3): Breakdown panel. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* LEFT column — trend + class-wise, stacked with no dead space */}
        <div className="lg:col-span-2 min-w-0 space-y-4">
          <OpenChartSection
            title="Collection Trend"
            subtitle={`${sessionLabel} · verified collections vs pending`}
            className="min-w-0"
            action={
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: FEES_CHART_PALETTE.collected }} /> Collected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: FEES_CHART_PALETTE.pending }} /> Pending
                </span>
              </div>
            }
          >
            {trendHasData ? (
              <MiniAreaChart data={monthly} height={150} format={(n) => formatINR(n, true)} showArea />
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">No collections yet — record a payment to see the trend.</p>
            )}
          </OpenChartSection>

          {/* Class-wise Collection — same visual philosophy as Payment
              Modes: compact Panel, horizontal bars, no giant cards. Bars
              are relative to each class's own expected amount. */}
          <Panel
            title="Class-wise Collection"
            subtitle={`${sessionLabel} · ${classRows.length} class${classRows.length === 1 ? '' : 'es'} · collected vs expected`}
            action={
              classRows.length > CLASSWISE_PREVIEW ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1.5"
                  onClick={() => setAllClasses((v) => !v)}
                  aria-expanded={allClasses}
                >
                  {allClasses ? 'Show less' : `View all ${classRows.length} classes`} <ArrowRight className="h-3 w-3" />
                </Button>
              ) : undefined
            }
            bodyClassName="p-0"
          >
            {visibleClassRows.length > 0 ? (
              <div className={cn('divide-y divide-border py-1', allClasses && 'max-h-[280px] overflow-y-auto custom-scrollbar')}>
                {visibleClassRows.map((c, i) => (
                  <motion.div
                    key={c.classId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.25) }}
                    className="px-4 py-2 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Class identity */}
                      <div className="min-w-0 w-[150px] shrink-0">
                        <p className="text-xs font-semibold truncate">{c.className}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">{c.students} student{c.students === 1 ? '' : 's'} with fees</p>
                      </div>
                      {/* Progress bar — collected share of this class's expectation */}
                      <div className="flex-1 min-w-0 h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(c.collectionRate > 0 ? 2 : 0, Math.min(100, c.collectionRate))}%` }}
                          transition={{ duration: 0.5, delay: Math.min(i * 0.04, 0.3) }}
                          className={cn(
                            'h-full rounded-full',
                            c.collectionRate >= 75 ? 'bg-emerald-500/80'
                              : c.collectionRate >= 40 ? 'bg-amber-500/80'
                                : c.billed === 0 ? 'bg-slate-300/60 dark:bg-slate-600/40'
                                  : 'bg-rose-500/70',
                          )}
                        />
                      </div>
                      {/* Amounts + rate — right-aligned mono rhythm like Payment Modes */}
                      <div className="hidden sm:block w-[200px] shrink-0 text-right text-[11px] tabular-nums text-muted-foreground truncate">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatINR(c.collected, true)}</span>
                        {' / '}{formatINR(c.billed, true)}
                      </div>
                      <span className="w-[52px] shrink-0 text-right text-xs font-semibold tabular-nums">{Math.round(c.collectionRate)}%</span>
                    </div>
                    {/* Mobile compact second line (amounts hidden above) */}
                    <p className="sm:hidden mt-1 text-[10px] tabular-nums text-muted-foreground">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatINR(c.collected, true)}</span>
                      {' / '}{formatINR(c.billed, true)}{c.outstanding > 0 ? ` · ${formatINR(c.outstanding, true)} due` : ''}
                    </p>
                  </motion.div>
                ))}
                {hiddenClassCount > 0 && !allClasses && (
                  <button
                    type="button"
                    onClick={() => setAllClasses(true)}
                    className="w-full px-4 py-2 text-left text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    +{hiddenClassCount} more classes — view all
                  </button>
                )}
              </div>
            ) : (
              <div className="py-6">
                <FeeEmptyState icon={<Users className="h-5 w-5" />} title="No classes yet." description="Create fee rows for students to see class-wise collections." />
              </div>
            )}
          </Panel>
        </div>

        {/* Expected obligation per fee head — honest policy view (bars are
            relative to the largest head, share % is of total expected). */}
        <Panel title="Breakdown" subtitle={`${sessionLabel} · expected by fee head`} className="h-full" bodyClassName="p-0">
          {visibleCategories.length > 0 ? (
            <div className="divide-y divide-border py-1">
              {visibleCategories.map((c, i) => (
                <motion.div
                  key={c.title}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="h-2 w-2 rounded-full shrink-0" style={{ background: c.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{c.title}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {catTotal > 0 ? Math.round((c.billed / catTotal) * 100) : 0}% of expected
                      </p>
                    </div>
                    <span className="text-xs font-semibold tabular-nums shrink-0">{formatINR(c.billed, true)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${catMax > 0 ? Math.max(3, Math.round((c.billed / catMax) * 100)) : 0}%` }}
                      transition={{ duration: 0.5, delay: i * 0.06 }}
                      className="h-full rounded-full"
                      style={{ background: c.color }}
                    />
                  </div>
                </motion.div>
              ))}
              {hiddenCategories > 0 && (
                <p className="px-4 py-2 text-[10px] text-muted-foreground">+{hiddenCategories} more heads</p>
              )}
            </div>
          ) : (
            <div className="py-6">
              <FeeEmptyState icon={<Wallet className="h-5 w-5" />} title="No fee heads yet." description="Create fee rows to see the breakdown by fee head." />
            </div>
          )}
        </Panel>
      </div>

      {/* 3 — Outstanding Dues + Needs Attention (merged actionable pair).
          Every row navigates to Student Accounts; chips carry the aging
          signal inline so no separate buckets section is needed. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Outstanding Dues"
          subtitle={
            dues
              ? `${topDues.length} ledger account${topDues.length === 1 ? '' : 's'} · largest balances`
              : `${topDues.length} student${topDues.length === 1 ? '' : 's'} · largest balances`
          }
          className="h-full"
          action={
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 border-emerald-500/40 text-[11px] text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                onClick={() => onNavigate('outreach')}
                title="Defaulter outreach — send fee reminders"
              >
                <Send className="h-3 w-3" /> Send reminders
                {dues && (
                  <span className="inline-flex items-center gap-1 text-emerald-600/80 dark:text-emerald-400/80">
                    · {dues.defaulterCount} live
                  </span>
                )}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => onNavigate('accounts')}>
                View accounts <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          }
          bodyClassName="p-0"
        >
          {topDues.length > 0 ? (
            <div className="divide-y divide-border max-h-72 overflow-y-auto custom-scrollbar py-1">
              {topDues.map((a, i) => (
                <motion.button
                  key={a.studentId}
                  type="button"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => onNavigate('accounts')}
                  aria-label={`Open fee account for ${a.name}, outstanding ${formatINR(a.outstanding, true)}`}
                  className={listPanelBtnClass}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-500/10 ring-1 ring-slate-500/20 text-[9px] font-semibold text-slate-600 dark:text-slate-300">
                    {initialsOf(a.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {a.className}{a.rollNo ? ` · Roll ${a.rollNo}` : ''}{a.admissionNo ? ` · ${a.admissionNo}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400">{formatINR(a.outstanding, true)}</span>
                    <OverdueChip days={a.daysOverdue} />
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="py-6">
              <FeeEmptyState
                icon={<CheckCheck className="h-5 w-5" />}
                title="All student accounts are clear."
                description="No outstanding dues to follow up on right now."
              />
            </div>
          )}
        </Panel>

        <Panel
          title="Needs Attention"
          subtitle={`${needsAttention.length} overdue · oldest due first`}
          className="h-full"
          action={
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => onNavigate('accounts')}>
              Follow up <ArrowRight className="h-3 w-3" />
            </Button>
          }
          bodyClassName="p-0"
        >
          <div className="divide-y divide-border max-h-72 overflow-y-auto custom-scrollbar py-1">
            {needsAttention.map((a, i) => (
              <motion.button
                key={a.studentId}
                type="button"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onNavigate('accounts')}
                aria-label={`Follow up on ${a.name}, ${a.daysOverdue > 0 ? `${a.daysOverdue} days overdue` : 'due soon'}, total due ${formatINR(a.outstanding, true)}`}
                className={listPanelBtnClass}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/20 text-[9px] font-semibold text-rose-600 dark:text-rose-300 tabular-nums">
                  {initialsOf(a.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {a.className}{a.rollNo ? ` · Roll ${a.rollNo}` : ''}{a.admissionNo ? ` · ${a.admissionNo}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400">{formatINR(a.outstanding, true)}</span>
                  <OverdueChip days={a.daysOverdue} />
                </div>
              </motion.button>
            ))}
            {needsAttention.length === 0 && (
              <div className="py-6">
                <FeeEmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="All fees are paid." description="No dues to follow up on." />
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* 4 — Recent Payments + Payment Modes (concise activity summary).
          Recent Payments is a SUMMARY only — "All transactions" goes to the
          authoritative ledger. Payment Modes is the analytical mix. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 min-w-0">
          <Panel
            title="Recent Payments"
            subtitle="latest verified collections across all counters"
            className="h-full"
            action={
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => onNavigate('transactions')}>
                All transactions <ArrowRight className="h-3 w-3" />
              </Button>
            }
            bodyClassName="p-0"
          >
            {recentPayments.length > 0 ? (
              <div className="divide-y divide-border max-h-72 overflow-y-auto custom-scrollbar py-1">
                {recentPayments.map((t, i) => {
                  const mode = canonicalMethodLabel(t.method)
                  return (
                    <motion.button
                      key={t.id}
                      type="button"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => onNavigate('transactions')}
                      aria-label={`View transaction for ${t.studentName}, ${formatINR(t.amount, true)} via ${mode}`}
                      className={listPanelBtnClass}
                    >
                      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1', modeAccent(mode))}>
                        <ModeIcon mode={mode} className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{t.studentName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{t.className ?? '—'} · {formatDate(t.collectedAt ?? t.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatINR(t.amount, true)}</p>
                        <p className="text-[9px] text-muted-foreground font-mono">{t.receiptNo ?? '—'}</p>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            ) : (
              <div className="py-6">
                <FeeEmptyState
                  icon={<Banknote className="h-5 w-5" />}
                  title="No payments recorded yet."
                  description="Verified payments will appear here as they come in."
                />
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Payment Modes" subtitle="share of verified collection" className="h-full" bodyClassName="pt-1">
          {modeMix.length > 0 ? (
            <div className="space-y-2">
              {modeMix.map((m, i) => (
                <motion.div
                  key={m.mode}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ModeIcon mode={m.mode} className="h-3 w-3 text-muted-foreground" />
                      {m.mode}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{m.pct}% · {formatINR(m.value, true)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(2, m.pct)}%` }}
                      transition={{ duration: 0.5, delay: i * 0.06 }}
                      className="h-full rounded-full bg-emerald-500/80"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-6">
              <FeeEmptyState icon={<Wallet className="h-5 w-5" />} title="No payments yet." />
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
