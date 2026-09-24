'use client'

/**
 * StudentMessagesModule — the student's canonical server inbox
 * (master-detail, read-only).
 *
 * STABILIZATION — every thread here is a REAL Message row from
 * GET /api/messages?box=inbox (recipientId = the session user):
 * principal reminders, teacher notices, school communications the
 * staff actually sent. The former fabricated demo threads
 * (Rohan/Kavita conversations persisted client-side in
 * localStorage) are RETIRED — this module never invents content.
 *
 * Compose: POST /api/messages is deliberately gated to staff roles
 * (PRINCIPAL/MANAGEMENT/TEACHER) in this backend, so the student
 * surface shows no composer — an honest read-only inbox. Opening a
 * message marks it read (PATCH /api/messages, per-recipient).
 *
 * LR-1 no-duplicate-title rule: no giant "Messages" heading — the
 * sidebar + top bar already say where you are. One compact toolbar
 * above the mail-style two-pane surface.
 */
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Inbox, Mail, MailOpen, RefreshCw, Search,
} from 'lucide-react'
import { GlassCard, GradientAvatar } from '@/components/shared/ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatRelativeTime, formatTime, formatDate } from '@/lib/format'
import { useServerInbox, type ServerInboxMessage } from '@/lib/store/server-inbox-store'
import { useCanonicalStudent } from '../shared/canonical'

/** Sender role → friendly label for the thread header. */
function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'PRINCIPAL': return 'Principal'
    case 'TEACHER': return 'Teacher'
    case 'MANAGEMENT': return 'School Office'
    case 'SUPER_ADMIN': return 'Platform'
    default: return 'School'
  }
}

/** Timestamp label for a message — time today, date otherwise. */
function messageStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  return sameDay ? formatTime(d) : formatDate(d)
}

/** First line of the body as the list preview. */
function preview(body: string): string {
  const line = body.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  return line.slice(0, 120)
}

