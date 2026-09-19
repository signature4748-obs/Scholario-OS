'use client'

/**
 * FeeReminderBanner — Round-7: the outreach loop's student-side landing.
 *
 * Until now a principal's fee reminder reached the student only as a
 * Messages inbox row + a bell/toast. This banner surfaces it at the very
 * top of the student dashboard — with the REAL outstanding balance, the
 * nearest due date, an excerpt of the principal's actual words, and both
 * follow-through actions (read the full message · go pay).
 *
 * All values are server-truth from /api/student/dashboard (feesSection now
 * joins the latest "Fee Reminder" Message row). Renders ONLY while dues
 * exist; dismissable for the session (a gentle nudge, not a wall).
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, MessageSquare, IndianRupee, X } from 'lucide-react'
import { formatINR } from '@/lib/format'
import { dueLabel } from './data'
import type { DashboardData } from './types'

/** "just now" / "4m ago" / "3h ago" / "2d ago" — compact relative stamp. */
function sinceLabel(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function FeeReminderBanner({ data, onNavigate }: {
  data: DashboardData
  onNavigate: (key: string) => void
}) {
  const [dismissed, setDismissed] = useState(false)
  const { outstanding, nearestDue, reminder } = data.fees

  if (dismissed || outstanding <= 0) return null

  const due = nearestDue ? dueLabel(nearestDue) : ''
  const overdue = nearestDue ? new Date(nearestDue).getTime() < Date.now() : false
  const fresh = reminder ? Date.now() - new Date(reminder.createdAt).getTime() < 48 * 3_600_000 : false

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Fee reminder"
      className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.08] via-rose-500/[0.05] to-transparent p-4 sm:p-4.5"
    >
      {/* Accent stripe + watermark icon */}
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-500 to-rose-500" aria-hidden />
      <Mail className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 rotate-12 text-amber-500/[0.06]" aria-hidden />

      <div className="flex items-start gap-3.5">
        {/* Icon chip */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Mail className="h-5 w-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-bold text-foreground">
              {reminder ? `Fee reminder from ${reminder.senderName}` : 'School fees pending'}
            </p>
            {fresh && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" aria-hidden />
                new
              </span>
            )}
            {reminder && (
              <span className="text-[10px] text-muted-foreground">{sinceLabel(reminder.createdAt)}</span>
            )}
          </div>

          {/* The principal's actual words (or the honest fallback) */}
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {reminder?.excerpt || 'Your fee account has a pending balance. Please arrange the payment to avoid late fees.'}
          </p>

          {/* Amount + due line */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              <IndianRupee className="h-3 w-3" aria-hidden />
              {formatINR(outstanding)} outstanding
            </span>
            {due && (
              <span className={`text-[11px] font-semibold ${overdue ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {overdue ? '⚠ ' : ''}{due}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {reminder && (
              <button
                type="button"
                onClick={() => onNavigate('messages')}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-amber-300"
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                View message
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('fees')}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-bold text-primary-foreground transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <IndianRupee className="h-3.5 w-3.5" aria-hidden />
              Pay fees
            </button>
          </div>
        </div>

        {/* Session dismiss */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss fee reminder banner"
          className="shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </motion.section>
  )
}
