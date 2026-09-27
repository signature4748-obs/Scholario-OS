'use client'

import { Wallet, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { FeeStructureStepProps as Props } from './FeeStructureStep/types'
import { useFeeCalculations } from './FeeStructureStep/useFeeCalculations'
import { SelectionPanel } from './FeeStructureStep/SelectionPanel'
import { SummaryPanel } from './FeeStructureStep/SummaryPanel'

export type { FeeDataState } from './FeeStructureStep/types'
export { defaultFeeDataState } from './FeeStructureStep/types'

export function FeeStructureStep({ className, feeState, onChangeFeeState, flags }: Props) {
  const calc = useFeeCalculations(className, feeState, onChangeFeeState, flags)

  return (
    <div className="space-y-5">
      {/* Header — title + single subtle read-only marker */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wallet className="h-5 w-5" />
          </div>
          <h3 className="font-display text-base font-bold text-foreground">Fee Structure</h3>
        </div>
        <Badge variant="outline" className="text-[11px] font-medium gap-1 text-muted-foreground">
          <Lock className="h-3 w-3" /> Read-only
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SelectionPanel
          feeState={feeState}
          onChangeFeeState={onChangeFeeState}
          flags={flags}
          schoolSettings={calc.schoolSettings}
          classBooks={calc.classBooks}
          uniforms={calc.uniforms}
          examConfig={calc.examConfig}
          examTotal={calc.examTotal}
          booksTotal={calc.booksTotal}
          booksCount={calc.booksCount}
          uniformTotal={calc.uniformTotal}
          uniformCount={calc.uniformCount}
          activityKitTotal={calc.activityKitTotal}
          activityKitCount={calc.activityKitCount}
          transportCost={calc.transportCost}
          hostelCost={calc.hostelCost}
          registrationFee={calc.registrationFee}
          admissionFee={calc.admissionFee}
          tuitionFee={calc.tuitionFee}
          otherHeadsTotal={calc.otherHeadsTotal}
          updateSelection={calc.updateSelection}
          toggleSelection={calc.toggleSelection}
          handleApplyWaiver={calc.handleApplyWaiver}
        />

        <SummaryPanel
          registrationFee={calc.registrationFee}
          admissionFee={calc.admissionFee}
          tuitionFee={calc.tuitionFee}
          otherHeadsTotal={calc.otherHeadsTotal}
          examTotal={calc.examTotal}
          booksTotal={calc.booksTotal}
          booksCount={calc.booksCount}
          uniformTotal={calc.uniformTotal}
          uniformCount={calc.uniformCount}
          activityKitTotal={calc.activityKitTotal}
          activityKitCount={calc.activityKitCount}
          transportTotal={calc.transportTotal}
          hostelTotal={calc.hostelTotal}
          grossFee={calc.grossFee}
          scholarshipAmount={calc.scholarshipAmount}
          waiverAmount={calc.waiverAmount}
          netTotal={calc.netTotal}
          initialInstallment={calc.initialInstallment}
          remainingBalance={calc.remainingBalance}
        />
      </div>
    </div>
  )
}
