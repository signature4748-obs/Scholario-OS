/**
 * Admission Documents — the single descriptor catalogue + required-document
 * evaluation rules used across the Admissions module (wizard step, review
 * workspace, dossier and issuance gating).
 *
 * Wave 2 rules (spec §2/§3):
 *   REQUIRED documents are policy blockers — an admission cannot be
 *   finalized while one is missing, UNLESS it was explicitly deferred
 *   ("Submit Later") by the admission desk.
 *   OPTIONAL documents never block anything, but if uploaded they still
 *   pass through the same verification workflow.
 */

import type { DocStatus } from '../types'

export interface AdmissionDocDescriptor {
  key: string
  name: string
  /** One short line — what the document is. */
  description: string
  /** Policy blocker when missing (per school admission policy). */
  mandatory: boolean
}

/**
 * The document catalogue. Order within each group is the display order.
 * Required set mirrors the school's configured admission policy.
 */
export const ADMISSION_DOCS: AdmissionDocDescriptor[] = [
  { key: 'birthCert', name: 'Birth Certificate', description: 'Municipal or hospital record', mandatory: true },
  { key: 'tc', name: 'Transfer Certificate (TC)', description: 'Previous school leaving certificate', mandatory: true },
  { key: 'aadhaar', name: 'Student Aadhaar Card', description: 'UIDAI identity copy', mandatory: true },
  { key: 'marksheet', name: 'Previous Class Marksheet', description: 'Last academic year report card', mandatory: true },
  { key: 'migration', name: 'Migration Certificate', description: 'Board migration certificate (Class IX+)', mandatory: false },
  { key: 'character', name: 'Character Certificate', description: 'Conduct certificate from previous school', mandatory: false },
]

export const REQUIRED_DOCS = ADMISSION_DOCS.filter((d) => d.mandatory)
export const OPTIONAL_DOCS = ADMISSION_DOCS.filter((d) => !d.mandatory)

export interface DocGroupSummary {
  total: number
  uploaded: number
  deferred: number
  notUploaded: number
  /** Only meaningful when verification workflow is enabled. */
  verified: number
  pending: number
  rejected: number
  replaceRequested: number
}

export function summarizeDocGroup(
  docs: AdmissionDocDescriptor[],
  docStatuses: Record<string, DocStatus>,
  verificationEnabled: boolean,
): DocGroupSummary {
  const s: DocGroupSummary = { total: docs.length, uploaded: 0, deferred: 0, notUploaded: 0, verified: 0, pending: 0, rejected: 0, replaceRequested: 0 }
  for (const doc of docs) {
    const st = docStatuses[doc.key]
    if (!st || st.status === 'pending') { s.notUploaded++; continue }
    if (st.status === 'later') { s.deferred++; continue }
    if (st.status === 'uploaded') {
      s.uploaded++
      if (verificationEnabled) {
        if (st.verificationStatus === 'verified') s.verified++
        else if (st.verificationStatus === 'rejected') s.rejected++
        else if (st.verificationStatus === 'replace_requested') s.replaceRequested++
        else s.pending++
      }
    }
  }
  return s
}

export interface RequiredDocIssue {
  doc: AdmissionDocDescriptor
  /** 'missing' = not uploaded and not deferred · 'deferred' = explicit Submit Later */
  kind: 'missing' | 'deferred'
}

/**
 * Evaluate the required-document policy for an application.
 * Returns the list of required documents that are not yet uploaded,
 * distinguishing hard blockers (missing) from deferred ones (Submit Later).
 */
export function evaluateRequiredDocs(
  docStatuses: Record<string, DocStatus>,
): RequiredDocIssue[] {
  const issues: RequiredDocIssue[] = []
  for (const doc of REQUIRED_DOCS) {
    const st = docStatuses[doc.key]
    if (!st || st.status === 'pending') issues.push({ doc, kind: 'missing' })
    else if (st.status === 'later') issues.push({ doc, kind: 'deferred' })
  }
  return issues
}

/** True when submission/finalization must be blocked (a required doc is missing). */
export function requiredDocsBlockSubmission(docStatuses: Record<string, DocStatus>): boolean {
  return evaluateRequiredDocs(docStatuses).some((i) => i.kind === 'missing')
}
