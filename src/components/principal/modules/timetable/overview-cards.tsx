'use client'

/**
 * OverviewCards — compact summary strip for the Timetable workspace.
 *
 * Brief section 6: Use the shared `SummaryCard` component (same as
 * Admissions/Teachers/Students & Classes). Remove jargon like "Tenant
 * Isolation Verified". Show only values backed by actual data.
 */
import { Clock, Building, Users, AlertTriangle } from 'lucide-react'
import { SummaryCard, SummaryCardGrid } from '../shared/summary-card'
import { teachers } from '@/lib/mock/teachers'
import { type TimetableSlot } from './data'

export function OverviewCards({ slots, conflictCount }: { slots: TimetableSlot[]; conflictCount: number }) {
  const roomsUsed = new Set(slots.map((s) => s.room)).size
  const facultyAssigned = new Set(slots.map((s) => s.teacherId)).size
  // Classes present in the LIVE schedule (server-hydrated) — never the
  // static seed list, so the count matches what every role actually sees.
  const classesScheduled = new Set(slots.map((s) => s.className)).size

  return (
    <SummaryCardGrid columns={4}>
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
        sub="Labs & classrooms"
        tone="cyan"
        icon={<Building className="h-4 w-4" />}
        delay={0.04}
      />
      <SummaryCard
        label="Faculty Assigned"
        value={facultyAssigned}
        sub={`of ${teachers.length} active`}
        tone="emerald"
        icon={<Users className="h-4 w-4" />}
        delay={0.08}
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
