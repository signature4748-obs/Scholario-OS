import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser } from '@/lib/api'
import { requireTeacher, auditTeacherAction, parseDate } from '@/lib/teacher-hub'
import { SEED_TEACHERS } from '@/lib/store/teachers-store/seed-data'
import { DEFAULT_POSITIONS } from '@/lib/store/teachers-store/constants'
import { getTeacherActivePermissions } from '@/lib/store/teachers-store/helpers'

export const runtime = 'nodejs'

// POST /api/teacher/communication/announcement — publish a school
// announcement as ONE canonical Notification row with audience targeting
// (never per-recipient copies). Permission is enforced on BOTH sides and
// SPLIT by scope:
//   · CLASS-SCOPED audiences (the class teacher's own class — students,
//     parents, or everyone) require ONLY the class-teacher appointment.
//     The classId is re-derived from the session (ctx.classTeacherOf);
//     a client can never target a class the teacher is not appointed to.
//   · SCHOOL-WIDE audiences additionally require the 'announcements'
//     permission from an ACTIVE position (the same teachers-store
//     permission system that gates the teacher nav). Normal class
//     teachers can never broadcast school-wide.
// The server independently enforces everything else it can derive from the
// session: TEACHER role, school scope and payload validity.
// NOTE (honest limitation): position assignments live in the client-side
// teachers-store; the server consults the canonical seed roster, so an
// in-session principal edit to a teacher's positions is not visible here
// until that data is persisted server-side (follow-up).
const SCHOOL_AUDIENCE_TAGS: Record<string, string> = {
  'all-teachers': 'TEACHERS',
  'all-parents': 'PARENTS',
  'all-staff': 'STAFF',
  'whole-school': 'ALL',
}
const PRIORITIES = new Set(['NORMAL', 'HIGH', 'URGENT'])

/** Resolve the session teacher's position permissions (fail closed). */
function sessionAnnouncementPermission(email: string): boolean {
  const rosterRecord = SEED_TEACHERS.find((t) => t.email.toLowerCase() === email.toLowerCase())
  const permissions = rosterRecord
    ? getTeacherActivePermissions(rosterRecord, DEFAULT_POSITIONS)
    : []
  return permissions.includes('announcements')
}

export async function POST(req: NextRequest) {
  return withUser(
    async (user) => {
      const ctx = await requireTeacher(user)

      const body = await req.json().catch(() => null)
      if (!body || typeof body !== 'object') throw new Error('Invalid request body')

      const title = typeof body.title === 'string' ? body.title.trim() : ''
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      const audienceInput = typeof body.audience === 'string' ? body.audience.trim() : ''
      const priority =
        typeof body.priority === 'string' && PRIORITIES.has(body.priority)
          ? body.priority
          : 'NORMAL'

      if (!title || title.length < 3) throw new Error('Title must be at least 3 characters')
      if (title.length > 120) throw new Error('Title must be at most 120 characters')
      if (!message || message.length < 3) throw new Error('Message must be at least 3 characters')
      if (message.length > 2000) throw new Error('Message must be at most 2000 characters')
      if (!audienceInput) throw new Error('Audience is required')

      // ── Audience resolution (structured value, re-derived server-side) ──
      //   school-wide: 'whole-school' | 'all-teachers' | 'all-parents' | 'all-staff'
      //   class-scoped: 'class:<classId>' | 'class-parents:<classId>' | 'class-students:<classId>'
      let audience: string
      if (SCHOOL_AUDIENCE_TAGS[audienceInput]) {
        if (!sessionAnnouncementPermission(user.email)) {
          throw new Error('School-wide announcements require the announcements permission')
        }
        audience = SCHOOL_AUDIENCE_TAGS[audienceInput]
      } else {
        const [kindRaw, classIdRaw] = audienceInput.split(':')
        const kind = (kindRaw ?? '').toLowerCase()
        const classId = (classIdRaw ?? '').trim()
        if (!['class', 'class-parents', 'class-students'].includes(kind) || !classId) {
          throw new Error('Audience must be a school-wide group or one of your classes')
        }
        // Re-derive the class from the session — the appointment IS the
        // permission for class-scoped announcements.
        const ownClass = ctx.classTeacherOf.find((c) => c.id === classId)
        if (!ownClass) {
          throw new Error('You can only announce to classes you are the class teacher of')
        }
        audience =
          kind === 'class-parents'
            ? `CLASS_PARENTS:${ownClass.label}`
            : kind === 'class-students'
              ? `CLASS_STUDENTS:${ownClass.label}`
              : `CLASS:${ownClass.label}`
      }

      // ── Optional schedule + expiry (Notification.publishAt / expiresAt —
      //    every reader filters through notificationVisibilityWhere, so a
      //    scheduled row stays invisible until due and an expired one
      //    disappears everywhere at once). ──
      let publishAt: Date | null = null
      let expiresAt: Date | null = null
      if (body.publishAt != null && body.publishAt !== '') {
        if (typeof body.publishAt !== 'string') throw new Error('Publish date must be a date-time')
        publishAt = parseDate(body.publishAt, 'Publish date')
      }
      if (body.expiresAt != null && body.expiresAt !== '') {
        if (typeof body.expiresAt !== 'string') throw new Error('Expiry date must be a date-time')
        expiresAt = parseDate(body.expiresAt, 'Expiry date')
        if (publishAt && expiresAt.getTime() <= publishAt.getTime()) {
          throw new Error('Expiry must be after the publish date')
        }
        if (!publishAt && expiresAt.getTime() <= Date.now()) {
          throw new Error('Expiry must be in the future')
        }
      }

      const notification = await db.notification.create({
        data: {
          schoolId: ctx.schoolId,
          title,
          message,
          audience,
          priority,
          senderId: ctx.userId,
          ...(publishAt ? { publishAt } : {}),
          ...(expiresAt ? { expiresAt } : {}),
        },
      })

      await auditTeacherAction(
        user,
        ctx.schoolId,
        'TEACHER_ANNOUNCEMENT_PUBLISHED',
        `"${title}" → ${audience}${publishAt ? ` (scheduled ${publishAt.toISOString()})` : ''} (notification ${notification.id})`,
      )

      return {
        id: notification.id,
        title: notification.title,
        audience: notification.audience,
        priority: notification.priority,
        publishAt: notification.publishAt ? notification.publishAt.toISOString() : null,
        expiresAt: notification.expiresAt ? notification.expiresAt.toISOString() : null,
        createdAt: notification.createdAt.toISOString(),
      }
    },
    { roles: ['TEACHER'] },
  )
}
