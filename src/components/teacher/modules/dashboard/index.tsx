'use client'

/**
 * TeacherDashboard v2 — the Teacher Command Center, built on the ONE
 * server aggregate (GET /api/teacher/dashboard; the pending queue now
 * renders from the same payload — no second/third fetch on mount).
 *
 * Information hierarchy (the seven questions, top to bottom):
 *   1. Who am I + what's next       → WelcomeBanner with the NextUp rail
 *   2. Today at a glance            → TeacherKpiCards (honest numbers)
 *   3. Is attendance complete?      → AttendanceCard (class-teacher only)
 *   4. What do I teach today?       → TodayClasses (schedule · lessons)
 *   5. What needs my attention?     → PendingActions (real queue)
 *   6. What can I do?               → QuickActions (role + day aware)
 *   7. What's new at school?        → NoticeBoard
 *   8. My class, end to end         → ClassTeacherHubCard (CT only)
 *
 * Mobile stacks in exactly that priority order (DOM order); desktop lays
 * the same sections into a calm 3-column rhythm. Loading → layout-matched
 * skeletons. Error → full retry card. Reload → stale data KEPT with a
 * quiet inline strip.
 */

import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useTeacherDashboard, useNow } from './hooks/use-teacher-dashboard'
import { WelcomeBanner } from './welcome-banner'
import { TeacherKpiCards } from './kpi-cards'
import { AttendanceCard } from './attendance-card'
import { TodayClasses } from './today-classes'
import { QuickActions } from './quick-actions'
import { NoticeBoard } from './notice-board'
import { PendingActions, ClassTeacherHubCard } from './pending-actions'

interface DashboardProps {
  onNavigate: (key: string) => void
}

export function TeacherDashboard({ onNavigate }: DashboardProps) {
  const { data, loading, error, staleError, reload } = useTeacherDashboard()
  // ONE shared 30s clock drives the live "Now / ends in" states in the
  // hero rail and the schedule — a single quiet interval, no refetching.
  const now = useNow()

  if (loading) return <DashboardSkeleton />

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold">Dashboard could not load</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {error ?? 'Your school data is temporarily unavailable.'}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={reload} className="h-8 gap-1.5">
          <RotateCw className="h-3.5 w-3.5" aria-hidden /> Try again
        </Button>
      </div>
    )
  }

  const isClassTeacher = data.classTeacherOf.length > 0
  const unmarkedAttendance = data.attendance.filter((s) => !s.marked).length

  return (
    <div className="flex flex-col gap-4 sm:gap-5 lg:grid lg:grid-cols-3">
      {/* A failed refresh never wipes a readable dashboard — quiet strip only */}
      {staleError && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-400 lg:col-span-3"
        >
          <span className="flex min-w-0 items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              Couldn&rsquo;t refresh — showing your last loaded dashboard. {staleError}
            </span>
          </span>
          <button
            type="button"
            onClick={reload}
            className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Try again
          </button>
        </div>
      )}

      {/* 1 · Personal context + the "what's next" focus rail */}
      <div className="lg:col-span-3">
        <WelcomeBanner data={data} now={now} onNavigate={onNavigate} />
      </div>

      {/* 2 · Today at a glance */}
      <div className="lg:col-span-3">
        <TeacherKpiCards data={data} />
      </div>

      {/* 3 · Attendance status (class-teacher classes only; renders
          nothing for a pure subject teacher) */}
      <div className="lg:col-span-3">
        <AttendanceCard attendance={data.attendance} onNavigate={onNavigate} />
      </div>

      {/* 4 · Today's schedule + today's lessons (internal 2 + 1 split) */}
      <div className="lg:col-span-3">
        <TodayClasses data={data} now={now} onNavigate={onNavigate} />
      </div>

      {/* 5 · The real pending queue */}
      <div className="lg:col-span-2">
        <PendingActions data={data} onNavigate={onNavigate} />
      </div>

      {/* 6 · Role-aware shortcuts (attendance-lifted when a baseline is open;
          lesson/marks shortcuts only for teachers with teaching subjects) */}
      <QuickActions
        onNavigate={onNavigate}
        isClassTeacher={isClassTeacher}
        unmarkedAttendance={unmarkedAttendance}
        unreadMessages={data.hub.unreadMessages}
        marksPending={data.hub.marksPending}
        hasAssignments={data.assignments.length > 0}
      />

      {/* 7 · Real school notices (full width when there is no hub card) */}
      <div className={cn(isClassTeacher ? 'lg:col-span-2' : 'lg:col-span-3')}>
        <NoticeBoard notices={data.notices} onNavigate={onNavigate} />
      </div>

      {/* 8 · Class Teacher Hub — appointed class teachers only */}
      {isClassTeacher && (
        <ClassTeacherHubCard classes={data.classTeacherOf} onNavigate={onNavigate} />
      )}
    </div>
  )
}

/** Layout-matched skeletons — the final composition, quietly loading. */
function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-[168px] rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Skeleton className="h-[104px] rounded-xl" />
        <Skeleton className="h-[104px] rounded-xl" />
        <Skeleton className="h-[104px] rounded-xl" />
        <Skeleton className="h-[104px] rounded-xl" />
      </div>
      <Skeleton className="h-[76px] rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <Skeleton className="h-[420px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <Skeleton className="h-[320px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <Skeleton className="h-[280px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    </div>
  )
}
