'use client'

/**
 * communication/conversation-list — the LEFT pane of the Communication Hub
 * messaging workspace. One unified, newest-first list across the teacher's
 * two real channels:
 *   · parent threads (ParentConversation — the former Parent Connect)
 *   · direct threads (Message rows grouped by counterpart — staff or
 *     students with accounts)
 * Search matches the person, the related student or the message subject;
 * filter chips cover All / Unread / Needs Reply / Parents / Staff /
 * Archived (archived rows are hidden from every other view by default).
 *
 * Each row carries a compact kebab action menu (H) — Open · Mark read /
 * unread · Pin / Unpin · Mark needs reply · Archive — the actions persist
 * through the canonical PATCH endpoints (ParentConversation flags /
 * DirectThreadState rows), never in local state.
 */

import { useState } from 'react'
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CheckCheck,
  MailOpen,
  MessagesSquare,
  MoreVertical,
  Pin,
  PinOff,
  Plus,
  Reply,
  Search,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar } from '@/components/shared/avatar'
import { HubEmptyState } from '@/components/teacher/modules/shared/hub-stat-cards'
import { formatRelativeTime } from '@/lib/format'
import type { ConversationSummary } from '@/lib/teacher-hub-types'
import { cn } from '@/lib/utils'
import { audienceTone, conversationPreview, directPreview, roleLabel } from './shared'
import type { DirectConversationSummary } from './types'

/** Unified selection key: `pc:<conversationId>` or `dm:<counterpartUserId>`. */
export type SelectionKey = string

export const parentKey = (conversationId: string) => `pc:${conversationId}` as SelectionKey
export const directKey = (counterpartId: string) => `dm:${counterpartId}` as SelectionKey

/** Everything the action menu needs for one row — resolved per kind. */
export interface RowActions {
  onTogglePin: (key: SelectionKey, pinned: boolean) => void
  onMarkRead: (key: SelectionKey) => void
  onMarkUnread: (key: SelectionKey) => void
  onSetNeedsReply: (key: SelectionKey, needsReply: boolean) => void
  onToggleArchive: (key: SelectionKey, archived: boolean) => void
}

interface ConversationListProps {
  conversations: ConversationSummary[]
  directConversations: DirectConversationSummary[]
  activeKey: SelectionKey | null
  onSelect: (key: SelectionKey) => void
  onNewMessage: () => void
  /** persisted action handlers (kebab menu) */
  actions: RowActions
}

type ListFilter = 'all' | 'unread' | 'reply' | 'parents' | 'staff' | 'archived'

const LIST_FILTERS: { value: ListFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'reply', label: 'Needs Reply' },
  { value: 'parents', label: 'Parents' },
  { value: 'staff', label: 'Staff' },
  { value: 'archived', label: 'Archived' },
]

