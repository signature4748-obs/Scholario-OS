/**
 * Admission Documents — the single descriptor catalogue + required-document
 * evaluation rules used across the Admissions module (wizard step, review
 * workspace, dossier and issuance gating).
 *
 * Canonical school policy (Wave 2 deep spec §1):
 *   REQUIRED — Student Aadhaar Card (the only policy blocker).
 *   OPTIONAL — Transfer Certificate, Character Certificate, Birth
 *   Certificate, Previous Mark Sheet, Migration Certificate. Optional
 *   documents never block completion; if uploaded they still pass through
 *   the same verification workflow.
 *
 * Completion rule (§2): the Documents step is COMPLETE when
 *   requiredCompleted === requiredTotal
 * — never "uploaded / total", which would wrongly let optional documents
 * block completion. A deferred ("Submit Later") required document is the
 * explicit desk escape hatch: submission proceeds, final enrollment is
 * tracked against it.
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
  { key: 'aadhaar', name: 'Student Aadhaar Card', description: 'UIDAI identity copy', mandatory: true },
  { key: 'tc', name: 'Transfer Certificate (TC)', description: 'Previous school leaving certificate', mandatory: false },
  { key: 'character', name: 'Character Certificate', description: 'Conduct certificate from previous school', mandatory: false },
  { key: 'birthCert', name: 'Birth Certificate', description: 'Municipal or hospital record', mandatory: false },
  { key: 'marksheet', name: 'Previous Mark Sheet', description: 'Last academic year report card', mandatory: false },
  { key: 'migration', name: 'Migration Certificate', description: 'Board migration certificate (Class IX+)', mandatory: false },
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

export interface DocumentsCompletion {
  /** requiredCompleted === requiredTotal (the ONLY completion rule, §2). */
  complete: boolean
  requiredTotal: number
  /** Uploaded OR deferred required documents (deferred = explicit desk decision). */
  requiredCompleted: number
  requiredDeferred: number
  optionalTotal: number
  optionalUploaded: number
}

/**
 * The canonical Documents-step completion (spec §2).
 * Optional uploads are informational only — they never affect `complete`.
 */
export function getDocumentsCompletion(docStatuses: Record<string, DocStatus>): DocumentsCompletion {
  const requiredTotal = REQUIRED_DOCS.length
  let requiredCompleted = 0
  let requiredDeferred = 0
  for (const doc of REQUIRED_DOCS) {
    const st = docStatuses[doc.key]
    if (st && (st.status === 'uploaded' || st.status === 'later')) {
      requiredCompleted++
      if (st.status === 'later') requiredDeferred++
    }
  }
  const optionalTotal = OPTIONAL_DOCS.length
  let optionalUploaded = 0
  for (const doc of OPTIONAL_DOCS) {
    const st = docStatuses[doc.key]
    if (st && st.status === 'uploaded') optionalUploaded++
  }
  return {
    complete: requiredCompleted === requiredTotal && requiredTotal > 0,
    requiredTotal,
    requiredCompleted,
    requiredDeferred,
    optionalTotal,
    optionalUploaded,
  }
}
