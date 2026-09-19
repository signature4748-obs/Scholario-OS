/**
 * lesson-planner — server-side data layer for the Teacher Workspace Lesson
 * Planner. The pure scheduling algorithm lives in lesson-schedule.ts
 * (shared with the demo seed); this module owns DB access, teacher scope
 * resolution and the plan payload.
 *
 * Permissions: a teacher may only plan (class, subject) pairs she actually
 * teaches — ACTIVE ClassSubjectAssignment ∩ Timetable cells carrying her
 * name. Class-teacher status grants attendance authority, not lesson
 * planning for subjects she does not teach.
 */

import { db } from '@/lib/db'
import { schoolScoped } from '@/lib/api'
import type { AuthUser } from '@/lib/auth'
import { classLabelOf } from '@/lib/teacher-hub'
import {
  dayKey,
  isHolidayKey,
  sessionStartFor,
  computeSchedule,
  WEEKDAY_INDEX,
  type HolidayRange,
  type ScheduledTopic,
} from '@/lib/lesson-schedule'
import {
  BOARD_LABELS,
  findSyllabusTemplate,
  normalizeTopicName,
  type SyllabusTemplate,
} from '@/lib/syllabus-templates'

export type { ScheduledTopic, TopicStatus, HolidayRange } from '@/lib/lesson-schedule'

// ─── Types (client contract) ────────────────────────────────────────────

export interface TeachingAssignment {
  classId: string
  classLabel: string
  subjectId: string
  subjectName: string
  periodsPerWeek: number
}

export interface UnitProgress {
  unitNo: number
  unitName: string
  total: number
  completed: number
}

/** One template topic the teacher's plan does not contain yet (LP-2). */
export interface SyllabusMissingTopic {
  unitNo: number
  unitName: string
  topicName: string
  description: string
  periodsNeeded: number
}

/** Board-syllabus coverage for the selected class + subject (LP-2). */
export interface SyllabusInfo {
  board: 'CBSE' | 'UP_BOARD'
  boardLabel: string
  bookLabel: string
  subjectLabel: string
  totalTopics: number
  coveredTopics: number
  units: { unitNo: number; unitName: string; topicCount: number; coveredCount: number }[]
  missingTopics: SyllabusMissingTopic[]
}

export interface LessonPlanPayload {
  classId: string
  classLabel: string
  subjectId: string
  subjectName: string
  sourceBoard: string
  sessionStart: string
  pace: {
    periodsPerWeek: number
    periodsPerDay: number
    periodMinutes: number
    teachingDaysPerWeek: number
  }
  progress: { completed: number; total: number; pct: number }
  units: UnitProgress[]
  topics: ScheduledTopic[]
  today: {
    date: string
    topic: ScheduledTopic | null
    reason: string | null
  }
  nextUp: ScheduledTopic[]
  /** Board-syllabus coverage — null when no template matches this pair. */
  syllabus: SyllabusInfo | null
  /** True when THIS request auto-fed the full session plan from the board
   *  syllabus (first open of a newly adopted subject). */
  autoProvisioned: boolean
}

// ─── Teacher scope resolution ───────────────────────────────────────────

