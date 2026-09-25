/**
 * growth/service — server-side bulk loaders + serializers for the Growth
 * surfaces. ONE canonical derivation: the Teacher Growth module, the
 * shared student profile, the Directory chips, My Class and the Principal
 * profile all render the numbers produced here.
 *
 * PERFORMANCE (§31): everything is loaded in bulk (a handful of indexed
 * queries regardless of student count) and scored with pure in-memory
 * functions — no per-student query loops, no per-render recomputation of
 * the whole school when only a scope is needed.
 */

import { db } from '@/lib/db'
import type { StudentFeesDto } from '@/lib/teacher/student-ledger'
import { buildExamAverages, computeGrowthScore, type GrowthExamAvg } from './score'
import {
  DEFAULT_NEGATIVE_PRESETS,
  DEFAULT_POSITIVE_PRESETS,
  growthCategoryOf,
  type FeeStandingDto,
  type GrowthEventItem,
  type GrowthEventSource,
  type GrowthPreset,
  type GrowthScoreDto,
  type GrowthSettingsDto,
} from './shared'

// ── serializers ──────────────────────────────────────────────────────────

type EventRowWithRefs = {
  id: string
  studentId: string
  points: number
  category: string
  reason: string
  note: string | null
  source: string
  sourceRef: string | null
  period: string | null
  status: string
  correctsId: string | null
  correctionNote: string | null
  createdAt: Date
  effectiveAt: Date
  createdBy: { id: string; name: string | null } | null
  student: {
    id: string
    user: { name: string | null } | null
    class: { name: string; section: string | null } | null
  } | null
}

export function toGrowthEventItem(r: EventRowWithRefs): GrowthEventItem {
  const s = r.student
  const label = s?.class
    ? s.class.section && !s.class.name.endsWith(` ${s.class.section}`)
      ? `${s.class.name} - ${s.class.section}`
      : s.class.name
    : 'Unassigned'
  return {
    id: r.id,
    studentId: r.studentId,
    studentName: s?.user?.name ?? 'Unnamed student',
    classLabel: label,
    points: r.points,
    category: growthCategoryOf(r.category),
    reason: r.reason,
    note: r.note,
    source: (['MANUAL', 'ATTENDANCE', 'ACADEMIC'].includes(r.source) ? r.source : 'MANUAL') as GrowthEventSource,
    sourceRef: r.sourceRef,
    period: r.period,
    status: (['ACTIVE', 'SUPERSEDED', 'REVOKED'].includes(r.status) ? r.status : 'ACTIVE') as GrowthEventItem['status'],
    correctsId: r.correctsId,
    correctionNote: r.correctionNote,
    createdBy: r.createdBy ? { id: r.createdBy.id, name: r.createdBy.name ?? 'Staff' } : null,
    createdAt: r.createdAt.toISOString(),
    effectiveAt: r.effectiveAt.toISOString(),
  }
}

const EVENT_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  student: {
    select: {
      id: true,
      user: { select: { name: true } },
      class: { select: { name: true, section: true } },
    },
  },
} as const

// ── bulk score loading ───────────────────────────────────────────────────

export interface GrowthStudentInput {
  id: string
}

/** Load every input the score needs for the given students (bulk) and
 *  compute their GrowthScoreDto profiles. */
