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
 *   · summary cards (./quick-stats) — Students, Avg Attendance,
 *     Girls · Boys, Classes, all from the roster payload;
 *   · the roster grid (./students-grid) — class dropdown (single class
 *     or All Classes), search, documented status filters, student
 *     cards, "View profile" sheet. The class selection lives in the
 *     roster's toolbar (Task W3-a) — no separate chip row.
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
import { HubEmptyState, HubModuleSkeleton } from '../shared/hub-stat-cards'
import { FEE_STATUS_META } from './shared'
import { useStudentDirectory } from './hooks'
import { QuickStats } from './quick-stats'
import { StudentsGrid } from './students-grid'
import { directoryStudentToProfile } from './profile-adapter'
import { StudentProfilePage } from '@/components/principal/modules/students/student-profile-page'
import type { DirectoryStudent } from './types'

export function StudentsModule() {
  const [selected, setSelected] = useState<DirectoryStudent | null>(null)
  const { data, error, reload, classId, setClassId, activeClass, students } = useStudentDirectory()

  const handleExport = () => {
    if (students.length === 0) return
    // Fee columns follow the roster's own data boundary: they are
    // included when ANY student on screen carries fee records (class-
    // teacher classes), with per-student blanks where the server sends
    // none — subject teachers export identity + academics only.
    const includeFees = students.some((s) => s.fees != null)
    const header = [
      'Roll No', 'Admission No', 'Name', 'Class', 'Gender', 'Guardian', 'Guardian Phone', 'Attendance %', 'Latest Exam Avg %',
      ...(includeFees ? ['Fee Status', 'Outstanding (INR)'] : []),
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
        ...(includeFees
          ? [s.fees ? FEE_STATUS_META[s.fees.status].label : '', s.fees ? String(s.fees.outstanding) : '']
          : []),
      ]),
    )
    const safeLabel = (activeClass?.label ?? 'all-classes').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    downloadCSVFile(csv, `${safeLabel}-student-list.csv`)
    toast.success('Export ready', {
      description: `${activeClass?.label ?? 'All Classes'} student list · ${students.length} students · CSV`,
    })
  }

  // ── module-level states (the hook above always runs) ────────────────

  // §7–§9 — the ONE canonical Student Profile: the same page the
  // Principal opens, rendered with the server-authorized (role-scoped)
  // payload for this teacher. No separate teacher-only profile page.
  if (selected) {
    const model = directoryStudentToProfile(selected)
    return (
      <StudentProfilePage
        student={model.student}
        detail={model.real}
        visibleTabs={model.visibleTabs}
        onBack={() => setSelected(null)}
        backLabel="Student Directory"
      />
    )
  }

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

      {/* Summary cards — real counts and honest em-dashes only */}
      <QuickStats students={students} activeClass={activeClass} classes={data.classes} />

      {/* Roster: class dropdown + search + documented filters + student
          cards (fee data included only where the teacher is class
          teacher) — the class selection lives in the roster toolbar */}
      <StudentsGrid
        students={students}
        classes={data.classes}
        classId={classId}
        onClassChange={setClassId}
        onSelect={setSelected}
      />
    </PageTransition>
  )
}
