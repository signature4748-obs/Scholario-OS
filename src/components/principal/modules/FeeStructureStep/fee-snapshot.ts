/**
 * Pure fee derivation — the same pipeline as useFeeCalculations, but as a
 * plain function (no hooks) so non-React surfaces (issuance artifacts,
 * documents, exports) can compute the REAL fee numbers for an application
 * instead of hardcoding demo values.
 */
import { getSchoolSettings } from '@/lib/school-settings'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import { ACTIVITY_KIT_ITEMS, HOSTEL_COST, SCHOLARSHIP_PERCENT, TRANSPORT_COST } from './constants'
import type { FeeDataState } from './types'

export interface FeeSnapshot {
  registrationFee: number
  admissionFee: number
  tuitionFee: number
  otherHeadsTotal: number
  examTotal: number
  booksTotal: number
  uniformTotal: number
  activityKitTotal: number
  transportTotal: number
  hostelTotal: number
  grossFee: number
  discountName?: string
  discountAmount: number
  netTotal: number
}

export function computeFeeSnapshot(
  className: string,
  feeState: FeeDataState,
  flags?: { enableTransport?: boolean; enableHostel?: boolean }
): FeeSnapshot {
  const settings = getSchoolSettings()
  const uniforms = useSchoolSettingsStore.getState().uniforms
  const examConfig = settings.examFeeConfig

  const examTotal =
    (feeState.examGroups.unitTest ? examConfig.unitTestFee : 0) +
    (feeState.examGroups.termExam ? examConfig.termExamFee : 0) +
    (feeState.examGroups.customGroups ? examConfig.customGroupsFee : 0)

  // Class-aware book list — mirrors resolveClassBooks (Books Master first,
  // auto-generated fallback second) so numbers match the Fee step exactly.
  const booksMaster = settings.booksMaster
  const existing = booksMaster.filter((b) => {
    const bCls = b.className.toLowerCase().trim()
    const targetCls = (className || '').toLowerCase().trim()
    return bCls === targetCls || targetCls.includes(bCls) || bCls.includes(targetCls)
  })
  const cls = className || 'Class 1'
  const classBooks =
    existing.length > 0
      ? existing.map((b) => ({ id: b.id, price: b.price }))
      : [
          { id: `BK-ENG-${cls}`, price: 180 },
          { id: `BK-MATH-${cls}`, price: 220 },
          { id: `BK-SCI-${cls}`, price: 240 },
          { id: `BK-HIN-${cls}`, price: 150 },
          { id: `BK-SST-${cls}`, price: 280 },
          { id: `BK-COMP-${cls}`, price: 260 },
        ]
  const booksTotal = classBooks.reduce(
    (sum, b) => sum + (feeState.bookSelections[b.id] || 0) * b.price,
    0
  )
  const uniformTotal = uniforms.reduce(
    (sum, u) => sum + (feeState.uniformSelections[u.id] || 0) * u.price,
    0
  )
  const activityKitTotal = ACTIVITY_KIT_ITEMS.reduce(
    (sum, a) => sum + (feeState.activityKitSelections[a.id] || 0) * a.price,
    0
  )
  const transportTotal =
    feeState.transportSelected && flags?.enableTransport ? TRANSPORT_COST : 0
  const hostelTotal =
    feeState.hostelSelected && flags?.enableHostel ? HOSTEL_COST : 0

  const heads = settings.feeHeads
  const registrationFee =
    heads.find((f) => f.category === 'Registration')?.defaultAmount || 1500
  const admissionFee =
    heads.find((f) => f.category === 'Admission')?.defaultAmount || 15000
  const tuitionFee =
    heads.find((f) => f.category === 'Tuition')?.defaultAmount || 60000
  const otherHeadsTotal = heads
    .filter((f) => !['Registration', 'Admission', 'Tuition'].includes(f.category))
    .reduce((a, b) => a + b.defaultAmount, 0)

  const optionalTotal =
    booksTotal + uniformTotal + activityKitTotal + transportTotal + hostelTotal
  const grossFee =
    registrationFee + admissionFee + tuitionFee + otherHeadsTotal + examTotal + optionalTotal

  const selectedDiscount = settings.discountRules.find(
    (d) => d.code === feeState.discountCode
  )
  let discountAmount = 0
  let discountName: string | undefined
  if (selectedDiscount) {
    discountAmount =
      selectedDiscount.type === 'percentage'
        ? Math.round((grossFee * selectedDiscount.value) / 100)
        : selectedDiscount.value
    discountName = selectedDiscount.name || selectedDiscount.code
  } else if (feeState.discountCode === 'CUSTOM') {
    discountAmount = Number(feeState.customDiscountValue) || 0
    discountName = feeState.customDiscountReason || 'Custom Concession'
  }
  const scholarshipAmount =
    feeState.discountCode === 'SCHOLAR'
      ? Math.round((grossFee * SCHOLARSHIP_PERCENT) / 100)
      : 0
  const totalDiscount = scholarshipAmount + discountAmount
  const netTotal = Math.max(0, grossFee - totalDiscount)

  return {
    registrationFee,
    admissionFee,
    tuitionFee,
    otherHeadsTotal,
    examTotal,
    booksTotal,
    uniformTotal,
    activityKitTotal,
    transportTotal,
    hostelTotal,
    grossFee,
    discountName,
    discountAmount: totalDiscount,
    netTotal,
  }
}
