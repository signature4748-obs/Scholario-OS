'use client'

/**
 * students/index — the Student Directory module entry point.
 *
 * Information architecture (master task §4 — the scope answers "which
 * students are in MY teaching scope", never "what classes exist"):
 *
 *   · quiet context line — for a class teacher the PRIMARY class context
 *     ("Grade 9 - A · 11 students · Class Teacher"); for a subject
 *     teacher the teaching scope ("Classes you teach · 3 classes ·
 *     Mathematics"). Subjects are stated ONCE here — never repeated on
 *     every class chip.
 *   · compact class selector — the real authorized classes with their
 *     student counts; a small "Class Teacher" tag marks the appointed
 *     class, nothing else. No giant chips, no zero-student ghost
 *     classes (the server only returns actual assignments).
 *   · summary cards (./quick-stats) + the roster grid (./students-grid).
 *
 * Everything is fed by ONE GET /api/teacher/students call (hook in
 * ./hooks) — real, tenant-scoped data only. Opening a student renders
 * the ONE shared TeacherStudentProfileSheet (same profile as My Class,
 * Fees and Behavior — master task §6/§25).
 */

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, BadgeCheck, Download, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { ModuleToolbar } from '../../teacher-panel/module-toolbar'
import { GlassCard, PageTransition } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import { toCsv } from '@/lib/csv'
import { downloadCSVFile } from '@/lib/download-file'
import { useFocusStore } from '@/lib/store/focus-store'
import { HubEmptyState, HubModuleSkeleton } from '../shared/hub-stat-cards'
import { ClassSelect } from '../shared/class-select'
import { FEE_STATUS_META } from './shared'
import { useStudentDirectory } from './hooks'
import { QuickStats } from './quick-stats'
import { StudentsGrid } from './students-grid'
import { TeacherStudentProfileSheet } from '../shared/student-profile-sheet'

export function StudentsModule() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data, error, reload, classId, setClassId, activeClass, students } = useStudentDirectory()

  // ── cross-module deep links (consumed exactly once, on mount + load):
  //    My Class → "Student Directory" navigates here with the class
  //    preselected (focus type 'class', id = classId).
  const pendingClassFocus = useRef<string | null>(null)
  useEffect(() => {
    const focus = useFocusStore.getState().focus
    if (!focus || focus.moduleKey !== 'students') return
    useFocusStore.getState().clearFocus()
    if (focus.type === 'class') pendingClassFocus.current = focus.id
  }, [])
  useEffect(() => {
    const classToSelect = pendingClassFocus.current
    if (!data || !classToSelect) return
    pendingClassFocus.current = null
    if (data.classes.some((c) => c.id === classToSelect)) setClassId(classToSelect)
  }, [data, setClassId])

  const handleExport = () => {
    if (!activeClass || students.length === 0) return
    // Fee columns exist only for the class teacher's own class — the same
    // data boundary the roster carries (subject teachers export identity +
    // academics only).
    const isCt = activeClass.isClassTeacher
    const header = [
      'Roll No', 'Admission No', 'Name', 'Class', 'Gender', 'Guardian', 'Guardian Phone', 'Attendance %', 'Latest Exam Avg %',
      ...(isCt ? ['Fee Status', 'Outstanding (INR)'] : []),
    ]
    const csv = toCsv(
      header,
      students.map((s) => [
        s.rollNo ?? '',
        s.admissionNo ?? '',
        s.name,
        s.classLabel,
        s.gender ?? '',
        s.guardianName ?? '',
        s.guardianPhone ?? '',
        s.attendance.pct != null ? `${s.attendance.pct}%` : 'No records',
        s.latestExam != null ? `${s.latestExam.averagePct}%` : 'No marks',
        ...(isCt
          ? [s.fees ? FEE_STATUS_META[s.fees.status].label : '', s.fees ? String(s.fees.outstanding) : '']
          : []),
      ]),
    )
    const safeLabel = activeClass.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    downloadCSVFile(csv, `${safeLabel}-student-list.csv`)
    toast.success('Export ready', {
      description: `${activeClass.label} student list · ${students.length} students · CSV`,
    })
  }

  // ── module-level states (the hook above always runs) ────────────────

  if (error) {
    return (
      <PageTransition>
        <GlassCard hover={false}>
          <HubEmptyState
            icon={AlertTriangle}
            title="Couldn't load the student directory"
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
            icon={AlertTriangle}
            title="No classes assigned yet"
            hint="Classes appear here once you are a class teacher or teach a subject in them."
          />
        </GlassCard>
      </PageTransition>
    )
  }

  // ── the scope context line ──────────────────────────────────────────
  // Class teacher → the appointed class is the primary context. Subject
  // teacher → the teaching scope, subjects stated exactly ONCE.
  const ctClasses = data.classes.filter((c) => c.isClassTeacher)
  const subjectClasses = data.classes.filter((c) => !c.isClassTeacher)
  const distinctSubjects = [...new Set(subjectClasses.flatMap((c) => c.subjects))].sort()
  let contextLine: string
  if (ctClasses.length > 0) {
    const primary = ctClasses[0]
    const rest = data.classes.length - 1
    contextLine =
      `${primary.label} · ${primary.studentCount} student${primary.studentCount === 1 ? '' : 's'} · Class Teacher` +
      (rest > 0 ? ` — plus ${rest} more class${rest === 1 ? '' : 'es'} you teach` : '')
  } else {
    contextLine =
      `Classes you teach · ${data.classes.length} class${data.classes.length === 1 ? '' : 'es'}` +
      (distinctSubjects.length > 0 ? ` · ${distinctSubjects.join(', ')}` : '')
  }

  return (
    <PageTransition className="space-y-4 sm:space-y-5">
      <ModuleToolbar
        context={contextLine}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={students.length === 0}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Export
          </Button>
        }
      />

      {/* Compact class selector (refinement §15) — the SAME selector
          language as Student Growth / My Class / Fees: a compact dropdown
          (bottom sheet on mobile) instead of a chip row. Only authorized
          classes are ever listed; the appointed class carries the Class
          Teacher mark. Subjects stay in the context line above — never
          repeated per class. */}
      {data.classes.length > 1 ? (
        <ClassSelect
          classes={data.classes.map((c) => ({
            id: c.id,
            label: c.label,
            meta: String(c.studentCount),
            isClassTeacher: c.isClassTeacher,
          }))}
          value={classId}
          onChange={(id) => setClassId(id ?? '')}
          ariaLabel="Select class"
        />
      ) : (
        data.classes[0].isClassTeacher && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            You are the Class Teacher of {data.classes[0].label}.
          </p>
        )
      )}

      {/* Summary cards — real counts and honest em-dashes only */}
      <QuickStats students={students} activeClass={activeClass} classes={data.classes} />

      {/* Roster: search + documented filters + student cards (fee data
          included only when this class is the teacher's own) */}
      <StudentsGrid
        students={students}
        classLabel={activeClass?.label ?? 'Class'}
        isClassTeacher={!!activeClass?.isClassTeacher}
        onSelect={(s) => setSelectedId(s.id)}
      />

      {/* The ONE shared student profile — the same sheet My Class, Fees
          and Behavior open (canonical student, role-scoped sections). */}
      <TeacherStudentProfileSheet
        studentId={selectedId}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null)
        }}
      />
    </PageTransition>
  )
}
