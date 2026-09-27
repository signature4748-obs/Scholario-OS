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

/* ------------------------------------------------------------------ */
/*  Upload policy — client side of the CLIENT + SERVER contract.       */
/*  The server route re-validates everything (type by magic bytes,     */
/*  size) so a client-side bypass cannot store an oversized file.      */
/* ------------------------------------------------------------------ */

/** Maximum supporting-document size (5 MB), enforced client AND server side. */
export const DOC_MAX_BYTES = 5 * 1024 * 1024
/** Native file-input accept list for supporting documents. */
export const DOC_ACCEPT = 'application/pdf,image/jpeg,image/png'

/**
 * Client-side pre-validation. Returns an error message, or null when the
 * file may be sent to the server (which will validate it again).
 */
export function validateDocumentFile(file: File): string | null {
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
    return 'Unsupported file type. Allowed: PDF, JPG, PNG.'
  }
  if (file.size > DOC_MAX_BYTES) {
    return 'File is too large. Maximum size is 5 MB.'
  }
  return null
}

export interface UploadedDocFile {
  fileId: string
  fileName: string
  size: number
}

/** Upload a supporting document; throws Error with a user-facing message. */
export async function uploadAdmissionDocument(file: File): Promise<UploadedDocFile> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/admissions/upload', { method: 'POST', body: fd })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Upload failed. Please try again.')
  }
  return { fileId: json.fileId, fileName: json.fileName, size: json.size }
}

/** Fire-and-forget removal of a stored file (record cleanup is local). */
export function deleteAdmissionDocumentFile(fileId: string): void {
  fetch(`/api/admissions/upload/${encodeURIComponent(fileId)}`, { method: 'DELETE' }).catch(() => {})
}

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
