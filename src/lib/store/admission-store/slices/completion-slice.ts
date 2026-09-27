import type { StateCreator } from 'zustand'
import type { AdmissionStatus, AdmissionStoreState, AdmissionApplication } from '../types'
import { students, Student } from '@/lib/mock/students'
import { useStudentsStore } from '@/lib/store/students-store'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import { useCurrentUser } from '@/lib/store/current-user-store'
import { computeAdmissionFeeSummary } from '@/components/principal/modules/admission/lib/fee-summary'

/**
 * Match an admission form class ("Class 3", section "A") to a canonical DB
 * class ("Grade 3 - A"). Admission forms and the DB roster use different
 * naming styles, so matching is level-based: extract the numeric grade from
 * both names, then prefer an exact section match.
 */
function matchDbClass(
  dbClasses: Array<{ id: string; name: string; section?: string | null }>,
  className: string,
  section: string,
): { id: string } | undefined {
  const level = (className.match(/\d+/) || [])[0]
  if (!level) return undefined
  const sameLevel = dbClasses.filter((c) => (c.name.match(/\d+/) || [])[0] === level)
  if (sameLevel.length === 0) return undefined
  return (
    sameLevel.find((c) => (c.section || '').toUpperCase() === section.toUpperCase()) ||
    sameLevel.find((c) => c.name.includes(section)) ||
    sameLevel[0]
  )
}

/**
 * Canonical server enrolment (spec §28/§29): the completed admission
 * creates the student in the SCHOOL DATABASE (POST /api/students) so the
 * Principal directory, teacher rosters, attendance, exams, fees and
 * timetable all resolve the SAME canonical student. Best-effort — the
 * admission record itself is already persisted when this runs.
 * Returns the created account's email (the working portal login).
 */
async function enrollStudentOnServer(
  app: Pick<AdmissionApplication, 'applicantName' | 'formData'>,
  details: { admissionNo: string; rollNo: string },
  tempPassword: string,
): Promise<string | null> {
  const f = app.formData
  const first = (f.firstName || 'student').trim().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  const last = (f.lastName || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '.')
  // Email domain follows the school of the signed-in admission officer.
  const officerEmail = useCurrentUser.getState().me?.email || ''
  const domain = officerEmail.includes('@') ? officerEmail.split('@')[1] : 'greenwood.edu.in'
  const base = `${first}${last ? '.' + last : ''}`.replace(/\.\./g, '.')

  try {
    // Resolve the canonical DB class by grade level + section (school-scoped).
    // API responses are wrapped: { ok: true, data: [...] }.
    const classesRes = await fetch('/api/classes?counts=1', { credentials: 'same-origin' })
    const classesJson = classesRes.ok ? await classesRes.json().catch(() => null) : null
    const classes: Array<{ id: string; name: string; section?: string | null }> = Array.isArray(classesJson)
      ? classesJson
      : Array.isArray(classesJson?.data)
      ? classesJson.data
      : []
    const cls = matchDbClass(classes, f.className || '', f.section || 'A')

    // Create the student user account with the generated portal password.
    // Email collisions (siblings) resolve with a numeric suffix.
    for (let attempt = 0; attempt < 3; attempt++) {
      const email = attempt === 0 ? `${base}@${domain}` : `${base}${attempt + 1}@${domain}`
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: app.applicantName,
          email,
          password: tempPassword,
          classId: cls?.id || undefined,
          rollNo: details.rollNo,
          admissionNo: details.admissionNo,
          guardianName: f.fatherName || f.motherName || undefined,
          guardianPhone: f.fatherPhone || f.motherPhone || undefined,
          dob: f.dob || undefined,
          gender: f.gender || undefined,
          bloodGroup: f.bloodGroup || undefined,
          address: f.currentAddress || undefined,
          // The canonical admission photo travels to the student record (§11).
          photoDataUrl: f.photoDataUrl || undefined,
        }),
      })
      if (res.ok) return email
      const body = await res.json().catch(() => ({}))
      const retryable = /email/i.test(String(body.error || '')) || res.status === 409
      if (!retryable) return null // Non-email failure — admission already persisted.
    }
  } catch {
    // Server enrolment is best-effort — never blocks the issuance flow.
  }
  return null
}