export async function getTeachingAssignments(user: AuthUser): Promise<TeachingAssignment[]> {
  const schoolId = schoolScoped(user)
  const teacher = await db.teacher.findUnique({ where: { userId: user.id } })
  if (!teacher || teacher.schoolId !== schoolId) return []
  const teacherName = (user.name || '').trim().toLowerCase()
  if (!teacherName) return []

  const rows = (await db.timetable.findMany({
    where: { schoolId, teacherName: { not: null }, subjectId: { not: null } },
    select: {
      classId: true,
      subjectId: true,
      teacherName: true,
      class: { select: { name: true, section: true } },
      subject: { select: { name: true } },
    },
  })) as {
    classId: string
    subjectId: string
    teacherName: string | null
    class: { name: string; section: string | null }
    subject: { name: string }
  }[]
  const mine = rows.filter((r) => (r.teacherName || '').trim().toLowerCase() === teacherName)
  if (mine.length === 0) return []

  // Permission gate: only ACTIVE ClassSubjectAssignments count.
  const csas = await db.classSubjectAssignment.findMany({
    where: { schoolId, isActive: true },
    select: { classId: true, subjectId: true },
  })
  const activeKeys = new Set(csas.map((c) => `${c.classId}|${c.subjectId}`))

  const byKey = new Map<string, TeachingAssignment>()
  for (const r of mine) {
    if (!r.subjectId) continue
    const key = `${r.classId}|${r.subjectId}`
    if (!activeKeys.has(key)) continue
    const existing = byKey.get(key)
    if (existing) {
      existing.periodsPerWeek += 1
    } else {
      byKey.set(key, {
        classId: r.classId,
        classLabel: classLabelOf(r.class),
        subjectId: r.subjectId,
        subjectName: r.subject.name,
        periodsPerWeek: 1,
      })
    }
  }
  return [...byKey.values()].sort((a, b) => a.classLabel.localeCompare(b.classLabel) || a.subjectName.localeCompare(b.subjectName))
}

// ─── Pace + calendar ────────────────────────────────────────────────────

interface ClassPace {
  periodsPerWeek: number
  teachingDaysPerWeek: number
  periodMinutes: number
  teachingWeekdays: number[]
}

async function getClassPace(schoolId: string, classId: string, subjectId: string | null): Promise<ClassPace> {
  const rows = await db.timetable.findMany({
    where: { schoolId, classId },
    select: { day: true, subjectId: true, startTime: true, endTime: true },
  })
  const days = new Set(rows.map((r) => r.day))
  const subjectCells = subjectId ? rows.filter((r) => r.subjectId === subjectId).length : 0

  let periodMinutes = 45
  for (const r of rows) {
    if (r.startTime && r.endTime) {
      const [sh, sm] = r.startTime.split(':').map(Number)
      const [eh, em] = r.endTime.split(':').map(Number)
      const mins = eh * 60 + em - (sh * 60 + sm)
      if (mins > 20 && mins < 90) {
        periodMinutes = mins
        break
      }
    }
  }

  return {
    periodsPerWeek: subjectCells,
    teachingDaysPerWeek: days.size || 6,
    periodMinutes,
    teachingWeekdays: [...days].map((d) => WEEKDAY_INDEX[d]).filter((n) => n !== undefined),
  }
}

export async function getHolidays(schoolId: string): Promise<HolidayRange[]> {
  const events = await db.schoolEvent.findMany({
    where: { schoolId, type: 'HOLIDAY' },
    select: { title: true, startDate: true, endDate: true },
    orderBy: { startDate: 'asc' },
  })
  return events.map((e) => ({
    title: e.title,
    start: dayKey(e.startDate),
    end: dayKey(e.endDate ?? e.startDate),
  }))
}

// ─── Board-syllabus templates (LP-2) ───────────────────────────────────

async function loadTemplateFor(
  schoolId: string,
  classLabel: string,
  subjectName: string,
): Promise<SyllabusTemplate | null> {
  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: { board: true },
  })
  return findSyllabusTemplate(school?.board, classLabel, subjectName)
}

/** Instantiate board-template topics as the class+subject's curriculum.
 *  `topicsToCreate` defaults to the whole template (auto-feed) — the merge
 *  path passes only the missing ones. */
async function instantiateTemplate(
  schoolId: string,
  classId: string,
  subjectId: string,
  template: SyllabusTemplate,
  existing: { orderIndex: number; topicNo: number }[],
  topicsToCreate: SyllabusTemplate['topics'],
): Promise<number> {
  if (topicsToCreate.length === 0) return 0
  const baseOrder = existing.length > 0 ? Math.max(...existing.map((t) => t.orderIndex)) : 0
  let topicNo = existing.length > 0 ? Math.max(...existing.map((t) => t.topicNo)) : 0
  for (let i = 0; i < topicsToCreate.length; i++) {
    const t = topicsToCreate[i]
    await db.curriculumTopic.create({
      data: {
        schoolId,
        classId,
        subjectId,
        sourceBoard: template.sourceBoard,
        unitNo: t.unitNo,
        unitName: t.unitName,
        topicNo: ++topicNo,
        topicName: t.topicName,
        description: t.description,
        periodsNeeded: t.periodsNeeded,
        orderIndex: baseOrder + (i + 1) * 10,
      },
    })
  }
  return topicsToCreate.length
}

