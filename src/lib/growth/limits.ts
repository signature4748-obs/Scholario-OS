/**
 * growth/limits — the server-side manual-point anti-abuse guard
 * (refinement §6/§7/§9/§21/§22).
 *
 * UI disabling is ONLY a courtesy — THIS module is the enforcement. Every
 * limit is checked here, at the API/service level, against the canonical
 * GrowthEvent ledger. Automatic events (ATTENDANCE / ACADEMIC) are never
 * counted: they are idempotent by dedupeKey, not rate-limited.
 *
 * POLICY (all configurable on GrowthSetting, §8 — the Principal's levers):
 *   · per TEACHER/student/calendar day      → manualDailyLimitPerTeacher   (1)
 *   · per TEACHER/student/rolling 7 days    → manualWeeklyLimitPerTeacher  (3)
 *   · same TEACHER/student/CATEGORY per rolling 7 days → one event        (§6)
 *   · |net manual points| per teacher/student/rolling 7 days
 *                                          → manualWeeklyPointsCapPerTeacher (5)
 *   · per STUDENT/calendar day (all staff)  → manualDailySchoolLimit       (2)
 *   · per STUDENT/rolling 7 days (all staff)→ manualWeeklySchoolLimit      (5)
 *
 * FEEDBACK (§22): business errors are concise and human — no thresholds,
 * no technical terminology, no rule text on screen.
 *
 * COUNTING RULE: only ACTIVE manual events count. A correction (§29 of the
 * original spec) supersedes the original and posts its own ACTIVE event, so
 * "one event today" stays exactly one after a correction — corrections are
 * never blocked by these limits.
 */

import { db } from '@/lib/db'
import type { GrowthSettingsDto } from './shared'

/** Clean, human limit errors (§22) — the two messages a teacher may see. */
export class GrowthLimitError extends Error {
  /** 'daily' | 'weekly' — lets the UI pre-empt with the same phrasing */
  readonly scope: 'daily' | 'weekly'
  constructor(scope: 'daily' | 'weekly', message: string) {
    super(message)
    this.name = 'GrowthLimitError'
    this.scope = scope
  }
}

const DAY_MS = 24 * 3600 * 1000

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Check every anti-abuse limit for a new manual event. Throws
 *  GrowthLimitError with a concise message when a limit is reached. */
export async function assertManualEventAllowed(args: {
  schoolId: string
  studentId: string
  teacherId: string
  category: string
  points: number
  settings: GrowthSettingsDto
  now?: Date
}): Promise<void> {
  const { schoolId, studentId, teacherId, category, points, settings } = args
  const now = args.now ?? new Date()
  const dayStart = startOfToday(now)
  const weekStart = new Date(now.getTime() - 7 * DAY_MS)

  const manual = { source: 'MANUAL' as const, status: 'ACTIVE' as const }

  // — this teacher's recent manual events for this student (one query) ──
  const mine = await db.growthEvent.findMany({
    where: {
      schoolId,
      studentId,
      createdById: teacherId,
      ...manual,
      createdAt: { gte: weekStart },
    },
    select: { points: true, category: true, createdAt: true },
  })

  const mineToday = mine.filter((e) => e.createdAt >= dayStart)
  if (mineToday.length >= Math.max(0, settings.manualDailyLimitPerTeacher)) {
    throw new GrowthLimitError('daily', "This student's growth has already been updated today.")
  }

  if (mine.length >= Math.max(0, settings.manualWeeklyLimitPerTeacher)) {
    throw new GrowthLimitError('weekly', 'Growth already recorded for this student this week.')
  }

  const sameCategory = mine.filter((e) => e.category === category)
  if (sameCategory.length >= 1) {
    throw new GrowthLimitError('weekly', 'Growth already recorded for this student this week.')
  }

  const netWeek = mine.reduce((s, e) => s + e.points, 0) + points
  const cap = Math.abs(settings.manualWeeklyPointsCapPerTeacher)
  if (netWeek > cap || netWeek < -cap) {
    throw new GrowthLimitError('weekly', 'Growth already recorded for this student this week.')
  }

  // — school-wide guardrails: all staff combined (§7 — a student taught by
  //   many teachers must not be flooded by their combined goodwill) ─────
  const [todayAll, weekAll] = await Promise.all([
    db.growthEvent.count({
      where: { schoolId, studentId, ...manual, createdAt: { gte: dayStart } },
    }),
    db.growthEvent.count({
      where: { schoolId, studentId, ...manual, createdAt: { gte: weekStart } },
    }),
  ])
  if (todayAll >= Math.max(0, settings.manualDailySchoolLimit)) {
    throw new GrowthLimitError('daily', "This student's growth has already been updated today.")
  }
  if (weekAll >= Math.max(0, settings.manualWeeklySchoolLimit)) {
    throw new GrowthLimitError('weekly', 'Growth already recorded for this student this week.')
  }
}

/** The current teacher's recent manual activity per student — feeds the
 *  quiet UI pre-empt (§21): `manualToday` disables the whole quick action,
 *  `manualWeekCategories` dims the specific chips that are spent. */
export async function manualStateByStudent(
  schoolId: string,
  teacherId: string,
  studentIds: string[],
  now?: Date,
): Promise<Map<string, { manualToday: boolean; manualWeekCategories: string[] }>> {
  const out = new Map<string, { manualToday: boolean; manualWeekCategories: string[] }>()
  if (studentIds.length === 0) return out
  const t = now ?? new Date()
  const rows = await db.growthEvent.findMany({
    where: {
      schoolId,
      createdById: teacherId,
      source: 'MANUAL',
      status: 'ACTIVE',
      studentId: { in: studentIds },
      createdAt: { gte: new Date(t.getTime() - 7 * DAY_MS) },
    },
    select: { studentId: true, category: true, createdAt: true },
  })
  const dayStart = startOfToday(t)
  for (const r of rows) {
    const cur = out.get(r.studentId) ?? { manualToday: false, manualWeekCategories: [] }
    if (r.createdAt >= dayStart) cur.manualToday = true
    if (!cur.manualWeekCategories.includes(r.category)) cur.manualWeekCategories.push(r.category)
    out.set(r.studentId, cur)
  }
  return out
}
