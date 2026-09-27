import { AdmissionLetterData } from '../../../OfficialAdmissionLetter'
import type { AdmissionApplication } from '@/lib/store/admission-store'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
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
  const regNo = isCompleted ? app.regNo : app.regNo !== '—' ? app.regNo : `REG-${new Date().getFullYear()}`

  // Portal credentials are generated ONCE at completion (completion-slice)
  // and communicated via the separate secure Credentials sheet — never the
  // official letter (spec §23).
  const loginId = isCompleted && app.generatedCredentials ? app.generatedCredentials.loginId : '—'
  const tempPassword = isCompleted && app.generatedCredentials ? app.generatedCredentials.tempPassword : '—'

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
        subtotal: feeSummary.grossFee,
        totalAnnualFee: feeSummary.grossFee,
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

  // Letter Data Assembly — the document output policy travels WITH the
  // letter data so every render path (preview + download) applies the
  // same privacy rules (spec §16/§17).
  const letterData: AdmissionLetterData = {
    admissionNo,
    refNo: admissionNo,
    studentId,
    regNo,
    admissionDate: isCompleted ? app.submittedDate : new Date().toISOString().split('T')[0],
    academicSession: app.academicSession || '2025–2026',
    student: {
      firstName: formData.firstName,
      lastName: formData.lastName,
      dob: formData.dob,
      photoUploaded: !!formData.photoDataUrl,
      // The CANONICAL admission photo — same image as the wizard, review,
      // dossier, and (after issuance) the student record (spec §11).
      photoUrl: formData.photoDataUrl || undefined,
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
    documentPrivacy: useSchoolSettingsStore.getState().admissionSettings.documentPrivacy,
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
