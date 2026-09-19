'use client'

/**
 * FeesDefaultersSection — the Principal's fee-defaulter OUTREACH workspace.
 *
 * Server-truth (same pattern as the round-3 student timetable): the list is
 * fetched from GET /api/fees/defaulters — the DB's real outstanding balances
 * grouped per student — never the client fee-store seeds.
 *
 * Workflow: filter (status / class / search) → select students → preview the
 * exact message → POST /api/fees/defaulters/remind. Every sent reminder:
 *   · lands in the student's Messages inbox (any role's message panel),
 *   · broadcasts through the live event-stream — open student tabs get the
 *     toast + bell entry within seconds, no reload,
 *   · writes a FEE_REMINDER_SENT audit row (Super Admin activity feed).
 *
 * Honest guard-rails baked in: students reminded in the last 24h are skipped
 * (reported, never silently dropped), and every state (loading / error /
 * empty / filtered-empty) has its own real surface.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, BellRing, CalendarClock, CheckCircle2, ChevronDown,
  IndianRupee, Mail, Phone, RefreshCw, Search, Send, Users, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatINR } from '@/lib/format'
import { useAuth } from '@/lib/store/auth-store'
import { Panel } from '../shared/panel'
import { SummaryCard, SummaryCardGrid } from '../shared/summary-card'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

// ─── payload types (mirror the API) ───────────────────────────────────

interface FeeLine {
  id: string
  title: string
  amount: number
  paid: number
  dueDate: string | null
  status: string
}

interface Defaulter {
  studentId: string
  userId: string
  name: string
  className: string | null
  rollNo: string | null
  guardianName: string | null
  guardianPhone: string | null
  outstanding: number
  feeLines: FeeLine[]
  oldestDueAt: string | null
  daysOverdue: number | null
  lastRemindedAt: string | null
}

interface DefaultersPayload {
  defaulters: Defaulter[]
  summary: {
    totalOutstanding: number
    defaulterCount: number
    overdueCount: number
    remindedThisWeek: number
  }
}

interface RemindResult {
  sent: Array<{ studentId: string; name: string; outstanding: number }>
  skipped: Array<{ studentId: string; name: string; reason: string }>
  totalOutstandingCovered: number
  note?: string
}

// ─── small helpers ────────────────────────────────────────────────────

/** "just now" / "4m ago" / "3h ago" / "2d ago" — honest, coarse, stable. */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatDay(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Days until the earliest due date (negative = already past). */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

/** The reminder message exactly as the remind endpoint composes it —
 * rendered in the preview dialog so the Principal sees the real text.
 * The real sender + school names come from /api/auth/me (same values the
 * endpoint itself uses); the fallback only shows while that loads. */
function previewMessage(d: Defaulter, schoolName: string, senderName: string): { subject: string; body: string } {
  const lineText = d.feeLines
    .map((l) => `• ${l.title} — ${formatINR(l.amount - l.paid)}${l.dueDate ? ` (due ${formatDay(l.dueDate)})` : ''}`)
    .join('\n')
  return {
    subject: `Fee Reminder — ${formatINR(d.outstanding)} outstanding`,
    body: [
      `Dear ${d.name}${d.className ? ` (${d.className})` : ''},`,
      '',
      `This is a gentle reminder from ${schoolName} that your fee account has an outstanding balance of ${formatINR(d.outstanding)}:`,
      '',
      lineText,
      '',
      `Total outstanding: ${formatINR(d.outstanding)}`,
      '',
      'You can complete the payment at the school office or through the Fees section of your portal. If you have already paid, please share the receipt with the office so we can update your account.',
      '',
      `— ${senderName}, Principal, ${schoolName}`,
    ].join('\n'),
  }
}

type StatusFilter = 'all' | 'overdue' | 'upcoming'

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Past due' },
  { value: 'upcoming', label: 'Due soon' },
]

// ─── the section ──────────────────────────────────────────────────────

