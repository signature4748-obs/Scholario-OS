/**
 * Canonical Admission Document Policy — single source of truth.
 *
 * REQUIRED (exactly one): Student Aadhaar Card. It is the ONLY document
 * that gates application completion / submission.
 *
 * OPTIONAL (5): Transfer Certificate, Character Certificate, Birth
 * Certificate, Previous Mark Sheet, Migration Certificate. Informational
 * only — an application is COMPLETE without them and they never block
 * submission.
 *
 * Completion rule: requiredCompleted === requiredTotal (never
 * uploaded/total — optional documents must not be able to block an
 * application).
 */

export interface AdmissionDocumentDef {
  key: string
  name: string
  required: boolean
}

/** The one document every application must have. */
export const REQUIRED_DOCUMENTS: AdmissionDocumentDef[] = [
  { key: 'aadhaar', name: 'Student Aadhaar Card', required: true },
]

/** Documents the school accepts but does not require. */
export const OPTIONAL_DOCUMENTS: AdmissionDocumentDef[] = [
  { key: 'tc', name: 'Transfer Certificate (TC)', required: false },
  { key: 'character', name: 'Character Certificate', required: false },
  { key: 'birthCert', name: 'Birth Certificate', required: false },
  { key: 'marksheet', name: 'Previous Mark Sheet', required: false },
  { key: 'migration', name: 'Migration Certificate', required: false },
]

/** Full registry in display order (required first). */
export const ADMISSION_DOCUMENTS: AdmissionDocumentDef[] = [
  ...REQUIRED_DOCUMENTS,
  ...OPTIONAL_DOCUMENTS,
]

export interface DocStatusLike {
  status?: 'uploaded' | 'pending' | 'later' | string
  fileName?: string
  verificationStatus?: string
}

export interface DocumentCompletion {
  requiredTotal: number
  requiredCompleted: number
  optionalTotal: number
  optionalUploaded: number
  /** True ONLY when every required document is uploaded. */
  complete: boolean
  /** e.g. "Required 1/1 complete ✓ · Optional 0/5 uploaded" */
  summaryLine: string
  /** Short badge label, e.g. "Documents ✓ Complete" or "Documents Incomplete". */
  badgeLabel: string
}

const isUploaded = (st?: DocStatusLike): boolean =>
  !!st && st.status === 'uploaded'

/**
 * Compute document completion for an application's docStatuses map.
 * Optional documents are counted for information only.
 */
export function getDocumentCompletion(
  docStatuses?: Record<string, DocStatusLike | undefined> | null
): DocumentCompletion {
  const statuses = docStatuses || {}
  const requiredCompleted = REQUIRED_DOCUMENTS.filter((d) =>
    isUploaded(statuses[d.key])
  ).length
  const optionalUploaded = OPTIONAL_DOCUMENTS.filter((d) =>
    isUploaded(statuses[d.key])
  ).length
  const requiredTotal = REQUIRED_DOCUMENTS.length
  const optionalTotal = OPTIONAL_DOCUMENTS.length
  const complete = requiredCompleted === requiredTotal

  return {
    requiredTotal,
    requiredCompleted,
    optionalTotal,
    optionalUploaded,
    complete,
    summaryLine: `Required ${requiredCompleted}/${requiredTotal} complete${
      complete ? ' ✓' : ''
    } · Optional ${optionalUploaded}/${optionalTotal} uploaded`,
    badgeLabel: complete ? 'Documents ✓ Complete' : 'Documents Incomplete',
  }
}
