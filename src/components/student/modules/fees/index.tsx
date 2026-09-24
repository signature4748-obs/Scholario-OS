'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, RotateCcw, ReceiptText } from 'lucide-react'
import { useFeatureGate } from '@/lib/tenant/store'
import { GlassCard } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/lib/store/current-user-store'
import { useCanonicalStudent, useMyServerFees } from '../shared/canonical'
import { BalanceHero } from './balance-hero'
import { FeeStructure } from './fee-structure'
import { Statement } from './statement'
import { AllPaidState, OnlineUnavailableCard } from './paid-state'
import { PaymentDialog } from './payment-dialog'
import type { PaymentConfigResponse } from './data'

/**
 * FeesModule — the student's financial truth.
 *
 * ONE data source: the canonical SERVER fee ledger (GET /api/student/fees
 * via useMyServerFees) — the same Fee + FeeTransaction rows the
 * Principal's Fee Management and the Teacher's Fee Collection modules
 * read. The retired client-side demo universe (fee-store seeded for
 * STU-58, computeAccount, structure revisions) no longer feeds this
 * module. Online payment is THE path: server-created order → gateway →
 * SERVER-side signature verification → server-minted receipt
 * (RCP-2026-XXXX) → notification → the ledger re-fetches via refresh().
 * The browser is never trusted to declare success.
 *
 * No big "My Fees" title renders here — the shell header + sidebar are
 * the single WHERE-AM-I (nav dedup rule).
 */
export function FeesModule() {
  // ── The ONE canonical ledger ─────────────────────────────────────────
  const { ledger, loading, error, refresh } = useMyServerFees()

  // ── Canonical identity (server session — never the client roster) ────
  const { student: canonical } = useCanonicalStudent()
  const meName = useCurrentUser((s) => s.me?.name)

  // SaaS-STAGE-2A §20 — school payment-channel policy: without the
  // fee_online_payments sub-feature there are no self-service rails.
  const onlinePaymentsFeature = useFeatureGate().isSubFeatureEnabled('fee_online_payments')

  // Server payment capability — the actual provider availability
  // (Razorpay keys or the sandbox gateway), probed from the API that owns
  // it. Null while resolving.
  const [payConfig, setPayConfig] = useState<PaymentConfigResponse | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/student/payments/config', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return
        const data = j && typeof j === 'object' && 'data' in j ? (j as { data?: PaymentConfigResponse }).data : null
        if (data) setPayConfig(data)
        else setPayConfig({ available: false, provider: null, mode: null, keyId: null })
      })
      .catch(() => { if (!cancelled) setPayConfig({ available: false, provider: null, mode: null, keyId: null }) })
    return () => { cancelled = true }
  }, [])

  const canPayOnline = onlinePaymentsFeature && !!payConfig?.available
  const [payOpen, setPayOpen] = useState(false)

  // ── Honest async states (loading / error / no-records) ───────────────
  if (loading) return <FeesLoadingSkeleton />

  if (error) {
    return (
      <div className="max-w-4xl">
        <GlassCard className="p-6" hover={false}>
          <div className="flex flex-col items-center text-center py-8 gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/25" aria-hidden>
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h3 className="font-display text-lg font-bold text-foreground">Couldn&apos;t load your fee records</h3>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">{error}</p>
            <Button variant="outline" className="mt-1 gap-2" onClick={() => void refresh()}>
              <RotateCcw className="h-3.5 w-3.5" /> Try again
            </Button>
          </div>
        </GlassCard>
      </div>
    )
  }

  if (!ledger || ledger.fees.length === 0) {
    return (
      <div className="max-w-4xl">
        <GlassCard className="p-6" hover={false}>
          <div className="flex flex-col items-center text-center py-8 gap-2.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground border border-border" aria-hidden>
              <ReceiptText className="h-6 w-6" />
            </span>
            <h3 className="font-display text-lg font-bold text-foreground">No fee records yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              No fees have been billed to your account for this session. If you believe this is a mistake, please contact the school office.
            </p>
          </div>
        </GlassCard>
      </div>
    )
  }

  // ── The canonical ledger, rendered ───────────────────────────────────
  const { totals, fees, transactions } = ledger
  const outstanding = Math.max(0, totals.outstanding)
  const allSettled = outstanding <= 0 && totals.billed > 0
  const latestVerified = transactions.find((t) => t.status === 'SUCCESS' || t.status === 'VERIFIED') ?? null

  // The primary fee head the payment is applied against — the largest
  // outstanding fee on the ledger (the server order stamps it and /verify
  // applies the money to that fee row).
  const primaryHead = fees
    .filter((f) => f.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)[0]?.title ?? 'School Fees'

  const identity = {
    classLabel: canonical?.classLabel ?? null,
    studentName: meName ?? null,
    admissionNo: canonical?.admissionNo ?? null,
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {allSettled ? (
        <AllPaidState billed={totals.billed} latestReceiptNo={latestVerified?.receiptNo ?? null} />
      ) : (
        <BalanceHero
          totals={totals}
          identity={identity}
          canPayOnline={canPayOnline}
          onPay={() => setPayOpen(true)}
        />
      )}

      {/* Online rails unavailable (platform policy OR no gateway configured
          server-side) → the office is the path, the balance stays visible. */}
      {!allSettled && !canPayOnline && <OnlineUnavailableCard outstanding={outstanding} />}

      <FeeStructure fees={fees} totals={totals} />

      <Statement transactions={transactions} />

      {canPayOnline && outstanding > 0 && (
        <PaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          student={{
            name: meName ?? 'Student',
            admissionNo: canonical?.admissionNo ?? null,
            classLabel: canonical?.classLabel ?? null,
          }}
          balanceDue={outstanding}
          primaryHead={primaryHead}
          config={payConfig}
          onPaid={() => void refresh()}
        />
      )}
    </div>
  )
}

/** Module-shaped loading skeleton (hero + billed-for + statement). */
function FeesLoadingSkeleton() {
  return (
    <div className="space-y-5 max-w-4xl" aria-busy="true" aria-label="Loading fee records">
      <GlassCard className="p-4 sm:p-5 lg:p-6 space-y-4" hover={false}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-11 w-52" />
        <Skeleton className="h-2.5 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-[74px] rounded-xl" />
          <Skeleton className="h-[74px] rounded-xl" />
        </div>
      </GlassCard>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
      <span className="sr-only">Loading fee records…</span>
    </div>
  )
}
