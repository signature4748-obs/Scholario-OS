/**
 * scripts/growth-migrate.ts — Student Growth system bootstrap (idempotent).
 *
 * 1. Seeds GrowthSetting + the GrowthRule catalog for every school
 *    (manual quick-picks + automatic evaluation rules — §17/§18).
 * 2. Migrates the legacy BehaviorRecord universe into the growth point
 *    ledger: real teacher-recorded observations become real manual point
 *    events (positive → +2, concern → −2, observation → +1 with the
 *    description preserved as the note). Legacy private notes are NEVER
 *    migrated (they were staff-only by contract and stay in the legacy
 *    table). Re-running never duplicates (dedupeKey = legacy:<recordId>).
 * 3. Cancels open legacy behavior follow-ups (the follow-up concept is
 *    not part of the quick-action growth workflow; open ones are closed
 *    honestly with an explanatory note).
 * 4. Runs the automatic evaluation engine once per school (attendance
 *    weeks + completed exams) — the same incremental, idempotent routine
 *    the Growth module calls on load.
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ── the rule catalog (§5/§17 — configurable, seeded as data not code) ────

const MANUAL_RULES: { key: string; label: string; category: string; points: number; sortOrder: number }[] = [
  { key: 'manual_participation', label: 'Participation', category: 'PARTICIPATION', points: 2, sortOrder: 10 },
  { key: 'manual_helping_others', label: 'Helping Others', category: 'CONDUCT', points: 2, sortOrder: 11 },
  { key: 'manual_leadership', label: 'Leadership', category: 'PARTICIPATION', points: 3, sortOrder: 12 },
  { key: 'manual_assignment', label: 'Consistent Work', category: 'ACADEMIC', points: 2, sortOrder: 13 },
  { key: 'manual_good_conduct', label: 'Good Conduct', category: 'CONDUCT', points: 2, sortOrder: 14 },
  { key: 'manual_improvement', label: 'Outstanding Improvement', category: 'IMPROVEMENT', points: 3, sortOrder: 15 },
  { key: 'manual_minor_concern', label: 'Minor Concern', category: 'CONDUCT', points: -1, sortOrder: 20 },
  { key: 'manual_disruption', label: 'Repeated Disruption', category: 'CONDUCT', points: -2, sortOrder: 21 },
  { key: 'manual_incomplete_work', label: 'Incomplete Work', category: 'ACADEMIC', points: -2, sortOrder: 22 },
  { key: 'manual_lateness', label: 'Repeated Lateness', category: 'ATTENDANCE', points: -3, sortOrder: 23 },
]

const ATTENDANCE_RULES: { key: string; label: string; category: string; points: number; sortOrder: number }[] = [
  { key: 'attendance_week_excellent', label: 'Excellent weekly attendance', category: 'ATTENDANCE', points: 3, sortOrder: 1 },
  { key: 'attendance_week_consistent', label: 'Attendance consistency', category: 'ATTENDANCE', points: 2, sortOrder: 2 },
  { key: 'attendance_week_good', label: 'Good weekly attendance', category: 'ATTENDANCE', points: 1, sortOrder: 3 },
  { key: 'attendance_week_absences', label: 'Repeated absences this week', category: 'ATTENDANCE', points: -2, sortOrder: 4 },
  { key: 'attendance_week_late', label: 'Repeated lateness this week', category: 'ATTENDANCE', points: -1, sortOrder: 5 },
]

const ACADEMIC_RULES: { key: string; label: string; category: string; points: number; sortOrder: number }[] = [
  { key: 'academic_result_strong', label: 'Strong academic result', category: 'ACADEMIC', points: 3, sortOrder: 1 },
  { key: 'academic_result_solid', label: 'Solid academic result', category: 'ACADEMIC', points: 2, sortOrder: 2 },
  { key: 'academic_result_mastery', label: 'Subject mastery', category: 'ACADEMIC', points: 2, sortOrder: 3 },
  { key: 'academic_improvement', label: 'Academic improvement', category: 'IMPROVEMENT', points: 5, sortOrder: 4 },
  { key: 'academic_decline', label: 'Recent academic decline', category: 'ACADEMIC', points: -3, sortOrder: 5 },
]

// ── legacy behavior → growth mapping ─────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  'positive-recognition': 'CONDUCT',
  'class-participation': 'PARTICIPATION',
  leadership: 'PARTICIPATION',
  collaboration: 'PARTICIPATION',
  'respect-conduct': 'CONDUCT',
  'academic-effort': 'ACADEMIC',
  'attendance-concern': 'ATTENDANCE',
  'classroom-concern': 'CONDUCT',
  'safety-concern': 'CONDUCT',
  other: 'CONDUCT',
}

const LABEL_MAP: Record<string, string> = {
  'positive-recognition': 'Positive Recognition',
  'class-participation': 'Class Participation',
  leadership: 'Leadership',
  collaboration: 'Collaboration',
  'respect-conduct': 'Respect & Conduct',
  'academic-effort': 'Academic Effort',
  'attendance-concern': 'Attendance Concern',
  'classroom-concern': 'Classroom Concern',
  'safety-concern': 'Safety Concern',
  other: 'Observation',
}

async function migrateSchool(schoolId: string) {
  // 1 — settings + rules (upsert = idempotent)
  await db.growthSetting.upsert({
    where: { schoolId },
    create: { schoolId },
    update: {},
  })
  const allRules = [
    ...MANUAL_RULES.map((r) => ({ ...r, source: 'MANUAL', frequency: 'manual' })),
    ...ATTENDANCE_RULES.map((r) => ({ ...r, source: 'ATTENDANCE', frequency: 'weekly' })),
    ...ACADEMIC_RULES.map((r) => ({ ...r, source: 'ACADEMIC', frequency: 'exam' })),
  ]
  for (const r of allRules) {
    await db.growthRule.upsert({
      where: { schoolId_key: { schoolId, key: r.key } },
      create: {
        schoolId,
        key: r.key,
        label: r.label,
        category: r.category,
        points: r.points,
        source: r.source,
        frequency: r.frequency,
        sortOrder: r.sortOrder,
        params: null,
        enabled: true,
      },
      update: { label: r.label, category: r.category, source: r.source, frequency: r.frequency, sortOrder: r.sortOrder },
    })
  }

  // 2 — legacy behavior records → growth events (dedupeKey = legacy:<id>)
  const records = await db.behaviorRecord.findMany({ where: { schoolId } })
  let migrated = 0
  for (const r of records) {
    const points = r.type === 'positive' ? 2 : r.type === 'concern' ? -2 : 1
    const reason =
      r.type === 'observation' ? 'Recorded observation' : LABEL_MAP[r.category] ?? 'Observation'
    const category = CATEGORY_MAP[r.category] ?? 'CONDUCT'
    try {
      await db.growthEvent.create({
        data: {
          schoolId,
          studentId: r.studentId,
          createdById: r.recordedById,
          points,
          category,
          reason,
          // only the shared description migrates — legacy private notes
          // were staff-only by contract and stay in the legacy table
          note: r.description,
          source: 'MANUAL',
          sourceRef: `legacy-behavior:${r.id}`,
          period: null,
          status: 'ACTIVE',
          effectiveAt: r.date,
          createdAt: r.createdAt,
          dedupeKey: `legacy:${r.id}`,
        },
      })
      migrated++
    } catch {
      // already migrated — idempotent re-run
    }
  }

  // 3 — cancel open legacy behavior follow-ups honestly
  const cancelled = await db.teacherFollowUp.updateMany({
    where: { schoolId, kind: 'behavior', status: 'open' },
    data: {
      status: 'cancelled',
      note: 'Closed automatically — the Behavior module became Student Growth (points-ledger redesign).',
    },
  })

  console.log(
    `school ${schoolId}: ${migrated} legacy records migrated (of ${records.length}), ${cancelled.count} follow-ups cancelled, ${allRules.length} rules`,
  )
}

async function main() {
  const schools = await db.school.findMany({ select: { id: true, name: true } })
  for (const s of schools) {
    await migrateSchool(s.id)
  }

  // 4 — run the automatic evaluation once (same routine the module uses)
  const { ensureGrowthEvaluation } = await import('../src/lib/growth/engine')
  for (const s of schools) {
    const res = await ensureGrowthEvaluation(s.id)
    if (res.weeksEvaluated || res.examsEvaluated || res.eventsCreated) {
      console.log(
        `school ${s.id}: engine evaluated ${res.weeksEvaluated} weeks + ${res.examsEvaluated} exams → ${res.eventsCreated} automatic events`,
      )
    } else {
      console.log(`school ${s.id}: engine found nothing new to evaluate`)
    }
  }

  const total = await db.growthEvent.count()
  const active = await db.growthEvent.count({ where: { status: 'ACTIVE' } })
  const runs = await db.growthEvalRun.count()
  console.log(`growth ledger: ${total} events (${active} active), ${runs} eval runs`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