function buildSyllabusInfo(
  template: SyllabusTemplate,
  planTopicNames: Set<string>,
): SyllabusInfo {
  const missingTopics: SyllabusMissingTopic[] = []
  const unitMap = new Map<number, { unitNo: number; unitName: string; topicCount: number; coveredCount: number }>()
  for (const u of template.units) {
    unitMap.set(u.unitNo, { ...u, coveredCount: 0 })
  }
  for (const t of template.topics) {
    const unit = unitMap.get(t.unitNo)
    if (planTopicNames.has(normalizeTopicName(t.topicName))) {
      if (unit) unit.coveredCount += 1
    } else {
      missingTopics.push({
        unitNo: t.unitNo,
        unitName: t.unitName,
        topicName: t.topicName,
        description: t.description,
        periodsNeeded: t.periodsNeeded,
      })
    }
  }
  return {
    board: template.board,
    boardLabel: BOARD_LABELS[template.board],
    bookLabel: template.bookLabel,
    subjectLabel: template.subjectLabel,
    totalTopics: template.topics.length,
    coveredTopics: template.topics.length - missingTopics.length,
    units: [...unitMap.values()],
    missingTopics,
  }
}

// ─── Custom topic authoring (LP-2: “very easy to add”) ───────────────────

export interface AddTopicInput {
  classId: string
  subjectId: string
  /** Existing unit number, or null to append a brand-new unit. */
  unitNo: number | null
  /** Required when creating a new unit. */
  unitName: string | null
  topicName: string
  description: string | null
  periodsNeeded: number
}

async function assertOwnsAssignment(
  user: AuthUser,
  classId: string,
  subjectId: string,
): Promise<{ schoolId: string; classLabel: string; subjectName: string }> {
  const schoolId = schoolScoped(user)
  const assignments = await getTeachingAssignments(user)
  const owns = assignments.find((a) => a.classId === classId && a.subjectId === subjectId)
  if (!owns) throw new Error('FORBIDDEN')
  return { schoolId, classLabel: owns.classLabel, subjectName: owns.subjectName }
}

/** Rewrite orderIndex positions after a splice (keeps the schedule order). */
async function rewriteOrderIndexes(
  rows: { id: string; orderIndex: number }[],
  orderedIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const desired = (i + 1) * 10
    const row = rows.find((r) => r.id === orderedIds[i])
    if (row && row.orderIndex !== desired) {
      await db.curriculumTopic.update({ where: { id: orderedIds[i] }, data: { orderIndex: desired } })
    }
  }
}

