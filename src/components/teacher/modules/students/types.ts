/**
 * types — the pure DTO contract for the Teacher Student Directory
 * (Task 2-c rebuild). Client-safe: no server imports.
 *
 * SECURITY MODEL: the directory exposes ONLY students of the teacher's
 * authorized classes — classes where she is class teacher ∪ classes she
 * teaches a subject in (timetable teacherName). Everything in these
 * payloads is server-derived and school-scoped; the client never sends
 * anything but the selected classId, and the server alone decides what
 * is exposed (guardian contact, exam marks — see the route's doc block).
 */

/** Per-student attendance derived from the canonical Attendance rows. */
export interface DirectoryAttendanceSummary {
  /** (present + late) / records × 100, rounded · null when no records */
  pct: number | null
  /** total recorded days */
  records: number
  present: number
  absent: number
  late: number
  leave: number
  /** newest first, capped by the server for the profile view */
  recent: { date: string; status: string }[]
}

/** One subject's marks in the latest exam that has entered marks. */
export interface DirectoryExamSubjectMark {
  subjectId: string
  subjectName: string
  marks: number
  maxMarks: number
  /** marks / maxMarks × 100, rounded */
  pct: number
}

/** The latest exam (per the student's class) with entered marks, if any. */
export interface DirectoryLatestExam {
  examId: string
  examName: string
  subjects: DirectoryExamSubjectMark[]
  /** mean of the subject percentages, rounded */
  averagePct: number
}

/** One student row in the directory roster. */
export interface DirectoryStudent {
  id: string
  name: string
  email: string
  rollNo: string | null
  admissionNo: string | null
  guardianName: string | null
  guardianPhone: string | null
  dob: string | null
  gender: string | null
  bloodGroup: string | null
  address: string | null
  /** class/section label of the student's class (never re-derived client-side) */
  classLabel: string
  attendance: DirectoryAttendanceSummary
  /** null when the class has no exam with entered marks */
  latestExam: DirectoryLatestExam | null
  /**
   * Fee & payment records — present ONLY when the signed-in teacher is
   * the class teacher of this student's class (server decision). A
   * subject teacher never receives fee data: the field is null and the
   * fee surfaces simply do not render.
   */
  fees: DirectoryStudentFees | null
}

/** One fee line of a student (real Fee row, amounts in ₹). */
export interface DirectoryFeeItem {
  id: string
  title: string
  amount: number
  paid: number
  outstanding: number
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE'
  dueDate: string | null
  method: string | null
}

/** One recorded payment against any of the student's fees — the
 *  canonical union: FeeTransaction rows (two-stage workflow: their own
 *  collections + direct office payments) and pre-workflow office
 *  records. txnId set ⇒ the shared receipt viewer can open it. */
export interface DirectoryPaymentRecord {
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
}

/** The class teacher's fee picture for one student. */
export interface DirectoryStudentFees {
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'NONE'
  totalBilled: number
  totalPaid: number
  outstanding: number
  awaitingVerification: number
  lastPaymentAt: string | null
  items: DirectoryFeeItem[]
  payments: DirectoryPaymentRecord[]
}

/** One authorized class in the class list (no roster). */
export interface DirectoryClass {
  id: string
  label: string
  /** true when the signed-in teacher is this class's class teacher */
  isClassTeacher: boolean
  /** subjects this teacher teaches in the class (may be empty for a
   *  class-teacher-only class) */
  subjects: string[]
  studentCount: number
  /** class-teacher classes only — the class's fee collection summary */
  feeSummary: DirectoryClassFeeSummary | null
}

/** Fee collection summary for a class the teacher is class teacher of. */
export interface DirectoryClassFeeSummary {
  totalBilled: number
  totalCollected: number
  outstanding: number
  studentsWithFees: number
  fullyPaid: number
  pending: number
  overdue: number
}

/** The full directory payload — one fetch, every authorized class. */
export interface DirectoryPayload {
  classes: DirectoryClass[]
  studentsByClass: Record<string, DirectoryStudent[]>
}
