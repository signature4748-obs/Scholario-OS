'use client'

/**
 * TransportTab — the student's transport picture, read from the ONE
 * canonical transport registry (`useTransportStore` assignments — the
 * same records the Transport module manages via assignStudent /
 * changeRoute), not a duplicated route string on the student record.
 *
 *   · opted in + assigned   → real route · stop · vehicle · driver rows
 *   · opted in, unassigned  → honest "route not assigned yet" state
 *   · not opted in          → the Transport Not Opted empty state
 */

import { Bus, MapPin, User, Truck } from 'lucide-react'
import type { StudentRecord } from '@/lib/store/students-store'
import { useTransportStore } from '@/lib/store/transport-store'
import { Section, InfoRow } from './shared'

type Props = { student: StudentRecord }

export function TransportTab({ student }: Props) {
  // The canonical assignment for THIS student (id-keyed, never a name match).
  const assignment = useTransportStore((s) =>
    s.assignments.find((a) => a.studentId === student.id && a.status === 'Assigned') ?? null,
  )

  return (
    <div className="space-y-4">
      <Section title="Transport Details">
        {!student.transport ? (
          <div className="rounded-lg border border-border bg-card/40 p-4 text-center">
            <Bus className="h-8 w-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-medium">Transport Not Opted</p>
            <p className="text-xs text-muted-foreground mt-1">This student does not use school transport.</p>
          </div>
        ) : assignment ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Route" value={assignment.routeName} />
              <InfoRow icon={<Bus className="h-3.5 w-3.5" />} label="Stop" value={assignment.stop || 'Not specified'} />
              <InfoRow icon={<Truck className="h-3.5 w-3.5" />} label="Vehicle" value={assignment.vehicleNo} />
              <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Driver" value={assignment.driverName} />
            </div>
            <p className="text-[10px] text-muted-foreground px-1">
              Assignment managed by the Transport module — route changes there update this view.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-center">
            <Bus className="h-8 w-8 text-amber-600 dark:text-amber-400 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-medium">Route not assigned yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Transport is opted in, but no route has been assigned to this student.
            </p>
          </div>
        )}
      </Section>
    </div>
  )
}
