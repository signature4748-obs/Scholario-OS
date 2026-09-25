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
    /** students with a valid calculated score — the only ones in the average */
    scoredCount: number
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

// ─── Class-hub DETAIL payload (GET /api/teacher/class-hub/detail) ───────

/** One roster row in the class directory section. */
export interface HubDirectoryStudent {
  studentId: string
  name: string
  rollNo: string | null
  admissionNo: string | null
  /** 30-day eligible-day rate % — null when nothing marked */
  attendancePct: number | null
  /** canonical growth score 0–100 — null = Building */
  growthScore: number | null
  growthMonthDelta: number
  /** latest-exam academic % — null when the student has no marks */
  academicPct: number | null
  feeOutstanding: number
  feeOverdue: boolean
}

export interface HubRankRow {
  rank: number
  studentId: string
  name: string
  rollNo: string | null
  pct: number
  total?: number
  maxTotal?: number
}

export interface HubDetailPayload {
  classId: string
  label: string
  studentCount: number
  directory: HubDirectoryStudent[]
  performance: {
    latestExam: { examId: string; examName: string; examDate: string | null } | null
    overallAvgPct: number | null
    subjectAverages: { subjectId: string; subjectName: string; avgPct: number }[]
    topPerformers: HubRankRow[]
    needsAttention: HubRankRow[]
    trend: { examId: string; examName: string; avgPct: number }[]
  }
  ranking: {
    exams: { examId: string; examName: string; examDate: string | null }[]
    rowsByExam: Record<string, HubRankRow[]>
  }
  attendanceReport: {
    overall: {
      ratePct: number | null
      markedDays: number
      present: number
      absent: number
      late: number
      leave: number
    }
    monthly: { month: string; ratePct: number | null }[]
    weekly: { week: string; ratePct: number | null }[]
    belowThreshold: {
      studentId: string
      name: string
      rollNo: string | null
      ratePct: number | null
      absentDays: number
      markedDays: number
    }[]
  }
  marksheets: {
    examId: string
    examName: string
    examDate: string | null
    resultStatus: string
    subjectsWithMarks: number
    studentsScored: number
    avgPct: number | null
  }[]
  taughtSubjects: { subjectId: string; subjectName: string }[]
}

// ─── Marksheet matrix payload (GET /api/teacher/class-hub/marksheet) ────

export interface MarksheetPayload {
  classId: string
  classLabel: string
  room: string | null
  exam: {
    examId: string
    examName: string
    type: string
    session: string | null
    examDate: string | null
    resultStatus: string
  }
  subjects: { subjectId: string; subjectName: string; maxMarks: number }[]
  rows: {
    studentId: string
    rollNo: string | null
    admissionNo: string | null
    name: string
    marks: Record<string, { obtained: number | null; status: string }>
    total: number
    maxTotal: number
    pct: number
    rank: number | null
  }[]
  classAveragePct: number | null
}
