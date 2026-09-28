'use client'

/**
 * Positions & Allocation tab — the final 4-section profile summary.
 *
 * Visual benchmark: the Teacher → Payroll page — white background, calm
 * scannable label/value rows, generous whitespace, subtle dividers and a
 * restrained green accent. The profile is a SUMMARY / SOURCE-OF-TRUTH
 * VIEW: assignments are managed from their actual modules, never
 * duplicated here.
 *
 *   EMPLOYMENT          designation facts                     [Edit]
 *   TEACHING ALLOCATION subjects · classes · class teacher    [Manage]
 *                       (Class Teacher is READ-ONLY — appointed in
 *                        Students & Classes → Classes; the profile
 *                        only reflects the canonical appointment)
 *   RESPONSIBILITIES    ongoing administrative roles, one per row [Manage]
 *   PERMISSIONS         derived automatically, grouped by source —
 *                       no manage action (derived data)
 *
 * Examination duties (invigilation assignments, exam-specific records)
 * deliberately do NOT appear on the Teacher Profile: they are event
 * assignments, not ongoing roles, and live exclusively in the
 * Examinations module (Examinations → Invigilation) that assigns them.
 *
 * Management is discoverable but quiet: destructive actions live behind
 * each responsibility row's overflow menu, never permanently on the row.
 */

import { useState } from 'react'
import {
  GraduationCap, Briefcase, ShieldCheck, KeyRound,
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
  EmploymentEditDialog, RemoveResponsibilityDialog,
} from './profile-edit-dialogs'

/* ---------- one section-header pattern for the whole page ---------- */

function SectionLabel({ icon: Icon, children, action }: { icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3.5">
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

/** Label-above-value field — the profile's field rhythm. */
function Field({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">{label}</p>
      <p className={cn('text-sm font-medium mt-1 break-words', muted ? 'text-muted-foreground italic font-normal' : 'text-foreground')}>
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
  const [employmentEditOpen, setEmploymentEditOpen] = useState(false)
  const [removingAssignment, setRemovingAssignment] = useState<PositionAssignment | null>(null)
  const [viewingAssignment, setViewingAssignment] = useState<PositionAssignment | null>(null)

  // Class Teacher assignment — READ-ONLY display from the SERVER roster
  // (canonical source), matched by the teacher's email. It is appointed
  // in Students & Classes → Classes → Class Teacher and this profile
  // only reflects the result — there is deliberately NO manage action
  // here (no duplicate assignment path). Changing the appointment there
  // updates this profile automatically.
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
  // listed here either (they live in the Examinations module).
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

  /** A responsibility's definition (category etc.) when it is a known position. */
  const definitionOf = (p: PositionAssignment) =>
    positionsList.find((d) => d.id === p.positionId) ?? null

  /* ---------- PERMISSIONS — derived, grouped by source ---------- */

  const subjectTeacherDef = positionsList.find(
    (p) => p.id === 'pos-subject-teacher' || /subject\s*teacher/i.test(p.title),
  )
  const classTeacherDefinition = positionsList.find(
    (p) => p.id === 'pos-class-teacher' || /class\s*teacher/i.test(p.title),
  )

  // Each group appears only when its source assignment exists; a
  // permission is never repeated across groups.
  const seen = new Set<string>()
  const permissionGroups: Array<{
    id: string
    label: string
    context: string | null
    permissions: string[]
  }> = []

  // 1) TEACHING ACCESS — derives from the actual teaching allocation.
  //    The class list is not repeated here (it is already shown in
  //    Teaching Allocation above) — a concise count keeps this section
  //    scannable.
  if ((teacher.subjects.length > 0 || teacher.classes.length > 0) && subjectTeacherDef) {
    const context = [
      teacher.subjects.length > 0 ? teacher.subjects.join(', ') : null,
      teacher.classes.length > 0
        ? `${teacher.classes.length} assigned class${teacher.classes.length === 1 ? '' : 'es'}`
        : null,
    ].filter(Boolean).join(' · ')
    const tokens = subjectTeacherDef.permissions
    tokens.forEach((t) => seen.add(t))
    permissionGroups.push({
      id: 'teaching',
      label: 'Teaching Access',
      context,
      permissions: getPermissionLabels(tokens),
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
      })
    }
  }

  return (
    <div className="space-y-8">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
          <Field label="Designation" value={teacher.designation} />
          <Field label="Department" value={teacher.department} />
          <Field label="Status" value={teacher.status} />
          <Field label="Joined" value={formatDate(teacher.joiningDate)} />
        </div>
      </section>

      {/* ---------- TEACHING ALLOCATION ---------- */}
      <section aria-label="Teaching allocation" className="pt-6 border-t border-border">
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
        <div className="space-y-4">
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
              Class Teacher and this profile only reflects the result;
              there is no second management path here. */}
          <Field
            label="Class Teacher"
            value={classTeacherValue ?? 'No class-teacher appointment'}
            muted={!classTeacherValue || classTeacherValue === 'Unavailable'}
          />
        </div>
      </section>

      {/* ---------- RESPONSIBILITIES ---------- */}
      <section aria-label="Responsibilities" className="pt-6 border-t border-border">
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
              <ResponsibilityRow
                key={p.id}
                assignment={p}
                category={definitionOf(p)?.category ?? null}
                onView={() => setViewingAssignment(p)}
                onRemove={() => setRemovingAssignment(p)}
              />
            ))}
            {pendingResponsibilities.map((p) => (
              <ResponsibilityRow
                key={p.id}
                assignment={p}
                category={definitionOf(p)?.category ?? null}
                onView={() => setViewingAssignment(p)}
                onRemove={() => setRemovingAssignment(p)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No additional responsibilities</p>
        )}
      </section>

      {/* ---------- PERMISSIONS (derived, grouped by source) ---------- */}
      <section aria-label="Permissions" className="pt-6 border-t border-border">
        <SectionLabel icon={KeyRound}>Permissions</SectionLabel>
        <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
          Effective access is derived automatically from this teacher&apos;s active teaching
          assignments, Class Teacher appointment and responsibilities.
        </p>
        {permissionGroups.length > 0 ? (
          <div className="mt-5 space-y-5">
            {permissionGroups.map((group) => (
              <div key={group.id}>
                <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  {group.label}
                </p>
                {group.context && (
                  <p className="text-xs font-medium text-foreground mt-1 break-words">{group.context}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 mt-2 max-w-2xl">
                  {group.permissions.map((label) => (
                    <p key={label} className="flex items-start gap-2 text-xs text-foreground">
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span className="min-w-0 break-words">{label}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic mt-3.5">None derived from current assignments</p>
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

/* ---------- one responsibility row (active or pending) ---------- */

function ResponsibilityRow({ assignment, category, onView, onRemove }: {
  assignment: PositionAssignment
  category: string | null
  onView: () => void
  onRemove: () => void
}) {
  const meta = [
    category,
    assignment.assignedBy,
    formatDate(assignment.effectiveDate || assignment.assignedDate),
  ].filter(Boolean).join(' · ')
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        {/* break-words (not truncate) so nothing is ever clipped on
            narrow screens — rows simply grow taller. */}
        <p className="text-sm font-medium text-foreground break-words">{assignment.positionTitle}</p>
        <p className="text-xs text-muted-foreground mt-0.5 break-words">{meta}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <StatusText tone={assignment.status === 'Active' ? 'active' : 'pending'}>
          {assignment.status === 'Active' ? 'Active' : 'Pending acceptance'}
        </StatusText>
        <ResponsibilityOverflow
          onView={onView}
          onRemove={onRemove}
          title={assignment.positionTitle}
        />
      </div>
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