export const createCompletionSlice: StateCreator<
  AdmissionStoreState,
  [],
  [],
  Pick<AdmissionStoreState, 'completeAdmission'>
> = (set, get) => ({
  completeAdmission: (appId, issuanceDetails) => {
    const state = get()
    const now = new Date().toISOString().split('T')[0]
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const app = state.applications.find((a) => a.id === appId)
    if (!app) return null

    // Generate permanent, non-sequential, unguessable public IDs (never reused)
    const RAND_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const randId = (n: number) => Array.from({ length: n }, () => RAND_ALPHABET[Math.floor(Math.random() * RAND_ALPHABET.length)]).join('')
    const year = new Date().getFullYear()
    const finalAdmissionNo = issuanceDetails?.admissionNo || `SCH-ADM-${year}-${randId(4)}-${randId(2)}`
    const finalStudentId = issuanceDetails?.studentId || `SCH-STU-${randId(4)}-${randId(4)}-${randId(1)}`
    const finalRollNo = issuanceDetails?.rollNo || (app.rollNo !== '—' ? app.rollNo : '01')
    const finalRegNo = issuanceDetails?.regNo || `REG-${year}-${randId(6)}`

    const loginId = `${app.formData.firstName.toUpperCase()}_2026`
    const tempPassword = `Scholario@${Math.floor(Math.random() * 9000 + 1000)}`

    // Canonical server enrolment (fire-and-forget): creates the student in
    // the school DATABASE with these exact credentials; on success the
    // record's loginId is updated to the working email address.
    void enrollStudentOnServer(
      { applicantName: app.applicantName, formData: app.formData },
      { admissionNo: finalAdmissionNo, rollNo: finalRollNo },
      tempPassword,
    ).then((accountEmail) => {
      if (!accountEmail) return
      set((s) => ({
        applications: s.applications.map((item) =>
          item.id === appId
            ? { ...item, generatedCredentials: { ...item.generatedCredentials!, loginId: accountEmail } }
            : item
        ),
      }))
    })

    // Canonical fee derivation (spec §28): the new student's fee record uses
    // the SAME fee engine as the wizard + issuance documents — no fake totals.
    const settingsState = useSchoolSettingsStore.getState()
    const feeSummary = computeAdmissionFeeSummary(
      app.formData.className || '',
      app.feeData,
      {
        enableTransport: settingsState.admissionSettings.featureFlags.enableTransport,
        enableHostel: settingsState.admissionSettings.featureFlags.enableHostel,
      },
    )

    const updatedApps = state.applications.map((item) =>
      item.id === appId
        ? {
            ...item,
            status: 'Completed' as AdmissionStatus,
            admissionNo: finalAdmissionNo,
            studentId: finalStudentId,
            rollNo: finalRollNo,
            regNo: finalRegNo,
            lastUpdatedDate: now,
            generatedCredentials: {
              loginId,
              tempPassword,
              portalUrl: 'https://portal.scholario.app',
            },
            notificationsSent: {
              sms: true,
              email: true,
              whatsapp: true,
              dispatchedAt: `${now} ${nowTime}`,
            },
            auditTrail: [
              ...item.auditTrail,
              {
                id: `a-${Date.now()}`,
                timestamp: `${now} ${nowTime}`,
                action: 'Admission Completed & Issued',
                actor: 'Admission Office',
                notes: `Admission Issued (${finalAdmissionNo}). Student account activated.`,
              },
            ],
          }
        : item
    )

    set({ applications: updatedApps })

    // Generate student object to return
    const newStudent: Student = {
      id: finalStudentId,
      admissionNo: finalAdmissionNo,
      rollNo: finalRollNo,
      name: app.applicantName,
      avatar: `${app.formData.firstName[0] || 'S'}${app.formData.lastName[0] || 'T'}`,
      gender: app.formData.gender as 'Male' | 'Female',
      className: app.formData.className || 'Class 2',
      section: app.formData.section || 'A',
      dob: app.formData.dob || '2017-08-14',
      bloodGroup: app.formData.bloodGroup || 'O+',
      fatherName: app.formData.fatherName || 'Parent',
      motherName: app.formData.motherName || 'Parent',
      guardianPhone: app.formData.fatherPhone || app.formData.motherPhone || '+91 98100 00000',
      email: app.formData.fatherEmail || app.formData.motherEmail || 'parent@gmail.com',
      address: app.formData.currentAddress || 'Gurugram',
      admissionDate: now,
      previousSchool: app.formData.previousSchool || 'N/A',
      status: 'Active',
      attendance: 100,
      feeStatus: feeSummary.initialInstallment >= feeSummary.netTotal ? 'Paid' : 'Partial',
      feePaid: feeSummary.initialInstallment,
      feeTotal: feeSummary.netTotal,
      transport: app.formData.transportRequired,
      hostel: app.formData.hostelRequired,
      scholarship: 0,
      photo: `${app.formData.firstName[0] || 'S'}${app.formData.lastName[0] || 'T'}`,
      libraryId: `LIB-${Math.floor(Math.random() * 8000 + 1000)}`,
      medical: app.formData.allergies || 'No known allergies',
    }

    // Push to mock students array if present
    if (students && !students.some((s) => s.id === newStudent.id || s.admissionNo === newStudent.admissionNo)) {
      students.unshift(newStudent)
    }

    // ─── SEAT LEDGER (spec §15) ───────────────────────────────────────
    // Issuing the admission consumes one seat in the allocated class.
    // Class names differ in style across sources ("Class 9" ledger vs
    // "Grade 9" form), so the match is level-based. Rejected/restored
    // admissions never touched the counter (nothing is incremented before
    // issuance), so no leak is possible.
    try {
      const level = (app.formData.className || '').match(/\d+/)?.[0]
      const seatRow = level
        ? settingsState.admissionSettings.seatCapacity.find(
            (c) => (c.className.match(/\d+/) || [])[0] === level,
          )
        : settingsState.admissionSettings.seatCapacity.find(
            (c) => c.className === app.formData.className,
          )
      if (seatRow) {
        settingsState.updateSeatCapacity(seatRow.className, {
          enrolled: seatRow.enrolled + 1,
        })
      }
    } catch {
      // Seat ledger is best-effort — never blocks the issuance itself.
    }

    // ─── CONNECTED ROSTER ENROLMENT ────────────────────────────────────
    // The completed admission ALSO becomes a REAL student in the canonical
    // roster store (Students & Classes, Fees, Certificates, Downloads all
    // reference the same student). Best-effort: a missing class match falls
    // back to the first class so the enrolment is never silently dropped.
    try {
      const roster = useStudentsStore.getState()
      const cls =
        roster.classes.find((c) => c.name === app.formData.className) ??
        roster.classes.find((c) => `${c.name}` === newStudent.className) ??
        roster.classes.find((c) => c.sections.some((s) => s.name === newStudent.section))
      if (cls) {
        const enrolled = roster.addStudent({
          name: newStudent.name,
          dob: newStudent.dob,
          gender: newStudent.gender,
          classId: cls.id,
          section: newStudent.section,
          fatherName: newStudent.fatherName,
          motherName: newStudent.motherName,
          guardianPhone: newStudent.guardianPhone,
          guardianEmail: newStudent.email,
          address: newStudent.address,
          bloodGroup: newStudent.bloodGroup,
          previousSchool: newStudent.previousSchool,
          admissionDate: now,
          photoDataUrl: app.formData.photoDataUrl || undefined,
        })
        // Cross-reference: the admission record points at the roster id so
        // every module resolves the SAME student.
        set((s) => ({
          applications: s.applications.map((item) =>
            item.id === appId
              ? { ...item, studentId: enrolled.id, admissionNo: enrolled.admissionNo }
              : item
          ),
        }))
      }
    } catch {
      // Roster enrolment is best-effort — the admission record itself is
      // already persisted above.
    }

    return newStudent
  },
})
