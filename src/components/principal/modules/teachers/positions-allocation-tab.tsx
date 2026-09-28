'use client'

/**
 * Positions & Allocation tab (Wave 2.3 §2–§4 + W2.3B + W2.3C + final
 * architecture correction).
 *
 * Visual benchmark: the Teacher Profile page — calm, scannable
 * label/value rows, generous whitespace, no pill walls, no helper
 * paragraphs. The profile is a SUMMARY / SOURCE-OF-TRUTH VIEW:
 * assignments are managed from their actual modules, never duplicated
 * here.
 *
 *   EMPLOYMENT          designation facts                    [Edit]
 *   TEACHING ALLOCATION subjects · classes                   [Manage]
 *   CLASS TEACHER       canonical Class/Section appointment —
 *                       READ-ONLY (assigned in Students & Classes
 *                       → Classes; the profile only reflects it)
 *   RESPONSIBILITIES    ongoing administrative roles, one per row [Manage]
 *   EXAMINATION DUTIES  specific invigilation assignments —
 *                       READ-ONLY (assigned in Examinations)
 *   PERMISSIONS         derived automatically, grouped by source
 *
 * Management is discoverable but quiet: destructive actions live behind
 * each responsibility row's overflow menu, never permanently on the row.
 */

import { useState } from 'react'
import {
  GraduationCap, Briefcase, ShieldCheck, KeyRound, ClipboardCheck,
  Pencil, Settings2, Trash2, MoreHorizontal, Eye, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  type TeacherRecord,
  type PositionAssignment,
  type PositionDefinition,
} from '@/lib/store/teachers-store'
import { getPermissionLabels } from './permission-labels'
import { useClassTeacherRoster, classesOfTeacher } from './use-class-teacher-roster'
import {
  useTeacherExamDuties, sortExamDutiesForDisplay, type TeacherExamDutyStatus,
} from './use-teacher-exam-duties'
import {
  EmploymentEditDialog, RemoveResponsibilityDialog,
} from './profile-edit-dialogs'

/* ---------- small presentation primitives (Profile-page rhythm) ---------- */

function SectionLabel({ icon: Icon, children, action }: { icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{children}</h3>
      </div>
      {action}
    </div>
  )
}

function SectionAction({ icon: Icon, label, onClick, ariaLabel }: {
  icon: React.ElementType; label: string; onClick: () => void; ariaLabel: string
}) {
  return (
    <Button
      variant="ghost" size="sm" onClick={onClick}
      className="text-xs h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground"
      aria-label={ariaLabel}
    >
      <Icon className="h-3 w-3" /> {label}
    </Button>
  )
}

/** Label-above-value row — the Profile page's field rhythm. */
function Field({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">{label}</p>
      <p className={cn('text-sm font-medium mt-0.5 break-words', muted ? 'text-muted-foreground italic font-normal' : 'text-foreground')}>
        {value}
      </p>
    </div>
  )
}

/** Quiet status text — no pill. */
function StatusText({ tone, children }: { tone: 'active' | 'pending'; children: React.ReactNode }) {
  return (
    <span className={cn(
      'text-[10px] font-semibold uppercase tracking-wider shrink-0',
      tone === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
    )}>
      {children}
    </span>
  )
}

/** Quiet duty status text — same rhythm, four statuses. */
function DutyStatusText({ status }: { status: TeacherExamDutyStatus }) {
  const tone =
    status === 'In Progress' ? 'text-emerald-600 dark:text-emerald-400'
    : status === 'Upcoming' ? 'text-amber-600 dark:text-amber-400'
    : 'text-muted-foreground'
  return (
    <span className={cn('text-[10px] font-semibold uppercase tracking-wider shrink-0', tone)}>
      {status}
    </span>
  )
}

/* ---------- the tab ---------- */

