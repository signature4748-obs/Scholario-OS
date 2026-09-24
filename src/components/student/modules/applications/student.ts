'use client'

/**
 * Student-side helpers for the Applications & Forms module.
 *
 * IDENTITY MODEL (canonical — stabilization §8):
 *   The authenticated student is resolved SERVER-side (/api/auth/me →
 *   me.student: the DB Student row). The retired client-side demo roster
 *   key (STU-58 · Class 2-A · DSO2024058) is no longer used for identity,
 *   submissions, payments or eligibility — every read is scoped to the
 *   session's own student record.
 */

import { useMemo } from 'react'
import type { StudentRecord } from '@/lib/store/students-store'
import {
  useApplicationsStore,
  type ApplicationAuditEvent,
  type CombinedSubmissionStatus,
  type StudentSubmissionIdentity,
} from '@/lib/store/applications-store'
import { useCurrentUser } from '@/lib/store/current-user-store'
import { useCanonicalStudent } from '../shared/canonical'

/** Canonical identity for the logged-in student. */
export interface StudentIdentityPair {
  /** Canonical record — display, submissions, payments and eligibility. */
  canonical: StudentRecord
}

/**
 * Reactive hook resolving the canonical identity from the server session
 * (me.student mapped into the StudentRecord shape the applications module
 * consumes). Null while unresolved or when the account has no student
 * record — callers render their honest unavailable state.
 */
export function useDemoStudent(): StudentIdentityPair | null {
  const { student, resolving } = useCanonicalStudent()
  const name = useCurrentUser((s) => s.me?.name)
  return useMemo(() => {
    if (resolving || !student) return null
    // Session-scoped canonical record. Only identity-bearing fields are
    // populated; roster-only extras (fees/attendance/academics snapshots)
    // are not fabricated here.
    const canonical: StudentRecord = {
      id: student.studentId,
      name: name ?? 'Student',
      avatar: (name ?? 'S').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
      admissionNo: student.admissionNo ?? '—',
      rollNo: student.rollNo ?? '—',
      classId: student.classId ?? '—',
      className: student.className ?? '—',
      section: student.section ?? '—',
      dob: student.dob ?? '',
      gender: student.gender ? student.gender.charAt(0) + student.gender.slice(1).toLowerCase() : '',
      bloodGroup: student.bloodGroup ?? '',
      guardianName: student.guardianName ?? '',
      guardianPhone: student.guardianPhone ?? '',
      address: student.address ?? '',
      status: 'Active',
    } as unknown as StudentRecord
    return { canonical }
  }, [student, resolving, name])
}

/**
 * Snapshot bundle the store expects on every submission. Carries the school
 * record particulars the official tour application prints — there is
 * deliberately NO house field (Scholario does not use a house system).
 */
export function buildSubmissionIdentity(canonical: StudentRecord): StudentSubmissionIdentity {
  return {
    id: canonical.id,
    name: canonical.name,
    admissionNo: canonical.admissionNo,
    className: canonical.className,
    classId: canonical.classId,
    section: canonical.section,
    rollNo: canonical.rollNo,
    dob: canonical.dob,
    gender: canonical.gender,
    bloodGroup: canonical.bloodGroup,
    address: canonical.address,
    guardianName: canonical.guardianName,
    guardianPhone: canonical.guardianPhone,
  }
}

/**
 * Append an audit event to the applications store.
 *
 * NOTE: the store contract documents an `addAuditEvent` action, but the
 * current applications-store build does not export one. This helper writes
 * the exact same `ApplicationAuditEvent` shape through the store's public
 * `setState` — same prepend order as the store's internal `pushAudit` —
 * without touching the store file. If the action lands upstream, swap the
 * body to `useApplicationsStore.getState().addAuditEvent(ev)`.
 */
export function addAuditEvent(ev: Omit<ApplicationAuditEvent, 'id'>): void {
  useApplicationsStore.setState((state) => ({
    audit: [
      {
        ...ev,
        id: `AEV-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      },
      ...state.audit,
    ],
  }))
}

/** Whole days until a yyyy-mm-dd deadline (negative once passed). */
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const target = new Date(`${dateStr}T23:59:59`)
  if (Number.isNaN(target.getTime())) return Number.NaN
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
}

/** Quiet chip tint per combined submission status. */
export function submissionStatusChipClass(status: CombinedSubmissionStatus): string {
  switch (status) {
    case 'Approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
    case 'Paid · Under Review':
    case 'Under Review':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400'
    case 'Awaiting Payment':
    case 'Awaiting Verification':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400'
    case 'Correction Required':
    case 'Rejected':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400'
    case 'Physical Doc Pending':
    case 'Physical Doc Verification':
      return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-400'
    case 'Withdrawn':
      return 'border-border bg-muted/50 text-muted-foreground'
    default:
      return 'border-border bg-muted/40 text-foreground'
  }
}
