'use client'

import { Wallet } from 'lucide-react'
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
      {/* Header — one subtle provenance note (spec §6: say it once) */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold font-display">Fee Structure</h3>
          <p className="text-xs text-muted-foreground">
            {className ? `Class ${className.replace(/^Class\s*/i, '')}` : 'Select a class to see the applicable fee'}
            {' · Read-only, managed in Fee Management'}
          </p>
        </div>
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