export function PositionsAllocationTab({
  teacher,
  positionsList,
  onManageWorkload,
  onManageResponsibilities,
}: {
  teacher: TeacherRecord
  positionsList: PositionDefinition[]
  onManageWorkload: (t: TeacherRecord) => void
  onManageResponsibilities: (t: TeacherRecord) => void
}) {
  const rosterState = useClassTeacherRoster()
  const dutiesState = useTeacherExamDuties(teacher.name)
  const [employmentEditOpen, setEmploymentEditOpen] = useState(false)
  const [removingAssignment, setRemovingAssignment] = useState<PositionAssignment | null>(null)
  const [viewingAssignment, setViewingAssignment] = useState<PositionAssignment | null>(null)

  // Class Teacher assignment — READ-ONLY display from the SERVER roster
  // (canonical source), matched by the teacher's email. It is appointed
  // in Students & Classes → Classes → Class Teacher and this profile
  // only reflects the result — there is deliberately NO manage action
  // here (no duplicate assignment path).
  const serverClasses =
    rosterState.status === 'ready' ? classesOfTeacher(rosterState.roster, teacher.email) : []
  const classTeacherValue =
    rosterState.status === 'loading' ? 'Loading…'
    : rosterState.status === 'error' ? 'Unavailable'
    : serverClasses.length > 0 ? serverClasses.map((c) => c.label).join(', ')
    : null

  // Administrative / co-curricular responsibilities: every ONGOING
  // position assignment that is not a base teaching role. Class Teacher
  // is never listed here (canonical appointment, shown read-only in
  // Teaching Allocation) and event-specific examination duties are never
  // listed here either (canonical ExamScheduleItems, shown read-only in
  // Examination Duties below).
  const isClassTeacherAssignment = (p: PositionAssignment) =>
    p.positionId === 'pos-class-teacher' || /class\s*teacher/i.test(p.positionTitle)
  const isSubjectTeacherAssignment = (p: PositionAssignment) =>
    p.positionId === 'pos-subject-teacher' || /subject\s*teacher/i.test(p.positionTitle)
  const responsibilities = teacher.positions.filter(
    (p) =>
      p.status === 'Active' &&
      !isSubjectTeacherAssignment(p) &&
      !isClassTeacherAssignment(p),
  )
  const pendingResponsibilities = teacher.positions.filter(
    (p) =>
      p.status === 'Pending Acceptance' &&
      !isSubjectTeacherAssignment(p) &&
      !isClassTeacherAssignment(p),
  )
  const hasResponsibilities = responsibilities.length > 0 || pendingResponsibilities.length > 0

  // Examination duties — READ-ONLY display from the canonical duty
  // roster (Examinations module assigns them); sorted live-first.
  const examDuties =
    dutiesState.status === 'ready' ? sortExamDutiesForDisplay(dutiesState.duties, new Date()) : []

  /* ---------- PERMISSIONS — derived, grouped by source ---------- */

  const subjectTeacherDef = positionsList.find(
    (p) => p.id === 'pos-subject-teacher' || /subject\s*teacher/i.test(p.title),
  )
  const classTeacherDefinition = positionsList.find(
    (p) => p.id === 'pos-class-teacher' || /class\s*teacher/i.test(p.title),
  )

  // Each group states WHERE its access comes from; a permission is never
  // repeated across groups.
  const seen = new Set<string>()
  const permissionGroups: Array<{
    id: string
    label: string
    context: string | null
    permissions: string[]
    source: string
  }> = []

  // 1) TEACHING ACCESS — derives from the actual teaching allocation.
  if ((teacher.subjects.length > 0 || teacher.classes.length > 0) && subjectTeacherDef) {
    const context = [
      teacher.subjects.length > 0 ? teacher.subjects.join(', ') : null,
      teacher.classes.length > 0 ? teacher.classes.join(', ') : null,
    ].filter(Boolean).join(' · ')
    const tokens = subjectTeacherDef.permissions
    tokens.forEach((t) => seen.add(t))
    permissionGroups.push({
      id: 'teaching',
      label: 'Teaching Access',
      context,
      permissions: getPermissionLabels(tokens),
      source: 'Teaching Allocation',
    })
  }

  // 2) CLASS TEACHER ACCESS — derives from the canonical appointment
  //    (Students & Classes → Classes → Class Teacher). Removing the
  //    appointment removes this group automatically.
  if (serverClasses.length > 0 && classTeacherDefinition && subjectTeacherDef) {
    const tokens = classTeacherDefinition.permissions.filter(
      (t) => !subjectTeacherDef.permissions.includes(t) && !seen.has(t),
    )
    tokens.forEach((t) => seen.add(t))
    permissionGroups.push({
      id: 'class-teacher',
      label: 'Class Teacher Access',
      context: serverClasses.map((c) => c.label).join(', '),
      permissions: getPermissionLabels(tokens),
      source: 'Class Teacher Appointment',
    })
  }

  // 3) RESPONSIBILITY ACCESS — derives from ACTIVE responsibilities only
  //    (pending-acceptance assignments grant nothing until accepted).
  const activeResponsibilities = responsibilities.filter((p) => p.status === 'Active')
  if (activeResponsibilities.length > 0) {
    const tokens = new Set<string>()
    activeResponsibilities.forEach((r) => {
      const def = positionsList.find((p) => p.id === r.positionId)
      def?.permissions.forEach((perm) => {
        if (!seen.has(perm)) tokens.add(perm)
      })
    })
    if (tokens.size > 0) {
      permissionGroups.push({
        id: 'responsibility',
        label: 'Responsibility Access',
        context: activeResponsibilities.map((r) => r.positionTitle).join(', '),
        permissions: getPermissionLabels(Array.from(tokens)),
        source: 'Active Responsibilities',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* ---------- EMPLOYMENT ---------- */}
      <section aria-label="Employment">
        <SectionLabel
          icon={Briefcase}
          action={
            <SectionAction
              icon={Pencil} label="Edit" onClick={() => setEmploymentEditOpen(true)}
              ariaLabel={`Edit employment information for ${teacher.name}`}
            />
          }
        >
          Employment
        </SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          <Field label="Designation" value={teacher.designation} />
          <Field label="Department" value={teacher.department} />
          <Field label="Status" value={teacher.status} />
          <Field label="Joined" value={formatDate(teacher.joiningDate)} />
        </div>
      </section>

      {/* ---------- TEACHING ALLOCATION ---------- */}
      <section aria-label="Teaching allocation" className="pt-4 border-t border-border">
        <SectionLabel
          icon={GraduationCap}
          action={
            <SectionAction
              icon={Settings2} label="Manage" onClick={() => onManageWorkload(teacher)}
              ariaLabel={`Manage class and subject allocation for ${teacher.name}`}
            />
          }
        >
          Teaching Allocation
        </SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
          <Field
            label="Subjects"
            value={teacher.subjects.length > 0 ? teacher.subjects.join(', ') : 'None assigned'}
            muted={teacher.subjects.length === 0}
          />
          <Field
            label="Classes"
            value={teacher.classes.length > 0 ? teacher.classes.join(', ') : 'No class assignments'}
            muted={teacher.classes.length === 0}
          />
          {/* Class Teacher — canonical Class/Section appointment, shown
              READ-ONLY. It is assigned in Students & Classes → Classes →
              Class Teacher and this profile only reflects the result. */}
          <Field
            label="Class Teacher"
            value={classTeacherValue ?? 'No class-teacher appointment'}
            muted={!classTeacherValue || classTeacherValue === 'Unavailable'}
          />
        </div>
      </section>

      {/* ---------- RESPONSIBILITIES ---------- */}
      <section aria-label="Responsibilities" className="pt-4 border-t border-border">
        <SectionLabel
          icon={ShieldCheck}
          action={
            <SectionAction
              icon={Settings2} label="Manage" onClick={() => onManageResponsibilities(teacher)}
              ariaLabel={`Manage responsibilities for ${teacher.name}`}
            />
          }
        >
          Responsibilities
        </SectionLabel>

        {hasResponsibilities ? (
          <div className="divide-y divide-border">
            {responsibilities.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.positionTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {p.assignedBy} · {formatDate(p.effectiveDate || p.assignedDate)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusText tone="active">Active</StatusText>
                  <ResponsibilityOverflow
                    onView={() => setViewingAssignment(p)}
                    onRemove={() => setRemovingAssignment(p)}
                    title={p.positionTitle}
                  />
                </div>
              </div>
            ))}
            {pendingResponsibilities.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.positionTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {p.assignedBy} · {formatDate(p.effectiveDate || p.assignedDate)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusText tone="pending">Pending acceptance</StatusText>
                  <ResponsibilityOverflow
                    onView={() => setViewingAssignment(p)}
                    onRemove={() => setRemovingAssignment(p)}
                    title={p.positionTitle}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No additional responsibilities</p>
        )}
      </section>

      {/* ---------- EXAMINATION DUTIES (canonical, read-only) ---------- */}
      <section aria-label="Examination duties" className="pt-4 border-t border-border">
        <SectionLabel icon={ClipboardCheck}>Examination Duties</SectionLabel>
        {dutiesState.status === 'error' ? (
          <p className="text-sm text-muted-foreground italic">Unavailable</p>
        ) : dutiesState.status === 'loading' ? (
          <p className="text-sm text-muted-foreground italic">Loading…</p>
        ) : examDuties.length > 0 ? (
          <div className="divide-y divide-border">
            {examDuties.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{d.examName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Invigilator · {d.subjectName} · {d.className} · {formatDate(d.date)}
                  </p>
                </div>
                <DutyStatusText status={d.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No examination duties assigned</p>
        )}
      </section>

      {/* ---------- PERMISSIONS (derived, grouped by source) ---------- */}
      <section aria-label="Permissions" className="pt-4 border-t border-border">
        <SectionLabel icon={KeyRound}>Permissions</SectionLabel>
        <p className="text-xs text-muted-foreground mb-3.5 max-w-xl">
          Effective access is derived automatically from this teacher&apos;s active teaching
          assignments, Class Teacher appointments and responsibilities.
        </p>
        {permissionGroups.length > 0 ? (
          <div className="space-y-4">
            {permissionGroups.map((group) => (
              <div key={group.id}>
                <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  {group.label}
                </p>
                {group.context && (
                  <p className="text-xs font-medium text-foreground mt-0.5 break-words">{group.context}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 mt-1.5 max-w-2xl">
                  {group.permissions.map((label) => (
                    <p key={label} className="flex items-center gap-2 text-xs text-foreground">
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">{label}</span>
                    </p>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Source: {group.source}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">None derived from current assignments</p>
        )}
      </section>

      {/* ---------- dialogs ---------- */}
      <EmploymentEditDialog teacher={teacher} open={employmentEditOpen} onClose={() => setEmploymentEditOpen(false)} />
      <RemoveResponsibilityDialog
        teacher={teacher}
        assignment={removingAssignment}
        open={removingAssignment !== null}
        onClose={() => setRemovingAssignment(null)}
      />
      <ViewAssignmentDialog
        assignment={viewingAssignment}
        positionsList={positionsList}
        open={viewingAssignment !== null}
        onClose={() => setViewingAssignment(null)}
      />
    </div>
  )
}

/* ---------- per-row overflow: actions on request, not permanent ---------- */

function ResponsibilityOverflow({ onView, onRemove, title }: {
  onView: () => void
  onRemove: () => void
  title: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost" size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          aria-label={`Actions for responsibility ${title}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onView} className="gap-2 text-xs">
          <Eye className="h-3.5 w-3.5" /> View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRemove} className="gap-2 text-xs text-destructive focus:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> Remove responsibility
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ---------- view assignment details (quiet record facts) ---------- */

function ViewAssignmentDialog({
  assignment, positionsList, open, onClose,
}: {
  assignment: PositionAssignment | null
  positionsList: PositionDefinition[]
  open: boolean
  onClose: () => void
}) {
  if (!assignment) return null
  const def = positionsList.find((p) => p.id === assignment.positionId)
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{assignment.positionTitle}</DialogTitle>
          <DialogDescription className="text-xs">Responsibility assignment record.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <Field label="Status" value={assignment.status} />
          <Field label="Category" value={def?.category ?? '—'} />
          <Field label="Assigned by" value={assignment.assignedBy} />
          <Field label="Assigned on" value={formatDate(assignment.assignedDate)} />
          <Field label="Effective from" value={formatDate(assignment.effectiveDate)} />
          {assignment.isEmergencyOverride && (
            <Field label="Activated via" value={`Emergency override — ${assignment.overrideReason ?? ''}`} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
