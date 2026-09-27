import type { DocumentPrivacyConfig } from '@/lib/store/school-settings-store/types'

export interface AdmissionLetterData {
  admissionNo: string
  refNo?: string
  studentId?: string
  regNo?: string
  admissionDate: string
  academicSession: string
  student: {
    firstName: string
    lastName: string
    dob: string
    photoUploaded?: boolean
    /** The canonical admission photo (data URL) — same image as the wizard, dossier and student record. */
    photoUrl?: string
  }
  parents: {
    fatherName: string
    fatherOccupation: string
    fatherPhone: string
    fatherEmail: string
    motherName: string
    motherOccupation: string
    motherPhone: string
  }
  address?: {
    currentAddress?: string
    district?: string
    state?: string
    pincode?: string
  }
  academic: {
    className: string
    section: string
    stream?: string
    rollNo?: string
    previousSchool?: string
    previousBoard?: string
  }
  fees: {
    registrationFee?: number
    admissionFee: number
    tuitionFee: number
    annualCharges?: number
    activityFee?: number
    transportFee?: number
    examFee?: number
    booksTotal?: number
    selectedBooksTitles?: string[]
    subtotal?: number
    totalAnnualFee?: number
    discountName?: string
    discountApplied?: number
    discountAmount?: number
    finalPayable: number
    paymentMethod?: string
  }
  /** Document output policy (spec §16/§17) — gates what the letter prints. */
  documentPrivacy?: DocumentPrivacyConfig
}

export interface OfficialAdmissionLetterProps {
  data: AdmissionLetterData
  onClose?: () => void
}
