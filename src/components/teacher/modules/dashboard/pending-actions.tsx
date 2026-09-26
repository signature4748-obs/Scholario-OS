'use client'

/**
 * PendingActions — real, server-derived action queue for the Teacher
 * Dashboard.
 *
 * Sources (existing Teacher Hub APIs, teacher-session scoped):
 *   • GET /api/teacher/parent-connect  → stats.unread + follow-ups
 *   • GET /api/teacher/growth          → summary.needsAttention
 * (Navigation targets the Communication Hub — Parent Connect was absorbed
 * into it as the parent-thread channel.)
 * Every number rendered here traces to a real row — the widget renders an
 * honest empty state when nothing needs attention.
 */

import { useEffect, useState } from 'react'
import {
  AlarmClock, ArrowRight, CalendarCheck, MessageSquareHeart, Shield, Inbox,
} from 'lucide-react'
import { GlassCard, GradientAvatar } from '@/components/shared/ui'
import { useFocusStore } from '@/lib/store/focus-store'
import { cn } from '@/lib/utils'
import type {
  FollowUpItem,
  GrowthWorkspacePayload,
  ParentConnectPayload,
} from '@/lib/teacher-hub-types'
import type { AttendanceSnapshot } from './types'

interface PendingActionsProps {
  onNavigate: (key: string) => void
  /** true only for appointed class teachers (drives the hub card) */
  isClassTeacher?: boolean
  /** Today's class-attendance baselines (dashboard aggregate) — unmarked
   *  ones are pending actions exactly like follow-ups. */
  attendance?: AttendanceSnapshot[]
}

interface FollowUpRow extends FollowUpItem {
  moduleKey: 'communication'
}

function dueLabel(due: string): { text: string; tone: 'overdue' | 'today' | 'later' } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // `due` may be a plain "YYYY-MM-DD" day key OR a full ISO timestamp —
  // parse it as-is when it already carries a time part.
  const d = new Date(due.includes('T') ? due : `${due}T00:00:00`)
  if (Number.isNaN(d.getTime())) return { text: 'Scheduled', tone: 'later' }
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, tone: 'overdue' }
  if (days === 0) return { text: 'Due today', tone: 'today' }
  if (days === 1) return { text: 'Due tomorrow', tone: 'later' }
  return { text: `Due in ${days}d`, tone: 'later' }
}

