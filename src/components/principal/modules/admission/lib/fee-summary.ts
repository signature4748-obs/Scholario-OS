/**
 * Pure admission fee summary — canonical totals for ADMISSION ISSUANCE paths
 * (official letter, fee receipt, dossier, student creation on enrolment).
 *
 * Wave 2 spec §28: issuance documents must derive from the SAME canonical
 * fee engine the Fee Structure step uses — no separate fake fee copies.
 * This function mirrors the math of `useFeeCalculations` but is callable
 * outside React (zustand slices, artifact builders). Both read the same
 * school-settings store, books master, fee structures and constants.
 */
import { getSchoolSettings } from '@/lib/school-settings'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import {
  ACTIVITY_KIT_ITEMS, HOSTEL_COST, INITIAL_INSTALLMENT_RATIO,
  SCHOLARSHIP_PERCENT, TRANSPORT_COST,
} from '../../FeeStructureStep/constants'
import type { FeeDataState } from '../../FeeStructureStep/types'

export interface AdmissionFeeLine {
  label: string
  amount: number
  kind: 'charge' | 'discount'
}

export interface AdmissionFeeSummary {
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
  discountLabel: string
  totalDiscount: number
  grossFee: number
  netTotal: number
  initialInstallment: number
  remainingBalance: number
  /** Ordered line items for receipts / letters. */
  lines: AdmissionFeeLine[]
}

/**
 * Compute the full admission fee summary for one application.
 * `className` + `feeData` come from the application record; flags come from
 * the school's admission settings (transport/hostel enabled).
 */
export function computeAdmissionFeeSummary(
  className: string,
  feeData: Partial<FeeDataState> | undefined,
  flags?: { enableTransport?: boolean; enableHostel?: boolean },
): AdmissionFeeSummary {
  const feeState: FeeDataState = {
    bookSelections: feeData?.bookSelections || {},
    uniformSelections: feeData?.uniformSelections || {},
    activityKitSelections: feeData?.activityKitSelections || {},
    examGroups: feeData?.examGroups || { unitTest: false, termExam: false, customGroups: false },
    transportSelected: !!feeData?.transportSelected,
    hostelSelected: !!feeData?.hostelSelected,
    discountCode: feeData?.discountCode || 'NONE',
    customDiscountValue: feeData?.customDiscountValue || 0,
    customDiscountReason: feeData?.customDiscountReason || '',
  }

  // Canonical sources (same as the Fee Structure step).
  const settings = useSchoolSettingsStore.getState()
  const schoolSettings = getSchoolSettings()

  const examConfig = schoolSettings.examFeeConfig
  const examTotal =
    (feeState.examGroups.unitTest ? examConfig.unitTestFee : 0) +
    (feeState.examGroups.termExam ? examConfig.termExamFee : 0) +
    (feeState.examGroups.customGroups ? examConfig.customGroupsFee : 0)

  const booksMaster = schoolSettings.booksMaster
  const targetCls = (className || '').toLowerCase().trim()
  const classBooks = booksMaster.filter((b) => {
    const cls = b.className.toLowerCase().trim()
    return cls === targetCls || targetCls.includes(cls) || cls.includes(targetCls)
  })
  const booksTotal = classBooks.reduce((sum, b) => sum + (feeState.bookSelections[b.id] || 0) * b.price, 0)

  const uniforms = settings.uniforms
  const uniformTotal = uniforms.reduce((sum, u) => sum + (feeState.uniformSelections[u.id] || 0) * u.price, 0)
  const activityKitTotal = ACTIVITY_KIT_ITEMS.reduce((sum, a) => sum + (feeState.activityKitSelections[a.id] || 0) * a.price, 0)

  const transportTotal = feeState.transportSelected && flags?.enableTransport ? TRANSPORT_COST : 0
  const hostelTotal = feeState.hostelSelected && flags?.enableHostel ? HOSTEL_COST : 0

  const baseFeeHeads = schoolSettings.feeHeads
  const registrationFee = baseFeeHeads.find((f) => f.category === 'Registration')?.defaultAmount || 1500
  const admissionFee = baseFeeHeads.find((f) => f.category === 'Admission')?.defaultAmount || 15000
  const tuitionFee = baseFeeHeads.find((f) => f.category === 'Tuition')?.defaultAmount || 60000
  const otherHeads = baseFeeHeads.filter((f) => !['Registration', 'Admission', 'Tuition'].includes(f.category))

  const grossFee =
    registrationFee + admissionFee + tuitionFee +
    otherHeads.reduce((a, b) => a + b.defaultAmount, 0) +
    examTotal + booksTotal + uniformTotal + activityKitTotal + transportTotal + hostelTotal

  const selectedDiscount = schoolSettings.discountRules.find((d) => d.code === feeState.discountCode)
  let discountAmount = 0
  let discountLabel = ''
  if (selectedDiscount) {
    discountAmount = selectedDiscount.type === 'percentage'
      ? Math.round((grossFee * selectedDiscount.value) / 100)
      : selectedDiscount.value
    discountLabel = `${selectedDiscount.name} Concession`
  } else if (feeState.discountCode === 'CUSTOM') {
    discountAmount = Number(feeState.customDiscountValue) || 0
    discountLabel = feeState.customDiscountReason || 'Custom Concession'
  }

  const scholarshipAmount = feeState.discountCode === 'SCHOLAR' ? Math.round((grossFee * SCHOLARSHIP_PERCENT) / 100) : 0
  const totalDiscount = discountAmount + scholarshipAmount
  const netTotal = Math.max(0, grossFee - totalDiscount)
  const initialInstallment = Math.round(netTotal * INITIAL_INSTALLMENT_RATIO)
  const remainingBalance = netTotal - initialInstallment

  const lines: AdmissionFeeLine[] = []
  if (registrationFee) lines.push({ label: 'Registration Fee (One-time)', amount: registrationFee, kind: 'charge' })
  if (admissionFee) lines.push({ label: 'Admission Fee (One-time)', amount: admissionFee, kind: 'charge' })
  if (tuitionFee) lines.push({ label: 'Tuition Fee (Annual)', amount: tuitionFee, kind: 'charge' })
  for (const h of otherHeads) lines.push({ label: `${h.category} (${h.name})`, amount: h.defaultAmount, kind: 'charge' })
  if (examTotal) lines.push({ label: 'Examination Fee', amount: examTotal, kind: 'charge' })
  if (booksTotal) lines.push({ label: 'Books & Textbooks', amount: booksTotal, kind: 'charge' })
  if (uniformTotal) lines.push({ label: 'Uniform', amount: uniformTotal, kind: 'charge' })
  if (activityKitTotal) lines.push({ label: 'Activity Kit', amount: activityKitTotal, kind: 'charge' })
  if (transportTotal) lines.push({ label: 'Transport Fee', amount: transportTotal, kind: 'charge' })
  if (hostelTotal) lines.push({ label: 'Hostel Fee', amount: hostelTotal, kind: 'charge' })
  if (totalDiscount) lines.push({ label: discountLabel || 'Concession', amount: -totalDiscount, kind: 'discount' })

  return {
    registrationFee, admissionFee, tuitionFee,
    otherHeadsTotal: otherHeads.reduce((a, b) => a + b.defaultAmount, 0),
    examTotal, booksTotal, uniformTotal, activityKitTotal,
    transportTotal, hostelTotal,
    discountLabel, totalDiscount, grossFee, netTotal,
    initialInstallment, remainingBalance,
    lines,
  }
}
