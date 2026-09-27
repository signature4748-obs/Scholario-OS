import type { AppointmentLetterData } from './types'

/**
 * Appointment letter factory — the ONE builder for issued appointment
 * letters (Wave 2.3 §9). Both the store's issue pipeline and the Add
 * Teacher wizard's initial record use it, so a letter issued anywhere
 * has the same shape, the same reference scheme, and the same immutable
 * snapshot semantics.
 *
 * Reference scheme: GWS/APT/{year}/{employeeDigits}-{issueSeq} —
 * deterministic, never random, consistent with previously issued seeds.
 */

/** Default appointment clauses — school policy, not invented per teacher. */
export const APPOINTMENT_DEFAULT_TERMS: string[] = [
  'Adherence to CBSE curriculum guidelines and professional ethics.',
  'Maintain complete confidentiality regarding student academic & psychological records.',
  'Participate actively in co-curricular activities, exam proctoring, and parent-teacher meets.',
  'Notice period of 60 days required prior to resignation during academic session.',
]

export interface AppointmentLetterInput {
  employeeId: string
  teacherName: string
  designation: string
  department: string
  joiningDate: string
  monthlySalary: number
  teacherAddress: string
  /** Issue sequence — 1 for a teacher's first letter, +1 per reissue. */
  issueSeq?: number
  /** Date the letter is issued (ISO yyyy-mm-dd); defaults to today. */
  issueDate?: string
  customTerms?: string[]
  principalName?: string
}

export function createAppointmentLetterSnapshot(
  input: AppointmentLetterInput
): AppointmentLetterData {
  const year = new Date().getFullYear()
  const issueSeq = input.issueSeq ?? 1
  const empDigits = (input.employeeId.match(/\d+/g) || []).join('') || input.employeeId
  const seq = String(issueSeq).padStart(2, '0')

  return {
    id: `APT-GWS-${year}-${empDigits}-${seq}`,
    officialLetterNo: `GWS/APT/${year}/${empDigits}-${seq}`,
    generatedDate: input.issueDate ?? new Date().toISOString().split('T')[0],
    teacherName: input.teacherName,
    employeeId: input.employeeId,
    designation: input.designation,
    department: input.department,
    joiningDate: input.joiningDate,
    monthlySalary: input.monthlySalary,
    annualSalary: input.monthlySalary * 12,
    workingHours: '08:00 AM – 03:30 PM',
    probationMonths: 6,
    noticePeriodDays: 60,
    termsAndConditions:
      input.customTerms && input.customTerms.length > 0
        ? input.customTerms
        : APPOINTMENT_DEFAULT_TERMS,
    principalName: input.principalName ?? 'Dr. Ananya Iyer',
    reportingAuthority: 'Dr. Ananya Iyer, Principal',
    schoolSealAttached: true,
    teacherAddress: input.teacherAddress,
  }
}
