/**
 * Canonical Admission Document Policy — single source of truth.
 *
 * The REGISTRY (ADMISSION_DOCUMENT_REGISTRY) defines the documents a
 * school CAN collect. The REQUIREMENT for each document is
 * SCHOOL-CONFIGURABLE (Admission Settings → Documents):
 *
 *   'required'      → applicant must provide it before submission
 *   'optional'      → submission is allowed without it
 *   'not-collected' → hidden from the digital admission workflow
 *
 * Nothing is hardcoded as universally mandatory — the defaults below
 * simply seed a fresh tenant with this school's current configuration
 * (Aadhaar required, five supporting documents optional), and the
 * Principal can change any of them at any time.
 *
 * Completion rule: requiredCompleted === requiredTotal (never
 * uploaded/total — optional documents must not be able to block an
 * application; a school with zero required documents is always complete).
 */

import type {
  AdmissionDocRequirement,
  AdmissionDocumentPolicy,
} from '@/lib/store/school-settings-store'

export type { AdmissionDocRequirement, AdmissionDocumentPolicy }

export interface AdmissionDocumentDef {
  key: string
  name: string
  /** Resolved requirement for this document under the active policy. */
  required: boolean
  /** Raw policy value ('required' | 'optional' | 'not-collected'). */
  policy: AdmissionDocRequirement
}

/** Registry of documents a school can collect, in canonical display order. */
export const ADMISSION_DOCUMENT_REGISTRY: {
  key: string
  name: string
  defaultPolicy: AdmissionDocRequirement
}[] = [
  { key: 'aadhaar', name: 'Student Aadhaar Card', defaultPolicy: 'required' },
  { key: 'tc', name: 'Transfer Certificate (TC)', defaultPolicy: 'optional' },
  { key: 'character', name: 'Character Certificate', defaultPolicy: 'optional' },
  { key: 'birthCert', name: 'Birth Certificate', defaultPolicy: 'optional' },
  { key: 'marksheet', name: 'Previous Mark Sheet', defaultPolicy: 'optional' },
  { key: 'migration', name: 'Migration Certificate', defaultPolicy: 'optional' },
]

/** Default policy map — one entry per registry document. */
export const DEFAULT_DOCUMENT_POLICY: AdmissionDocumentPolicy =
  Object.fromEntries(
    ADMISSION_DOCUMENT_REGISTRY.map((d) => [d.key, d.defaultPolicy])
  )

/**
 * Resolve the school's document policy against the registry. Persisted
 * settings that pre-date the policy system (or are missing a key) fall
 * back to the registry default for that key — the school's existing
 * configuration is never silently changed.
 */
export function resolveDocumentPolicy(
  stored?: Partial<AdmissionDocumentPolicy> | null
): Required<AdmissionDocumentPolicy> {
  const resolved = { ...DEFAULT_DOCUMENT_POLICY }
  if (stored) {
    for (const d of ADMISSION_DOCUMENT_REGISTRY) {
      const v = stored[d.key]
      if (v === 'required' || v === 'optional' || v === 'not-collected') {
        resolved[d.key] = v
      }
    }
  }
  return resolved
}

/** Documents actually COLLECTED under the policy (required + optional). */
export function getCollectedDocuments(
  policy?: Partial<AdmissionDocumentPolicy> | null
): AdmissionDocumentDef[] {
  const resolved = resolveDocumentPolicy(policy)
  return ADMISSION_DOCUMENT_REGISTRY.filter(
    (d) => resolved[d.key] !== 'not-collected'
  ).map((d) => ({
    key: d.key,
    name: d.name,
    required: resolved[d.key] === 'required',
    policy: resolved[d.key],
  }))
}

/** Required documents only, in registry order. */
export function getRequiredDocuments(
  policy?: Partial<AdmissionDocumentPolicy> | null
): AdmissionDocumentDef[] {
  return getCollectedDocuments(policy).filter((d) => d.required)
}

/** Optional documents only, in registry order. */
export function getOptionalDocuments(
  policy?: Partial<AdmissionDocumentPolicy> | null
): AdmissionDocumentDef[] {
  return getCollectedDocuments(policy).filter((d) => !d.required)
}

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
  /** True ONLY when every required document is uploaded (0 required → true). */
  complete: boolean
  /** e.g. "Required 1/1 complete ✓ · Optional 0/5 uploaded" */
  summaryLine: string
  /** Short badge label, e.g. "Documents ✓ Complete" or "Documents Incomplete". */
  badgeLabel: string
  /** Names of required documents still missing (empty when complete). */
  missingRequired: string[]
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
 * Compute document completion for an application's docStatuses map under
 * the school's document policy. Optional documents are counted for
 * information only.
 */
export function getDocumentCompletion(
  docStatuses?: Record<string, DocStatusLike | undefined> | null,
  policy?: Partial<AdmissionDocumentPolicy> | null
): DocumentCompletion {
  const statuses = docStatuses || {}
  const required = getRequiredDocuments(policy)
  const optional = getOptionalDocuments(policy)
  const missingRequired = required
    .filter((d) => !isUploaded(statuses[d.key]))
    .map((d) => d.name)
  const requiredCompleted = required.length - missingRequired.length
  const optionalUploaded = optional.filter((d) =>
    isUploaded(statuses[d.key])
  ).length
  const requiredTotal = required.length
  const optionalTotal = optional.length
  const complete = requiredCompleted === requiredTotal

  return {
    requiredTotal,
    requiredCompleted,
    optionalTotal,
    optionalUploaded,
    complete,
    missingRequired,
    summaryLine: `Required ${requiredCompleted}/${requiredTotal} complete${
      complete ? ' ✓' : ''
    } · Optional ${optionalUploaded}/${optionalTotal} uploaded`,
    badgeLabel: complete ? 'Documents ✓ Complete' : 'Documents Incomplete',
  }
}