export async function growthScoresFor(
  schoolId: string,
  studentIds: string[],
): Promise<Map<string, GrowthScoreDto>> {
  const out = new Map<string, GrowthScoreDto>()
  if (studentIds.length === 0) return out

  const [attRows, eventRows, markRows, configRows] = await Promise.all([
    db.attendance.findMany({
      where: { schoolId, studentId: { in: studentIds } },
      select: { studentId: true, date: true, status: true },
    }),
    db.growthEvent.findMany({
      where: { schoolId, studentId: { in: studentIds }, status: 'ACTIVE' },
      select: { studentId: true, category: true, points: true, effectiveAt: true },
    }),
    db.examMark.findMany({
      where: {
        studentId: { in: studentIds },
        marksObtained: { not: null },
        exam: { status: 'COMPLETED' },
      },
      select: {
        examId: true,
        studentId: true,
        subjectId: true,
        marksObtained: true,
        workflowStatus: true,
        exam: { select: { name: true, startDate: true, createdAt: true, status: true } },
        subject: { select: { name: true, fullMarks: true } },
      },
    }),
    db.examSubjectConfig.findMany({
      where: { exam: { status: 'COMPLETED' }, class: { students: { some: { id: { in: studentIds } } } } },
      select: { examId: true, subjectId: true, maxMarks: true },
    }),
  ])

  const maxByKey = new Map(configRows.map((c) => [`${c.examId}:${c.subjectId}`, c.maxMarks]))
  const raw = markRows.map((m) => ({
    examId: m.examId,
    studentId: m.studentId,
    subjectId: m.subjectId,
    marksObtained: m.marksObtained,
    workflowStatus: m.workflowStatus,
    examName: m.exam.name,
    examStartDate: m.exam.startDate,
    examCreatedAt: m.exam.createdAt,
    subjectName: m.subject.name,
  }))
  const examsByStudent: Map<string, GrowthExamAvg[]> = buildExamAverages(raw, (examId, subjectId) =>
    maxByKey.get(`${examId}:${subjectId}`) ?? 100,
  )

  const attByStudent = new Map<string, { date: Date; status: string }[]>()
  for (const a of attRows) {
    const list = attByStudent.get(a.studentId) ?? []
    list.push({ date: a.date, status: a.status })
    attByStudent.set(a.studentId, list)
  }
  const eventsByStudent = new Map<string, { category: string; points: number; effectiveAt: Date }[]>()
  for (const e of eventRows) {
    const list = eventsByStudent.get(e.studentId) ?? []
    list.push({ category: e.category, points: e.points, effectiveAt: e.effectiveAt })
    eventsByStudent.set(e.studentId, list)
  }

  for (const id of studentIds) {
    out.set(
      id,
      computeGrowthScore({
        attendance: attByStudent.get(id) ?? [],
        exams: examsByStudent.get(id) ?? [],
        events: eventsByStudent.get(id) ?? [],
      }),
    )
  }
  return out
}

// ── events + presets + settings ──────────────────────────────────────────

export async function recentEventsFor(
  schoolId: string,
  where: Record<string, unknown>,
  take = 60,
): Promise<GrowthEventItem[]> {
  const rows = await db.growthEvent.findMany({
    where: { schoolId, ...where },
    include: EVENT_INCLUDE,
    orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
    take,
  })
  return rows.map(toGrowthEventItem)
}

/** Manual quick-pick presets from the school's GrowthRule rows (fallback
 *  to the shared defaults if the school has none — e.g. School B). */
export async function manualPresetsFor(schoolId: string): Promise<{
  positive: GrowthPreset[]
  negative: GrowthPreset[]
}> {
  const rows = await db.growthRule.findMany({
    where: { schoolId, source: 'MANUAL', enabled: true },
    select: { key: true, label: true, category: true, points: true },
    orderBy: { sortOrder: 'asc' },
  })
  const presets: GrowthPreset[] = rows.map((r) => ({
    key: r.key,
    label: r.label,
    category: growthCategoryOf(r.category),
    points: r.points,
  }))
  if (presets.length === 0) {
    return { positive: DEFAULT_POSITIVE_PRESETS, negative: DEFAULT_NEGATIVE_PRESETS }
  }
  return {
    positive: presets.filter((p) => p.points > 0),
    negative: presets.filter((p) => p.points < 0),
  }
}

export async function growthSettingsFor(schoolId: string): Promise<GrowthSettingsDto> {
  const row = await db.growthSetting.findUnique({ where: { schoolId } })
  if (!row) {
    return {
      enabled: true,
      negativeEnabled: true,
      minManualPoints: -5,
      maxManualPoints: 5,
      customReasons: true,
      studentVisibility: true,
      feePunctualityPoints: false,
    }
  }
  return {
    enabled: row.enabled,
    negativeEnabled: row.negativeEnabled,
    minManualPoints: row.minManualPoints,
    maxManualPoints: row.maxManualPoints,
    customReasons: row.customReasons,
    studentVisibility: row.studentVisibility,
    feePunctualityPoints: row.feePunctualityPoints,
  }
}

// ── fee standing (§23 — administrative, ALWAYS separate from growth) ─────

export function feeStandingOf(fees: StudentFeesDto | null): FeeStandingDto | null {
  if (!fees || fees.status === 'NONE') return null
  if (fees.awaitingVerification > 0) {
    return {
      standing: 'AWAITING_VERIFICATION',
      label: 'Verification pending',
      detail: 'A payment is awaiting office verification.',
    }
  }
  if (fees.status === 'PAID') {
    return {
      standing: 'FULLY_PAID',
      label: 'Fully paid',
      detail: 'All billed fees are settled.',
    }
  }
  if (fees.status === 'OVERDUE') {
    return {
      standing: 'OVERDUE',
      label: 'Overdue',
      detail: 'A fee line is past its due date — an administrative reminder.',
    }
  }
  return {
    standing: 'DUE',
    label: 'Due',
    detail: 'Payment due on the scheduled date.',
  }
}
