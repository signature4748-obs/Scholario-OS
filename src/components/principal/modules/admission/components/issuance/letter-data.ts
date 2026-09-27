import { AdmissionLetterData } from '../../../OfficialAdmissionLetter'
import type { AdmissionApplication } from '@/lib/store/admission-store'
import type { AdmissionFeeSummary } from '../../lib/fee-summary'

export interface IssuanceArtifacts {
  admissionNo: string
  studentId: string
  rollNo: string
  regNo: string
  loginId: string
  tempPassword: string
  letterData: AdmissionLetterData
  receiptNo: string
}

export function buildIssuanceArtifacts(
  app: AdmissionApplication,
  feeSummary?: AdmissionFeeSummary,
): IssuanceArtifacts {
  const formData = app.formData
  const isCompleted = app.status === 'Completed'

  const admissionNo = isCompleted ? app.admissionNo : app.admissionNo.replace('DRAFT-', '') || `ADM-2026-0842`
  const studentId = isCompleted ? app.studentId : app.studentId.replace('DRAFT-', '') || `STU-2026-0842`
  const rollNo = app.rollNo && app.rollNo !== '—' ? app.rollNo : '01'
  const regNo = isCompleted ? app.regNo : `REG-CBSE-2026-8812`

  const loginId = isCompleted && app.generatedCredentials ? app.generatedCredentials.loginId : `${formData.firstName.toUpperCase()}_2026`
  const tempPassword = isCompleted && app.generatedCredentials ? app.generatedCredentials.tempPassword : `Scholario@2026`

  // Deterministic receipt number derived from the admission number (no fake
  // sequential counters — the same admission always yields the same receipt).
  const receiptNo = `REC-${new Date(app.submittedDate || Date.now()).getFullYear()}-${admissionNo.replace(/[^0-9]/g, '').slice(-6) || '000001'}`

  // Canonical fee breakdown (spec §28): derived from the school fee engine
  // (computeAdmissionFeeSummary) — falls back to a minimal shape only when
  // no summary was supplied (legacy callers).
  const fees: AdmissionLetterData['fees'] = feeSummary
    ? {
        registrationFee: feeSummary.registrationFee,
        admissionFee: feeSummary.admissionFee,
        tuitionFee: feeSummary.tuitionFee,
        annualCharges: feeSummary.otherHeadsTotal,
        activityFee: feeSummary.activityKitTotal,
        transportFee: feeSummary.transportTotal,
        examFee: feeSummary.examTotal,
        booksTotal: feeSummary.booksTotal,
        discountName: feeSummary.totalDiscount > 0 ? feeSummary.discountLabel || 'Concession' : undefined,
        discountApplied: feeSummary.totalDiscount,
        finalPayable: feeSummary.netTotal,
        paymentMethod: app.feeData?.paymentMethod || 'Online Banking',
      }
    : {
        admissionFee: 0,
        tuitionFee: 0,
        finalPayable: 0,
        paymentMethod: app.feeData?.paymentMethod || 'Online Banking',
      }

  // Letter Data Assembly
  const letterData: AdmissionLetterData = {
    admissionNo,
    studentId,
    regNo,
    admissionDate: isCompleted ? app.submittedDate : new Date().toISOString().split('T')[0],
    academicSession: app.academicSession || '2025–2026',
    student: {
      firstName: formData.firstName,
      lastName: formData.lastName,
      dob: formData.dob,
      photoUrl: undefined,
    },
    parents: {
      fatherName: formData.fatherName,
      fatherOccupation: formData.fatherOccupation,
      fatherPhone: formData.fatherPhone,
      fatherEmail: formData.fatherEmail,
      motherName: formData.motherName,
      motherOccupation: formData.motherOccupation,
      motherPhone: formData.motherPhone,
    },
    address: {
      currentAddress: formData.currentAddress,
      district: formData.district,
      state: formData.state,
      pincode: formData.pincode,
    },
    academic: {
      className: formData.className,
      section: formData.section,
      stream: formData.stream,
      rollNo,
      previousSchool: formData.previousSchool,
      previousBoard: formData.previousBoard,
    },
    fees,
    qrCodeData: `https://verify.demoschool.edu/admission/${admissionNo}`,
    digitalVerificationId: `VER-2026-HASH-${admissionNo.slice(-4)}-CBSE`,
  }

  return {
    admissionNo,
    studentId,
    rollNo,
    regNo,
    loginId,
    tempPassword,
    letterData,
    receiptNo,
  }
}