export function PendingActions({ onNavigate, isClassTeacher = false, attendance = [] }: PendingActionsProps) {
  const [state, setState] = useState<
    | { phase: 'loading' }
    | { phase: 'error' }
    | {
        phase: 'ready'
        unread: number
        needsAttention: number
        followUps: FollowUpRow[]
      }
  >({ phase: 'loading' })
  // Tick-driven loads: the "Try again" action re-runs the effect (a bare
  // setState could never re-fire the old mount-only fetch).
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // Both sources fail independently; a TOTAL failure must surface the
      // error card — never an "all caught up" lie built from two nulls.
      const [pc, growth] = await Promise.allSettled([
        fetch('/api/teacher/parent-connect', { cache: 'no-store', credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('pc')))),
        fetch('/api/teacher/growth', { cache: 'no-store', credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('growth')))),
      ])
      if (cancelled) return
      const pcData = pc.status === 'fulfilled' ? (pc.value.data as ParentConnectPayload) : null
      const growthData = growth.status === 'fulfilled' ? (growth.value.data as GrowthWorkspacePayload) : null
      if (!pcData && !growthData) {
        setState({ phase: 'error' })
        return
      }

      const rows: FollowUpRow[] = []
      pcData?.followUps
        ?.filter((f) => f.status === 'open')
        .forEach((f) => rows.push({ ...f, moduleKey: 'communication' }))
      rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate))

      setState({
        phase: 'ready',
        unread: pcData?.stats?.unread ?? 0,
        needsAttention: growthData?.summary?.needsAttention ?? 0,
        followUps: rows.slice(0, 4),
      })
    }
    load()
    return () => { cancelled = true }
  }, [tick])

  // Unmarked attendance baselines (server truth from the dashboard
  // aggregate) — same queue, same honesty: they count as pending work.
  const unmarked = attendance.filter((s) => !s.marked)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      <GlassCard className="p-3 sm:p-4 lg:p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <AlarmClock className="h-4 w-4 text-amber-500" /> Pending Actions
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Follow-ups & messages awaiting your attention</p>
          </div>
        </div>

        {state.phase === 'loading' && (
          <div className="space-y-2.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {state.phase === 'error' && (
          <div className="py-8 text-center">
            <Inbox className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Pending actions could not load.</p>
            <button
              onClick={() => { setState({ phase: 'loading' }); setTick((t) => t + 1) }}
              className="mt-2 text-xs text-primary font-medium hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {state.phase === 'ready' && state.followUps.length === 0 && state.unread === 0 && state.needsAttention === 0 && unmarked.length === 0 && (
          <div className="py-8 text-center">
            <Inbox className="h-8 w-8 mx-auto text-emerald-500/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">No follow-ups or unread messages right now.</p>
          </div>
        )}

        {state.phase === 'ready' && (
          <div className="space-y-2.5">
            {unmarked.map((s) => (
              <button
                key={s.classId}
                onClick={() => {
                  // Same deep-link the attendance prompt uses — the exact
                  // class lands focused in the Class Attendance module.
                  useFocusStore.getState().setFocus({
                    type: 'class',
                    id: s.classId,
                    title: s.classLabel,
                    moduleKey: 'attendance',
                  })
                  onNavigate('attendance')
                }}
                className="w-full flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-left hover:bg-amber-500/10 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <CalendarCheck className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{s.classLabel} attendance not marked</p>
                  <p className="text-xs text-muted-foreground">Class Attendance · today&rsquo;s baseline is still open</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}

            {state.unread > 0 && (
              <button
                onClick={() => onNavigate('communication')}
                className="w-full flex items-center gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-left hover:bg-sky-500/10 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                  <MessageSquareHeart className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{state.unread} unread parent message{state.unread === 1 ? '' : 's'}</p>
                  <p className="text-xs text-muted-foreground">Communication Hub · reply from your conversations</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            )}

            {state.needsAttention > 0 && (
              <button
                onClick={() => onNavigate('growth')}
                className="w-full flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-left hover:bg-rose-500/10 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                  <Shield className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{state.needsAttention} student{state.needsAttention === 1 ? '' : 's'} needing attention</p>
                  <p className="text-xs text-muted-foreground">Student Growth · review recent points</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            )}

            {state.followUps.map((f) => {
              const due = dueLabel(f.dueDate)
              return (
                <button
                  key={f.id}
                  onClick={() => onNavigate(f.moduleKey)}
                  className="w-full flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3 text-left hover:bg-accent/40 transition-colors"
                >
                  <GradientAvatar name={f.student?.name ?? 'Follow-up'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{f.student?.name ?? 'Follow-up'}</p>
                    <p className="text-xs text-muted-foreground truncate">{f.reason}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      due.tone === 'overdue' && 'bg-rose-500/10 text-rose-600',
                      due.tone === 'today' && 'bg-amber-500/10 text-amber-600',
                      due.tone === 'later' && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {due.text}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </GlassCard>

      <div className="space-y-4">
        {isClassTeacher && <TeacherHubCard onNavigate={onNavigate} />}
      </div>
    </div>
  )
}

/** Quiet secondary card — the appointed class teacher's entry point into
 *  their Class Teacher Hub (My Class). Rendered ONLY for teachers with a
 *  real appointment — a subject teacher never sees hub affordances. */
function TeacherHubCard({ onNavigate }: { onNavigate: (key: string) => void }) {
  return (
    <GlassCard className="p-3 sm:p-4 lg:p-5">
      <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
        <Shield className="h-4 w-4 text-emerald-500" /> Class Teacher Hub
      </h3>
      <p className="text-xs text-muted-foreground mb-3">Your class, end to end — attendance, fees, results & growth</p>
      <button
        onClick={() => onNavigate('class-hub')}
        className="w-full rounded-xl border border-border bg-card/40 p-3 text-left hover:bg-accent/40 transition-colors"
      >
        <p className="text-[11px] text-muted-foreground">
          Open My Class overview
        </p>
      </button>
    </GlassCard>
  )
}
