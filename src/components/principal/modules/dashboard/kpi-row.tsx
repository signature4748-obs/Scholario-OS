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
import { formatINR } from '@/lib/format'
import { useDuesSummaryStore, selectLiveDues } from '@/lib/store/dues-summary-store'
import { useFocusStore } from '@/lib/store/focus-store'
import { useSchoolStats } from '@/hooks/use-school-stats'
import { useAdmissionStore } from '@/lib/store/admission-store'
import { SummaryCard, SummaryCardGrid } from '../shared/summary-card'
import { LiveChip } from '../shared/live-chip'

export interface KpiRowProps {
  onNavigate?: (module: string) => void
}

export function KpiRow({ onNavigate }: KpiRowProps) {
  // Round-7 — server-truth dues for the Pending Fees card. STABILIZATION:
  // the former mock fallback (feeAnalytics.pendingDues — ₹1.84 Cr from
  // the retired demo universe) is GONE. While the ledger loads (or if
  // the sync fails) the card shows an honest loading/unavailable state
  // — fake money must never render as if it were real.
  const dues = useDuesSummaryStore(selectLiveDues)
  const duesStatus = useDuesSummaryStore((s) => s.status)
  const ensureDues = useDuesSummaryStore((s) => s.ensure)
  useEffect(() => { void ensureDues() }, [ensureDues])

  // SERVER TRUTH — attendance + upcoming exams from GET /api/dashboard
  // (real Attendance rows + real Exam rows; never the mock universe).
  const { data: schoolStats, loading: statsLoading } = useSchoolStats()
  const realAttendance = schoolStats?.stats.attendanceRate
  const realPresent = schoolStats?.attendance.present
  const upcoming = schoolStats?.upcomingExams ?? []

  // New admissions — the SAME admission-store universe the Admissions
  // module reads (applications submitted this calendar month, no drafts).
  const newAdmissions = useAdmissionStore((s) => {
    const now = new Date()
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return s.applications.filter(
      (a) => a.status !== 'Draft' && (a.submittedDate ?? '').startsWith(prefix)
    ).length
  })
  const nearestExam = upcoming.find((e) => e.startDate)
  const nearestInDays = nearestExam?.startDate
    ? Math.max(0, Math.round((new Date(nearestExam.startDate).getTime() - Date.now()) / 86_400_000))
    : null

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

  const feesValue = dues ? formatINR(dues.totalOutstanding, true) : duesStatus === 'error' ? '—' : '…'
  const feesSub = dues
    ? `${dues.defaulterCount} student${dues.defaulterCount === 1 ? '' : 's'} · ${dues.overdueCount > 0 ? `${dues.overdueCount} past due` : 'all current'}`
    : duesStatus === 'error'
      ? 'fee ledger unavailable — retry from Fee Management'
      : 'loading live ledger…'

  return (
    <SummaryCardGrid columns={4}>
      <SummaryCard
        label="Attendance"
        value={statsLoading ? '…' : realAttendance ?? 0}
        suffix={statsLoading ? '' : '%'}
        sub={statsLoading ? 'loading…' : `${(realPresent ?? 0).toLocaleString('en-IN')} present · last 7 days`}
        tone="emerald"
        icon={<CalendarCheck className="h-4 w-4" />}
        delay={0}
        onClick={onNavigate ? () => onNavigate('attendance') : undefined}
      />
      <SummaryCard
        label="Pending Fees"
        value={feesValue}
        sub={feesSub}
        chip={dues ? <LiveChip /> : undefined}
        tone="rose"
        icon={<IndianRupee className="h-4 w-4" />}
        delay={0.04}
        onClick={onNavigate ? (dues && dues.defaulterCount > 0 ? openOutreach : () => onNavigate('fees')) : undefined}
      />
      <SummaryCard
        label="New Admissions"
        value={newAdmissions}
        sub={`applications this month`}
        tone="sky"
        icon={<UserPlus className="h-4 w-4" />}
        delay={0.08}
        onClick={onNavigate ? () => onNavigate('admission') : undefined}
      />
      <SummaryCard
        label="Upcoming Exams"
        value={statsLoading ? '…' : upcoming.length}
        sub={nearestExam && nearestInDays != null ? `${nearestExam.name} in ${nearestInDays} day${nearestInDays === 1 ? '' : 's'}` : 'none scheduled'}
        tone="amber"
        icon={<FileText className="h-4 w-4" />}
        delay={0.12}
        trend="neutral"
        onClick={onNavigate ? () => onNavigate('exams') : undefined}
      />
    </SummaryCardGrid>
  )
}
