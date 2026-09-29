'use client'

/**
 * MedicalTab — the student's medical note and emergency contact
 * (Principal store view). An absent medical note renders an honest
 * "no conditions on record" state rather than a placeholder dash.
 */

import { Phone, Stethoscope, User } from 'lucide-react'
import type { StudentRecord } from '@/lib/store/students-store'
import { Section, InfoRow } from './shared'

type Props = { student: StudentRecord }

function notRecorded(v: string | null | undefined): boolean {
  return !v || v.trim() === '' || v === '—'
}

export function MedicalTab({ student }: Props) {
  const hasMedical = !notRecorded(student.medical)
  const hasGuardian = !notRecorded(student.guardianName)
  const hasPhone = !notRecorded(student.guardianPhone)

  return (
    <div className="space-y-4">
      <Section title="Medical Information">
        {hasMedical ? (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3">
            <Stethoscope className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
            <p className="text-sm">{student.medical}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card/40 p-4 flex items-center gap-3">
            <Stethoscope className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No medical conditions on record.</p>
          </div>
        )}
      </Section>
      <Section title="Emergency Contact">
        {hasGuardian || hasPhone ? (
          <div className="grid grid-cols-2 gap-2">
            <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Guardian" value={hasGuardian ? student.guardianName : 'Not recorded'} />
            <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={hasPhone ? student.guardianPhone : 'Not recorded'} />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card/40 p-4 text-center">
            <p className="text-sm font-medium">No emergency contact on record</p>
            <p className="text-xs text-muted-foreground mt-1">Guardian details have not been captured for this student.</p>
          </div>
        )}
      </Section>
    </div>
  )
}
