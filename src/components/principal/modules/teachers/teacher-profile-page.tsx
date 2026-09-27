'use client'

import { useState } from 'react'
import {
  Lock, Unlock, ShieldAlert, ArrowLeft, FileCheck2, FileSignature,
  KeyRound, ChevronDown, GraduationCap, BookOpen, Users, Briefcase,
  ShieldCheck, Camera, BadgeCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared/ui'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import {
  getTeacherActivePermissions,
  useTeachersStore,
  type TeacherRecord,
  type PositionDefinition,
} from '@/lib/store/teachers-store'
import { gradientFor } from './shared'
import { getPermissionLabels } from './permission-labels'
import { TeacherPayrollTab } from './teacher-payroll-tab'
import { useClassTeacherRoster, classesOfTeacher } from './use-class-teacher-roster'
import { PhotoStep } from '../admission/components/PhotoStep'
import { SignatureUpload } from './signature-upload'
import {
  validateTeacherMedia, uploadTeacherMedia, deleteTeacherMediaFile,
  toMediaRecord, dataUrlToBlob,
} from './teacher-media'
import { toast } from 'sonner'

interface Props {
  teacher: TeacherRecord
  positionsList: PositionDefinition[]
  onBack: () => void
  onOpenAppointment: () => void
  onOpenJoiningLetter: () => void
  onResetPassword: () => void
  onToggleLock: () => void
  onOpenTermination: () => void
}

/**
 * Teacher Profile Page — full-page workspace (Wave 2.3 §2–§4, §11).
 *
 * Header: identity (name · employee ID · designation · department ·
 * status) + key actions. Tabs keep the three domains separate:
 *   Positions & Allocation → employment, teaching allocation,
 *                             responsibilities, permissions
 *   Profile                → personal/professional details + media
 *   Payroll                → salary and payment history (untouched)
 *
 * Class Teacher assignment is derived from the SERVER class-teacher
 * roster (the same record that gates the teacher's Class Teacher Hub) —
 * never inferred from the designation, never duplicated locally.
 */