/** Add a custom topic at the end of its unit — position-aware. */
export async function addCustomTopic(user: AuthUser, input: AddTopicInput): Promise<string> {
  const { schoolId } = await assertOwnsAssignment(user, input.classId, input.subjectId)

  const name = input.topicName.trim()
  if (!name || name.length > 160) throw new Error('A topic name (1–160 characters) is required')
  const periods = Math.min(60, Math.max(1, Math.round(input.periodsNeeded || 4)))

  const existing = await db.curriculumTopic.findMany({
    where: { schoolId, classId: input.classId, subjectId: input.subjectId },
    orderBy: { orderIndex: 'asc' },
    select: { id: true, unitNo: true, unitName: true, topicNo: true, orderIndex: true },
  })

  // Resolve the target unit.
  const unitNumbers = [...new Set(existing.map((t) => t.unitNo))]
  let unitNo: number
  let unitName: string
  if (input.unitNo != null && unitNumbers.includes(input.unitNo)) {
    unitNo = input.unitNo
    unitName = existing.find((t) => t.unitNo === input.unitNo)?.unitName ?? 'Topics'
  } else {
    unitNo = unitNumbers.length > 0 ? Math.max(...unitNumbers) + 1 : 1
    unitName = (input.unitName ?? '').trim() || 'My Topics'
  }

  const topicNo = existing.reduce((m, t) => Math.max(m, t.topicNo), 0) + 1

  const created = await db.curriculumTopic.create({
    data: {
      schoolId,
      classId: input.classId,
      subjectId: input.subjectId,
      sourceBoard: 'CUSTOM',
      unitNo,
      unitName,
      topicNo,
      topicName: name,
      description: input.description?.trim() ? input.description.trim().slice(0, 400) : null,
      periodsNeeded: periods,
      orderIndex: 0, // rewritten below
    },
    select: { id: true },
  })

  // Position: after the last topic of the target unit (new units go last).
  let insertAt = existing.length
  if (existing.some((t) => t.unitNo === unitNo)) {
    for (let i = 0; i < existing.length; i++) {
      if (existing[i].unitNo === unitNo) insertAt = i + 1
    }
  }
  const orderedIds = existing.map((t) => t.id)
  orderedIds.splice(insertAt, 0, created.id)
  const rowsForOrder = [...existing.map((t) => ({ id: t.id, orderIndex: t.orderIndex })), { id: created.id, orderIndex: 0 }]
  await rewriteOrderIndexes(rowsForOrder, orderedIds)
  return created.id
}

export interface UpdateTopicInput {
  topicId: string
  topicName?: string
  description?: string | null
  periodsNeeded?: number
  /** Move to another EXISTING unit. */
  unitNo?: number
}

export async function updateCustomTopic(user: AuthUser, input: UpdateTopicInput): Promise<void> {
  const topic = await db.curriculumTopic.findUnique({
    where: { id: input.topicId },
    select: { id: true, schoolId: true, classId: true, subjectId: true, unitNo: true, orderIndex: true, topicNo: true },
  })
  if (!topic) throw new Error('Topic not found')
  await assertOwnsAssignment(user, topic.classId, topic.subjectId)
  if (topic.schoolId !== schoolScoped(user)) throw new Error('FORBIDDEN')

  const data: { topicName?: string; description?: string | null; periodsNeeded?: number; unitNo?: number; unitName?: string } = {}
  if (input.topicName != null) {
    const name = input.topicName.trim()
    if (!name || name.length > 160) throw new Error('A topic name (1–160 characters) is required')
    data.topicName = name
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() ? input.description.trim().slice(0, 400) : null
  }
  if (input.periodsNeeded != null) {
    data.periodsNeeded = Math.min(60, Math.max(1, Math.round(input.periodsNeeded)))
  }

  const siblings = await db.curriculumTopic.findMany({
    where: { schoolId: topic.schoolId, classId: topic.classId, subjectId: topic.subjectId },
    orderBy: { orderIndex: 'asc' },
    select: { id: true, unitNo: true, unitName: true, orderIndex: true },
  })

  if (input.unitNo != null && input.unitNo !== topic.unitNo) {
    const target = siblings.find((t) => t.unitNo === input.unitNo)
    if (!target) throw new Error('That unit does not exist in this plan')
    data.unitNo = target.unitNo
    data.unitName = target.unitName
  }

  await db.curriculumTopic.update({ where: { id: topic.id }, data })

  // If the unit changed, move the topic to the end of its new unit.
  if (data.unitNo != null) {
    const others = siblings.filter((t) => t.id !== topic.id)
    const orderedIds = others.map((t) => t.id)
    let insertAt = orderedIds.length
    for (let i = 0; i < others.length; i++) {
      if (others[i].unitNo === data.unitNo) insertAt = i + 1
    }
    orderedIds.splice(insertAt, 0, topic.id)
    const rowsForOrder = [...others.map((t) => ({ id: t.id, orderIndex: t.orderIndex })), { id: topic.id, orderIndex: topic.orderIndex }]
    await rewriteOrderIndexes(rowsForOrder, orderedIds)
  }
}

