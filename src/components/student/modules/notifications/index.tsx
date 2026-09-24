'use client'

/**
 * StudentNotificationsModule — the student's "My Feed" (Notices tab 1).
 *
 * A data-driven feed DERIVED from real sources only (stabilization §8/§10):
 *
 *   Fee reminder     → the student's OWN server fee ledger
 *                      (/api/student/fees — one row while outstanding > 0)
 *   Exams            → the next upcoming exam from the server's Exam rows
 *                      (/api/student/results → upcoming)
 *   New messages     → student-messaging store unread conversations
 *                      (live count)
 *   School news      → REAL announcements from /api/student/notices
 *                      (audience-scoped Notification rows published by the
 *                      school — no static demo content)
 *
 * The legacy client-universe rows are RETIRED: the students-store STU-58
 * fee status, the library-store overdue books (no student-scoped API),
 * the mock-academics exam list and the client timetable-store
 * publications are no longer sources — they simply produce no row.
 *
 * Read state + "Mark all read" persist in the shared student-notif-prefs
 * store (the channel switches live in Settings); announcement rows ALSO
 * honour the server-side acknowledgement (NotificationRead) so feed state
 * converges with the Announcements tab. `onNavigate` (optional)
 * deep-links each item to its module.
 *
 * LR-1 no-duplicate-title rule: no giant "Notifications" heading — the
 * Notices tab bar above says where you are; this opens straight into a
 * compact toolbar + the scannable feed.
 */
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Award, IndianRupee, MessageCircle,
  Megaphone, CheckCheck, ChevronRight, Bell,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatRelativeTime, formatDate, formatINR } from '@/lib/format'
import {
  useStudentMessagingStore, countUnreadConversations, isConversationUnread,
  type StudentConversation,
} from '@/lib/store/student-messaging-store'
import { useStudentNotifPrefsStore, NOTIF_KIND_TO_PREF } from '@/lib/store/student-notif-prefs-store'
import { useServerNotices, type ServerNotice } from '@/lib/store/server-notices-store'
import { toast } from 'sonner'
import { useMyServerFees, useMyServerResults } from '../shared/canonical'

// ─── Types ───────────────────────────────────────────────────────────

export type StudentNotificationTarget =
  | 'results' | 'fees'
  | 'messages' | 'announcements' | 'timetable'

/** Feed kinds that are actually derivable from real sources. */
export type StudentNotificationKind =
  | 'exam' | 'fee' | 'message' | 'announcement'

export interface StudentNotificationItem {
  id: string
  kind: StudentNotificationKind
  title: string
  description: string
  /** Event timestamp (ISO). Standing reminders carry a label instead. */
  at?: string
  /** Label shown instead of a relative time (e.g. 'This term'). */
  standing?: string
  target?: StudentNotificationTarget
  /** Server-acknowledged (announcement rows) — treated as already read. */
  serverRead?: boolean
}

/** The next upcoming exam from /api/student/results. */
export interface UpcomingExam {
  examName: string
  startsAt: string
  endsAt: string | null
}

interface BuildDeps {
  /** Outstanding fee total from the server ledger; null while it loads. */
  feeOutstanding: number | null
  /** Next scheduled (not yet declared) exam; null when there is none. */
  upcomingExam: UpcomingExam | null
  conversations: StudentConversation[]
  seenAt: Record<string, string>
  /** LR-1 — real school announcements (null while loading). */
  serverNotices: ServerNotice[] | null
}

// ─── Derivation (single source of truth for feed + badge) ───────────