export function TeacherProfilePage({
  teacher, positionsList, onBack,
  onOpenAppointment, onOpenJoiningLetter, onResetPassword, onToggleLock, onOpenTermination,
}: Props) {
  return (
    <div className="space-y-5">
      {/* ============ HEADER ============ */}
      <div className="flex items-start gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0" aria-label="Back to directory">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {teacher.photo?.dataUrl ? (
            <img
              src={teacher.photo.dataUrl}
              alt={teacher.name}
              className="h-11 w-11 shrink-0 rounded-xl object-cover border border-border"
            />
          ) : (
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white font-semibold', gradientFor(teacher.id))}>
              {teacher.avatar}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">{teacher.name}</h1>
              <StatusBadge status={teacher.status} variant={teacher.status === 'Active' ? 'success' : 'warning'} />
              {teacher.isLocked && (
                <Badge variant="destructive" className="text-[10px]">
                  <Lock className="h-2.5 w-2.5 mr-1" /> Locked
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {teacher.designation} · {teacher.department} · <span className="font-mono">{teacher.employeeId}</span>
            </p>
          </div>
        </div>

        {/* Key actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5" /> Documents <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onOpenAppointment} className="gap-2 text-xs">
                <FileCheck2 className="h-3.5 w-3.5" /> Appointment Letter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenJoiningLetter} className="gap-2 text-xs">
                <FileSignature className="h-3.5 w-3.5" /> Joining Letter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onResetPassword} className="gap-2 text-xs">
                <KeyRound className="h-3.5 w-3.5" /> Account Slip
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={onToggleLock}
            className={cn('text-xs h-8 gap-1.5', teacher.isLocked && 'border-amber-500 text-amber-700 hover:bg-amber-50')}>
            {teacher.isLocked ? <Unlock className="h-3.5 w-3.5 text-amber-600" /> : <Lock className="h-3.5 w-3.5 text-slate-500" />}
            {teacher.isLocked ? 'Unlock' : 'Lock'}
          </Button>
          <Button variant="destructive" size="sm" onClick={onOpenTermination} className="text-xs h-8 gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Relieve
          </Button>
        </div>
      </div>

      {/* ============ TABS ============ */}
      <Tabs defaultValue="positions">
        <TabsList className="bg-muted/60 h-9 p-1 gap-1 rounded-full inline-flex">
          <TabsTrigger value="positions" className="text-xs rounded-full px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground">Positions &amp; Allocation</TabsTrigger>
          <TabsTrigger value="profile" className="text-xs rounded-full px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground">Profile</TabsTrigger>
          <TabsTrigger value="payroll" className="text-xs rounded-full px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground">Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-4">
          <PositionsAllocationTab teacher={teacher} positionsList={positionsList} />
        </TabsContent>
        <TabsContent value="profile" className="mt-4">
          <ProfileTab teacher={teacher} />
        </TabsContent>
        <TabsContent value="payroll" className="mt-4">
          <TeacherPayrollTab teacherId={teacher.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ================================================================== */
/*  TAB 1 — POSITIONS & ALLOCATION                                     */
/* ================================================================== */

function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{children}</h3>
    </div>
  )
}

function FactGrid({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
      {facts.map((f) => (
        <div key={f.label} className="min-w-0">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">{f.label}</p>
          <p className="text-sm font-medium text-foreground mt-0.5 truncate">{f.value}</p>
        </div>
      ))}
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground italic">{children}</p>
}

function PositionsAllocationTab({
  teacher,
  positionsList,
}: {
  teacher: TeacherRecord
  positionsList: PositionDefinition[]
}) {
  const rosterState = useClassTeacherRoster()
  const activePermissions = getTeacherActivePermissions(teacher, positionsList)

  // Class Teacher assignment — from the SERVER roster (canonical source),
  // matched by the teacher's email. Falls back to an explicit store
  // position assignment (from the Add Teacher wizard / position modal)
  // when this teacher is not in the school database.
  const serverClasses =
    rosterState.status === 'ready' ? classesOfTeacher(rosterState.roster, teacher.email) : []
  const localClassTeacherLabels = teacher.positions
    .filter((p) => p.status === 'Active' && /class teacher/i.test(p.positionTitle))
    .map((p) => p.classAssigned || (p.positionTitle.match(/\(([^)]+)\)/)?.[1] ?? ''))
    .filter(Boolean)

  // Server record wins when the roster is loaded; a teacher without a
  // server class-teacher slot genuinely has no class-teacher assignment.
  const classTeacherLabels = serverClasses.map((c) => c.label)
  const useClassTeacherFallback =
    rosterState.status !== 'ready' && classTeacherLabels.length === 0 && localClassTeacherLabels.length > 0

  // Administrative / co-curricular responsibilities: every ACTIVE position
  // that is not the base teaching roles (Subject Teacher / Class Teacher).
  const responsibilities = teacher.positions.filter(
    (p) =>
      p.status === 'Active' &&
      !['Subject Teacher', 'Class Teacher'].includes(p.positionTitle) &&
      !/class teacher/i.test(p.positionTitle)
  )

  return (
    <div className="space-y-6">
      {/* ---------- EMPLOYMENT ---------- */}
      <section aria-label="Employment">
        <SectionLabel icon={Briefcase}>Employment</SectionLabel>
        <FactGrid
          facts={[
            { label: 'Designation', value: teacher.designation },
            { label: 'Department', value: teacher.department },
            { label: 'Status', value: teacher.status },
            { label: 'Joined', value: formatDate(teacher.joiningDate) },
          ]}
        />
      </section>

      {/* ---------- TEACHING ALLOCATION ---------- */}
      <section aria-label="Teaching allocation" className="pt-4 border-t border-border">
        <SectionLabel icon={GraduationCap}>Teaching Allocation</SectionLabel>
        <div className="space-y-4">
          {/* Subjects */}
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

          {/* Classes / Sections */}
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
            {rosterState.status === 'loading' && classTeacherLabels.length === 0 && !useClassTeacherFallback ? (
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
            ) : useClassTeacherFallback ? (
              <div className="flex flex-wrap gap-1.5">
                {localClassTeacherLabels.map((label) => (
                  <span key={label} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2 py-1 text-xs font-semibold shadow-sm">
                    <BadgeCheck className="h-3 w-3" /> {label}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyNote>No class-teacher assignment</EmptyNote>
            )}
            {classTeacherLabels.length === 0 && !useClassTeacherFallback && rosterState.status !== 'loading' && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Appoint from Students &amp; Classes → Classes → Class Teacher Appointments.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---------- RESPONSIBILITIES ---------- */}
      <section aria-label="Responsibilities" className="pt-4 border-t border-border">
        <SectionLabel icon={ShieldCheck}>Responsibilities</SectionLabel>
        {responsibilities.length > 0 || teacher.examResponsibilities.length > 0 ? (
          <div className="space-y-2">
            {responsibilities.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.positionTitle}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Assigned by {p.assignedBy} · {formatDate(p.assignedDate)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[9px] shrink-0',
                    p.status === 'Active'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700'
                      : 'border-amber-500/50 bg-amber-500/10 text-amber-700'
                  )}
                >
                  {p.status}
                </Badge>
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
          Derived from active position assignments — manage via Settings → Staff Settings.
        </p>
      </section>
    </div>
  )
}

/* ================================================================== */
/*  TAB 2 — PROFILE                                                    */
/* ================================================================== */

function ProfileTab({ teacher }: { teacher: TeacherRecord }) {
  const setTeacherMedia = useTeachersStore((s) => s.setTeacherMedia)
  const [photoBusy, setPhotoBusy] = useState(false)

  const handlePhotoChange = async (dataUrl: string | null) => {
    if (!dataUrl) {
      if (teacher.photo) deleteTeacherMediaFile(teacher.photo.fileId)
      setTeacherMedia(teacher.id, 'photo', null)
      toast.info('Photo removed')
      return
    }
    setPhotoBusy(true)
    try {
      const blob = await dataUrlToBlob(dataUrl)
      const file = new File([blob], 'teacher-photo.jpg', { type: blob.type || 'image/jpeg' })
      const validationError = await validateTeacherMedia(file, 'photo')
      if (validationError) {
        toast.error(validationError)
        return
      }
      const uploaded = await uploadTeacherMedia(file, 'photo', { dataUrl })
      if (teacher.photo) deleteTeacherMediaFile(teacher.photo.fileId)
      setTeacherMedia(teacher.id, 'photo', toMediaRecord(uploaded))
      toast.success('Photo updated', { description: 'Stored on the staff record.' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Photo upload failed. Please try again.')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Personal & professional details */}
      <section aria-label="Personal details">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <ProfileField label="Email" value={teacher.email} mono />
          <ProfileField label="Phone" value={teacher.phone} mono />
          <ProfileField label="Date of Birth" value={formatDate(teacher.dob)} />
          <ProfileField label="Blood Group" value={teacher.bloodGroup} />
          <ProfileField label="Experience" value={`${teacher.totalExperience} years`} />
          <ProfileField label="Employment Type" value={teacher.employmentType} />
          <ProfileField label="Qualifications" value={teacher.educationalQualifications.map((q) => `${q.degree} (${q.institution})`).join(', ')} />
          <ProfileField label="Address" value={teacher.currentAddress} />
          <ProfileField label="Emergency Contact" value={`${teacher.emergencyContact.name} (${teacher.emergencyContact.relation}) · ${teacher.emergencyContact.phone}`} />
        </div>
      </section>

      {/* Photo & signature — the same media pipeline as the Add wizard */}
      <section aria-label="Photo and signature" className="pt-4 border-t border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Camera className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Photo &amp; Signature</h3>
        </div>
        <div className="space-y-6">
          <PhotoStep
            photoDataUrl={teacher.photo?.dataUrl ?? null}
            onChange={handlePhotoChange}
            title="Photograph"
            recordLabel="staff record"
            suppressToasts
            startInPreview
          />
          {photoBusy && (
            <p className="text-[11px] text-muted-foreground -mt-2">Storing photo on the staff record…</p>
          )}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileSignature className="h-4 w-4" />
              </div>
              <h2 className="font-display text-sm font-bold tracking-tight">Signature</h2>
            </div>
            <SignatureUpload
              value={teacher.signature ?? null}
              onChange={(media) => setTeacherMedia(teacher.id, 'signature', media)}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

/* Single-line profile field — label + value, no card background */
function ProfileField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">{label}</p>
      <p className={cn('text-sm font-medium text-foreground mt-1 break-words', mono && 'font-mono')}>{value}</p>
    </div>
  )
}