export async function deleteCustomTopic(user: AuthUser, topicId: string): Promise<void> {
  const topic = await db.curriculumTopic.findUnique({
    where: { id: topicId },
    select: { id: true, schoolId: true, classId: true, subjectId: true },
  })
  if (!topic) throw new Error('Topic not found')
  await assertOwnsAssignment(user, topic.classId, topic.subjectId)
  if (topic.schoolId !== schoolScoped(user)) throw new Error('FORBIDDEN')

  const completion = await db.lessonTopicCompletion.findUnique({
    where: { curriculumTopicId: topic.id },
    select: { id: true },
  })
  if (completion) {
    throw new Error('This topic is already completed — undo the completion before deleting it')
  }

  const siblings = await db.curriculumTopic.findMany({
    where: { schoolId: topic.schoolId, classId: topic.classId, subjectId: topic.subjectId },
    orderBy: { orderIndex: 'asc' },
    select: { id: true, orderIndex: true },
  })
  await db.curriculumTopic.delete({ where: { id: topic.id } })
  const orderedIds = siblings.filter((t) => t.id !== topic.id).map((t) => t.id)
  await rewriteOrderIndexes(siblings, orderedIds)
}

/** Add every template topic the plan is missing (LP-2 syllabus merge). */
export async function mergeSyllabusTemplate(
  user: AuthUser,
  classId: string,
  subjectId: string,
): Promise<{ added: number }> {
  const { schoolId, classLabel, subjectName } = await assertOwnsAssignment(user, classId, subjectId)
  const template = await loadTemplateFor(schoolId, classLabel, subjectName)
  if (!template) throw new Error('No board syllabus template exists for this subject')

  const existing = await db.curriculumTopic.findMany({
    where: { schoolId, classId, subjectId },
    orderBy: { orderIndex: 'asc' },
    select: { orderIndex: true, topicNo: true, topicName: true },
  })
  const existingNames = new Set(existing.map((t) => normalizeTopicName(t.topicName)))
  const missing = template.topics.filter((t) => !existingNames.has(normalizeTopicName(t.topicName)))
  if (missing.length === 0) return { added: 0 }

  const added = await instantiateTemplate(
    schoolId,
    classId,
    subjectId,
    template,
    existing.map((t) => ({ orderIndex: t.orderIndex, topicNo: t.topicNo })),
    missing,
  )
  return { added }
}


