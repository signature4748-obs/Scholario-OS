// Scholario SaaS Platform Subscription Engine
// Completely independent from School Fees. Handles student platform licensing.

import { useStudentsStore } from '@/lib/store/students-store'

export interface PlatformConfig {
  annualFee: number
  offerDiscountPercentage: number
  payableAmount: number
  upiId: string
  merchantName: string
  currency: string
  supportEmail: string
  supportPhone: string
}

export interface StudentSubscriptionRecord {
  studentId: string
  studentName: string
  schoolName: string
  isActive: boolean
  planName: string
  amountPaid: number
  activatedAt?: string
  expiresAt?: string
  paymentMethod?: string
  transactionRef?: string
  receiptNo?: string
}

// Global Platform Subscription Settings (Configurable by SuperAdmin)
let globalPlatformConfig: PlatformConfig = {
  annualFee: 600,
  offerDiscountPercentage: 50,
  payableAmount: 300,
  upiId: 'scholario.platform@icici',
  merchantName: 'Scholario Education Technologies Pvt Ltd',
  currency: 'INR',
  supportEmail: 'subscriptions@scholario.app',
  supportPhone: '+91 1800 200 4500',
}

// In-memory subscription database
const subscriptionStore: Record<string, StudentSubscriptionRecord> = {
  'STU-58': {
    studentId: 'STU-58',
    studentName: 'Aarav Sharma',
    schoolName: 'Greenwood Public School',
    isActive: true,
    planName: 'Scholario Annual Student Platform License',
    amountPaid: 300,
    activatedAt: '2025-04-01',
    expiresAt: '2026-04-01',
    paymentMethod: 'UPI QR Code',
    transactionRef: 'UPI/504912903481/OKICICI',
    receiptNo: 'SCH-SUB-2025-018',
  },
}

// Legacy seed key — the record above was issued to the DEMO student
// (Aarav Sharma) under their pre-sync mock id. The license belongs to
// that ONE student, so lookups made under their canonical (post-sync)
// id must still find it — without granting it to any other student.
const SEEDED_LICENSE_KEY = 'STU-58'

// The demo student's account email (the student login quick-fill
// account). It anchors "who the seeded license belongs to" across the
// mock-id → canonical-id unification.
const DEMO_ACCOUNT_EMAIL = 'aarav.sharma@greenwood.edu.in'

/**
 * The demo student's CURRENT id: their canonical roster record (matched
 * by the demo account email the roster sync stamps on the record), or
 * the legacy mock id while the roster is still the pre-sync seed.
 */
function seededLicenseHolderId(): string {
  const holder = useStudentsStore
    .getState()
    .students.find((s) => (s.email ?? '').toLowerCase() === DEMO_ACCOUNT_EMAIL)
  return holder?.id ?? SEEDED_LICENSE_KEY
}

export const getPlatformConfig = (): PlatformConfig => globalPlatformConfig

export const updatePlatformConfig = (newConfig: Partial<PlatformConfig>): PlatformConfig => {
  globalPlatformConfig = { ...globalPlatformConfig, ...newConfig }
  // Recalculate payable amount if discount changes
  if (newConfig.annualFee !== undefined || newConfig.offerDiscountPercentage !== undefined) {
    const fee = globalPlatformConfig.annualFee
    const disc = globalPlatformConfig.offerDiscountPercentage
    globalPlatformConfig.payableAmount = Math.round(fee - (fee * disc) / 100)
  }
  return globalPlatformConfig
}

export const getStudentSubscription = (studentId: string): StudentSubscriptionRecord => {
  if (subscriptionStore[studentId]) {
    return subscriptionStore[studentId]
  }

  // Identity unification: the seeded license was issued to the demo
  // student under their legacy mock id — serve it to the same student
  // under their canonical (post-sync) id so an active license never
  // lapses just because the roster ids changed underneath it.
  if (studentId && studentId === seededLicenseHolderId()) {
    const seeded = subscriptionStore[SEEDED_LICENSE_KEY]
    if (seeded) return seeded
  }

  // Default record for new/unsubbed student
  return {
    studentId,
    studentName: 'New Enrolled Student',
    schoolName: 'Greenwood Public School',
    isActive: false, // Default inactive to trigger activation workflow
    planName: 'Scholario Annual Student Platform License',
    amountPaid: globalPlatformConfig.payableAmount,
  }
}

export const activateStudentSubscription = (
  studentId: string,
  studentName: string,
  paymentMethod: string,
  transactionRef: string
): StudentSubscriptionRecord => {
  const now = new Date()
  const expiry = new Date()
  expiry.setFullYear(now.getFullYear() + 1)

  const record: StudentSubscriptionRecord = {
    studentId,
    studentName,
    schoolName: 'Greenwood Public School',
    isActive: true,
    planName: 'Scholario Annual Student Platform License',
    amountPaid: globalPlatformConfig.payableAmount,
    activatedAt: now.toISOString().split('T')[0],
    expiresAt: expiry.toISOString().split('T')[0],
    paymentMethod,
    transactionRef: transactionRef || `UPI/${Math.floor(100000000000 + Math.random() * 900000000000)}/PAY`,
    receiptNo: `SCH-SUB-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
  }

  subscriptionStore[studentId] = record
  return record
}
