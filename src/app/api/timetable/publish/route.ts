import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'
import { slotsToServerRows, type PublishableSlot } from '@/lib/timetable/server-mapping'

export const runtime = 'nodejs'

/**
 * POST /api/timetable/publish — sync the school's Timetable rows with the
 * Principal's PUBLISHED master schedule.
 *
 * PERMISSION MODEL:
 *   · PRINCIPAL only (role check server-side; a student/teacher can never
 *     write the master timetable);
 *   · school-scoped via the session — the sync only ever touches THIS
 *     school's rows.
 *
 * SEMANTICS — replace-all within the school (a publish IS the new truth):
 *   1. map slots → row drafts (ladder period → teaching period, time →
 *      "HH:MM", via the shared server-mapping algorithm);
 *   2. resolve each distinct className → Class row (match by name;
 *      create when the Principal schedules a class the school has not
 *      registered yet);
 *   3. resolve each distinct subject → Subject row (match by name; create
 *      when missing — same honest rule);
 *   4. delete all existing Timetable rows for the school, then write the
 *      new set in one createMany;
 *   5. log the publication to ActivityLog (platform audit trail).
 *
 * Students and teachers read these rows on their next module load — the
 * Principal publishes → the whole school sees it (one data universe).
 */

interface PublishBody {
  slots: PublishableSlot[]
}

const MAX_SLOTS = 600

export async function POST(req: NextRequest) {
  return withUser(
    async (user) => {
      if (user.role !== 'PRINCIPAL') throw new Error('FORBIDDEN')
      const schoolId = schoolScoped(user)

      const body = (await req.json().catch(() => ({}))) as Partial<PublishBody>
      const slots = Array.isArray(body.slots) ? body.slots : []
      if (slots.length === 0) throw new Error('EMPTY_TIMETABLE')
      if (slots.length > MAX_SLOTS) throw new Error('TOO_MANY_SLOTS')

      // 1 — shared ladder-aware mapping (same algorithm the read path uses).
      const drafts = slotsToServerRows(slots)
      if (drafts.length === 0) throw new Error('UNPARSEABLE_SLOTS')

      // 2 — resolve classes (name → row; create genuinely new classes).
      const classNames = [...new Set(drafts.map((d) => d.className))].filter(Boolean)
      const classByKey = new Map<string, { id: string; name: string; section: string | null }>()
      for (const name of classNames) {
        const existing = await db.class.findFirst({
          where: { schoolId, name },
          select: { id: true, name: true, section: true },
        })
        if (existing) {
          classByKey.set(name, existing)
        } else {
          // Name may carry its own section ("Grade 9 - A") — keep the full
          // label as the name (that's how the roster renders it) and derive
          // a single-letter section when one trails the label.
          const sectionMatch = name.match(/[-–\s]([A-Z])$/)
          classByKey.set(
            name,
            await db.class.create({
              data: { schoolId, name, section: sectionMatch ? sectionMatch[1] : null, capacity: 40 },
              select: { id: true, name: true, section: true },
            }),
          )
        }
      }

      // 3 — resolve subjects (name → row; create when missing).
      const subjectNames = [...new Set(drafts.map((d) => d.subject))].filter(Boolean)
      const subjectByKey = new Map<string, { id: string }>()
      for (const name of subjectNames) {
        const existing = await db.subject.findFirst({
          where: { schoolId, name },
          select: { id: true },
        })
        if (existing) {
          subjectByKey.set(name, existing)
        } else {
          subjectByKey.set(
            name,
            await db.subject.create({
              data: {
                schoolId,
                name,
                code: name.slice(0, 4).toUpperCase(),
                status: 'Active',
              },
              select: { id: true },
            }),
          )
        }
      }

      // 4 — replace-all within the school (publish = the new truth).
      //     The publish IS a Principal configuration act: every (class,
      //     subject) it schedules becomes ACTIVE ClassSubjectAssignment
      //     config, so a published timetable can never contain an
      //     "unconfigured subject" cell (no orphaned rows, ever).
      const pairs = new Set(
        drafts.flatMap((d) => {
          const cls = classByKey.get(d.className)
          const subj = subjectByKey.get(d.subject)
          return cls && subj ? [[cls.id, subj.id] as const] : []
        })
      )
      let csaCreated = 0
      for (const [classId, subjectId] of pairs) {
        const existing = await db.classSubjectAssignment.findUnique({
          where: { classId_subjectId: { classId, subjectId } },
          select: { id: true, isActive: true },
        })
        if (!existing) {
          await db.classSubjectAssignment.create({
            data: { schoolId, classId, subjectId, isActive: true },
          })
          csaCreated += 1
        } else if (!existing.isActive) {
          await db.classSubjectAssignment.update({
            where: { id: existing.id },
            data: { isActive: true },
          })
          csaCreated += 1
        }
      }

      const removed = await db.timetable.deleteMany({ where: { schoolId } })
      const written = await db.timetable.createMany({
        data: drafts.map((d) => ({
          schoolId,
          classId: classByKey.get(d.className)!.id,
          subjectId: subjectByKey.get(d.subject)?.id ?? null,
          day: d.day,
          period: d.period,
          startTime: d.startTime,
          endTime: d.endTime,
          teacherName: d.teacherName,
          room: d.room || null,
        })),
      })

      // 5 — audit trail (platform activity feed reads these).
      await db.activityLog.create({
        data: {
          schoolId,
          userId: user.id,
          action: 'TIMETABLE_PUBLISHED',
          detail: `${written.count} slots across ${classByKey.size} classes (replaced ${removed.count} rows)`,
        },
      })

      return {
        rowsWritten: written.count,
        rowsReplaced: removed.count,
        classes: classByKey.size,
        subjects: subjectByKey.size,
        subjectConfigsEnsured: csaCreated,
      }
    },
    { roles: ['PRINCIPAL'] },
  )
}
