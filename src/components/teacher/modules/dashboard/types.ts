'use client'

/**
 * TeacherDashboard — the response shape of the ONE server-side aggregation
 * (GET /api/teacher/dashboard). Every field is REAL data derived server-side
 * from the signed-in teacher's records (timetable cells, class-teacher
 * scope, curriculum progress, Teacher Hub counts + follow-up rows, draft
 * marks entries, Notification rows with per-user read state). The former
 * static mock identity (Class 2-A, fake charts) is gone.
 *
 * Nullable fields mirror the server serializers honestly (Timetable
 * startTime/endTime/room are nullable; employeeId may be unmapped).
 */

export interface TeacherIdentity {
  name: string
  employeeId: string | null
}

export interface TeacherPeriod {
  period: number
  startTime: string | null
  endTime: string | null
  subjectName: string
  classLabel: string
  room: string | null
  /** ids for deep-linking a period into the Lesson Planner */
  classId: string | null
  subjectId: string | null
}

export interface TeacherToday {
  weekday: string
  date: string
  periods: TeacherPeriod[]
}

/** The next teaching day after today (null when the timetable has none). */
export interface TeacherNextDay {
  weekday: string
  period: TeacherPeriod
}

export interface TeachingAssignment {
  classId: string
  classLabel: string
  subjectId: string
  subjectName: string
  periodsPerWeek: number
}

export interface ClassTeacherClass {
  classId: string
  classLabel: string
  studentCount: number
  /** canonical 30-day class rate (LEAVE never penalizes); null = no marked days */
  attendancePct: number | null
  /** open follow-ups for students of this class (this teacher's queue) */
  openFollowUps: number
}

export interface AttendanceCounts {
  present: number
  absent: number
  late: number
  leave: number
}

export interface AttendanceSnapshot {
  classId: string
  classLabel: string
  studentCount: number
  marked: boolean
  /** rows recorded today — the honest "X of Y marked" partial state */
  markedCount: number
  counts: AttendanceCounts
}

export interface CurriculumTopicStatus {
  topicName: string
  unitName: string
  status: LessonTopicState
  endDate: string | null
}

export interface CurriculumProgress {
  completed: number
  total: number
  pct: number
}

export interface CurriculumAssignment {
  classId: string
  classLabel: string
  subjectId: string
  subjectName: string
  progress: CurriculumProgress
  todayTopic: CurriculumTopicStatus | null
  todayReason: string | null
}

/** Statuses produced by src/lib/lesson-schedule.ts (documented value set). */
export type LessonTopicState =
  | 'completed'
  | 'today'
  | 'in-progress'
  | 'needs-rescheduling'
  | 'upcoming'

/** One actionable follow-up row (server truth — same rows the hub shows). */
export interface HubFollowUp {
  id: string
  kind: string
  reason: string
  dueDate: string
  priority: string
  status: string
  studentName: string | null
  classLabel: string | null
}

export interface TeacherHubCounts {
  unreadMessages: number
  openFollowUps: number
  needsAttention: number
  /** marks entries sitting in DRAFT for this teacher's class-subjects */
  marksPending: number
  followUps: HubFollowUp[]
}

export interface TeacherNotice {
  id: string
  title: string
  message: string
  priority: string
  sender: string
  createdAt: string
  /** human audience tag derived server-side ("Whole school", "Staff", …) */
  audienceLabel: string
  /** per-user read state — null until the teacher acknowledges it */
  readAt: string | null
}

export interface TeacherDashboardData {
  teacher: TeacherIdentity
  today: TeacherToday
  nextDay: TeacherNextDay | null
  assignments: TeachingAssignment[]
  classTeacherOf: ClassTeacherClass[]
  attendance: AttendanceSnapshot[]
  curriculum: CurriculumAssignment[]
  hub: TeacherHubCounts
  notices: TeacherNotice[]
}
