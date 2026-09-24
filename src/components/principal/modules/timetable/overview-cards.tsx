'use client'

/**
 * OverviewCards — compact summary strip for the Timetable workspace.
 *
 * Brief section 6: Use the shared `SummaryCard` component (same as
 * Admissions/Teachers/Students & Classes). Remove jargon like "Tenant
 * Isolation Verified". Show only values backed by actual data.
 */
import { Clock, Building, Users, AlertTriangle, BookCheck } from 'lucide-react'
import { SummaryCard, SummaryCardGrid } from '../shared/summary-card'
import { useTeacherRosterStore } from '@/lib/store/teacher-roster-store'
import { useAcademicConfigStore } from '@/lib/academic-config/client'
import { type TimetableSlot } from './data'

export function OverviewCards({ slots, conflictCount }: { slots: TimetableSlot[]; conflictCount: number }) {
  // Real faculty roster (server-backed; mock fallback until it resolves)
  const teachers = useTeacherRosterStore((s) => s.teachers)
  // Principal's subject configuration (ACTIVE CSA) — the single source the
  // slot editor schedules against. Counts distinct configured subjects.
  const academicConfig = useAcademicConfigStore((s) => s.config)
  const roomsUsed = new Set(slots.map((s) => s.room)).size
  const facultyAssigned = new Set(slots.map((s) => s.teacherId)).size
  // Classes present in the LIVE schedule (server-hydrated) — never the
  // static seed list, so the count matches what every role actually sees.
  const classesScheduled = new Set(slots.map((s) => s.className)).size
  const configuredSubjects = new Set(
    (academicConfig?.classes ?? []).flatMap((c) => c.subjects.map((s) => s.name)),
  ).size

  return (
    <SummaryCardGrid columns={5}>
      <SummaryCard
        label="Active Slots"
        value={slots.length}
        sub={`Across ${classesScheduled} classes`}
        tone="violet"
        icon={<Clock className="h-4 w-4" />}
        delay={0}
      />
      <SummaryCard
        label="Rooms Used"
        value={roomsUsed}
        sub="Class homerooms"
        tone="cyan"
        icon={<Building className="h-4 w-4" />}
        delay={0.04}
      />
      <SummaryCard
        label="Faculty Assigned"
        value={facultyAssigned}
        sub={`of ${teachers.length} on roster`}
        tone="emerald"
        icon={<Users className="h-4 w-4" />}
        delay={0.08}
      />
      <SummaryCard
        label="Configured Subjects"
        value={configuredSubjects}
        sub={academicConfig ? 'From subject configuration' : 'Configuration loading…'}
        tone={configuredSubjects > 0 ? 'amber' : 'slate'}
        icon={<BookCheck className="h-4 w-4" />}
        delay={0.1}
      />
      <SummaryCard
        label="Conflicts"
        value={conflictCount}
        sub={conflictCount === 0 ? 'No conflicts' : 'Needs resolution'}
        tone={conflictCount === 0 ? 'emerald' : 'rose'}
        icon={<AlertTriangle className="h-4 w-4" />}
        delay={0.12}
      />
    </SummaryCardGrid>
  )
}
