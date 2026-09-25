import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser } from '@/lib/api'
import {
  requireTeacher,
  assertStudentInScope,
  authorizedStudentWhere,
  auditTeacherAction,
  parseString,
} from '@/lib/teacher-hub'
import { ensureGrowthEvaluation } from '@/lib/growth/engine'
import {
  growthScoresFor,
  growthSettingsFor,
  manualPresetsFor,
  recentEventsFor,
} from '@/lib/growth/service'
import {
  bandOf,
  growthCategoryOf,
  type GrowthClassSummary,
  type GrowthScopeSummary,
  type GrowthTrendPoint,
  type GrowthWorkspacePayload,
} from '@/lib/growth/shared'

export const runtime = 'nodejs'

// GET /api/teacher/growth — the Student Growth workspace (§12):
// scope summary + per-class summaries, the recent point ledger, manual
// presets, school settings and the 8-week scope trend. The incremental
// automatic evaluation runs first (cheap when nothing is missing).
export async function GET() {
  return withUser(
    async (user) => {
      const ctx = await requireTeacher(user)
      await ensureGrowthEvaluation(ctx.schoolId).catch(() => undefined)

      const [scopeStudents, settings, presets, events] = await Promise.all([
        db.student.findMany({
          where: authorizedStudentWhere(ctx),
          include: {
            class: { select: { id: true, name: true, section: true } },
            user: { select: { name: true } },
          },
          orderBy: [{ rollNo: 'asc' }],
          take: 300,
        }),
        growthSettingsFor(ctx.schoolId),
        manualPresetsFor(ctx.schoolId),
        // ACTIVE only — the teacher feed shows the current truth; the full
        // audit trail (superseded originals + corrections) is the
        // Principal's inspection view (§29/§30).
        recentEventsFor(ctx.schoolId, { status: 'ACTIVE' }, 80),
      ])

      const ids = scopeStudents.map((s) => s.id)
      const scores = await growthScoresFor(ctx.schoolId, ids)

      // — per-class + scope summaries (the SAME canonical scores) ──────
      const classIds = [...new Set(scopeStudents.map((s) => s.classId).filter((x): x is string => !!x))]
      const classes = classIds.length
        ? await db.class.findMany({
            where: { id: { in: classIds } },
            select: { id: true, name: true, section: true },
            orderBy: { name: 'asc' },
          })
        : []
      const labelOf = new Map(
        classes.map((c) => [
          c.id,
          c.section && !c.name.endsWith(` ${c.section}`) ? `${c.name} - ${c.section}` : c.name,
        ]),
      )
      const ctIds = new Set(ctx.classTeacherOf.map((c) => c.id))

      const classSummaries: GrowthClassSummary[] = []
      for (const c of classes) {
        const members = scopeStudents.filter((s) => s.classId === c.id)
        const memberIds = new Set(members.map((s) => s.id))
        const summaries = members.map((s) => scores.get(s.id))
        const withScore = summaries.filter((g): g is NonNullable<typeof g> => !!g && g.score != null)
        const bands = summaries.map((g) => bandOf(g?.score ?? null, g?.monthDelta ?? 0))
        // this class's weekly trend — average of its students' snapshots
        const memberScores = [...scores.entries()]
          .filter(([id]) => memberIds.has(id))
          .map(([, g]) => g)
        const classTrendLen = Math.max(0, ...memberScores.map((g) => g.trend.length), 0)
        const classTrend: GrowthTrendPoint[] = []
        for (let i = 0; i < classTrendLen; i++) {
          const vals: number[] = []
          let label = `W${i}`
          for (const g of memberScores) {
            const p = g.trend[i]
            if (p) {
              label = p.label
              if (p.value != null) vals.push(p.value)
            }
          }
          classTrend.push({
            label,
            value: vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null,
          })
        }
        classSummaries.push({
          classId: c.id,
          label: labelOf.get(c.id) ?? c.name,
          isClassTeacher: ctIds.has(c.id),
          studentCount: members.length,
          average:
            withScore.length > 0
              ? Math.round(withScore.reduce((sum, g) => sum + g.score!, 0) / withScore.length)
              : null,
          improving: bands.filter((b) => b === 'IMPROVING').length,
          steady: bands.filter((b) => b === 'STEADY').length,
          needsAttention: bands.filter((b) => b === 'NEEDS_ATTENTION').length,
          building: bands.filter((b) => b === 'BUILDING').length,
          monthPoints: memberScores.reduce((sum, g) => sum + g.monthDelta, 0),
          trend: classTrend,
        })
      }

      const scopeWithScore = [...scores.values()].filter((g) => g.score != null)
      const scopeBands = [...scores.values()].map((g) => bandOf(g.score, g.monthDelta))
      const summary: GrowthScopeSummary = {
        studentCount: scopeStudents.length,
        average:
          scopeWithScore.length > 0
            ? Math.round(scopeWithScore.reduce((sum, g) => sum + g.score!, 0) / scopeWithScore.length)
            : null,
        improving: scopeBands.filter((b) => b === 'IMPROVING').length,
        steady: scopeBands.filter((b) => b === 'STEADY').length,
        needsAttention: scopeBands.filter((b) => b === 'NEEDS_ATTENTION').length,
        building: scopeBands.filter((b) => b === 'BUILDING').length,
        monthPoints: [...scores.values()].reduce((sum, g) => sum + g.monthDelta, 0),
      }

      // — scope trend: average of the students' weekly snapshots ────────
      const trend: GrowthTrendPoint[] = []
      const trendLen = Math.max(0, ...[...scores.values()].map((g) => g.trend.length), 0)
      for (let i = 0; i < trendLen; i++) {
        const vals: number[] = []
        let label = `W${i}`
        for (const g of scores.values()) {
          const p = g.trend[i]
          if (p) {
            label = p.label
            if (p.value != null) vals.push(p.value)
          }
        }
        trend.push({
          label,
          value: vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null,
        })
      }

      const payload: GrowthWorkspacePayload = {
        scopeLabel:
          [...ctx.classTeacherOf, ...ctx.taughtClasses].map((c) => c.label).join(' · ') || 'Your students',
        settings,
        presets,
        classes: classSummaries,
        students: scopeStudents.map((s) => ({
          id: s.id,
          name: s.user?.name ?? 'Unnamed student',
          rollNo: s.rollNo,
          classLabel: labelOf.get(s.classId ?? '') ?? 'Unassigned',
          classId: s.classId,
        })),
        events,
        summary,
        trend,
      }
      return payload
    },
    { roles: ['TEACHER'] },
  )
}

