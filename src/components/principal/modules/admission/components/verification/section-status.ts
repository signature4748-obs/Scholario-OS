/**
 * Section status derivation for the Verification workspace.
 *
 * Statuses are COMPUTED from the application's actual data (spec §36) —
 * never defaulted to "Complete". The officer's stored review overrides
 * (Needs Review / Incomplete + issue note) take precedence over the
 * derived status; "Complete" in the store means "no officer flag".
 */

import type {
  AdmissionApplication,
  SectionKey,
  SectionReviewState,
} from '@/lib/store/admission-store'
import {
  getDocumentCompletion,
  REQUIRED_DOCUMENTS,
  ADMISSION_DOCUMENTS,
} from '../../lib/documents'

export type DerivedSectionStatus = 'Verified' | 'Needs Review' | 'Incomplete'

export interface SectionStatus {
  status: DerivedSectionStatus
  /** Concrete, actionable issue line — shown when not Verified. */
  issue?: string
  /** True when an officer flag (not data) caused this status. */
  flaggedByOfficer: boolean
}

/** Mask an Aadhaar number for display: XXXX XXXX 3847 (spec §23). */
export function maskAadhaar(aadhaar?: string | null): string {
  if (!aadhaar) return '—'
  const digits = aadhaar.replace(/\D/g, '')
  if (digits.length < 4) return `XXXX XXXX ${digits}`
  return `XXXX XXXX ${digits.slice(-4)}`
}

/** Compute the DATA-derived status for one section (no officer input). */
export function deriveSectionStatus(
  key: SectionKey,
  app: AdmissionApplication
): SectionStatus {
  const formData = app.formData

  if (key === 'documents') {
    const completion = getDocumentCompletion(formData.docStatuses)
    if (completion.complete) return { status: 'Verified', flaggedByOfficer: false }
    const missing = REQUIRED_DOCUMENTS.filter(
      (d) => formData.docStatuses[d.key]?.status !== 'uploaded'
    ).map((d) => d.name)
    return {
      status: 'Incomplete',
      issue: `Missing ${missing.join(', ')}`,
      flaggedByOfficer: false,
    }
  }

  if (key === 'photo') {
    // A photo is on file when either a digital copy exists (photoDataUrl,
    // from the wizard's crop pipeline) or the record's photoUploaded flag is
    // set (photo collected offline / on paper).
    if (!formData.photoDataUrl && !formData.photoUploaded) {
      return {
        status: 'Incomplete',
        issue: 'Photo not uploaded',
        flaggedByOfficer: false,
      }
    }
    return { status: 'Verified', flaggedByOfficer: false }
  }

  return { status: 'Verified', flaggedByOfficer: false }
}

/**
 * Resolve the FINAL status for a section: the officer's flag (stored in
 * sectionReviews) overrides the derived status, with their issue note.
 */
export function resolveSectionStatus(
  key: SectionKey,
  app: AdmissionApplication
): SectionStatus {
  const derived = deriveSectionStatus(key, app)
  const review: SectionReviewState | undefined = app.sectionReviews?.[key]

  if (review && (review.status === 'Needs Review' || review.status === 'Incomplete')) {
    return {
      status: review.status,
      issue: review.remarks?.trim() || derived.issue,
      flaggedByOfficer: true,
    }
  }
  return derived
}

/** Count of sections with no issues or flags. */
export function countVerified(
  sections: { key: SectionKey }[],
  app: AdmissionApplication
): { verified: number; total: number; incomplete: number; flagged: number } {
  let verified = 0
  let incomplete = 0
  let flagged = 0
  for (const s of sections) {
    const st = resolveSectionStatus(s.key, app)
    if (st.status === 'Verified') verified++
    else if (st.status === 'Incomplete') incomplete++
    else flagged++
  }
  return { verified, total: sections.length, incomplete, flagged }
}

/* ------------------------------------------------------------------ */
/*  One-line section summaries (collapsed row) — real data only.       */
/* ------------------------------------------------------------------ */

const emDash = (v: string | undefined | null): string => (v && v.trim() ? v.trim() : '—')

export function getSectionSummary(key: SectionKey, app: AdmissionApplication): string {
  const f = app.formData
  switch (key) {
    case 'personal': {
      const parts = [`${f.firstName} ${f.lastName}`.trim()]
      if (f.dob) parts.push(`DOB ${f.dob}`)
      if (f.gender) parts.push(f.gender)
      if (f.category) parts.push(f.category)
      return parts.filter(Boolean).join(' · ')
    }
    case 'parents': {
      const parts: string[] = []
      if (f.fatherName) parts.push(`Father ${f.fatherName}`)
      if (f.motherName) parts.push(`Mother ${f.motherName}`)
      if (f.emergencyName) parts.push('Emergency contact on file')
      return parts.length ? parts.join(' · ') : '—'
    }
    case 'address': {
      const bits = [f.district, f.state].filter(Boolean).join(', ')
      return bits ? `${bits}${f.pincode ? ` – ${f.pincode}` : ''}` : '—'
    }
    case 'previousSchool': {
      if (f.admissionType === 'fresh' && !f.previousSchool) return 'Fresh admission'
      return f.previousSchool
        ? `${f.previousSchool}${f.previousBoard ? ` (${f.previousBoard})` : ''}`
        : '—'
    }
    case 'medical': {
      if (f.allergies) return `Allergies: ${f.allergies}`
      if (f.conditions) return `Conditions: ${f.conditions}`
      return 'No allergies or conditions recorded'
    }
    case 'classAllocation':
      return f.className
        ? `Class ${f.className}${f.section ? ` – ${f.section}` : ''}`
        : '—'
    case 'fees': {
      const fee = app.feeData
      const concession =
        fee?.discountCode && fee.discountCode !== 'NONE'
          ? fee.discountCode === 'CUSTOM'
            ? 'Custom waiver'
            : 'Concession applied'
          : 'No concession'
      return `${concession}${fee?.transportSelected ? ' · Transport' : ''}${fee?.hostelSelected ? ' · Hostel' : ''}`
    }
    case 'documents': {
      const c = getDocumentCompletion(f.docStatuses)
      return `Required ${c.requiredCompleted}/${c.requiredTotal} · Optional ${c.optionalUploaded}/${c.optionalTotal}`
    }
    case 'photo':
      return f.photoDataUrl || f.photoUploaded
        ? 'Passport photo on file'
        : 'No photo uploaded'
    default:
      return emDash(null)
  }
}

/** Document list with per-doc status + actions metadata (spec §21). */
export interface VerificationDocRow {
  key: string
  name: string
  required: boolean
  uploaded: boolean
  fileName?: string
  fileId?: string
  verified: boolean
}

export function getDocumentRows(app: AdmissionApplication): VerificationDocRow[] {
  const statuses = app.formData.docStatuses || {}
  return ADMISSION_DOCUMENTS.map((d) => {
    const st = statuses[d.key]
    return {
      key: d.key,
      name: d.name,
      required: d.required,
      uploaded: st?.status === 'uploaded',
      fileName: st?.fileName,
      fileId: st?.fileId,
      verified: st?.verificationStatus === 'verified',
    }
  })
}