export function FeesDefaultersSection() {
  const [data, setData] = useState<DefaultersPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [previewOpen, setPreviewOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // The acting principal + school display names for the message preview
  // (the remind endpoint derives the same values server-side).
  const [meNames, setMeNames] = useState<{ senderName: string; schoolName: string } | null>(null)
  const authUser = useAuth((s) => s.user)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
        const json = (await res.json().catch(() => null)) as
                   | { ok?: unknown; data?: { user?: { name?: string; school?: { name?: string } } } } | null
        if (!alive) return
        if (json?.ok && json.data?.user) {
          setMeNames({
            senderName: json.data.user.name ?? 'The Principal',
            schoolName: json.data.user.school?.name ?? 'the school office',
          })
        }
      } catch {
        // preview falls back to the auth-store name below — non-fatal
      }
    })()
    return () => { alive = false }
  }, [])

  const senderName = meNames?.senderName ?? authUser?.name ?? 'The Principal'
  const schoolName = meNames?.schoolName ?? 'the school office'

  const load = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/fees/defaulters', { cache: 'no-store', credentials: 'same-origin' })
        const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; data?: DefaultersPayload } | null
        if (!alive) return
        if (!res.ok || !json || json.ok !== true) throw new Error(typeof json?.error === 'string' ? json.error : `Request failed (${res.status})`)
        setData(json.data as DefaultersPayload)
        setError(null)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Could not load defaulters')
      }
    })()
    return () => { alive = false }
  }, [reloadKey])

  const defaulters = data?.defaulters ?? []
  const summary = data?.summary

  const classes = useMemo(
    () => [...new Set(defaulters.map((d) => d.className).filter((c): c is string => !!c))].sort(),
    [defaulters],
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return defaulters.filter((d) => {
      if (filter === 'overdue' && d.daysOverdue === null) return false
      if (filter === 'upcoming') {
        const du = daysUntil(d.oldestDueAt)
        if (du === null || du < 0 || du > 14) return false
      }
      if (classFilter !== 'all' && d.className !== classFilter) return false
      if (q && !d.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [defaulters, filter, classFilter, search])

  const selectedRows = useMemo(() => visible.filter((d) => selected.has(d.studentId)), [visible, selected])
  const selectedTotal = selectedRows.reduce((s, d) => s + d.outstanding, 0)

  const toggleRow = (id: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const allVisibleSelected = visible.length > 0 && visible.every((d) => selected.has(d.studentId))
  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev)
    if (allVisibleSelected) visible.forEach((d) => next.delete(d.studentId))
    else visible.forEach((d) => next.add(d.studentId))
    return next
  })

  const toggleExpanded = (id: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const sendReminders = async () => {
    if (selectedRows.length === 0 || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/fees/defaulters/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ studentIds: selectedRows.map((d) => d.studentId) }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: unknown; error?: unknown; data?: RemindResult } | null
      if (!res.ok || !json || json.ok !== true) throw new Error(typeof json?.error === 'string' ? json.error : `Request failed (${res.status})`)
      const r = json.data as RemindResult
      if (r.sent.length > 0) {
        toast.success(`Reminders sent to ${r.sent.length} student${r.sent.length === 1 ? '' : 's'} · ${formatINR(r.totalOutstandingCovered)} outstanding covered`, {
          description: r.skipped.length > 0 ? `${r.skipped.length} skipped (reminded in the last 24h)` : 'Live-delivered to open student tabs · Messages inbox',
        })
      } else {
        toast.info('No reminders sent', { description: r.note ?? 'All selected students were reminded recently.' })
      }
      setPreviewOpen(false)
      setSelected(new Set())
      load()
    } catch (e) {
      toast.error('Could not send reminders', { description: e instanceof Error ? e.message : 'Please try again.' })
    } finally {
      setSending(false)
    }
  }

  const previewSample = selectedRows[0]

  // ─── render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* KPI strip — the four outreach numbers */}
      <SummaryCardGrid columns={4}>
        <SummaryCard
          icon={<IndianRupee className="h-4 w-4" />}
          label="Total Outstanding"
          value={summary ? formatINR(summary.totalOutstanding, true) : '—'}
          sub={summary ? `${summary.defaulterCount} student${summary.defaulterCount === 1 ? '' : 's'} with dues` : 'loading…'}
          tone="rose"
          delay={0}
        />
        <SummaryCard
          icon={<Users className="h-4 w-4" />}
          label="Students With Dues"
          value={summary?.defaulterCount ?? '—'}
          sub={`across ${classes.length || 0} class${classes.length === 1 ? '' : 'es'}`}
          tone="amber"
          delay={0.05}
        />
        <SummaryCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="Past Due Date"
          value={summary?.overdueCount ?? '—'}
          sub="earliest outstanding due date"
          tone="rose"
          delay={0.1}
        />
        <SummaryCard
          icon={<BellRing className="h-4 w-4" />}
          label="Reminded This Week"
          value={summary?.remindedThisWeek ?? '—'}
          sub="students messaged in last 7 days"
          tone="sky"
          delay={0.15}
        />
      </SummaryCardGrid>

      {/* Filters + refresh */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Status filter">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === f.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {classes.length > 1 && (
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label="Filter by class"
            className="h-8 rounded-lg border border-border bg-card px-2 text-[11px] font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All classes</option>
            {classes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student…"
            aria-label="Search student by name"
            className="h-8 w-40 rounded-lg border border-border bg-card pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); searchRef.current?.focus() }}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={load}
          aria-label="Refresh defaulters"
          title="Refresh"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {/* Selection action bar */}
      <AnimatePresence>
        {selectedRows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5"
            role="status"
          >
            <p className="min-w-0 flex-1 text-xs">
              <span className="font-bold text-foreground">{selectedRows.length} selected</span>
              <span className="text-muted-foreground"> · {formatINR(selectedTotal)} outstanding total</span>
            </p>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.98]"
            >
              <Send className="h-3 w-3" aria-hidden />
              Send Reminders ({selectedRows.length})
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The list */}
      <Panel bodyClassName="p-0">
        {/* Loading skeleton */}
        {!data && !error && (
          <div className="space-y-1 p-3" aria-busy="true" aria-label="Loading defaulters">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted/60" />
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted/70" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted/60" />
                <div className="ml-auto h-3 w-16 animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-14 animate-pulse rounded bg-muted/50" />
              </div>
            ))}
          </div>
        )}

        {/* Error — honest, retryable */}
        {error && !data && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-6">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Defaulters unavailable.</span> {error}
            </p>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw className="h-3 w-3" aria-hidden /> Retry
            </button>
          </div>
        )}

        {/* All settled — celebratory empty state */}
        {data && defaulters.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground">All settled — no outstanding dues</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Every student fee account is fully paid. When balances become outstanding, this workspace
              lists them here with one-click reminder outreach.
            </p>
          </div>
        )}

        {/* The table */}
        {data && defaulters.length > 0 && (
          <div>
            {/* header row */}
            <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                aria-label="Select all filtered students"
                className="h-4 w-4 shrink-0 accent-emerald-600"
              />
              <span className="w-5" aria-hidden />
              <span className="min-w-0 flex-1">Student</span>
              <span className="hidden w-28 shrink-0 md:block">Class</span>
              <span className="hidden w-36 shrink-0 lg:block">Guardian</span>
              <span className="w-20 shrink-0 text-right">Outstanding</span>
              <span className="w-24 shrink-0 text-right">Due</span>
              <span className="hidden w-16 shrink-0 text-right sm:block">Reminded</span>
            </div>

            <ul>
              {visible.map((d) => {
                const isSel = selected.has(d.studentId)
                const isExp = expanded.has(d.studentId)
                const du = daysUntil(d.oldestDueAt)
                return (
                  <li key={d.studentId} className={cn('border-b border-border/40 last:border-b-0', isSel && 'bg-emerald-500/5')}>
                    <div className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleRow(d.studentId)}
                        aria-label={`Select ${d.name}`}
                        className="h-4 w-4 shrink-0 accent-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={() => toggleExpanded(d.studentId)}
                        aria-expanded={isExp}
                        aria-label={`${isExp ? 'Collapse' : 'Expand'} fee lines for ${d.name}`}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isExp && 'rotate-180')} aria-hidden />
                      </button>

                      {/* identity */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary"
                            aria-hidden
                          >
                            {initials(d.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">{d.name}</p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {d.feeLines.length} fee line{d.feeLines.length === 1 ? '' : 's'}
                              {d.rollNo ? ` · Roll ${d.rollNo}` : ''}
                              <span className="md:hidden">{d.className ? ` · ${d.className}` : ''}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <span className="hidden w-28 shrink-0 truncate text-xs text-muted-foreground md:block">{d.className ?? '—'}</span>

                      <span className="hidden w-36 shrink-0 lg:block">
                        <p className="truncate text-xs text-foreground">{d.guardianName ?? '—'}</p>
                        {d.guardianPhone && (
                          <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                            <Phone className="h-2.5 w-2.5 shrink-0" aria-hidden /> {d.guardianPhone}
                          </p>
                        )}
                      </span>

                      <span className="w-20 shrink-0 text-right text-xs font-bold tabular-nums text-foreground">
                        {formatINR(d.outstanding, true)}
                      </span>

                      {/* due chip */}
                      <span className="w-24 shrink-0 text-right">
                        {d.daysOverdue !== null ? (
                          <span
                            className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400"
                            title={`Due ${formatDay(d.oldestDueAt)}`}
                          >
                            {d.daysOverdue}d overdue
                          </span>
                        ) : du !== null && du <= 14 ? (
                          <span
                            className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400"
                            title={`Due ${formatDay(d.oldestDueAt)}`}
                          >
                            {du <= 0 ? 'due today' : `in ${du}d`}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground" title={formatDay(d.oldestDueAt)}>
                            {formatDay(d.oldestDueAt)}
                          </span>
                        )}
                      </span>

                      <span
                        className={cn(
                          'hidden w-16 shrink-0 text-right text-[10px] tabular-nums sm:block',
                          d.lastRemindedAt ? 'text-muted-foreground' : 'text-muted-foreground/50',
                        )}
                        suppressHydrationWarning
                      >
                        {d.lastRemindedAt ? relativeTime(d.lastRemindedAt) : 'never'}
                      </span>
                    </div>

                    {/* expandable fee lines */}
                    <AnimatePresence initial={false}>
                      {isExp && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden bg-muted/20"
                        >
                          <ul className="px-4 pb-3 pt-1 sm:pl-14">
                            {d.feeLines.map((l) => (
                              <li key={l.id} className="flex items-center gap-2 border-t border-border/30 py-1.5 first:border-t-0">
                                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{l.title}</span>
                                <span className="text-[10px] text-muted-foreground">due {formatDay(l.dueDate)}</span>
                                <span className="text-[11px] font-semibold tabular-nums text-foreground">
                                  {formatINR(l.amount - l.paid, true)}
                                  {l.paid > 0 && (
                                    <span className="ml-1 font-normal text-muted-foreground">
                                      (of {formatINR(l.amount, true)}, {formatINR(l.paid, true)} paid)
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                )
              })}

              {visible.length === 0 && (
                <li className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <p className="text-xs font-semibold text-muted-foreground">No students match this filter</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">Adjust the status, class or search filter.</p>
                </li>
              )}
            </ul>

            {/* footer count */}
            <div className="border-t border-border bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
              {visible.length} of {defaulters.length} student{defaulters.length === 1 ? '' : 's'} ·
              {' '}outstanding shown: {formatINR(visible.reduce((s, d) => s + d.outstanding, 0), true)} of {formatINR(summary?.totalOutstanding ?? 0, true)}
            </div>
          </div>
        )}
      </Panel>

      {/* Reminder preview dialog */}
      <Dialog open={previewOpen} onOpenChange={(open) => (open ? setPreviewOpen(true) : setPreviewOpen(false))}>
        <DialogContent className="sm:max-w-[calc(100vw-1.5rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Send fee reminders
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedRows.length} student{selectedRows.length === 1 ? '' : 's'} · {formatINR(selectedTotal)} outstanding total.
              {' '}Each student receives a personal message with their exact balance.
            </DialogDescription>
          </DialogHeader>

          {previewSample && (
            <div className="space-y-3">
              {/* rendered preview — the first selected student's message */}
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Message preview — {previewSample.name}
                </p>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-bold text-foreground">{previewMessage(previewSample, schoolName, senderName).subject}</p>
                  <pre className="mt-1.5 max-h-44 overflow-y-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-muted-foreground">
                    {previewMessage(previewSample, schoolName, senderName).body}
                  </pre>
                </div>
              </div>

              {selectedRows.length > 1 && (
                <p className="text-[11px] text-muted-foreground">
                  …and {selectedRows.length - 1} more with their own balances:{' '}
                  {selectedRows.slice(1, 4).map((d) => d.name).join(', ')}
                  {selectedRows.length > 4 ? ` +${selectedRows.length - 4} more` : ''}.
                </p>
              )}

              <p className="flex items-start gap-2 rounded-lg bg-sky-500/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                Delivered live to open student tabs and their Messages inbox. Students already
                reminded in the last 24 hours are skipped automatically.
              </p>
            </div>
          )}

          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              disabled={sending}
              className="rounded-md border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={sendReminders}
              disabled={sending}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.98] disabled:opacity-60"
            >
              <Send className={cn('h-3.5 w-3.5', sending && 'animate-pulse')} aria-hidden />
              {sending ? 'Sending…' : `Send ${selectedRows.length} Reminder${selectedRows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
