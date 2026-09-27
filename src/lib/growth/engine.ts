/**
 * growth/engine — the automatic point evaluation engine (§6/§7).
 *
 * Derives growth events from CANONICAL school records — the existing
 * Attendance and ExamMark tables. It NEVER creates a second attendance
 * or marks database; every automatic event references its source record
 * via sourceRef/period (§35) so the score is explainable end to end.
 *
 * IDEMPOTENCY (§22 — no duplicate events, ever):
 *   1. GrowthEvalRun — one row per (school, kind, periodKey). The engine
 *      only ever evaluates periods that have NO run row yet, so repeated
 *      calls are a few cheap index reads.
 *   2. dedupeKey — every automatic event carries
 *      "a:<ruleKey>:<studentId>:<periodKey>" under a school-scoped
 *      UNIQUE constraint; createMany(skipDuplicates) makes a double run
 *      a structural impossibility, even under concurrency.
 *
 * FAIRNESS (§6):
 *   · LEAVE (approved leave / medical) is never penalized — it is not an
 *     eligible attendance day for scoring, and never generates negative
 *     events.
 *   · Weeks with fewer than 3 eligible days are skipped entirely —
 *     not enough data ⇒ no events (§21).
 *   · Low absolute marks NEVER generate negative points. Only a real
 *     decline across two completed exams does (reversible by progress).
 *
 * The engine runs opportunistically: the Growth module's aggregate GET
 * calls ensureGrowthEvaluation(schoolId) first. Because evaluation is
 * incremental (only missing periods), steady-state page loads add ~3
 * indexed count queries (§31 performance).
 */

import { db } from '@/lib/db'
import { addDays, buildExamAverages, isoWeekKey, mondayOfWeek, type RawMarkRow } from './score'

// ── rule keys (the seeded GrowthRule rows carry the points/labels; the
//    thresholds below are the engine's documented defaults) ───────────────

export const ATTENDANCE_RULES = {
  attendance_week_excellent: { minEligible: 4, pct: 1.0 },
  attendance_week_consistent: { minEligible: 4, minPct: 0.95, maxPct: 1.0 },
  attendance_week_good: { minEligible: 4, minPct: 0.9, maxPct: 0.95 },
  attendance_week_absences: { minEligible: 3, minAbsences: 2 },
  attendance_week_late: { minEligible: 3, minLates: 3 },
} as const

export const ACADEMIC_RULES = {
  academic_result_strong: { minAvg: 85 },
  academic_result_solid: { minAvg: 75, maxAvg: 85 },
  academic_result_mastery: { minSubjectPct: 95 },
  academic_improvement: { minDelta: 5 },
  academic_decline: { maxDelta: -10 },
} as const

interface RuleRow {
  key: string
  label: string
  category: string
  points: number
  enabled: boolean
}

interface NewGrowthEvent {
  schoolId: string
  studentId: string
  createdById: string | null
  points: number
  category: string
  reason: string
  note: string | null
  source: string
  sourceRef: string | null
  period: string | null
  status: string
  effectiveAt: Date
  dedupeKey: string
}

/** SQLite has no createMany(skipDuplicates) — insert per event and treat a
 *  unique dedupeKey violation (P2002) as "already exists" (the §22 hard
 *  guarantee). Everything else rethrows. */
async function insertEvents(events: NewGrowthEvent[]): Promise<number> {
  let created = 0
  for (const e of events) {
    try {
      await db.growthEvent.create({ data: e })
      created++
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === 'P2002') continue // duplicate — idempotency by design
      throw err
    }
  }
  return created
}

// ── period helpers ───────────────────────────────────────────────────────

function weekRangeOf(weekKey: string): { monday: Date; sunday: Date } {
  // weekKey = "2026-W38" — resolve via a Thursday anchor (ISO rule:
  // the Thursday of any week carries that week's ISO year/number).
  const [yearStr, weekStr] = weekKey.split('-W')
  const year = Number(yearStr)
  const week = Number(weekStr)
  const jan4 = new Date(year, 0, 4)
  const jan4Monday = mondayOfWeek(jan4)
  const thursday = addDays(jan4Monday, (week - 1) * 7 + 3)
  const monday = mondayOfWeek(thursday)
  return { monday, sunday: addDays(monday, 7) }
}

