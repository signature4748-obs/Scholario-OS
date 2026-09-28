'use client'

/**
 * students/student-card — thin adapter over the ONE shared directory card
 * (Task W3-a). The visual design lives in
 * `@/components/shared/student-directory/student-card` — including the
 * three-band structure (identity → metrics → footer), the
 * collision-safety rules and the motion choreography; see that file's
 * doc block. This adapter only maps the teacher's `DirectoryStudent`
 * DTO onto the role-agnostic `StudentCardData`:
 *
 *   · attendance   real per-student summary (pct + record count)
 *   · latestAvg    the latest exam with entered marks, else null
 *   · fees         present ONLY for the teacher's class-teacher classes
 *                  (server decision) — null simply omits the column
 *   · status       the documented At Risk / Steady rule (./shared)
 *
 * students-grid keeps importing this named `StudentCard` export.
 */

import {
  StudentCard as SharedStudentCard,
  type StudentCardData,
} from '@/components/shared/student-directory/student-card'
import { statusOf } from './shared'
import type { DirectoryStudent } from './types'

/** DirectoryStudent → the role-agnostic shared-card DTO. */
export function toStudentCardData(s: DirectoryStudent): StudentCardData {
  return {
    id: s.id,
    name: s.name,
    classLabel: s.classLabel,
    rollNo: s.rollNo,
    admissionNo: s.admissionNo,
    attendance: { pct: s.attendance.pct, records: s.attendance.records },
    latestAvg: s.latestExam ? { pct: s.latestExam.averagePct, examName: s.latestExam.examName } : null,
    fees: s.fees
      ? { status: s.fees.status, outstanding: s.fees.outstanding, itemCount: s.fees.items.length }
      : null,
    guardianName: s.guardianName,
    status: statusOf(s),
  }
}

export function StudentCard({
  student: s,
  index,
  onSelect,
}: {
  student: DirectoryStudent
  index: number
  onSelect: (s: DirectoryStudent) => void
}) {
  return <SharedStudentCard student={toStudentCardData(s)} index={index} onSelect={() => onSelect(s)} />
}
