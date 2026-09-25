/**
 * teacher-hub-types — the shared DTO contract for the Teacher Hub
 * modules (parent conversations / Student Growth).
 *
 * Pure types + tiny config maps: NO server imports — this file is safe for
 * client components. Server routes in /api/teacher/** serialize rows into
 * these shapes; frontend modules consume them verbatim.
 *
 * Dates are ISO strings. Statuses are lowercase strings (SQLite has no
 * enums) — the unions below document the allowed values.
 */

// ---------- shared ----------

export interface StudentRef {
  id: string
  name: string
  rollNo: string | null
  classLabel: string // e.g. "Grade 9 - A"
  classId: string | null
}

export type FollowUpKind = 'parent-connect' | 'behavior'
export type FollowUpPriority = 'low' | 'normal' | 'high'
export type FollowUpStatus = 'open' | 'done' | 'cancelled'

export interface FollowUpItem {
  id: string
  kind: FollowUpKind
  reason: string
  note: string | null
  dueDate: string
  priority: FollowUpPriority
  status: FollowUpStatus
  student: StudentRef | null
  conversationId: string | null
  recordId: string | null
  createdAt: string
}

// ---------- Parent conversations (the former Parent Connect engine) ----------

export type ConversationCategory =
  | 'general'
  | 'academic'
  | 'attendance'
  | 'behavior'
  | 'wellbeing'
  | 'urgent'

export interface ConversationSummary {
  id: string
  category: ConversationCategory
  pinned: boolean
  createdAt: string
  lastMessageAt: string | null
  /** parent messages the teacher has not read yet */
  unread: number
  parent: { id: string; name: string; phone: string | null }
  student: StudentRef
  lastMessage: { body: string; fromTeacher: boolean; createdAt: string } | null
  openFollowUp: { id: string; dueDate: string; priority: FollowUpPriority } | null
}

export interface ThreadMessage {
  id: string
  fromTeacher: boolean
  senderName: string
  body: string
  createdAt: string
  /** when the RECIPIENT read it (null = not read yet) */
  readAt: string | null
}

export interface ThreadPayload {
  conversation: {
    id: string
    category: ConversationCategory
    pinned: boolean
    createdAt: string
    parent: { id: string; name: string; phone: string | null }
    student: StudentRef
    teacher: { name: string }
  }
  messages: ThreadMessage[]
}

export interface MessageTemplateItem {
  id: string
  label: string
  body: string
  category: string
}

/** A student the teacher may start a conversation about (has a linked guardian user). */
export interface ParentLinkableStudent {
  student: StudentRef
  guardianName: string | null
  guardianPhone: string | null
  parentUserId: string | null
  existingConversationId: string | null
}

export interface ParentConnectStats {
  total: number
  /** conversation with a message in the last 21 days */
  active: number
  unread: number
  followUpsOpen: number
  /** open follow-ups due today or earlier */
  followUpsDue: number
  /** % of parent messages (last 90 days) followed by a teacher reply — null when no parent messages */
  replyRate: number | null
}

export interface ParentConnectPayload {
  teacher: { name: string; classLabel: string }
  conversations: ConversationSummary[]
  followUps: FollowUpItem[]
  templates: MessageTemplateItem[]
  students: ParentLinkableStudent[]
  stats: ParentConnectStats
}

// ---------- Student Behavior (LEGACY — the growth redesign) ----------
// The BehaviorRecord/BehaviorCategory tables and these DTOs remain for
// the legacy rows (migrated into the GrowthEvent ledger by
// scripts/growth-migrate.ts) and any future staff-only archive surface.
// The live module is Student Growth (@/lib/growth/*).

export type BehaviorType = 'positive' | 'observation' | 'concern'
export type BehaviorStatus = 'open' | 'monitoring' | 'resolved'

export interface BehaviorCategoryItem {
  key: string
  label: string
  kind: 'any' | 'positive' | 'concern'
}

export interface BehaviorRecordItem {
  id: string
  date: string
  /** category key — resolve the label client-side via categories list */
  category: string
  type: BehaviorType
  description: string
  actionTaken: string | null
  followUpRequired: boolean
  followUpDate: string | null
  status: BehaviorStatus
  parentNotified: boolean
  /** teacher/staff-only note — never rendered on any parent/student surface */
  privateNote: string | null
  recordedBy: { id: string; name: string }
  student: StudentRef
}

export interface BehaviorStats {
  studentsObserved: number
  positive: number
  observation: number
  concern: number
  /** type=concern AND status != resolved */
  openConcerns: number
  followUpsOpen: number
  followUpsDue: number
  total: number
}

export interface BehaviorPayload {
  scopeLabel: string
  categories: BehaviorCategoryItem[]
  records: BehaviorRecordItem[]
  followUps: FollowUpItem[]
  /** students the teacher may record observations for */
  students: StudentRef[]
  stats: BehaviorStats
}

export interface StudentBehaviorProfile {
  student: StudentRef
  records: BehaviorRecordItem[]
  counts: { positive: number; observation: number; concern: number; open: number }
  followUps: FollowUpItem[]
  conversationId: string | null
}

// ---------- Student Growth (re-exported canonical contract) ----------
// The growth system's DTOs live in @/lib/growth/shared (pure, client-safe);
// they are re-exported here so every Teacher module can keep importing its
// DTO contract from this one hub-types module.

export type {
  GrowthCategory,
  GrowthCategoryConfig,
  GrowthEventSource,
  GrowthEventStatus,
  GrowthEventItem,
  GrowthDimension,
  GrowthTrendPoint,
  GrowthScoreDto,
  FeeStanding,
  FeeStandingDto,
  GrowthPreset,
  GrowthSettingsDto,
  StudentGrowthSummary,
  GrowthBand,
  GrowthClassSummary,
  GrowthScopeSummary,
  GrowthWorkspacePayload,
} from '@/lib/growth/shared'
export {
  GROWTH_CATEGORIES,
  GROWTH_CATEGORY_CONFIG,
  isGrowthCategory,
  growthCategoryOf,
  GROWTH_SOURCES,
  SOURCE_LABELS,
  isAutomaticSource,
  GROWTH_BAND_LABELS,
  bandOf,
  DEFAULT_POSITIVE_PRESETS,
  DEFAULT_NEGATIVE_PRESETS,
} from '@/lib/growth/shared'

// ---------- client-side config (labels / tones shared by the modules) ----------

export const FOLLOW_UP_PRIORITY_LABELS: Record<FollowUpPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
}

export const BEHAVIOR_TYPE_LABELS: Record<BehaviorType, string> = {
  positive: 'Positive',
  observation: 'Observation',
  concern: 'Concern',
}

export const BEHAVIOR_STATUS_LABELS: Record<BehaviorStatus, string> = {
  open: 'Open',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
}

export const CONVERSATION_CATEGORY_LABELS: Record<ConversationCategory, string> = {
  general: 'General',
  academic: 'Academic',
  attendance: 'Attendance',
  behavior: 'Behaviour',
  wellbeing: 'Wellbeing',
  urgent: 'Urgent',
}