export async function getLessonPlan(
  user: AuthUser,
  classId: string,
  subjectId: string
): Promise<LessonPlanPayload | null> {
  const assignments = await getTeachingAssignments(user)
  const assignment = assignments.find((a) => a.classId === classId && a.subjectId === subjectId)
  if (!assignment) return null

  const schoolId = schoolScoped(user)
  let [school, topicRows, completionRows, pace, holidays] = await Promise.all([
    db.school.findUnique({ where: { id: schoolId }, select: { academicYear: true, board: true } }),
    db.curriculumTopic.findMany({
      where: { schoolId, classId, subjectId },
      orderBy: { orderIndex: 'asc' },
    }),
    db.lessonTopicCompletion.findMany({
      where: { schoolId, classId, subjectId },
      select: { curriculumTopicId: true, completedOn: true, note: true },
    }),
    getClassPace(schoolId, classId, subjectId),
    getHolidays(schoolId),
  ])

  // ── LP-2 AUTO-FEED: a newly adopted subject has no curriculum yet —
  // instantiate the COMPLETE session plan from the school's board syllabus
  // (CBSE / UP Board) the moment the teacher opens it. Failures are quiet:
  // the plan simply renders its honest empty state.
  let autoProvisioned = false
  if (topicRows.length === 0) {
    const template = findSyllabusTemplate(school?.board, assignment.classLabel, assignment.subjectName)
    if (template) {
      try {
        const fed = await instantiateTemplate(schoolId, classId, subjectId, template, [], template.topics)
        if (fed > 0) {
          autoProvisioned = true
          topicRows = await db.curriculumTopic.findMany({
            where: { schoolId, classId, subjectId },
            orderBy: { orderIndex: 'asc' },
          })
        }
      } catch {
        // Auto-feed is best-effort; never block the plan read.
      }
    }
  }

  const today = new Date()
  const sessionStart = sessionStartFor(school?.academicYear, today)
  const completions = new Map(
    completionRows.map((c) => [c.curriculumTopicId, { completedOn: dayKey(c.completedOn), note: c.note }])
  )
  const topics = computeSchedule({
    topics: topicRows.map((t) => ({
      id: t.id,
      unitNo: t.unitNo,
      unitName: t.unitName,
      topicNo: t.topicNo,
      topicName: t.topicName,
      description: t.description,
      periodsNeeded: t.periodsNeeded,
      orderIndex: t.orderIndex,
    })),
    completions,
    sessionStart,
    today,
    pace,
    holidays,
  })
  // Display numbering follows the SCHEDULE order (custom inserts keep the
  // on-screen sequence tidy even though stored topicNo stays insert-stable).
  topics.forEach((t, i) => {
    t.topicNo = i + 1
  })

  const completed = topics.filter((t) => t.status === 'completed').length
  const total = topics.length
  const unitMap = new Map<string, UnitProgress>()
  for (const t of topics) {
    const key = `${t.unitNo}|${t.unitName}`
    let u = unitMap.get(key)
    if (!u) {
      u = { unitNo: t.unitNo, unitName: t.unitName, total: 0, completed: 0 }
      unitMap.set(key, u)
    }
    u.total += 1
    if (t.status === 'completed') u.completed += 1
  }

  const todayKeyStr = dayKey(today)
  const todayTopic =
    topics.find((t) => t.status === 'today') ?? topics.find((t) => t.status === 'in-progress')
    // A topic completed TODAY still owns the hero — it renders in its quiet
    // "Completed · <date>" state with an Undo link, instead of the teacher's
    // just-finished lesson vanishing into "No lesson scheduled for today".
    ?? topics.find((t) => t.status === 'completed' && t.completedOn === todayKeyStr)
    ?? null
  let reason: string | null = null
  if (!todayTopic) {
    const holiday = isHolidayKey(todayKeyStr, holidays)
    if (holiday) {
      reason = `School holiday — ${holiday.title}`
    } else if (pace.teachingWeekdays.length > 0 && !pace.teachingWeekdays.includes(today.getUTCDay())) {
      reason = 'No classes scheduled today'
    } else if (topics.length > 0 && topics[topics.length - 1].status === 'completed') {
      reason = 'Curriculum completed for this session'
    } else {
      reason = 'No lesson scheduled for today'
    }
  }

  const periodsPerDay = pace.periodsPerWeek > 0
    ? pace.periodsPerWeek / Math.max(1, pace.teachingDaysPerWeek)
    : 1

  // Board-syllabus coverage (LP-2) — null when no template matches.
  let syllabus: SyllabusInfo | null = null
  {
    const template = findSyllabusTemplate(school?.board, assignment.classLabel, assignment.subjectName)
    if (template) {
      const planNames = new Set(topicRows.map((t) => normalizeTopicName(t.topicName)))
      syllabus = buildSyllabusInfo(template, planNames)
    }
  }

  return {
    classId,
    classLabel: assignment.classLabel,
    subjectId,
    subjectName: assignment.subjectName,
    sourceBoard: topicRows[0]?.sourceBoard ?? school?.board ?? 'CBSE',
    sessionStart: dayKey(sessionStart),
    pace: {
      periodsPerWeek: pace.periodsPerWeek,
      periodsPerDay: Math.round(periodsPerDay * 10) / 10,
      periodMinutes: pace.periodMinutes,
      teachingDaysPerWeek: pace.teachingDaysPerWeek,
    },
    progress: { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 },
    units: [...unitMap.values()].sort((a, b) => a.unitNo - b.unitNo),
    topics,
    today: { date: todayKeyStr, topic: todayTopic, reason },
    nextUp: topics.filter((t) => t.status === 'upcoming' || t.status === 'today').slice(0, 5),
    syllabus,
    autoProvisioned,
  }
}
