'use client'

/**
 * Positions & Allocation tab (Wave 2.3 §2–§4 + W2.3B §1–§4).
 *
 * View: employment facts, teaching allocation, responsibilities and the
 * permissions DERIVED from active responsibilities — each domain kept
 * strictly separate (Designation ≠ Responsibility ≠ Teaching assignment
 * ≠ Class Teacher assignment ≠ Permission).
 *
 * Management: every section makes its real management path discoverable —
 *   Employment          → [Edit] dialog (updateTeacher)
 *   Teaching allocation → [Manage] → the module's WorkloadAllocationModal
 *                          (subjects & classes, conflict-checked)
 *   Responsibilities    → [Manage] → the module's AssignPositionModal;
 *                          per-row Remove (soft 'Pending Removal', or
 *                          emergency instant removal with the Principal
 *                          authorization code)
 *   Class Teacher       → appointed in Students & Classes → Classes →
 *                          Class Teacher Appointments (server truth)
 *   Permissions         → derived from active responsibilities above
 */

import { useState } from 'react'
import {
  GraduationCap, BookOpen, Users, Briefcase, ShieldCheck,
  Pencil, Settings2, Trash2, BadgeCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
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

/* ---------- small presentation primitives ---------- */

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

function ManageButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="text-xs h-7 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <Settings2 className="h-3 w-3" /> {label}
    </Button>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground italic">{children}</p>
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
  const activePermissions = getTeacherActivePermissions(teacher, positionsList)
  const [employmentEditOpen, setEmploymentEditOpen] = useState(false)
  const [removingAssignment, setRemovingAssignment] = useState<PositionAssignment | null>(null)

  // Class Teacher assignment — from the SERVER roster (canonical source),
  // matched by the teacher's email; never inferred from the designation.
  const serverClasses =
    rosterState.status === 'ready' ? classesOfTeacher(rosterState.roster, teacher.email) : []
  const classTeacherLabels = serverClasses.map((c) => c.label)

  // Administrative / co-curricular responsibilities: every position
  // assignment that is not a base teaching role.
  const responsibilities = teacher.positions.filter(
    (p) =>
      p.status === 'Active' &&
      !['Subject Teacher', 'Class Teacher'].includes(p.positionTitle) &&
      !/class teacher/i.test(p.positionTitle)
  )
  const pendingResponsibilities = teacher.positions.filter(
    (p) => p.status === 'Pending Acceptance'
  )

  return (
    <div className="space-y-6">
      {/* ---------- EMPLOYMENT ---------- */}
      <section aria-label="Employment">
        <SectionLabel
          icon={Briefcase}
          action={
            <Button
              variant="ghost" size="sm" onClick={() => setEmploymentEditOpen(true)}
              className="text-xs h-7 px-2 gap-1 text-muted-foreground hover:text-foreground"
              aria-label={`Edit employment information for ${teacher.name}`}
            >
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          }
        >
          Employment
        </SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
          <Fact label="Designation" value={teacher.designation} />
          <Fact label="Department" value={teacher.department} />
          <Fact label="Status" value={teacher.status} />
          <Fact label="Joined" value={formatDate(teacher.joiningDate)} />
        </div>
      </section>

      {/* ---------- TEACHING ALLOCATION ---------- */}
      <section aria-label="Teaching allocation" className="pt-4 border-t border-border">
        <SectionLabel
          icon={GraduationCap}
          action={<ManageButton label="Manage allocation" onClick={() => onManageWorkload(teacher)} />}
        >
          Teaching Allocation
        </SectionLabel>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1.5">Subjects</p>
            {teacher.subjects.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {teacher.subjects.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary border border-primary/20 px-2 py-1 text-xs font-medium">
                    <BookOpen className="h-3 w-3" /> {s}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyNote>No subject assignments</EmptyNote>
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1.5">Classes / Sections</p>
            {teacher.classes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {teacher.classes.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2 py-1 text-xs font-medium">
                    <Users className="h-3 w-3" /> {c}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyNote>No class assignments</EmptyNote>
            )}
          </div>

          {/* Class Teacher — separated from ordinary teaching assignments */}
          <div>
            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1.5">Class Teacher</p>
            {rosterState.status === 'loading' ? (
              <p className="text-xs text-muted-foreground">Loading appointment record…</p>
            ) : classTeacherLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 items-center">
                {classTeacherLabels.map((label) => (
                  <span key={label} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2 py-1 text-xs font-semibold shadow-sm">
                    <BadgeCheck className="h-3 w-3" /> {label}
                  </span>
                ))}
                <span className="text-[10px] text-muted-foreground ml-1">from the school&rsquo;s class-teacher register</span>
              </div>
            ) : (
              <>
                <EmptyNote>No class-teacher appointment</EmptyNote>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Appointed in Students &amp; Classes → Classes → Class Teacher Appointments.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ---------- RESPONSIBILITIES ---------- */}
      <section aria-label="Responsibilities" className="pt-4 border-t border-border">
        <SectionLabel
          icon={ShieldCheck}
          action={<ManageButton label="Manage responsibilities" onClick={() => onManageResponsibilities(teacher)} />}
        >
          Responsibilities
        </SectionLabel>
        {responsibilities.length > 0 || pendingResponsibilities.length > 0 || teacher.examResponsibilities.length > 0 ? (
          <div className="space-y-2">
            {responsibilities.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.positionTitle}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Assigned by {p.assignedBy} · {formatDate(p.assignedDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[9px] border-emerald-500/50 bg-emerald-500/10 text-emerald-700">
                    Active
                  </Badge>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setRemovingAssignment(p)}
                    className="h-7 px-2 gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                    aria-label={`Remove responsibility ${p.positionTitle}`}
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </Button>
                </div>
              </div>
            ))}
            {pendingResponsibilities.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.positionTitle}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Assigned by {p.assignedBy} · awaiting teacher acceptance
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[9px] border-amber-500/50 bg-amber-500/10 text-amber-700">
                    Pending
                  </Badge>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setRemovingAssignment(p)}
                    className="h-7 px-2 gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                    aria-label={`Withdraw responsibility ${p.positionTitle}`}
                  >
                    <Trash2 className="h-3 w-3" /> Withdraw
                  </Button>
                </div>
              </div>
            ))}
            {teacher.examResponsibilities.map((e) => (
              <div key={e} className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3.5 py-2.5">
                <p className="text-sm font-medium text-foreground">{e}</p>
                <Badge variant="outline" className="text-[9px] text-muted-foreground shrink-0 ml-auto">Examination</Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyNote>No additional responsibilities</EmptyNote>
        )}
      </section>

      {/* ---------- PERMISSIONS ---------- */}
      <section aria-label="Permissions" className="pt-4 border-t border-border">
        <SectionLabel icon={ShieldCheck}>Permissions</SectionLabel>
        {activePermissions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 max-w-3xl">
            {getPermissionLabels(activePermissions).map((label) => (
              <span key={label} className="inline-flex items-center rounded-md bg-muted text-foreground border border-border px-2 py-1 text-[11px] font-medium">
                {label}
              </span>
            ))}
          </div>
        ) : (
          <EmptyNote>No permissions derived from current assignments</EmptyNote>
        )}
        <p className="text-[10px] text-muted-foreground mt-2.5">
          Derived from active responsibilities — assign or remove them in Responsibilities above.
        </p>
      </section>

      {/* ---------- dialogs ---------- */}
      <EmploymentEditDialog teacher={teacher} open={employmentEditOpen} onClose={() => setEmploymentEditOpen(false)} />
      <RemoveResponsibilityDialog
        teacher={teacher}
        assignment={removingAssignment}
        open={removingAssignment !== null}
        onClose={() => setRemovingAssignment(null)}
      />
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5 truncate">{value}</p>
    </div>
  )
}
