'use client'

/**
 * Teacher media — client side of the photo/signature upload contract
 * (Wave 2.3 §5). Mirrors the admission upload architecture: the client
 * pre-validates (type / size / dimensions), then the file is POSTed to
 * /api/teachers/upload where the server re-validates EVERYTHING by magic
 * bytes + decoded dimensions before storing. A client-side bypass can
 * never store an oversized or fake-extension file.
 */

import type { TeacherMediaRecord } from '@/lib/store/teachers-store'

export type TeacherMediaKind = 'photo' | 'signature'

export interface TeacherMediaRules {
  maxBytes: number
  maxLabel: string
  accept: string
  minDimension: number
  maxDimension: number
  types: string[]
}

export const PHOTO_RULES: TeacherMediaRules = {
  maxBytes: 2 * 1024 * 1024,
  maxLabel: '2 MB',
  accept: 'image/jpeg,image/png,image/webp',
  minDimension: 200,
  maxDimension: 6000,
  types: ['image/jpeg', 'image/png', 'image/webp'],
}

export const SIGNATURE_RULES: TeacherMediaRules = {
  maxBytes: 1 * 1024 * 1024,
  maxLabel: '1 MB',
  accept: 'image/jpeg,image/png,image/webp',
  minDimension: 60,
  maxDimension: 6000,
  types: ['image/jpeg', 'image/png', 'image/webp'],
}

export function rulesFor(kind: TeacherMediaKind): TeacherMediaRules {
  return kind === 'photo' ? PHOTO_RULES : SIGNATURE_RULES
}

/** Decode intrinsic dimensions of an image file in the browser. */
function readBrowserDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight }
      URL.revokeObjectURL(url)
      resolve(dims)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to decode image'))
    }
    img.src = url
  })
}

/**
 * Client-side pre-validation (the server re-checks on arrival).
 * Returns an error message, or null when the file may be uploaded.
 */
export async function validateTeacherMedia(
  file: File,
  kind: TeacherMediaKind
): Promise<string | null> {
  const rules = rulesFor(kind)
  if (!rules.types.includes(file.type)) {
    return `Unsupported file type. Allowed: JPG, PNG, WebP.`
  }
  if (file.size > rules.maxBytes) {
    return `File is too large. Maximum size is ${rules.maxLabel}.`
  }
  try {
    const { width, height } = await readBrowserDimensions(file)
    if (width < rules.minDimension || height < rules.minDimension) {
      return `Image is too small (${width} × ${height} px). Use at least ${rules.minDimension} × ${rules.minDimension} px.`
    }
    if (width > rules.maxDimension || height > rules.maxDimension) {
      return `Image is too large (${width} × ${height} px). Maximum is ${rules.maxDimension} × ${rules.maxDimension} px.`
    }
  } catch {
    return 'Could not read the image — the file may be corrupt.'
  }
  return null
}

export interface UploadTeacherMediaResult {
  fileId: string
  fileName: string
  dataUrl: string
}

/** Upload a file for a teacher media slot; throws with a user-facing message. */
export async function uploadTeacherMedia(
  file: File | Blob,
  kind: TeacherMediaKind,
  opts?: { dataUrl?: string }
): Promise<UploadTeacherMediaResult> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('kind', kind)
  const res = await fetch('/api/teachers/upload', { method: 'POST', body: fd })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Upload failed. Please try again.')
  }
  const dataUrl =
    opts?.dataUrl ??
    (file instanceof File ? await fileToDataUrl(file) : '')
  return { fileId: json.fileId, fileName: json.fileName, dataUrl }
}

/** Convert the crop pipeline's dataURL output back into an uploadable Blob. */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/** Build a TeacherMediaRecord from an upload result. */
export function toMediaRecord(uploaded: UploadTeacherMediaResult): TeacherMediaRecord {
  return {
    fileId: uploaded.fileId,
    fileName: uploaded.fileName,
    uploadedAt: new Date().toISOString().split('T')[0],
    dataUrl: uploaded.dataUrl,
  }
}

/** Fire-and-forget removal of a stored media file (record cleanup is local). */
export function deleteTeacherMediaFile(fileId: string): void {
  fetch(`/api/teachers/upload/${encodeURIComponent(fileId)}`, { method: 'DELETE' }).catch(() => {})
}

/** Stable preview URL for a stored media record. */
export function teacherMediaUrl(record: TeacherMediaRecord): string {
  return `/api/teachers/upload/${encodeURIComponent(record.fileId)}`
}