// POST /api/teacher/growth — award a manual point (§8/§9/§10):
//   · quick-pick: { studentId, presetKey } — points/category/reason come
//     from the school's GrowthRule row (never trusted from the client)
//   · custom: { studentId, points, reason } — reason required, points
//     bounded by the school's settings, negatives checked.
// The note is optional. The server captures teacher/date/student/class
// behind the scenes — the teacher only picks a reason.
export async function POST(req: NextRequest) {
  return withUser(
    async (user) => {
      const ctx = await requireTeacher(user)
      const settings = await growthSettingsFor(ctx.schoolId)
      if (!settings.enabled) throw new Error('The growth system is disabled for this school')

      const body = await req.json().catch(() => null)
      if (!body || typeof body !== 'object') throw new Error('Invalid request body')

      const student = await assertStudentInScope(ctx, body.studentId)

      let points: number
      let category: string
      let reason: string
      const note = parseString(body.note, 'Note', { max: 500 })

      if (typeof body.presetKey === 'string' && body.presetKey.trim()) {
        // quick-pick — resolved against the school's rule catalog
        const rule = await db.growthRule.findFirst({
          where: { schoolId: ctx.schoolId, key: body.presetKey, source: 'MANUAL', enabled: true },
        })
        if (!rule) throw new Error('Unknown point reason')
        points = rule.points
        category = rule.category
        reason = rule.label
      } else {
        // custom entry — short reason required (§9)
        if (!settings.customReasons) throw new Error('Custom point reasons are disabled for this school')
        points = typeof body.points === 'number' ? Math.round(body.points) : Number.NaN
        if (!Number.isFinite(points) || points === 0) throw new Error('Points must be a non-zero number')
        if (points > settings.maxManualPoints || points < settings.minManualPoints) {
          throw new Error(`Points must be between ${settings.minManualPoints} and ${settings.maxManualPoints}`)
        }
        reason = parseString(body.reason, 'Reason', { required: true, max: 80 })!
        category = typeof body.category === 'string' ? growthCategoryOf(body.category) : 'CONDUCT'
      }

      if (points < 0 && !settings.negativeEnabled) {
        throw new Error('Negative points are disabled for this school')
      }

      const event = await db.growthEvent.create({
        data: {
          schoolId: ctx.schoolId,
          studentId: student.id,
          createdById: ctx.userId,
          points,
          category,
          reason,
          note,
          source: 'MANUAL',
          sourceRef: null,
          period: null,
          status: 'ACTIVE',
          effectiveAt: new Date(),
          dedupeKey: `m:${crypto.randomUUID()}`,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          student: {
            select: {
              id: true,
              user: { select: { name: true } },
              class: { select: { name: true, section: true } },
            },
          },
        },
      })

      await auditTeacherAction(
        user,
        ctx.schoolId,
        'GROWTH_POINT_ADDED',
        `${points >= 0 ? '+' : ''}${points} ${reason} for ${student.user?.name ?? 'student'}`,
      )

      return { event }
    },
    { roles: ['TEACHER'] },
  )
}
