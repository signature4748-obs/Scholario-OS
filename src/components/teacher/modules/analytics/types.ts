/**
 * analytics/types — the client-side contract of
 * GET /api/teacher/analytics. Every field is derived from real
 * records (ExamMark / ExamSubjectConfig / Attendance); the route is
 * the single source of truth for thresholds and date labels.
 */

export interface AnalyticsClassRef {
  id: string
  label: string
  /** True for classes the teacher is class teacher of (selector default). */
  isClassTeacher: boolean
}

export interface LatestAssessment {
  examId: string
  name: string
  dateLabel: string
  /** Full label with year (e.g. "9 Sept 2026") — real start date. */
  dateLabelFull: string
  status: string
  resultStatus: string
}

export interface ExamTrendPoint {
  examId: string
  name: string
  dateLabel: string
  /** real start date (epoch ms, null when undated) — time-period filter */
  dateMs: number | null
  /** Mean of the class's normalized marks in that exam (0–100). */
  avgPct: number
}

export interface SubjectAverage {
  subject: string
  /** Raw mean of entered marks. */
  avg: number
  /** maxMarks from ExamSubjectConfig — the honest denominator. */
  max: number
  pct: number
  /** Distinct students with an entered mark in this subject. */
  graded: number
}

export interface AssessmentCompletion {
  examId: string
  examName: string
  dateLabel: string
  entered: number
  expected: number
  pct: number | null
}

export interface WeeklyAttendancePoint {
  key: string
  /** Real Monday of the week, e.g. "10 Aug". */
  label: string
  value: number
}

export interface AttendanceStats {
  total: number
  present: number
  late: number
  absent: number
  pct: number | null
  weeklyTrend: WeeklyAttendancePoint[]
}

export interface AttentionReason {
  kind: 'performance' | 'attendance'
  /** Short threshold-based label for the UI chip. */
  label: string
  /** The real numbers behind the flag. */
  detail: string
}

export interface AttentionStudent {
  studentId: string
  name: string
  rollNo: string | null
  /** Latest-assessment average — null when the student has no marks. */
  avgPct: number | null
  attendancePct: number | null
  attendanceRecords: number
  reasons: AttentionReason[]
}

/** One exam the class knows about (configured ∪ graded) — the Assessment
 *  Performance section. Every field comes from real rows; an ungraded exam
 *  honestly carries 0 graded students and no average. */
export interface AssessmentSummary {
  examId: string
  name: string
  dateLabel: string
  /** real start date (epoch ms, null when undated) — time-period filter */
  dateMs: number | null
  status: string
  resultStatus: string
  subjectsConfigured: number
  /** distinct subjects with ≥1 entered mark */
  subjectsEntered: number
  /** distinct students with ≥1 entered, config-normalizable mark */
  studentsGraded: number
  studentCount: number
  /** mark rows entered vs configured subjects × roster */
  entered: number
  expected: number
  classAveragePct: number | null
  highestPct: number | null
  lowestPct: number | null
}

/** A student whose normalized average ROSE between the two most recent
 *  graded exams — real calculated change, never a fabricated delta. */
export interface ImprovingStudent {
  studentId: string
  name: string
  rollNo: string | null
  /** latest avg% − previous avg% (points) */
  deltaPct: number
  latestAvgPct: number
  previousAvgPct: number
  latestExamName: string
  previousExamName: string
}

export interface ClassAnalytics {
  classId: string
  label: string
  studentCount: number
  latestAssessment: LatestAssessment | null
  classAveragePct: number | null
  /** Students with at least one entered mark in the latest assessment. */
  gradedStudents: number
  subjectAverages: SubjectAverage[]
  examTrend: ExamTrendPoint[]
  assessmentCompletion: AssessmentCompletion | null
  attendance: AttendanceStats
  needingAttention: AttentionStudent[]
  /** recent exams (configured ∪ graded), newest first */
  assessments: AssessmentSummary[]
  /** students with positive exam-over-exam change (needs ≥2 graded exams) */
  improvingStudents: ImprovingStudent[]
}

export interface AnalyticsPayload {
  classes: AnalyticsClassRef[]
  classAnalytics: ClassAnalytics[]
}
