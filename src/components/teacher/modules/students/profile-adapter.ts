/**
 * profile-adapter — maps a server-authorized DirectoryStudent (teacher
 * payload) onto the canonical Student Profile (production pass §7–§9).
 *
 * The SAME profile component the Principal uses renders the teacher's
 * student — through a role-aware lens: the record carries only what the
 * server sent, the `real` detail carries the richer server records, and
 * the returned tab allowlist reflects the teacher's scope:
 *
 *   · Class teacher (the payload carries fees) → overview · academics ·
 *     attendance · fees · parents
 *   · Subject teacher → overview · academics · attendance
 *
 * Nothing is invented: unknown identity fields render "Not recorded" and
 * unknown sections simply never appear.
 */

import type { StudentRecord, Gender, FeeStatus } from '@/lib/store/students-store'
import type { StudentProfileRealData } from '@/components/principal/modules/students/profile-real-data'
import type { TabName } from '@/components/principal/modules/students/student-profile-page'
import type { DirectoryStudent } from './types'

/** "Grade 9 - A" → { className: "Grade 9", section: "A" }; "Grade 9" → no section. */
function splitClassLabel(label: string): { className: string; section: string } {
  const idx = label.lastIndexOf(' - ')
  if (idx === -1) return { className: label, section: '' }
  return { className: label.slice(0, idx), section: label.slice(idx + 3) }
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0]?.toUpperCase())
    .slice(0, 2)
    .join('')
}

function mapGender(g: string | null): Gender {
  if (g === 'MALE') return 'Male'
  if (g === 'FEMALE') return 'Female'
  // Display-only placeholder — renders as "Not recorded" in real mode.
  return '—' as Gender
}

function mapFeeStatus(fees: DirectoryStudent['fees']): FeeStatus {
  if (!fees) return 'Paid'
  switch (fees.status) {
    case 'PAID': return 'Paid'
    case 'PARTIAL': return 'Partial'
    default: return 'Pending'
  }
}

export interface TeacherProfileModel {
  student: StudentRecord
  real: StudentProfileRealData
  visibleTabs: readonly TabName[]
  /** true when the teacher is the class teacher of this student's class. */
  isClassTeacher: boolean
}

export function directoryStudentToProfile(dir: DirectoryStudent): TeacherProfileModel {
  const { className, section } = splitClassLabel(dir.classLabel)
  const isClassTeacher = !!dir.fees

  const student: StudentRecord = {
    id: dir.id,
    admissionNo: dir.admissionNo ?? '—',
    rollNo: dir.rollNo ?? '—',
    name: dir.name,
    avatar: initialsOf(dir.name),
    gender: mapGender(dir.gender),
    classId: '',
    className,
    section,
    dob: dir.dob ?? '',
    bloodGroup: dir.bloodGroup ?? '—',
    category: '—',
    fatherName: '—',
    motherName: '—',
    guardianPhone: dir.guardianPhone ?? '',
    guardianEmail: '',
    guardianName: dir.guardianName ?? '',
    city: '—',
    state: '—',
    hostel: false,
    disciplinePoints: 0,
    address: dir.address ?? '',
    admissionDate: '',
    previousSchool: '—',
    status: 'Active',
    attendance: dir.attendance.pct ?? 0,
    feeStatus: mapFeeStatus(dir.fees),
    feePaid: dir.fees?.totalPaid ?? 0,
    feeTotal: dir.fees?.totalBilled ?? 0,
    transport: false,
    scholarship: 0,
    medical: '—',
    academics: {
      overallGrade: '—',
      overallPercent: dir.latestExam?.averagePct ?? 0,
      rankInClass: 0,
      subjects: [],
    },
    attendanceTrend: [],
    achievements: [],
    disciplineRecords: [],
    documents: [],
    timeline: [],
  }

  const real: StudentProfileRealData = {
    email: dir.email,
    dob: dir.dob,
    gender: dir.gender,
    bloodGroup: dir.bloodGroup,
    address: dir.address,
    guardianPhone: dir.guardianPhone,
    attendance: dir.attendance,
    latestExam: dir.latestExam,
    fees: dir.fees,
  }

  const visibleTabs: readonly TabName[] = isClassTeacher
    ? ['overview', 'academics', 'attendance', 'fees', 'parents']
    : ['overview', 'academics', 'attendance']

  return { student, real, visibleTabs, isClassTeacher }
}
