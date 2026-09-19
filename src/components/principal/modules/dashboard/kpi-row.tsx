'use client'

/**
 * KpiRow — 4 primary actionable KPIs for the principal.
 *
 * Reduced from 8 → 4 per the DASH-A audit. The 4 actionable KPIs a principal
 * needs at a glance:
 *   1. Attendance (emerald) — today's school-wide attendance rate
 *   2. Pending fees (rose) — outstanding dues (Round-7: SERVER TRUTH)
 *   3. New admissions (sky) — applications submitted this month
 *   4. Upcoming exams (amber) — scheduled examinations
 *
 * Each card is clickable — clicking navigates to the relevant module:
 *   Attendance → attendance, Pending fees → fees (deep-links to the
 *   Outreach tab via the focus store, because the card's numbers ARE the
 *   Outreach tab's numbers — same /api/fees/defaulters aggregation),
 *   New admissions → admission, Upcoming exams → exams
 *
 * Round-7 consistency fix: "Pending Fees" used to quote the static mock
 * finance series (₹1.84 Cr / 142 students) while Fee Management and the
 * Outreach tab told two OTHER stories. The card now reads the live dues
 * summary (dues-summary-store → GET /api/fees/defaulters?summary=1) —
 * mock values serve only as the pre-sync fallback, and the "live" chip
 * appears only once the server number is actually on screen (the mock
 * sparkline is dropped in that state — never a fake trend under a real
 * number).
 *
 * Removed (relocated): Students total, Teachers count, Revenue, Salary due —
 * these are passive status, not actionable, and now live on the WelcomeBanner
 * meta strip (Students / Teachers) or in their dedicated modules.
 *
 * Removed: `SecondaryKpiRow` (was dead code at lines 38-47).
 */

import { useEffect } from 'react'
import {
  CalendarCheck, IndianRupee, UserPlus, FileText,
} from 'lucide-react'
import { attendanceOverview } from '@/lib/mock/attendance'
import { feeAnalytics } from '@/lib/mock/finance'
import { studentStats } from '@/lib/mock/students'
import { exams } from '@/lib/mock/academics'
import { formatINR } from '@/lib/format'
import { useDuesSummaryStore, selectLiveDues } from '@/lib/store/dues-summary-store'
import { useFocusStore } from '@/lib/store/focus-store'
import { SummaryCard, SummaryCardGrid } from '../shared/summary-card'
import { LiveChip } from '../shared/live-chip'
import { admissionsMonthly } from '../analytics/data'

export interface KpiRowProps {
  onNavigate?: (module: string) => void
}

export function KpiRow({ onNavigate }: KpiRowProps) {
  // Round-7 — server-truth dues for the Pending Fees card (mock fallback
  // until the sync lands; honest lineage via the live chip).
  const dues = useDuesSummaryStore(selectLiveDues)
  const ensureDues = useDuesSummaryStore((s) => s.ensure)
  useEffect(() => { void ensureDues() }, [ensureDues])

  /** Deep-link: fees module + Outreach tab (the card's numbers live there). */
  const openOutreach = () => {
    if (!onNavigate) return
    useFocusStore.getState().setFocus({
      type: 'fee-outreach',
      id: 'fee-outreach',
      title: 'Fee defaulter outreach',
      moduleKey: 'fees',
    })
    onNavigate('fees')
  }

  const feesValue = dues ? dues.totalOutstanding : feeAnalytics.pendingDues
  const feesSub = dues
    ? `${dues.defaulterCount} student${dues.defaulterCount === 1 ? '' : 's'} · ${dues.overdueCount > 0 ? `${dues.overdueCount} past due` : 'all current'}`
    : `${feeAnalytics.pendingCount} students`

  return (
    <SummaryCardGrid columns={4}>
      <SummaryCard
        label="Attendance"
        value={attendanceOverview.today.rate}
        suffix="%"
        sub={`${attendanceOverview.today.present.toLocaleString('en-IN')} present`}
        tone="emerald"
        icon={<CalendarCheck className="h-4 w-4" />}
        delay={0}
        sparkline={attendanceOverview.weekTrend.map((d) => d.rate)}
        trend="up"
        onClick={onNavigate ? () => onNavigate('attendance') : undefined}
      />
      <SummaryCard
        label="Pending Fees"
        value={formatINR(feesValue, true)}
        sub={feesSub}
        chip={dues ? <LiveChip /> : undefined}
        tone="rose"
        icon={<IndianRupee className="h-4 w-4" />}
        delay={0.04}
        sparkline={dues ? undefined : feeAnalytics.monthly.map((d) => d.pending)}
        trend="up"
        onClick={onNavigate ? (dues && dues.defaulterCount > 0 ? openOutreach : () => onNavigate('fees')) : undefined}
      />
      <SummaryCard
        label="New Admissions"
        value={studentStats.newThisMonth}
        sub="+18.4% this month"
        tone="sky"
        icon={<UserPlus className="h-4 w-4" />}
        delay={0.08}
        sparkline={admissionsMonthly.map((d) => d.value)}
        trend="up"
        onClick={onNavigate ? () => onNavigate('admission') : undefined}
      />
      <SummaryCard
        label="Upcoming Exams"
        value={exams.filter((e) => e.status === 'Scheduled').length}
        sub="Pre-Board in 12 days"
        tone="amber"
        icon={<FileText className="h-4 w-4" />}
        delay={0.12}
        trend="neutral"
        onClick={onNavigate ? () => onNavigate('exams') : undefined}
      />
    </SummaryCardGrid>
  )
}
