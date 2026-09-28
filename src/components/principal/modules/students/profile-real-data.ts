import type { StudentRecord } from '@/lib/store/students-store'

/**
 * profile-real-data — the role-aware data contract for the ONE canonical
 * Student Profile (production pass §7–§9).
 *
 * The Principal view feeds the profile from the students store
 * (StudentRecord). The Teacher view feeds the SAME profile component with
 * server-authorized data (GET /api/teacher/students) mapped through this
 * shape — richer where the server sends real records (attendance counts,
 * latest exam marks, fee lines + payments), absent where the role is not
 * authorized (a subject teacher receives no `fees`, so the fee surfaces
 * simply do not render). Nothing is invented: unknown fields render as
 * honest "Not recorded" states or hide entirely.
 */

/** Real attendance picture (canonical Attendance rows, server-derived). */
export interface RealAttendance {
  pct: number | null
  records: number
  present: number
  absent: number
  late: number
  leave: number
  recent: { date: string; status: string }[]
}

/** One subject's marks in the latest exam with entered marks. */
export interface RealExamSubject {
  subjectId: string
  subjectName: string
  marks: number
  maxMarks: number
  pct: number
}

export interface RealLatestExam {
  examId?: string
  examName: string
  subjects: RealExamSubject[]
  averagePct: number
}

/** Class-teacher fee picture (real Fee rows + canonical payment records). */
export interface RealStudentFees {
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'NONE'
  totalBilled: number
  totalPaid: number
  outstanding: number
  awaitingVerification: number
  lastPaymentAt: string | null
  items: {
    id: string
    title: string
    amount: number
    paid: number
    outstanding: number
    status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE'
    dueDate: string | null
    method: string | null
  }[]
  payments: {
    id: string
    txnId: string | null
    feeTitle: string
    amount: number
    method: string | null
    status: string
    createdAt: string
    source: string | null
    sourceLabel: string | null
    receiptNo: string | null
    collectedBy: string | null
    verifiedBy: string | null
    rejectionReason: string | null
  }[]
}

/**
 * Everything the teacher-authorized profile knows beyond the store-shaped
 * `StudentRecord`. All fields optional — each surface renders only what its
 * role actually received.
 */
export interface StudentProfileRealData {
  email?: string | null
  dob?: string | null
  gender?: string | null
  bloodGroup?: string | null
  address?: string | null
  guardianPhone?: string | null
  attendance?: RealAttendance | null
  latestExam?: RealLatestExam | null
  fees?: RealStudentFees | null
}

/** The props profile tabs accept in addition to the store record. */
export interface RealTabProps {
  student: StudentRecord
  real?: StudentProfileRealData
}
