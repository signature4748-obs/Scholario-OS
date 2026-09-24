'use client'

/**
 * PaymentsSection — the OPERATIONS page of Fee Management.
 *
 *   Payments is for ACTIONS. Transactions is for HISTORY. Overview is for INSIGHTS.
 *
 * Contents (FINAL PAYMENTS UI POLISH — page order is fixed):
 *   1. Payment verification — the canonical two-stage verification
 *      workspace (VerificationWorkspace — /api/fees/verification; mounted
 *      exactly as before). Lives FIRST: it is the operational heart.
 *   2. Payment summary — Today / Week / Month as the SAME compact
 *      Overview-style SummaryCards. CANONICAL SOURCE: verified
 *      FeeTransactions (useCanonicalFees — /api/fees/transactions)
 *      bucketed by their collected-at instant; the sub counts share the
 *      exact same filters. The primary "Collect Fee" CTA sits RIGHT.
 *   3. Recent Payments — NEW / ACTIONABLE payment activity (client
 *      operations list → payments/recent-payments).
 *   4. Cash Verification — the verification workflow table (→ fees-approvals).
 *   5. Additional Collections — ALWAYS LAST (→ fees-additional-charges).
 *
 * What deliberately does NOT live here: financial KPIs, the collection trend,
 * payment-mode analytics (→ Overview) and the complete transaction ledger
 * (→ Transactions).
 */

import { IndianRupee, CalendarDays, CalendarRange, Wallet, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useFeeData } from '@/lib/store/fee-store'
import { formatINR } from '@/lib/format'
import { useCanonicalFees, isVerifiedTxnStatus } from '../use-canonical-fees'
// SaaS-STAGE-2A (Task 7-b) — the open-collect affordances follow the
// ACTIVE school's fee_collect sub-feature. Cash Verification and the
// tables are core operations and stay. SummaryCards untouched.
import { useFeatureGate } from '@/lib/tenant/store'
import { SummaryCard, SummaryCardGrid } from '../../shared/summary-card'
import { FeesVerificationQueue } from '../fees-approvals'
import { FeesAdditionalCharges } from '../fees-additional-charges'
import { RecentPayments } from './recent-payments'
import { VerificationWorkspace } from './verification-workspace'

interface Props {
  data: ReturnType<typeof useFeeData>
  onCollect: () => void
  onOpenTransactions?: () => void
}

/** Payment count for a bucket — mirrors the verified-only filter (the same
 *  source the value above it sums), so sub and value never disagree. */
const countLabel = (n: number) =>
  n === 0 ? 'no payments yet' : `${n} payment${n === 1 ? '' : 's'}`

export function PaymentsSection({ data, onCollect, onOpenTransactions }: Props) {
  // Canonical operational snapshot — verified collections landing right
  // now (useCanonicalFees → /api/fees/transactions). The sub counts share
  // the exact same filters as the amounts.
  const { data: canonical, loading, error, refresh } = useCanonicalFees()
  const verified = (canonical?.txns ?? []).filter((t) => isVerifiedTxnStatus(t.status))
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(); monthStart.setMonth(monthStart.getMonth() - 1)
  const inWindow = (iso: string | null, from?: Date) => {
    if (!iso) return false
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return false
    return from ? t >= from.getTime() : true
  }
  const todayTxns = verified.filter((t) => (t.collectedAt ?? '').slice(0, 10) === today)
  const weekTxns = verified.filter((t) => inWindow(t.collectedAt, weekStart))
  const monthTxns = verified.filter((t) => inWindow(t.collectedAt, monthStart))

  // SaaS-STAGE-2A (Task 7-b) — the Collect Fee CTA (and any open-collect
  // entry point) renders only when the school's platform configuration
  // enables fee_collect. The store enforces the same gate at action time.
  const gate = useFeatureGate()
  const canCollect = gate.isSubFeatureEnabled('fee_collect')

  return (
    <div className="space-y-4">
      {/* 0 — PAYMENT VERIFICATION (real canonical ledger) — the two-stage
          collection workflow's principal side: class-teacher collections
          awaiting the Principal's decision + direct office payments.
          Lives FIRST: it is the operational heart of this tab. */}
      <VerificationWorkspace />

      {/* 1 — Payment summary + primary action. Overview-style compact
          summary cards; the "Payments" tab already establishes context,
          so no page heading — the page opens straight into live figures. */}
      {error && !canonical ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Could not load the payment summary — {error}
          </p>
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {loading && !canonical ? (
            <SummaryCardGrid columns={3} className="flex-1 min-w-[280px] max-w-2xl [&>*]:min-w-0">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border p-4 space-y-2.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              ))}
            </SummaryCardGrid>
          ) : (
            <SummaryCardGrid columns={3} className="flex-1 min-w-[280px] max-w-2xl [&>*]:min-w-0">
              <SummaryCard
                icon={<CalendarDays className="h-4 w-4" />}
                label="Today"
                value={formatINR(todayTxns.reduce((s, t) => s + t.amount, 0), true)}
                sub={countLabel(todayTxns.length)}
                tone="emerald"
              />
              <SummaryCard
                icon={<CalendarRange className="h-4 w-4" />}
                label="This Week"
                value={formatINR(weekTxns.reduce((s, t) => s + t.amount, 0), true)}
                sub={countLabel(weekTxns.length)}
                tone="teal"
              />
              <SummaryCard
                icon={<IndianRupee className="h-4 w-4" />}
                label="This Month"
                value={formatINR(monthTxns.reduce((s, t) => s + t.amount, 0), true)}
                sub={countLabel(monthTxns.length)}
                tone="slate"
              />
            </SummaryCardGrid>
          )}
          {/* Primary action — same treatment as Salary & Payroll → Payments'
              "Record Payment" (white outline, subtle border, Wallet icon,
              identical height/typography/radius): one shared enterprise
              design system across money modules.
              SaaS-STAGE-2A (Task 7-b) — hidden when fee_collect is disabled
              for the school; verification + tables stay. */}
          {canCollect && (
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={onCollect}
              >
                <Wallet className="h-3 w-3" /> Collect Fee
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 2 — Recent / Active Payments (current actionable activity +
          contextual bulk receipt actions) */}
      <RecentPayments data={data} onOpenTransactions={onOpenTransactions} />

      {/* 3 — Cash Verification (compact table; renders its own all-clear
          slim row when nothing is pending) */}
      <FeesVerificationQueue data={data} />

      {/* 4 — Additional Collections — ALWAYS LAST (lifecycle-aware:
          creation + payment status per collection; forms link optionally) */}
      <FeesAdditionalCharges data={data} onCollect={canCollect ? onCollect : undefined} />
    </div>
  )
}