export function buildStudentNotifications(
  { feeOutstanding, upcomingExam, conversations, seenAt, serverNotices }: BuildDeps,
): StudentNotificationItem[] {
  const items: StudentNotificationItem[] = []

  // Exams — the next upcoming exam from the server's own Exam rows (the
  // same universe the Results module reads). No mock exam list.
  if (upcomingExam) {
    items.push({
      id: `exam-upcoming-${upcomingExam.examName}`,
      kind: 'exam',
      title: `${upcomingExam.examName} — schedule announced`,
      description: `Starts ${formatDate(upcomingExam.startsAt)}${
        upcomingExam.endsAt ? ` · ends ${formatDate(upcomingExam.endsAt)}` : ''
      }`,
      at: upcomingExam.startsAt,
      standing: 'Upcoming',
      target: 'results',
    })
  }

  // Fee reminder — standing, derived from the canonical server ledger
  // (/api/student/fees). One honest line: what is actually outstanding.
  if (feeOutstanding != null && feeOutstanding > 0) {
    items.push({
      id: 'fee-outstanding',
      kind: 'fee',
      title: 'Fee reminder',
      description: `${formatINR(feeOutstanding)} fee outstanding`,
      standing: 'This term',
      target: 'fees',
    })
  }

  // New messages — one notification while any conversation is unread
  const unread = countUnreadConversations(conversations, seenAt)
  if (unread > 0) {
    const latestUnreadAt = conversations.reduce<string | undefined>((acc, c) => {
      if (!isConversationUnread(c, seenAt)) return acc
      return !acc || c.lastOn > acc ? c.lastOn : acc
    }, undefined)
    items.push({
      id: 'msg-unread',
      kind: 'message',
      title: 'New message from teacher',
      description: `${unread} unread conversation${unread > 1 ? 's' : ''} — open Messages`,
      at: latestUnreadAt,
      target: 'messages',
    })
  }

  // School news — LR-1: the REAL published announcements (audience-scoped,
  // read state honoured from the server acknowledgement). While the feed
  // is loading we show nothing rather than fabricated placeholders.
  for (const n of serverNotices ?? []) {
    items.push({
      id: `ann-${n.id}`,
      kind: 'announcement',
      title: n.title,
      description: `${n.audience} · ${n.sender}`,
      at: n.createdAt,
      target: 'announcements',
      serverRead: n.read,
    })
  }

  // Newest first; standing reminders (no timestamp) sort last.
  return items.sort((a, b) => (b.at ? new Date(b.at).getTime() : 0) - (a.at ? new Date(a.at).getTime() : 0))
}

/** Nav-badge helper — unread derived notifications (not in readIds AND not
 *  server-acknowledged). SS-1: disabled channels never count toward the
 *  badge (same filter the feed applies — prefs are server-persisted,
 *  hydrated on panel mount). */
export function useUnreadStudentNotificationCount(): number {
  const { ledger } = useMyServerFees()
  const { upcoming } = useMyServerResults()
  const conversations = useStudentMessagingStore((s) => s.conversations)
  const seenAt = useStudentMessagingStore((s) => s.seenAt)
  const serverNotices = useServerNotices((s) => s.notices)
  const readIds = useStudentNotifPrefsStore((s) => s.readIds)
  const prefs = useStudentNotifPrefsStore((s) => s.prefs)
  return useMemo(() => {
    const items = buildStudentNotifications({
      feeOutstanding: ledger?.totals.outstanding ?? null,
      upcomingExam: upcoming,
      conversations, seenAt, serverNotices,
    })
    return items.filter(
      (i) => !i.serverRead && !readIds.includes(i.id) && (prefs[NOTIF_KIND_TO_PREF[i.kind]] ?? true),
    ).length
  }, [ledger, upcoming, conversations, seenAt, serverNotices, readIds, prefs])
}

// ─── Presentation meta ───────────────────────────────────────────────

