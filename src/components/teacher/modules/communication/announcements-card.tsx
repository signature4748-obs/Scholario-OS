'use client'

/**
 * communication/announcements-card — the ANNOUNCEMENTS pane: the
 * Notification rows this teacher is allowed to see (audience-scoped via
 * audienceAllows, class fan-outs deduped on the server — same rule as the
 * bell feed), newest first, as a searchable LIST (not a wall of cards).
 * A row expands inline to the full announcement; unread items can be
 * acknowledged ("Mark as read" persists a NotificationRead through the
 * SAME /api/notifications-feed PATCH the bell feed uses).
 */

import { useMemo, useState } from 'react'
import { Check, ChevronDown, Loader2, Megaphone, Plus, Search } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { HubEmptyState } from '@/components/teacher/modules/shared/hub-stat-cards'
import { cn } from '@/lib/utils'
import { announcementDate, audienceChip, priorityTone } from './shared'
import type { CommunicationAnnouncement } from './types'

const THIN_SCROLLBAR =
  '[scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5'

type AudienceFilter = 'all' | 'own' | 'school'

interface AnnouncementsCardProps {
  announcements: CommunicationAnnouncement[]
  /** read-state resolver (server readAt ∨ local acknowledgement override) */
  isRead: (a: CommunicationAnnouncement) => boolean
  /** mark as read — the parent persists it and updates the override */
  onMarkRead: (id: string) => Promise<void>
  /** shown on the empty state ONLY when the teacher has announcement permission */
  onNewAnnouncement?: () => void
}

export function AnnouncementsCard({
  announcements,
  isRead,
  onMarkRead,
  onNewAnnouncement,
}: AnnouncementsCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('all')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return announcements.filter((a) => {
      if (audienceFilter === 'own' && !a.ownClass) return false
      if (audienceFilter === 'school' && a.ownClass) return false
      if (!q) return true
      return (
        a.title.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        a.senderName.toLowerCase().includes(q)
      )
    })
  }, [announcements, query, audienceFilter])

  const ownCount = announcements.filter((a) => a.ownClass).length

  return (
    <GlassCard className="flex flex-col overflow-hidden p-0">
      <div className="space-y-2.5 border-b border-border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            School Announcements
          </p>
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
            {visible.length} of {announcements.length} visible
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search announcements…"
              aria-label="Search announcements"
              className="w-full rounded-lg border border-border bg-card/50 py-1.5 pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
            />
          </div>
          <div className="flex shrink-0 gap-1.5" role="group" aria-label="Filter by audience">
            {([
              { value: 'all', label: 'All' },
              { value: 'own', label: `My classes${ownCount ? ` (${ownCount})` : ''}` },
              { value: 'school', label: 'School' },
            ] as { value: AudienceFilter; label: string }[])
              .filter((f) => f.value !== 'own' || ownCount > 0)
              .map((f) => (
                <button
                  key={f.value}
                  onClick={() => setAudienceFilter(f.value)}
                  aria-pressed={audienceFilter === f.value}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    audienceFilter === f.value
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
          </div>
        </div>
      </div>

      {announcements.length === 0 ? (
        <HubEmptyState
          icon={Megaphone}
          title="No announcements yet"
          hint="School-wide notices addressed to teachers will appear here."
          action={
            onNewAnnouncement && (
              <button
                onClick={onNewAnnouncement}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New Announcement
              </button>
            )
          }
        />
      ) : visible.length === 0 ? (
        <p className="px-4 py-10 text-center text-xs text-muted-foreground">
          No announcements match your search or filter.
        </p>
      ) : (
        <div
          className={cn('max-h-[26rem] divide-y divide-border/50 overflow-y-auto', THIN_SCROLLBAR)}
          role="list"
          aria-label="School announcements for teachers"
        >
          {visible.map((a) => {
            const read = isRead(a)
            const expanded = expandedId === a.id
            const priority = priorityTone(a.priority)
            return (
              <div key={a.id} role="listitem">
                <button
                  onClick={() => setExpandedId(expanded ? null : a.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40"
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      read ? 'bg-transparent' : 'bg-primary',
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={cn(
                          'truncate text-sm',
                          read ? 'font-medium text-foreground' : 'font-semibold text-foreground',
                        )}
                      >
                        {a.title}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                          audienceChip(a),
                        )}
                      >
                        {a.ownClass ? `Your class · ${a.audienceLabel}` : a.audienceLabel}
                      </span>
                      {a.priority !== 'NORMAL' && (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted-foreground">
                          <span className={cn('h-1.5 w-1.5 rounded-full', priority.dot)} aria-hidden="true" />
                          {priority.label}
                        </span>
                      )}
                    </span>
                    {!expanded && (
                      <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                        {a.message}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                    <span className="whitespace-nowrap text-[10px] text-muted-foreground tabular-nums">
                      {announcementDate(a.createdAt)}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-muted-foreground transition-transform',
                        expanded && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                {expanded && (
                  <div className="px-4 pb-3.5 pl-[1.9rem]">
                    <p className="whitespace-pre-line text-xs leading-relaxed text-foreground/90">
                      {a.message}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">By {a.senderName}</p>
                      {!read && <MarkReadButton id={a.id} onMarkRead={onMarkRead} />}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </GlassCard>
  )
}

function MarkReadButton({
  id,
  onMarkRead,
}: {
  id: string
  onMarkRead: (id: string) => Promise<void>
}) {
  const [marking, setMarking] = useState(false)
  return (
    <button
      onClick={() => {
        setMarking(true)
        onMarkRead(id).finally(() => setMarking(false))
      }}
      disabled={marking}
      className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-60"
    >
      {marking ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : (
        <Check className="h-3 w-3" aria-hidden="true" />
      )}
      Mark as read
    </button>
  )
}
