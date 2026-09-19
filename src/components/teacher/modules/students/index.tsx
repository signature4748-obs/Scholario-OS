'use client'

/**
 * students/index — the Student Directory module entry point (Task 2-c
 * rebuild). `teacher-panel/module-router.tsx` imports the named
 * `StudentsModule` export and renders it with no props.
 *
 * Composition (same card language as Marks Entry / Class Attendance —
 * the shell's top bar already titles the page, content never repeats
 * it with a giant H1):
 *   · quiet context line — the authorized classes + their real student
 *     counts ("Grade 9 - A · 11 students · Grade 10 - A · 8 students"),
 *     with the CSV export action;
 *   · class tabs — the real authorized class list; classes the teacher
 *     is class teacher of carry an explicit "Class Teacher" chip (never
 *     shown for subject-only classes);
 *   · summary cards (./quick-stats) — Students, Avg Attendance,
 *     Girls · Boys, Classes, all from the roster payload;
 *   · the roster grid (./students-grid) — search, documented status
 *     filters, student cards, "View profile" sheet.
 *
 * Everything is fed by ONE GET /api/teacher/students call (hook in
 * ./hooks) — real, tenant-scoped data only.
 */

import { useState } from 'react'
import { AlertTriangle, Download, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { ModuleToolbar } from '../../teacher-panel/module-toolbar'
import { GlassCard, PageTransition } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import { toCsv } from '@/lib/csv'
import { downloadCSVFile } from '@/lib/download-file'
import { cn } from '@/lib/utils'
import { HubEmptyState, HubModuleSkeleton } from '../shared/hub-stat-cards'
import { FEE_STATUS_META } from './shared'
import { useStudentDirectory } from './hooks'
import { QuickStats } from './quick-stats'
import { StudentsGrid } from './students-grid'
import { StudentProfileSheet } from './student-profile-sheet'
import type { DirectoryStudent } from './types'

export function StudentsModule() {
  const [selected, setSelected] = useState<DirectoryStudent | null>(null)
  const { data, error, reload, classId, setClassId, activeClass, students } = useStudentDirectory()

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

  // The quiet context line: exactly the classes this teacher is
  // authorized to view, with their real student counts.
  const contextLine = data.classes
    .map((c) => `${c.label} · ${c.studentCount} student${c.studentCount === 1 ? '' : 's'}`)
    .join('  ·  ')

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

      {/* Class selector — the real authorized classes. The two views are
          explicit: an emerald “Class Teacher” chip for the appointed
          class, a muted “Teaches …” chip for subject-only classes. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Select a class">
        {data.classes.map((c) => {
          const isActive = classId === c.id
          const subjectChip =
            c.subjects.length > 0
              ? `Teaches ${c.subjects[0]}${c.subjects.length > 1 ? ` +${c.subjects.length - 1}` : ''}`
              : null
          return (
            <button
              key={c.id}
              aria-pressed={isActive}
              onClick={() => setClassId(c.id)}
              className={cn(
                'flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
              )}
            >
              {c.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                  isActive ? 'bg-primary-foreground/20' : 'bg-muted',
                )}
              >
                {c.studentCount}
              </span>
              {c.isClassTeacher ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                    isActive ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary',
                  )}
                >
                  Class Teacher
                </span>
              ) : (
                subjectChip && (
                  <span
                    className={cn(
                      'max-w-[150px] truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                      isActive ? 'bg-primary-foreground/20' : 'bg-muted',
                    )}
                    title={c.subjects.join(', ')}
                  >
                    {subjectChip}
                  </span>
                )
              )}
            </button>
          )
        })}
      </div>

      {/* Summary cards — real counts and honest em-dashes only */}
      <QuickStats students={students} activeClass={activeClass} classes={data.classes} />

      {/* Roster: search + documented filters + student cards (fee data
          included only when this class is the teacher's own) */}
      <StudentsGrid
        students={students}
        classLabel={activeClass?.label ?? 'Class'}
        isClassTeacher={!!activeClass?.isClassTeacher}
        onSelect={setSelected}
      />

      {/* Student profile sheet */}
      <StudentProfileSheet student={selected} onClose={() => setSelected(null)} />
    </PageTransition>
  )
}
