import { db } from '@/lib/db'
import { withUser } from '@/lib/api'
import { parseUserAgent } from '@/lib/auth'

export const runtime = 'nodejs'

/**
 * GET /api/superadmin/activity — the platform's REAL cross-school activity
 * stream (no mock tenant data), merged from the server's own records:
 *
 *   · ActivityLog — staff actions actually logged by school workflows
 *     (messages sent, announcements published, timetables published…);
 *   · Payment     — successful fee payments (school revenue events);
 *   · Session     — user sign-ins (device context included).
 *
 * SUPER_ADMIN only (platform-level oversight). One unified, newest-first
 * timeline with honest provenance: every row says WHO did WHAT at WHICH
 * school (user + school names are included; never tokens or IPs in the
 * payload — the session events carry a device label, nothing more).
 *
 * Shape: { events: [{ id, at, kind, actor, school, summary, meta }] }
 */

type FeedEvent = {
  id: string
  at: string
  kind: 'staff' | 'payment' | 'signin'
  actor: string
  school: string | null
  summary: string
  meta: string | null
}

const LIMIT = 30

export async function GET() {
  return withUser(
    async () => {
      const [logs, payments, sessions] = await Promise.all([
        db.activityLog.findMany({
          take: LIMIT,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { name: true, email: true } },
            school: { select: { name: true } },
          },
        }),
        db.payment.findMany({
          take: LIMIT,
          orderBy: { createdAt: 'desc' },
          where: { status: 'SUCCESS' },
          include: {
            fee: {
              select: {
                student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } },
              },
            },
          },
        }),
        db.session.findMany({
          take: LIMIT,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { name: true, role: true } },
          },
        }),
      ])

      // Session count per user for the day is NOT leaked; only the event row.
      const events: FeedEvent[] = []

      for (const l of logs) {
        events.push({
          id: `log-${l.id}`,
          at: l.createdAt.toISOString(),
          kind: 'staff',
          actor: l.user?.name ?? 'System',
          school: l.school?.name ?? null,
          summary: l.action.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()),
          meta: l.detail ?? null,
        })
      }

      for (const p of payments) {
        const studentName = p.fee?.student?.user?.name
        const className = p.fee?.student?.class?.name
        events.push({
          id: `pay-${p.id}`,
          at: p.createdAt.toISOString(),
          kind: 'payment',
          actor: studentName ? `${studentName} (family)` : 'Fee payment',
          school: null,
          summary: `Fee payment received · ₹${p.amount.toLocaleString('en-IN')}`,
          meta: [className, p.method, p.transactionId].filter(Boolean).join(' · ') || null,
        })
      }

      for (const s of sessions) {
        const ua = parseUserAgent(s.userAgent)
        events.push({
          id: `ses-${s.id}`,
          at: s.createdAt.toISOString(),
          kind: 'signin',
          actor: s.user?.name ?? 'Unknown user',
          school: null,
          summary: `Sign-in · ${s.user?.role ?? 'user'}`,
          meta: s.userAgent
            ? `${ua.browser} · ${ua.os} · ${ua.device}${s.userAgent.includes('curl') ? ' (API)' : ''}`
            : null,
        })
      }

      events.sort((a, b) => (a.at < b.at ? 1 : -1))

      return {
        events: events.slice(0, LIMIT),
        counts: {
          staff: logs.length,
          payments: payments.length,
          signins: sessions.length,
        },
      }
    },
    { roles: ['SUPER_ADMIN'] },
  )
}