const KIND_META: Record<StudentNotificationKind, { icon: typeof Bell; tone: string; label: string }> = {
  exam: { icon: Award, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Exam' },
  fee: { icon: IndianRupee, tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', label: 'Fees' },
  message: { icon: MessageCircle, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Messages' },
  announcement: { icon: Megaphone, tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', label: 'School' },
}

// ─── Module ──────────────────────────────────────────────────────────

export function StudentNotificationsModule({ onNavigate }: { onNavigate?: (key: string) => void }) {
  // Canonical server data — the student's own fee ledger + exam universe.
  const { ledger } = useMyServerFees()
  const { upcoming } = useMyServerResults()
  const conversations = useStudentMessagingStore((s) => s.conversations)
  const seenAt = useStudentMessagingStore((s) => s.seenAt)
  const serverNotices = useServerNotices((s) => s.notices)
  const readIds = useStudentNotifPrefsStore((s) => s.readIds)
  const prefs = useStudentNotifPrefsStore((s) => s.prefs)
  const markRead = useStudentNotifPrefsStore((s) => s.markRead)
  const markAllRead = useStudentNotifPrefsStore((s) => s.markAllRead)

  // SS-1 — channel preferences filter the feed (server-persisted prefs;
  // messages/announcements are ALSO enforced server-side in the bell feed).
  const items = useMemo(
    () =>
      buildStudentNotifications({
        feeOutstanding: ledger?.totals.outstanding ?? null,
        upcomingExam: upcoming,
        conversations, seenAt, serverNotices,
      })
        .filter((i) => prefs[NOTIF_KIND_TO_PREF[i.kind]] ?? true),
    [ledger, upcoming, conversations, seenAt, serverNotices, prefs],
  )
  const isRead = (i: StudentNotificationItem) => i.serverRead === true || readIds.includes(i.id)
  const unreadItems = items.filter((i) => !isRead(i))

  const handleMarkAllRead = () => {
    markAllRead(items.map((i) => i.id))
    toast.success('All notifications marked as read')
  }

  const handleItemClick = (item: StudentNotificationItem) => {
    markRead(item.id)
    if (item.target && onNavigate) onNavigate(item.target)
  }

  return (
    <div className="space-y-3">
      {/* ── Compact toolbar — honest counts, no module title (LR-1) ── */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {items.length} item{items.length === 1 ? '' : 's'}
          {unreadItems.length > 0 && (
            <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {unreadItems.length} new
            </span>
          )}
        </p>
        {unreadItems.length > 0 && (
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleMarkAllRead}>
            <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Mark all read
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border bg-card/50 px-4 py-12 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
            <Bell className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Nothing needs your attention right now.
          </p>
        </div>
      ) : (
        /* ── The feed — one scannable list, not stacked cards ─────── */
        <div className="max-h-[62vh] space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
          {items.map((item, i) => {
            const meta = KIND_META[item.kind]
            const Icon = meta.icon
            const unread = !isRead(item)
            const time = item.standing ?? (item.at ? formatRelativeTime(item.at) : '')
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.25), duration: 0.2 }}
              >
                <div
                  role={item.target ? 'button' : undefined}
                  tabIndex={item.target ? 0 : undefined}
                  onClick={() => handleItemClick(item)}
                  onKeyDown={(e) => {
                    if (item.target && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      handleItemClick(item)
                    }
                  }}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                    unread ? 'border-primary/25 bg-primary/[0.04]' : 'border-border/70 bg-card/40',
                    item.target && 'cursor-pointer hover:border-primary/40 hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring/40',
                  )}
                >
                  <span className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    meta.tone,
                    !unread && 'opacity-60',
                  )}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn('truncate text-sm', unread ? 'font-semibold' : 'font-medium text-muted-foreground')}>
                        {item.title}
                      </span>
                      {unread && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                      )}
                    </span>
                    <span className={cn('mt-0.5 block truncate text-[11px] leading-relaxed', unread ? 'text-muted-foreground' : 'text-muted-foreground/70')}>
                      {item.description}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        {meta.label}
                      </span>
                      {time && (
                        <>
                          <span aria-hidden className="text-muted-foreground/30">·</span>
                          <span className="text-[10px] tabular-nums text-muted-foreground/70">{time}</span>
                        </>
                      )}
                      {item.target && (
                        <>
                          <span aria-hidden className="text-muted-foreground/30">·</span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary">
                            View <ChevronRight className="h-3 w-3" aria-hidden />
                          </span>
                        </>
                      )}
                    </span>
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
