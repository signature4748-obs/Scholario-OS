'use client'

/**
 * AttendanceModule — entry point (canonical server data).
 *
 * Three-section sub-navigation:
 *   - Overview (student attendance + analytics)
 *   - Teachers & Employees (honest empty state — no staff data source yet)
 *   - History (day-level records + exports)
 *
 * The module owns the shared state — selected DATE (null = server today),
 * class filter, active tab — and the single /api/principal/attendance
 * fetch that Overview + History both render from. Every number in this
 * module comes from that canonical snapshot.
 */

import { useCallback, useState } from 'react'
import { PageTransition } from '@/components/shared/ui'
import { toast } from 'sonner'
import { downloadCSVFile, safeFileName } from '@/lib/download-file'
import { toCsv } from '@/lib/csv'
import { AttendanceTabs, type AttendanceTab } from './attendance-tabs'
import { StudentWorkspace } from './student-workspace'
import { StaffAttendanceTab } from './staff-tab'
import { AttendanceHistoryTab } from './history-tab'
import { usePrincipalAttendance } from './data'

export function AttendanceModule() {
  const [activeTab, setActiveTab] = useState<AttendanceTab>('overview')
  // Shared class filter — used by Overview + History (stays in sync)
  const [classFilter, setClassFilter] = useState<string>('all')
  // Shared date — null = "server today" (the snapshot's `date` field is
  // the authoritative today; the first fetch runs without a date param).
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const { snapshot, loading, error, reload } = usePrincipalAttendance(selectedDate)
  const effectiveDate = selectedDate ?? snapshot?.date ?? null

  const onDateChange = useCallback((date: string) => {
    setSelectedDate(date)
  }, [])

  // REAL CSV export of the Overview context (respects the class filter):
  //   - All Classes → the byClass summary rows (exact ClassReport rows)
  //   - Class       → that class's roster + statuses for the selected date
  const handleExport = useCallback(() => {
    if (!snapshot || !effectiveDate) {
      toast.error('Nothing to export yet', {
        description: 'Attendance data is still loading — try again in a moment.',
      })
      return
    }
    const rows: (string | number)[][] = []
    let scope: string
    let header: (string | number)[]
    let base: string

    if (classFilter === 'all') {
      scope = 'All Classes'
      header = ['Date', 'Class', 'Students', 'Recorded', 'Present', 'Absent', 'Late', 'Leave', 'Rate (%)', 'Status']
      base = `attendance-overview-${effectiveDate}`
      for (const c of snapshot.byClass) {
        const pct = c.rate
        const status = pct === null
          ? 'No record'
          : pct >= 95 ? 'Excellent' : pct >= 90 ? 'Good' : pct >= 85 ? 'Average' : 'Needs Attention'
        rows.push([
          effectiveDate, c.classLabel, c.students, c.recorded,
          c.present, c.absent, c.late, c.leave,
          pct ?? '—', status,
        ])
      }
    } else {
      const section = snapshot.sections.find((s) => s.classId === classFilter)
      const breakdown = snapshot.byClass.find((c) => c.classId === classFilter)
      if (!section) {
        toast.error('Nothing to export', { description: 'This class has no roster.' })
        return
      }
      scope = breakdown?.classLabel ?? 'Class'
      header = ['Date', 'Class', 'Roll No', 'Student', 'Status']
      base = `attendance-overview-${effectiveDate}-${scope.replace(/[^a-zA-Z0-9]+/g, '-')}`
      for (const s of section.roster) {
        const status = s.status === 'PRESENT' ? 'Present'
          : s.status === 'LATE' ? 'Late'
          : s.status === 'ABSENT' ? 'Absent'
          : s.status === 'LEAVE' ? 'Leave'
          : 'Not marked'
        rows.push([effectiveDate, section.classLabel, s.rollNo, s.name, status])
      }
    }

    const filename = safeFileName(base, 'csv')
    downloadCSVFile(toCsv(header, rows), filename)
    toast.success('Attendance report exported', {
      description: `${filename} · ${rows.length} ${classFilter === 'all' ? `class summar${rows.length === 1 ? 'y' : 'ies'}` : `student${rows.length === 1 ? '' : 's'}`} · ${scope}`,
    })
  }, [snapshot, effectiveDate, classFilter])

  // "View full attendance" (heatmap CTA) → switch to History with the
  // picked day pre-selected (shared date state).
  const handleViewFullAttendance = useCallback((dateStr: string) => {
    setSelectedDate(dateStr)
    setActiveTab('history')
  }, [])

  return (
    <PageTransition className="space-y-4">
      {/* Sub-navigation tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <AttendanceTabs value={activeTab} onValueChange={setActiveTab} />
      </div>

      {/* Active tab content */}
      {activeTab === 'overview' && (
        <StudentWorkspace
          snapshot={snapshot}
          loading={loading}
          error={error}
          reload={reload}
          selectedDate={selectedDate}
          onDateChange={onDateChange}
          classFilter={classFilter}
          setClassFilter={setClassFilter}
          onExport={handleExport}
          onViewFullAttendance={handleViewFullAttendance}
        />
      )}

      {activeTab === 'staff' && (
        <StaffAttendanceTab />
      )}

      {activeTab === 'history' && (
        <AttendanceHistoryTab
          snapshot={snapshot}
          loading={loading}
          error={error}
          reload={reload}
          selectedDate={selectedDate}
          onDateChange={onDateChange}
          classFilter={classFilter}
          setClassFilter={setClassFilter}
        />
      )}
    </PageTransition>
  )
}