export function StudentMessagesModule() {
  const messages = useServerInbox((s) => s.messages)
  const loading = useServerInbox((s) => s.loading)
  const error = useServerInbox((s) => s.error)
  const refresh = useServerInbox((s) => s.refresh)

  // Canonical identity — the context line renders the session's own class
  // (server Student row); no client roster is consulted.
  const { student } = useCanonicalStudent()

  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Fresh inbox on mount (the panel hydrates it too — this catches
  // messages that arrived while the student sat in another module).
  useEffect(() => { void refresh() }, [refresh])

  const unread = useMemo(() => (messages ?? []).filter((m) => !m.read).length, [messages])

  const sorted = useMemo(
    () => [...(messages ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [messages],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((m) =>
      (m.sender?.name ?? '').toLowerCase().includes(q) ||
      m.subject.toLowerCase().includes(q) ||
      m.body.toLowerCase().includes(q),
    )
  }, [sorted, query])

  const active = (messages ?? []).find((m) => m.id === openId) ?? null

  return (
    <div className="space-y-3">
      {/* ── Compact toolbar — context + actions, no module title (LR-1) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">
          {student?.classLabel
            ? `${student.classLabel} · school messages for you`
            : 'Messages sent to you by the school'}
        </p>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 text-[10px]">
              {unread} unread
            </Badge>
          )}
          <Button size="sm" variant="outline" className="h-8" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
            {loading ? 'Checking…' : 'Refresh'}
          </Button>
        </div>
      </div>

      <GlassCard className="p-0 overflow-hidden flex h-[70vh] lg:h-[calc(100vh-13rem)] min-h-[28rem]">
        {/* ── Message list (master) ── */}
        <div
          className={cn(
            'w-full lg:w-[330px] lg:min-w-[330px] lg:max-w-[330px] shrink-0 border-b lg:border-b-0 lg:border-r border-border flex flex-col',
            openId && 'hidden lg:flex',
          )}
        >
          <div className="p-3 border-b border-border/60">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search messages"
                aria-label="Search messages"
                className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading && !messages ? (
              <InboxSkeleton />
            ) : error && !messages ? (
              <EmptyMini text="Couldn't load your messages. Try the refresh button above." />
            ) : filtered.length === 0 ? (
              <EmptyMini
                text={
                  (messages ?? []).length === 0
                    ? 'No messages yet — school communications will appear here.'
                    : 'No messages match your search.'
                }
              />
            ) : (
              filtered.map((m, i) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  index={i}
                  selected={openId === m.id}
                  onOpen={() => setOpenId(m.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Message (detail) ── */}
        <div className={cn('flex-1 min-w-0 flex flex-col', !openId && 'hidden lg:flex')}>
          {active ? (
            <MessageView
              message={active}
              onBack={() => setOpenId(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                <Inbox className="h-6 w-6" aria-hidden />
              </div>
              <p className="text-sm font-medium">Select a message</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                Pick a message from the list to read it in full.
              </p>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  )
}

// ─── List row ───────────────────────────────────────────────────────

function MessageRow({ message, index, selected, onOpen }: {
  message: ServerInboxMessage
  index: number
  selected: boolean
  onOpen: () => void
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.2) }}
      onClick={onOpen}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'relative w-full flex items-start gap-3 px-3.5 py-3 text-left border-b border-border/40 transition-colors',
        selected ? 'bg-primary/[0.06]' : 'hover:bg-muted/40',
      )}
    >
      {/* Selection rail — a hairline accent on the open message */}
      {selected && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[3px] rounded-r-full bg-primary" aria-hidden />
      )}
      <GradientAvatar name={message.sender?.name ?? 'School'} size="sm" className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn(
            'text-[13px] truncate flex-1',
            !message.read ? 'font-semibold' : 'font-medium text-foreground/85',
          )}>{message.sender?.name ?? 'School office'}</p>
          {!message.read && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
          )}
        </div>
        <p className={cn(
          'text-[11px] truncate mt-0.5',
          !message.read ? 'text-foreground/80 font-medium' : 'text-muted-foreground',
        )}>{message.subject}</p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-[10px] truncate flex-1 text-muted-foreground/70">
            {preview(message.body)}
          </p>
          <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
            {formatRelativeTime(message.createdAt)}
          </span>
        </div>
      </div>
    </motion.button>
  )
}

// ─── Message detail ─────────────────────────────────────────────────

function MessageView({ message, onBack }: { message: ServerInboxMessage; onBack: () => void }) {
  const markRead = useServerInbox((s) => s.markRead)

  // Opening a message acknowledges it (server-side per-recipient read
  // state — re-fires safely if a new row replaces this one).
  useEffect(() => {
    if (!message.read) void markRead(message.id)
  }, [message.id, message.read, markRead])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Message header */}
      <div className="shrink-0 flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-border/60">
        <button
          onClick={onBack}
          className="lg:hidden -ml-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Back to messages"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <GradientAvatar name={message.sender?.name ?? 'School'} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{message.sender?.name ?? 'School office'}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {roleLabel(message.sender?.role)} · {messageStamp(message.createdAt)}
          </p>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            'text-[10px] shrink-0 gap-1',
            message.read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
          )}
        >
          {message.read ? <MailOpen className="h-3 w-3" aria-hidden /> : <Mail className="h-3 w-3" aria-hidden />}
          {message.read ? 'Read' : 'New'}
        </Badge>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-5">
        <p className="text-base font-semibold text-foreground mb-1">{message.subject}</p>
        <p className="text-[11px] text-muted-foreground mb-4">
          From {message.sender?.name ?? 'the school office'} ({roleLabel(message.sender?.role)}) · {formatDate(message.createdAt)} · {formatTime(message.createdAt)}
        </p>
        <div className="rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-5">
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
            {message.body}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Loading skeleton + empty state ─────────────────────────────────

function InboxSkeleton() {
  return (
    <div className="p-3 space-y-2" aria-label="Loading messages" role="status">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 px-1 py-2 animate-pulse">
          <div className="h-8 w-8 shrink-0 rounded-full bg-muted/70" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 rounded bg-muted/70" />
            <div className="h-2.5 w-1/2 rounded bg-muted/50" />
            <div className="h-2 w-5/6 rounded bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="py-12 text-center px-6">
      <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
        <Mail className="h-4.5 w-4.5" aria-hidden />
      </div>
      <p className="text-xs text-muted-foreground max-w-[16rem] mx-auto leading-relaxed">{text}</p>
    </div>
  )
}
