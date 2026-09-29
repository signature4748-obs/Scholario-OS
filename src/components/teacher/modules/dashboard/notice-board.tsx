'use client'

/**
 * NoticeBoard (v2) — REAL Notification rows from the dashboard aggregate
 * (audience-scoped, latest three, with per-user read state). Each notice
 * shows its priority tone, title, a one-line preview, the author, the
 * audience tag and a relative date; unread notices carry a small emerald
 * dot. "View all" opens the Communication Hub — the canonical surface
 * (acknowledging a notice there persists through the same
 * NotificationRead rows this card reads).
 */

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Megaphone, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/shared/ui'
import { relativeTime } from './hooks/use-teacher-dashboard'
import type { TeacherNotice } from './types'

interface NoticeBoardProps {
  notices: TeacherNotice[]
  onNavigate: (key: string) => void
}

/** Quiet priority language (matches the Communication Hub's announcements). */
function priorityOf(p: string): { label: string; chip: string } {
  if (p === 'URGENT') return { label: 'Urgent', chip: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400' }
  if (p === 'HIGH') return { label: 'Important', chip: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' }
  return { label: '', chip: '' }
}

export function NoticeBoard({ notices, onNavigate }: NoticeBoardProps) {
  const reduce = useReducedMotion()
  const unread = notices.filter((n) => !n.readAt).length

  return (
    <GlassCard className="flex flex-col p-3.5 sm:p-4 lg:p-5">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="font-display text-sm font-bold tracking-tight">Notice Board</h3>
          {unread > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
              {unread} new
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onNavigate('communication')}
          className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          View all <ArrowRight className="h-3 w-3" aria-hidden />
        </button>
      </div>

      {notices.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60">
            <Megaphone className="h-5 w-5 text-muted-foreground/60" aria-hidden />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No new school announcements</p>
          <p className="mt-0.5 max-w-[240px] text-xs text-muted-foreground/70">
            Notices for you and your classes will appear here.
          </p>
        </div>
      ) : (
        <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
          {notices.map((n, i) => {
            const p = priorityOf(n.priority)
            const isUnread = !n.readAt
            return (
              <motion.button
                key={n.id}
                type="button"
                initial={reduce ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.2), duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => onNavigate('communication')}
                className={cn(
                  'flex w-full gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isUnread
                    ? 'border-emerald-500/25 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]'
                    : 'border-border bg-card/40 hover:bg-accent/40',
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    p.chip
                      ? p.chip
                      : 'bg-muted/60 text-muted-foreground',
                  )}
                  aria-hidden
                >
                  <Megaphone className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {isUnread && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="Unread" />
                    )}
                    <p className="truncate text-sm font-semibold">{n.title}</p>
                    {p.label && (
                      <span className={cn('shrink-0 rounded-full border px-2 py-px text-[9px] font-bold uppercase tracking-wider', p.chip)}>
                        {p.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/70">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-2.5 w-2.5" aria-hidden /> {n.sender}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="rounded bg-muted/70 px-1.5 py-px font-medium text-muted-foreground">
                      {n.audienceLabel}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{relativeTime(n.createdAt)}</span>
                  </p>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}
    </GlassCard>
  )
}
