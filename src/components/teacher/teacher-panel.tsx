'use client'

import { useState } from 'react'
import { AppShell } from '@/components/shell/app-shell'
import { lazyModule } from '@/components/shared/lazy-module'
import { useTeachersStore } from '@/lib/store/teachers-store'
import { useTeacherHubStore } from '@/lib/store/teacher-hub-store'
import { useCurrentUser } from '@/lib/store/current-user-store'
import { useTeacherRole } from './teacher-panel/use-teacher-role'
import {
  buildTeacherNavGroups,
  getPendingAssignments,
} from './teacher-panel/nav-registry'
import { AccountLockedBanner } from './teacher-panel/banners/account-locked-banner'
import { PayrollRevisionBanner } from './teacher-panel/banners/payroll-revision-banner'
import { PendingAssignmentsBanner } from './teacher-panel/banners/pending-assignments-banner'
import { SalaryConfirmationsBanner } from './teacher-panel/banners/salary-confirmations-banner'
import { RelievedViews } from './teacher-panel/relieved-views'
import { ModuleRouter } from './teacher-panel/module-router'
import {
  DeclineDialog,
  ClarifyDialog,
} from './teacher-panel/dialogs/position-dialogs'
import { useTeacherHandlers } from './teacher-panel/use-teacher-handlers'

// Lazily-loaded chunk — compiles only when the payroll tab is opened.
// Chunk-resilient: import retry + per-module error boundary (§22).
const MySalaryModule = lazyModule(
  () => import('./modules/my-salary'),
  'MySalaryModule',
)

/** Honest empty state for store-driven staff surfaces when the signed-in
 *  teacher has no published staffing record (no fabricated profile). */
function QuietNoRecord({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

/** Module keys the ModuleRouter knows — validates ?module= deep-links. */
const TEACHER_MODULE_KEYS = [
  'dashboard', 'payroll', 'my-attendance', 'my-timetable', 'attendance',
  'lesson-planner', 'marks', 'students', 'app-reviews', 'growth',
  'class-hub', 'fee-collection', 'analytics', 'settings', 'communication', 'profile',
  'fee-management',
] as const

export function TeacherPanel() {
  const { teachers, confirmPayrollRevision } = useTeachersStore()
  // Live server-derived Teacher Hub counts (published by the Communication Hub
  // module after each load) — drives the sidebar badge. One store, one truth.
  const hubUnread = useTeacherHubStore((s) => s.parentUnread)

  // The signed-in teacher's OWN record in the staffing store — matched by
  // the SERVER session email (never a hardcoded demo row: every store-
  // driven banner below belongs to this teacher alone; an unmatched
  // session shows none of them instead of another teacher's data).
  const me = useCurrentUser((st) => st.me)
  const currentTeacher = me?.email
    ? teachers.find((t) => (t.email ?? '').toLowerCase() === me.email.toLowerCase()) ?? null
    : null
  const isRelieved = currentTeacher != null && currentTeacher.status === 'Relieved'
  const [active, setActive] = useState(() => {
    const fallback = isRelieved ? 'profile' : 'dashboard'
    if (typeof window === 'undefined') return fallback
    // ?module=<key> deep-link — opens a specific module directly (bookmarks,
    // shared links). Unknown keys fall back to the default landing module.
    const requested = new URLSearchParams(window.location.search).get('module')
    return requested && (TEACHER_MODULE_KEYS as readonly string[]).includes(requested)
      ? requested
      : fallback
  })

  // REAL appointment context (server truth) — gates the Class Teacher Hub.
  const role = useTeacherRole()
  const classTeacherOf = role?.classTeacherOf ?? []

  // Check pending position assignments for approval workflow
  const pendingAssignments = getPendingAssignments(currentTeacher ?? undefined, isRelieved)

  const navGroups = buildTeacherNavGroups({ isRelieved, classTeacherOf, hubUnread })

  const {
    dialogs,
    handleAcceptAssignment,
    handleOpenDecline,
    handleConfirmDecline,
    handleOpenClarification,
    handleConfirmClarification,
  } = useTeacherHandlers(currentTeacher ?? undefined)

  return (
    <AppShell
      groups={navGroups}
      activeKey={active}
      onNavigate={setActive}
      role="teacher"
      roleLabel={`Teacher · ${currentTeacher?.name || 'Faculty Member'}`}
    >
      <AccountLockedBanner show={!!currentTeacher?.isLocked} />

      <PayrollRevisionBanner
        teacherId={currentTeacher?.id || ''}
        pendingPayrollUpdate={currentTeacher?.pendingPayrollUpdate}
        confirmPayrollRevision={confirmPayrollRevision}
      />

      <PendingAssignmentsBanner
        assignments={pendingAssignments}
        onAccept={handleAcceptAssignment}
        onDecline={handleOpenDecline}
        onClarify={handleOpenClarification}
      />

      <SalaryConfirmationsBanner
        employeeId={currentTeacher?.id || ''}
        onReview={() => setActive('payroll')}
      />

      {active === 'payroll' &&
        (currentTeacher ? (
          <MySalaryModule employeeId={currentTeacher.id} />
        ) : (
          <QuietNoRecord label="Your payroll record is not available yet — the office will publish your salary details." />
        ))}

      {/* Relieved staff views (profile / fee-management) */}
      {(active === 'profile' || active === 'fee-management') &&
        (currentTeacher ? (
          <RelievedViews active={active} currentTeacher={currentTeacher} isRelieved={isRelieved} />
        ) : (
          <QuietNoRecord label="Your staff profile has not been published by the office yet." />
        ))}

      {/* Module Content */}
      {active !== 'profile' && active !== 'payroll' && active !== 'fee-management' && (
        <ModuleRouter active={active} onNavigate={setActive} />
      )}

      <DeclineDialog
        open={dialogs.declineDialogOpen}
        onOpenChange={dialogs.setDeclineDialogOpen}
        reason={dialogs.declineReason}
        setReason={dialogs.setDeclineReason}
        onConfirm={handleConfirmDecline}
      />

      <ClarifyDialog
        open={dialogs.clarifyDialogOpen}
        onOpenChange={dialogs.setClarifyDialogOpen}
        query={dialogs.clarifyQuery}
        setQuery={dialogs.setClarifyQuery}
        onConfirm={handleConfirmClarification}
      />
    </AppShell>
  )
}
