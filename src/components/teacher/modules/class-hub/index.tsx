'use client'

/**
 * class-hub/index — the Class Teacher Hub module entry point. The module
 * router imports the named `ClassHubModule` export and renders it with
 * the panel's onNavigate.
 *
 * This is "the something extra" an appointed class teacher gets: one
 * control room for THEIR class. Composition (master task §7 — the
 * class-management work comes first, decoration never):
 *
 *   · a COMPACT class header — identity, student count, appointment and
 *     room on one refined line + the four practical quick actions
 *     (no oversized decorative hero);
 *   · the control room grid — today's attendance, class growth, the
 *     fee picture with defaulters (each defaulter opens the ONE shared
 *     student profile), and the results-submission matrix.
 *
 * Everything is fed by ONE call to GET /api/teacher/class-hub, which
 * only exists for classes the signed-in teacher is actually appointed
 * class teacher of. A teacher without an appointment never reaches this
 * module (the sidebar group does not exist for them); a direct deep-link
 * lands on the honest empty state below.
 */

import { useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck,
  FileText,
  GraduationCap,
  RefreshCw,
  School,
  TrendingUp,
  Users,
  BadgeCheck,
  DoorOpen,
} from 'lucide-react'
import { PageTransition } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import { useFocusStore } from '@/lib/store/focus-store'
import { GlassCard } from '@/components/shared/ui'
import { HubEmptyState, HubModuleSkeleton } from '../shared/hub-stat-cards'
import { TeacherStudentProfileSheet } from '../shared/student-profile-sheet'
import { useClassHub } from './hooks'
import { AttendanceCard } from './attendance-card'
import { FeesCard } from './fees-card'
import { ResultsCard } from './results-card'
import { GrowthCard } from './growth-card'

const QUICK_ACTIONS = [
  { key: 'attendance', label: 'Mark Attendance', icon: CalendarCheck },
  { key: 'marks', label: 'Enter Marks', icon: FileText },
  { key: 'students', label: 'Student Directory', icon: Users },
  { key: 'growth', label: 'Growth', icon: TrendingUp },
] as const

export function ClassHubModule({ onNavigate }: { onNavigate: (key: string) => void }) {
  const { data, error, reload } = useClassHub()
  const [classId, setClassId] = useState<string | null>(null)
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null)

  // ── module-level states (the hook above always runs) ─────────────────

  if (error) {
    return (
      <PageTransition>
        <GlassCard hover={false}>
          <HubEmptyState
            icon={AlertTriangle}
            title="Couldn't load your class hub"
            hint={error}
            action={
              <Button size="sm" onClick={reload}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
              </Button>
            }
          />
        </GlassCard>
      </PageTransition>
    )
  }

  if (!data) {
    return (
      <PageTransition aria-busy="true">
        <HubModuleSkeleton />
      </PageTransition>
    )
  }

  if (data.classes.length === 0) {
    return (
      <PageTransition>
        <GlassCard hover={false}>
          <HubEmptyState
            icon={School}
            title="You are not a class teacher right now"
            hint="The Class Teacher Hub appears automatically when the principal appoints you class teacher of a class."
          />
        </GlassCard>
      </PageTransition>
    )
  }

  const active = data.classes.find((c) => c.classId === classId) ?? data.classes[0]

  /** "Student Directory" opens the Directory with THIS class preselected
   *  (focus-store deep link — the directory consumes it on mount). */
  const openDirectoryForClass = () => {
    useFocusStore.getState().setFocus({
      type: 'class',
      id: active.classId,
      title: active.label,
      subtitle: 'Opened from My Class',
      moduleKey: 'students',
    })
    onNavigate('students')
  }

  return (
    <PageTransition className="space-y-4 sm:space-y-5">
      {/* ── compact class header — identity + appointment + quick actions.
          No oversized decorative hero; the SCHOLARIO card language. ── */}
      <section
        aria-label={`${active.label} class header`}
        className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5"
      >
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">{active.label}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {active.studentCount} student{active.studentCount === 1 ? '' : 's'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Class Teacher
                </span>
                {active.room && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      {active.room}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon
              const isDirectory = a.key === 'students'
              return (
                <Button
                  key={a.key}
                  type="button"
                  variant={a.key === 'attendance' ? 'default' : 'outline'}
                  size="sm"
                  className="h-9 gap-1.5 text-xs"
                  onClick={() => (isDirectory ? openDirectoryForClass() : onNavigate(a.key))}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {a.label}
                </Button>
              )
            })}
          </div>
        </div>
      </section>

      {/* class pills (only when the teacher runs more than one class) */}
      {data.classes.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Select one of your classes">
          {data.classes.map((c) => {
            const isActive = active.classId === c.classId
            return (
              <button
                key={c.classId}
                type="button"
                aria-pressed={isActive}
                onClick={() => setClassId(c.classId)}
                className={
                  isActive
                    ? 'min-h-[36px] rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary'
                    : 'min-h-[36px] rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-muted-foreground/30 hover:text-foreground'
                }
              >
                {c.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── the control room ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <AttendanceCard cls={active} onNavigate={onNavigate} />
        <GrowthCard cls={active} onNavigate={onNavigate} />
        <FeesCard cls={active} onNavigate={onNavigate} onOpenProfile={setProfileStudentId} />
        <div className="lg:col-span-2">
          <ResultsCard cls={active} onNavigate={onNavigate} />
        </div>
      </div>

      {/* The ONE shared student profile — the same sheet the Directory,
          Fees and Growth open (canonical student, §25). */}
      <TeacherStudentProfileSheet
        studentId={profileStudentId}
        onOpenChange={(o) => {
          if (!o) setProfileStudentId(null)
        }}
        onNavigate={onNavigate}
        onChanged={reload}
      />
    </PageTransition>
  )
}
