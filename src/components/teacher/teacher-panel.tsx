'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { AppShell } from '@/components/shell/app-shell'
import { ModuleLoading } from '@/components/shared/module-loading'
import { useTeachersStore } from '@/lib/store/teachers-store'
import { useTeacherHubStore } from '@/lib/store/teacher-hub-store'
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
const MySalaryModule = dynamic(
  () => import('./modules/my-salary').then((m) => m.MySalaryModule),
  { loading: ModuleLoading }
)

/** Module keys the ModuleRouter knows — validates ?module= deep-links. */
const TEACHER_MODULE_KEYS = [
  'dashboard', 'payroll', 'my-attendance', 'my-timetable', 'attendance',
  'lesson-planner', 'marks', 'students', 'app-reviews', 'behavior',
  'class-hub', 'analytics', 'settings', 'communication', 'profile',
  'fee-management',
] as const

export function TeacherPanel() {
  const { teachers, confirmPayrollRevision } = useTeachersStore()
  // Live server-derived Teacher Hub counts (published by the Communication Hub
  // module after each load) — drives the sidebar badge. One store, one truth.
  const hubUnread = useTeacherHubStore((s) => s.parentUnread)

  // Default to Rohan Mehta (EMP-014) for Teacher View preview or active teacher
  const currentTeacher = teachers.find((t) => t.id === 'T-014') || teachers[0]
  const isRelieved = (currentTeacher?.status as string) === 'Relieved' || currentTeacher?.status === 'Suspended' || (currentTeacher?.status as string) === 'Terminated'
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
  const pendingAssignments = getPendingAssignments(currentTeacher, isRelieved)

  const navGroups = buildTeacherNavGroups({ isRelieved, classTeacherOf, hubUnread })

  const {
    dialogs,
    handleAcceptAssignment,
    handleOpenDecline,
    handleConfirmDecline,
    handleOpenClarification,
    handleConfirmClarification,
  } = useTeacherHandlers(currentTeacher)

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

      {/* My Salary & Payments (employee side of the payment trust model) */}
      {active === 'payroll' && currentTeacher && (
        <MySalaryModule employeeId={currentTeacher.id} />
      )}

      {/* Relieved staff views (profile / fee-management) */}
      {currentTeacher && (active === 'profile' || active === 'fee-management') && (
        <RelievedViews active={active} currentTeacher={currentTeacher} isRelieved={isRelieved} />
      )}

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
