'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/shared/ui'
import { formatDate, formatINR } from '@/lib/format'
import { useSchoolProfile } from '@/lib/school-profile'
import type { AdmissionApplication } from '@/lib/store/admission-store'
import type { IssuanceArtifacts } from './letter-data'
import type { AdmissionFeeSummary } from '../../lib/fee-summary'

interface FeeReceiptTabProps {
  app: AdmissionApplication
  artifacts: IssuanceArtifacts
  feeSummary: AdmissionFeeSummary
}

export function FeeReceiptTab({ app, artifacts, feeSummary }: FeeReceiptTabProps) {
  const { admissionNo, receiptNo } = artifacts
  const formData = app.formData
  const profile = useSchoolProfile()

  return (
    <GlassCard className="p-6 max-w-2xl mx-auto space-y-6 border">
      <div className="flex justify-between items-start border-b pb-4 gap-3">
        <div>
          <h3 className="font-extrabold text-lg">Official Fee Receipt</h3>
          <p className="text-xs text-muted-foreground">{profile.name || 'Demo School of Scholario'} · Accounts Office</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold block">{receiptNo}</span>
          <span className="text-xs text-muted-foreground">Date: {formatDate(app.lastUpdatedDate || new Date().toISOString().split('T')[0])}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Student Name</span>
          <span className="font-bold text-sm text-foreground">{formData.firstName} {formData.lastName}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Class & Section</span>
          <span className="font-bold text-foreground">{formData.className} - {formData.section}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Admission Number</span>
          <span className="font-mono font-bold">{admissionNo}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">Payment Mode</span>
          <span className="font-semibold">{app.feeData?.paymentMethod || 'Online UPI / Bank Transfer'}</span>
        </div>
      </div>

      {/* Canonical fee line items (spec §28 — derived from the school fee engine) */}
      <div className="border rounded-xl overflow-hidden text-xs">
        <div className="grid grid-cols-12 p-2.5 bg-muted/60 font-bold uppercase text-[10px]">
          <div className="col-span-8">Fee Particulars</div>
          <div className="col-span-4 text-right">Amount (INR)</div>
        </div>
        <div className="divide-y p-2.5 space-y-0">
          {feeSummary.lines.map((line) => (
            <div key={line.label} className={`flex justify-between py-1.5 ${line.kind === 'discount' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}`}>
              <span>{line.label}</span>
              <span className="tabular-nums">{line.kind === 'discount' ? `−${formatINR(line.amount).replace('−', '')}` : formatINR(line.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between font-extrabold text-sm pt-2.5 border-t mt-1.5">
            <span>Net Amount Payable</span>
            <span className="text-emerald-700 dark:text-emerald-300">{formatINR(feeSummary.netTotal)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>First installment due at admission</span>
            <span className="tabular-nums">{formatINR(feeSummary.initialInstallment)}</span>
          </div>
        </div>
      </div>

      <div className="pt-2 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => window.print()} className="text-xs">
          <Printer className="h-3.5 w-3.5 mr-1" />
          Print Fee Receipt
        </Button>
      </div>
    </GlassCard>
  )
}
