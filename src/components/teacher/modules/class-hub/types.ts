/**
 * class-hub/types — the pure DTO contract for the Class Teacher Hub
 * (GET /api/teacher/class-hub). Client-safe: no server imports.
 *
 * The payload exists ONLY for classes the signed-in teacher is actually
 * appointed class teacher of (Class.classTeacherId = User.id) — the same
 * server truth that gates the module in the sidebar.
 */

/** A student with money outstanding (overdue first, then by amount). */
export interface ClassHubDefaulter {
  studentId: string
  name: string
  rollNo: string | null
  guardianPhone: string | null
  outstanding: number
  hasOverdue: boolean
}

/** The class's fee collection picture. */
export interface ClassHubFees {
  totalBilled: number
  totalCollected: number
  outstanding: number
  fullyPaidStudents: number
  studentsWithFees: number
  overdueStudents: number
  awaitingVerificationCount: number
  awaitingVerificationAmount: number
  defaulters: ClassHubDefaulter[]
}

/** One subject's marks-entry state in one exam (for the class teacher's
 *  overall results-submission view — across ALL subjects, not just theirs). */
export interface ClassHubResultSubject {
  subjectId: string
  subjectName: string
  /** students with marks entered (denominator = class size) */
  entered: number
  /** marks rows already SUBMITTED (vs still DRAFT) */
  submitted: number
  /** class average % over entered marks — null when nothing entered */
  avgPct: number | null
}

/** One exam's submission matrix for the class. */
export interface ClassHubResultExam {
  examId: string
  examName: string
  examDate: string | null
  status: string
  subjects: ClassHubResultSubject[]
  enteredSubjects: number
  submittedSubjects: number
  totalSubjects: number
}

/** Everything about one class-teacher class. */
export interface ClassHubClass {
  classId: string
  label: string
  room: string | null
  studentCount: number
  attendanceToday: {
    marked: boolean
    present: number
    absent: number
    late: number
    leave: number
  }
  fees: ClassHubFees
  results: ClassHubResultExam[]
  growth: {
    average: number | null
    improving: number
    steady: number
    needsAttention: number
    building: number
    monthPoints: number
  }
}

export interface ClassHubPayload {
  classes: ClassHubClass[]
}
