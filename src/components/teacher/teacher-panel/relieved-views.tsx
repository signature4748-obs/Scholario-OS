'use client'

import { useMemo } from 'react'
import { Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useFeeStore } from '@/lib/store/fee-store'
import { formatINR } from '@/lib/format'
import type { TeacherRecord } from '@/lib/store/teachers-store'

interface RelievedViewsProps {
  active: string
  currentTeacher: TeacherRecord
  isRelieved: boolean
}

/**
 * Relieved-staff surfaces. The `payroll` key never reaches this component
 * (teacher-panel renders MySalaryModule for it first) — the former legacy
 * breakdown view here was unreachable and violated the simple-payroll
 * model, so it is gone. Fee totals are derived from the canonical client
 * fee ledger (transactions carrying THIS teacher's name) — never a
 * hardcoded number.
 */
export function RelievedViews({ active, currentTeacher, isRelieved }: RelievedViewsProps) {
  const transactions = useFeeStore((s) => s.transactions)

  // Collections recorded under this teacher's name (any channel status).
  const mine = useMemo(() => {
    const name = currentTeacher.name.trim().toLowerCase()
    return transactions.filter((t) => (t.collectedBy || '').trim().toLowerCase() === name)
  }, [transactions, currentTeacher.name])

  const totals = useMemo(() => {
    const verified = mine.filter((t) => t.status === 'Success')
    const pending = mine.filter((t) => t.status === 'Under Verification' || t.status === 'Pending')
    return {
      verifiedTotal: verified.reduce((s, t) => s + t.amount, 0),
      verifiedCount: verified.length,
      pendingTotal: pending.reduce((s, t) => s + t.amount, 0),
      pendingCount: pending.length,
    }
  }, [mine])

  if (active === 'profile') {
    return (
      <div className="space-y-4">
        {isRelieved && (
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200">
            <strong>Restricted Access Mode:</strong> Relieved staff access is strictly limited to Profile, Payroll, and processed Fee receipts.
          </div>
        )}
        <div className="p-6 rounded-2xl border border-border bg-card/60 space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="font-bold text-lg">{currentTeacher.name}</h3>
              <p className="text-xs text-muted-foreground">{currentTeacher.designation} · {currentTeacher.department}</p>
            </div>
            <Badge variant="outline" className="text-xs">{currentTeacher.status}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div><span className="text-muted-foreground">Employee ID:</span> <strong className="block font-mono">{currentTeacher.employeeId}</strong></div>
            <div><span className="text-muted-foreground">Date of Joining:</span> <strong className="block">{currentTeacher.joiningDate}</strong></div>
            <div><span className="text-muted-foreground">Phone:</span> <strong className="block">{currentTeacher.phone}</strong></div>
            <div><span className="text-muted-foreground">Email:</span> <strong className="block">{currentTeacher.email}</strong></div>
            <div><span className="text-muted-foreground">Current Address:</span> <strong className="block">{currentTeacher.currentAddress}</strong></div>
            <div><span className="text-muted-foreground">Aadhaar ID:</span> <strong className="block font-mono">{currentTeacher.aadhaarNo}</strong></div>
          </div>
        </div>
      </div>
    )
  }

  if (active === 'fee-management') {
    return (
      <div className="space-y-4">
        <div className="p-6 rounded-2xl border border-border bg-card/60 space-y-4">
          <h3 className="font-bold text-base">Fee Collections Processed Through ID</h3>
          <p className="text-xs text-muted-foreground">Historical fee collection receipts recorded under {currentTeacher.name} ({currentTeacher.employeeId}).</p>
          {mine.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-border bg-muted/10 text-center">
              <Wallet className="h-6 w-6 mx-auto text-muted-foreground/40" aria-hidden="true" />
              <p className="mt-2 text-xs font-semibold text-foreground">No fee collections on record</p>
              <p className="mt-1 text-[11px] text-muted-foreground">No collection receipts were recorded under your name.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="p-4 rounded-xl border border-border bg-muted/20 text-xs flex items-center justify-between gap-3">
                <span>Verified collections (receipts issued):</span>
                <strong className="text-sm font-bold text-emerald-600 text-right">
                  {formatINR(totals.verifiedTotal)} ({totals.verifiedCount} transaction{totals.verifiedCount === 1 ? '' : 's'})
                </strong>
              </div>
              {totals.pendingCount > 0 && (
                <div className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] text-xs flex items-center justify-between gap-3">
                  <span className="text-amber-900 dark:text-amber-200">Awaiting Principal verification (not final):</span>
                  <strong className="text-sm font-bold text-amber-700 dark:text-amber-300 text-right">
                    {formatINR(totals.pendingTotal)} ({totals.pendingCount} transaction{totals.pendingCount === 1 ? '' : 's'})
                  </strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
