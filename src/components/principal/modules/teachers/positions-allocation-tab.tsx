'use client'

/**
 * Positions & Allocation tab (Wave 2.3 §2–§4 + W2.3B + W2.3C).
 *
 * Visual benchmark: the Teacher Profile page — calm, scannable
 * label/value rows, generous whitespace, no pill walls, no helper
 * paragraphs. Concepts stay strictly separate (Designation ≠
 * Responsibility ≠ Teaching assignment ≠ Class Teacher ≠ Permission):
 *
 *   EMPLOYMENT          designation facts                    [Edit]
 *   TEACHING ALLOCATION subjects · classes · class teacher   [Manage]
 *   RESPONSIBILITIES    administrative duties, one per row   [Manage]
 *   PERMISSIONS         derived from active responsibilities
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
  getTeacherActivePermissions,
  type TeacherRecord,
  type PositionAssignment,
  type PositionDefinition,
} from '@/lib/store/teachers-store'
import { getPermissionLabels } from './permission-labels'
import { useClassTeacherRoster, classesOfTeacher } from './use-class-teacher-roster'
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

/* ---------- the tab ---------- */

export function PositionsAllocationTab({
  teacher,
  positionsList,
  onManageWorkload,
  onManageResponsibilities,
  onManageClassTeacher,
}: {
  teacher: TeacherRecord
  positionsList: PositionDefinition[]
  onManageWorkload: (t: TeacherRecord) => void
  onManageResponsibilities: (t: TeacherRecord) => void
  /** Deep-links to Students & Classes → Classes (canonical class-teacher appointments). */
  onManageClassTeacher?: () => void
}) {
  const rosterState = useClassTeacherRoster()
  const [employmentEditOpen, setEmploymentEditOpen] = useState(false)
  const [removingAssignment, setRemovingAssignment] = useState<PositionAssignment | null>(null)
  const [viewingAssignment, setViewingAssignment] = useState<PositionAssignment | null>(null)

  // Class Teacher assignment — from the SERVER roster (canonical source),
  // matched by the teacher's email; never inferred from the designation.
  const serverClasses =
    rosterState.status === 'ready' ? classesOfTeacher(rosterState.roster, teacher.email) : []
  const classTeacherValue =
    rosterState.status === 'loading' ? 'Loading…'
    : rosterState.status === 'error' ? 'Unavailable'
    : serverClasses.length > 0 ? serverClasses.map((c) => c.label).join(', ')
    : null

  // Administrative / co-curricular responsibilities: every position
  // assignment that is not a base teaching role. Class Teacher is never
  // listed here — it is a canonical appointment shown in Teaching
  // Allocation above.
  const isClassTeacherAssignment = (p: PositionAssignment) =>
    p.positionId === 'pos-class-teacher' || /class\s*teacher/i.test(p.positionTitle)
  const responsibilities = teacher.positions.filter(
    (p) =>
      p.status === 'Active' &&
      !['Subject Teacher'].includes(p.positionTitle) &&
      !isClassTeacherAssignment(p),
  )
  const pendingResponsibilities = teacher.positions.filter(
    (p) => p.status === 'Pending Acceptance' && !isClassTeacherAssignment(p),
  )
  const hasResponsibilities =
    responsibilities.length > 0 || pendingResponsibilities.length > 0 || teacher.examResponsibilities.length > 0

  // PERMISSIONS derive from (a) the teacher's actual responsibilities —
  // excluding any legacy Class Teacher position assignment so no duplicate
  // state influences them — plus (b) the canonical Class Teacher permission
  // set when the server roster (Students & Classes → Classes) actually
  // appoints this teacher. Changing or removing the canonical appointment
  // therefore updates the derived permissions automatically.
  const classTeacherDefinition = positionsList.find(
    (p) => p.id === 'pos-class-teacher' || /class\s*teacher/i.test(p.title),
  )
  const activePermissions = Array.from(new Set([
    ...getTeacherActivePermissions(
      { ...teacher, positions: teacher.positions.filter((p) => !isClassTeacherAssignment(p)) },
      positionsList,
    ),
    ...(serverClasses.length > 0 && classTeacherDefinition ? classTeacherDefinition.permissions : []),
  ]))

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
          {/* Class Teacher — canonical appointment (server roster) with its
              own quiet Manage link to Students & Classes → Classes. */}
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Class Teacher</p>
            <div className="flex items-start gap-1.5 mt-0.5 min-w-0">
              <p
                className={cn(
                  'text-sm font-medium break-words',
                  classTeacherValue && classTeacherValue !== 'Loading…' && classTeacherValue !== 'Unavailable'
                    ? 'text-foreground'
                    : 'text-muted-foreground italic font-normal',
                )}
              >
                {classTeacherValue ?? 'No class-teacher appointment'}
              </p>
              {onManageClassTeacher && (
                <SectionAction
                  icon={Settings2} label="Manage" onClick={onManageClassTeacher}
                  ariaLabel={`Manage class-teacher appointments for ${teacher.name} in Students and Classes`}
                />
              )}
            </div>
          </div>
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
            {teacher.examResponsibilities.map((e) => (
              <div key={e} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{e}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Examination</p>
                </div>
                <StatusText tone="active">Active</StatusText>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No additional responsibilities</p>
        )}
      </section>

      {/* ---------- PERMISSIONS ---------- */}
      <section aria-label="Permissions" className="pt-4 border-t border-border">
        <SectionLabel icon={KeyRound}>Permissions</SectionLabel>
        <p className="text-[10px] text-muted-foreground mb-2.5">Derived from active responsibilities.</p>
        {activePermissions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 max-w-2xl">
            {getPermissionLabels(activePermissions).map((label) => (
              <p key={label} className="flex items-center gap-2 text-xs text-foreground">
                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{label}</span>
              </p>
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