function dayFloor(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// ── weekly attendance evaluation ─────────────────────────────────────────

async function evaluateAttendanceWeek(schoolId: string, weekKey: string, rules: RuleRow[]): Promise<number> {
  const { monday, sunday } = weekRangeOf(weekKey)
  const rows = await db.attendance.findMany({
    where: {
      schoolId,
      date: { gte: monday, lt: sunday },
    },
    select: { studentId: true, status: true },
  })
  if (rows.length === 0) return 0

  const byStudent = new Map<string, { eligible: number; attended: number; absences: number; lates: number }>()
  for (const r of rows) {
    if (r.status !== 'PRESENT' && r.status !== 'LATE' && r.status !== 'ABSENT') continue // LEAVE never penalized
    const s =
      byStudent.get(r.studentId) ?? { eligible: 0, attended: 0, absences: 0, lates: 0 }
    s.eligible++
    if (r.status === 'PRESENT' || r.status === 'LATE') s.attended++
    if (r.status === 'ABSENT') s.absences++
    if (r.status === 'LATE') s.lates++
    byStudent.set(r.studentId, s)
  }

  const effectiveAt = addDays(monday, 6) // the week's Sunday — honest month attribution
  const events: NewGrowthEvent[] = []

  for (const [studentId, s] of byStudent) {
    if (s.eligible < 3) continue // not enough data this week (§21)
    const pct = s.attended / s.eligible

    for (const rule of rules) {
      if (!rule.enabled) continue
      let applies = false
      if (rule.key === 'attendance_week_excellent') {
        const t = ATTENDANCE_RULES.attendance_week_excellent
        applies = s.eligible >= t.minEligible && pct >= t.pct
      } else if (rule.key === 'attendance_week_consistent') {
        const t = ATTENDANCE_RULES.attendance_week_consistent
        applies = s.eligible >= t.minEligible && pct >= t.minPct && pct < t.maxPct
      } else if (rule.key === 'attendance_week_good') {
        const t = ATTENDANCE_RULES.attendance_week_good
        applies = s.eligible >= t.minEligible && pct >= t.minPct && pct < t.maxPct
      } else if (rule.key === 'attendance_week_absences') {
        const t = ATTENDANCE_RULES.attendance_week_absences
        applies = s.eligible >= t.minEligible && s.absences >= t.minAbsences
      } else if (rule.key === 'attendance_week_late') {
        const t = ATTENDANCE_RULES.attendance_week_late
        applies = s.eligible >= t.minEligible && s.lates >= t.minLates
      }
      if (!applies) continue
      events.push({
        schoolId,
        studentId,
        createdById: null,
        points: rule.points,
        category: 'ATTENDANCE',
        reason: rule.label,
        note: null,
        source: 'ATTENDANCE',
        sourceRef: `week:${weekKey}`,
        period: weekKey,
        status: 'ACTIVE',
        effectiveAt,
        dedupeKey: `a:${rule.key}:${studentId}:${weekKey}`,
      })
    }
  }

  return insertEvents(events)
}

// ── exam results evaluation ──────────────────────────────────────────────

async function evaluateExamResults(schoolId: string, examId: string, rules: RuleRow[]): Promise<number> {
  const markRows = await db.examMark.findMany({
    where: { examId, marksObtained: { not: null } },
    select: {
      examId: true,
      studentId: true,
      subjectId: true,
      marksObtained: true,
      workflowStatus: true,
      exam: { select: { name: true, startDate: true, createdAt: true, status: true } },
      subject: { select: { name: true, fullMarks: true } },
    },
  })
  const finalized = markRows.filter(
    (m) => m.workflowStatus === 'SUBMITTED' || m.workflowStatus === 'VERIFIED',
  )
  if (finalized.length === 0) {
    return 0
  }

  // maxMarks per (exam, subject) — ExamSubjectConfig first (same honest
  // rule as the Directory / profile routes).
  const configRows = await db.examSubjectConfig.findMany({
    where: { examId },
    select: { subjectId: true, maxMarks: true },
  })
  const maxByKey = new Map(configRows.map((c) => [c.subjectId, c.maxMarks]))

  const raw: RawMarkRow[] = finalized.map((m) => ({
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
  const maxMarksOf = (_examId: string, subjectId: string) => maxByKey.get(subjectId) ?? 100
  const byStudent = buildExamAverages(raw, maxMarksOf)

  // Previous completed exam (per student) — for improvement/decline, the
  // latest finalized exam BEFORE this one that also has the student's marks.
  const studentIds = [...byStudent.keys()]
  const prevMarks = studentIds.length
    ? await db.examMark.findMany({
        where: {
          studentId: { in: studentIds },
          marksObtained: { not: null },
          workflowStatus: { in: ['SUBMITTED', 'VERIFIED'] },
          exam: { status: 'COMPLETED', startDate: { lt: finalized[0].exam.startDate ?? finalized[0].exam.createdAt } },
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
      })
    : []

  // subject pct per student for THIS exam (for mastery detection)
  const subjectPctByStudent = new Map<string, { name: string; pct: number }[]>()
  for (const m of finalized) {
    const max = maxByKey.get(m.subjectId) ?? 100
    const list = subjectPctByStudent.get(m.studentId) ?? []
    list.push({ name: m.subject.name, pct: (m.marksObtained! / max) * 100 })
    subjectPctByStudent.set(m.studentId, list)
  }

  // previous per-student averages
  const prevRaw: RawMarkRow[] = prevMarks.map((m) => ({
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
  const prevByStudent = buildExamAverages(prevRaw, () => 100)

  const thisExam = finalized[0].exam
  const effectiveAt = thisExam.startDate ?? thisExam.createdAt
  const periodKey = `exam:${examId}`
  const events: NewGrowthEvent[] = []

  for (const [studentId, examList] of byStudent) {
    const avg = examList[examList.length - 1].avgPct
    const prevList = prevByStudent.get(studentId)
    const prevAvg = prevList && prevList.length > 0 ? prevList[prevList.length - 1].avgPct : null
    const delta = prevAvg != null ? avg - prevAvg : null

    for (const rule of rules) {
      if (!rule.enabled) continue
      let applies = false
      let reason = rule.label
      let note: string | null = null
      if (rule.key === 'academic_result_strong') {
        applies = avg >= ACADEMIC_RULES.academic_result_strong.minAvg
        note = `${thisExam.name} average ${avg}%`
      } else if (rule.key === 'academic_result_solid') {
        const t = ACADEMIC_RULES.academic_result_solid
        applies = avg >= t.minAvg && avg < t.maxAvg
        note = `${thisExam.name} average ${avg}%`
      } else if (rule.key === 'academic_result_mastery') {
        const best = (subjectPctByStudent.get(studentId) ?? []).reduce(
          (b, s) => (s.pct > b.pct ? s : b),
          { name: '', pct: -1 },
        )
        applies = best.pct >= ACADEMIC_RULES.academic_result_mastery.minSubjectPct
        if (applies) {
          reason = `${rule.label} — ${best.name}`
          note = `${Math.round(best.pct)}% in ${best.name} (${thisExam.name})`
        }
      } else if (rule.key === 'academic_improvement') {
        applies = delta != null && delta >= ACADEMIC_RULES.academic_improvement.minDelta
        if (applies) {
          reason = `Improved by ${delta! >= 0 ? '+' : ''}${delta} points`
          note = `${prevAvg}% → ${avg}% across exams`
        }
      } else if (rule.key === 'academic_decline') {
        applies = delta != null && delta <= ACADEMIC_RULES.academic_decline.maxDelta
        if (applies) {
          reason = 'Recent academic decline'
          note = `${prevAvg}% → ${avg}% — recoverable with support`
        }
      }
      if (!applies) continue
      events.push({
        schoolId,
        studentId,
        createdById: null,
        points: rule.points,
        category: rule.category as 'ACADEMIC' | 'IMPROVEMENT',
        reason,
        note,
        source: 'ACADEMIC',
        sourceRef: periodKey,
        period: periodKey,
        status: 'ACTIVE',
        effectiveAt,
        dedupeKey: `a:${rule.key}:${studentId}:${periodKey}`,
      })
    }
  }

  return insertEvents(events)
}

// ── the incremental entry point ──────────────────────────────────────────

const evaluating = new Set<string>()

export interface EvaluationResult {
  weeksEvaluated: number
  examsEvaluated: number
  eventsCreated: number
}

/**
 * Evaluate every not-yet-evaluated period for the school. Safe to call on
 * every module load: steady-state calls find nothing missing and cost a
 * few indexed reads. Concurrent calls for the same school are collapsed
 * in-memory; the dedupeKey unique constraint is the hard guarantee.
 */
export async function ensureGrowthEvaluation(schoolId: string): Promise<EvaluationResult> {
  const result: EvaluationResult = { weeksEvaluated: 0, examsEvaluated: 0, eventsCreated: 0 }
  if (evaluating.has(schoolId)) return result
  evaluating.add(schoolId)
  try {
    const setting = await db.growthSetting.findUnique({ where: { schoolId } })
    if (setting && !setting.enabled) return result

    const [runs, attDates, exams, rules] = await Promise.all([
      db.growthEvalRun.findMany({
        where: { schoolId },
        select: { kind: true, periodKey: true },
      }),
      db.attendance.findMany({
        where: { schoolId, date: { lt: dayFloor(new Date()) } },
        select: { date: true },
      }),
      db.exam.findMany({
        where: { schoolId, status: 'COMPLETED' },
        select: { id: true, name: true, startDate: true, createdAt: true },
      }),
      db.growthRule.findMany({
        where: { schoolId, source: { in: ['ATTENDANCE', 'ACADEMIC'] } },
        select: { key: true, label: true, category: true, points: true, enabled: true, source: true },
      }),
    ])
    const evaluated = new Set(runs.map((r) => `${r.kind}:${r.periodKey}`))
    const attRules = rules.filter((r) => r.source === 'ATTENDANCE' || r.key.startsWith('attendance_'))
    const acaRules = rules.filter((r) => r.source === 'ACADEMIC' || r.key.startsWith('academic_'))

    const currentWeekKey = isoWeekKey(new Date())

    // — complete weeks present in the attendance record ────────────────
    const weekKeys = new Set(attDates.map((a) => isoWeekKey(a.date)))
    for (const weekKey of weekKeys) {
      if (weekKey >= currentWeekKey) continue // current week is not complete yet
      if (evaluated.has(`WEEKLY_ATTENDANCE:${weekKey}`)) continue
      let created = 0
      try {
        created = await evaluateAttendanceWeek(schoolId, weekKey, attRules)
      } catch (e) {
        // log + record the attempt so a poisoned week cannot loop forever
        console.error('[growth] weekly evaluation failed for', weekKey, e)
      }
      await db.growthEvalRun.upsert({
        where: { schoolId_kind_periodKey: { schoolId, kind: 'WEEKLY_ATTENDANCE', periodKey: weekKey } },
        create: {
          schoolId,
          kind: 'WEEKLY_ATTENDANCE',
          periodKey: weekKey,
          status: 'DONE',
          eventsCreated: created,
        },
        update: {},
      })
      result.weeksEvaluated++
      result.eventsCreated += created
    }

    // — completed exams with marks ─────────────────────────────────────
    for (const exam of exams) {
      const periodKey = `exam:${exam.id}`
      if (evaluated.has(`EXAM_RESULTS:${periodKey}`)) continue
      let created = 0
      let detail: string | null = null
      try {
        created = await evaluateExamResults(schoolId, exam.id, acaRules)
      } catch (e) {
        console.error('[growth] exam evaluation failed for', exam.id, e)
        detail = e instanceof Error ? e.message.slice(0, 180) : 'evaluation failed'
      }
      await db.growthEvalRun.upsert({
        where: {
          schoolId_kind_periodKey: { schoolId, kind: 'EXAM_RESULTS', periodKey },
        },
        create: {
          schoolId,
          kind: 'EXAM_RESULTS',
          periodKey,
          status: 'DONE',
          eventsCreated: created,
          detail,
        },
        update: {},
      })
      result.examsEvaluated++
      result.eventsCreated += created
    }

    return result
  } finally {
    evaluating.delete(schoolId)
  }
}