export function ConversationList({
  conversations,
  directConversations,
  activeKey,
  onSelect,
  onNewMessage,
  actions,
}: ConversationListProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ListFilter>('all')

  const total = conversations.length + directConversations.length
  const hasArchived =
    conversations.some((c) => c.archived) || directConversations.some((c) => c.archived)

  // The React Compiler memoizes this derivation automatically — a manual
  // useMemo here cannot be preserved (spread + switch in the filter chain).
  const visible = (() => {
    const q = query.trim().toLowerCase()
    const parentRows = conversations.map((c) => {
      const derivedReply = c.lastMessage != null && !c.lastMessage.fromTeacher
      return {
        kind: 'parent' as const,
        key: parentKey(c.id),
        name: c.parent.name,
        secondary: `Parent of ${c.student.name} · ${c.student.classLabel}`,
        chipTone: '',
        preview: conversationPreview(c),
        time: c.lastMessageAt,
        unread: c.unread,
        pinned: c.pinned,
        archived: c.archived,
        needsReply: derivedReply || c.needsReply,
        followUp: c.openFollowUp != null,
        searchHit:
          !q ||
          c.parent.name.toLowerCase().includes(q) ||
          c.student.name.toLowerCase().includes(q) ||
          (c.lastMessage?.body ?? '').toLowerCase().includes(q),
      }
    })
    const directRows = directConversations.map((c) => ({
      kind: 'direct' as const,
      key: directKey(c.counterpartId),
      name: c.counterpartName,
      secondary: `${roleLabel(c.counterpartRole)}${c.lastMessage?.subject ? ` · ${c.lastMessage.subject}` : ''}`,
      chipTone: audienceTone(c.counterpartRole),
      preview: directPreview(c),
      time: c.lastMessageAt,
      unread: c.unread,
      pinned: c.pinned,
      archived: c.archived,
      needsReply: c.awaitingReply || c.needsReply,
      followUp: false,
      searchHit:
        !q ||
        c.counterpartName.toLowerCase().includes(q) ||
        (c.lastMessage?.subject ?? '').toLowerCase().includes(q) ||
        (c.lastMessage?.body ?? '').toLowerCase().includes(q),
    }))
    return [...parentRows, ...directRows]
      .filter((r) => r.searchHit)
      .filter((r) => {
        switch (filter) {
          case 'archived':
            return r.archived
          case 'unread':
            return r.unread > 0 && !r.archived
          case 'reply':
            return r.needsReply && !r.archived
          case 'parents':
            return r.kind === 'parent' && !r.archived
          case 'staff':
            return r.kind === 'direct' && !r.archived
          default:
            return !r.archived
        }
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        const at = a.time ? Date.parse(a.time) : 0
        const bt = b.time ? Date.parse(b.time) : 0
        return bt - at
      })
  })()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2.5 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations by name, student or subject"
            className="w-full rounded-lg border border-border bg-card/50 py-1.5 pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter conversations">
          {LIST_FILTERS.filter((f) => f.value !== 'archived' || hasArchived).map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                filter === f.value
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
        aria-label="Conversations"
      >
        {total === 0 ? (
          <HubEmptyState
            icon={MessagesSquare}
            title="No conversations yet"
            hint="Messages with parents, students and colleagues will appear here."
            action={
              <button
                onClick={onNewMessage}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New Message
              </button>
            }
          />
        ) : visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-muted-foreground">
            {filter === 'archived'
              ? 'No archived conversations.'
              : 'No conversations match your search or filter.'}
          </p>
        ) : (
          visible.map((r) => (
            <ConversationRow
              key={r.key}
              r={r}
              active={r.key === activeKey}
              onSelect={onSelect}
              actions={actions}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface RowShape {
  kind: 'parent' | 'direct'
  key: SelectionKey
  name: string
  secondary: string
  /** chip tone for direct rows (audience/role color) — '' on parent rows */
  chipTone: string
  preview: string
  time: string | null
  unread: number
  pinned: boolean
  archived: boolean
  needsReply: boolean
  followUp: boolean
}

function ConversationRow({
  r,
  active,
  onSelect,
  actions,
}: {
  r: RowShape
  active: boolean
  onSelect: (key: SelectionKey) => void
  actions: RowActions
}) {
  return (
    <div
      className={cn(
        'group relative flex w-full items-start gap-2.5 border-b border-l-2 border-b-border/60 px-3 py-2.5 text-left transition-colors',
        active
          ? 'border-l-primary bg-muted/50'
          : 'border-l-transparent hover:bg-muted/40',
        r.pinned && !active && 'bg-primary/[0.035]',
      )}
    >
      <button
        onClick={() => onSelect(r.key)}
        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        aria-label={`Open conversation with ${r.name}`}
      >
        <Avatar name={r.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {r.pinned && <Pin className="h-3 w-3 shrink-0 text-primary/70" aria-label="Pinned" />}
            {r.name}
          </p>
          {r.kind === 'direct' ? (
            <span
              className={cn(
                'mt-0.5 inline-block max-w-full truncate rounded-full border px-1.5 py-px text-[10px] font-medium',
                r.chipTone || 'border-border bg-muted text-muted-foreground',
              )}
            >
              {r.secondary}
            </span>
          ) : (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.secondary}</p>
          )}
          <p className="mt-1 truncate text-xs text-muted-foreground/90">{r.preview}</p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          {r.time && (
            <span className="text-[10px] text-muted-foreground">{formatRelativeTime(r.time)}</span>
          )}
          {r.unread > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
              {r.unread}
            </span>
          )}
          {r.needsReply && (
            <Reply className="h-3 w-3 text-amber-500" aria-label="Needs reply" />
          )}
          {r.followUp && (
            <AlertCircle className="h-3 w-3 text-amber-500" aria-label="Needs follow-up" />
          )}
        </span>
      </button>

      {/* kebab action menu — persisted through the canonical PATCH routes */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Conversation actions for ${r.name}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-muted/60 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onSelect(r.key)}>
            <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Open
          </DropdownMenuItem>
          {r.unread > 0 ? (
            <DropdownMenuItem onClick={() => actions.onMarkRead(r.key)}>
              <MailOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Mark as read
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => actions.onMarkUnread(r.key)}>
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark as unread
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => actions.onTogglePin(r.key, !r.pinned)}>
            {r.pinned ? (
              <>
                <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                Pin conversation
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.onSetNeedsReply(r.key, !r.needsReply)}>
            <Reply className="h-3.5 w-3.5" aria-hidden="true" />
            {r.needsReply ? 'Clear needs reply' : 'Mark needs reply'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => actions.onToggleArchive(r.key, !r.archived)}>
            {r.archived ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                Unarchive
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                Archive
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
