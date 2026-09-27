'use client'

/**
 * Wizard Step 5 — Photo & Sign (Wave 2.3 §5 + §6).
 *
 * CONTENT AREA ONLY — the top stepper already communicates progress, so
 * this step carries exactly two content sections and nothing else:
 *
 *   Photograph  → the SAME capture/crop pipeline as Admissions (upload,
 *                 camera, crop, rotate, replace, remove), then the final
 *                 crop is uploaded to the staff media store.
 *   Signature   → upload + preview + replace + remove (no crop — the
 *                 original file is kept for legibility/transparency).
 *
 * Both slots are REAL media records: client pre-validation, then a
 * server upload (magic bytes + size + dimensions) under
 * /api/teachers/upload, with the returned fileId kept on the record.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import type { AddTeacherForm } from './add-teacher-data'
import { PhotoStep } from '../admission/components/PhotoStep'
import { SignatureUpload } from './signature-upload'
import {
  validateTeacherMedia,
  uploadTeacherMedia,
  deleteTeacherMediaFile,
  toMediaRecord,
  dataUrlToBlob,
} from './teacher-media'

type SetF = (key: string, val: any) => void

interface Props {
  form: AddTeacherForm
  setF: SetF
}

export function Step5PhotoSignature({ form, setF }: Props) {
  const [photoUploading, setPhotoUploading] = useState(false)

  /** Apply / replace / remove the teacher photo (from the shared pipeline). */
  const handlePhotoChange = async (dataUrl: string | null) => {
    // Removed — clear the record and the stored file.
    if (!dataUrl) {
      if (form.photo) deleteTeacherMediaFile(form.photo.fileId)
      setF('photo', null)
      toast.info('Photo removed')
      return
    }

    // Applied / re-cropped — upload the optimized crop output.
    setPhotoUploading(true)
    try {
      const blob = await dataUrlToBlob(dataUrl)
      const file = new File([blob], 'teacher-photo.jpg', {
        type: blob.type || 'image/jpeg',
      })
      const validationError = await validateTeacherMedia(file, 'photo')
      if (validationError) {
        toast.error(validationError)
        return
      }
      const uploaded = await uploadTeacherMedia(file, 'photo', { dataUrl })
      if (form.photo) deleteTeacherMediaFile(form.photo.fileId)
      setF('photo', toMediaRecord(uploaded))
      toast.success('Photo saved', {
        description: 'Passport-size image added to the staff record.',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Photo upload failed. Please try again.')
    } finally {
      setPhotoUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* PHOTOGRAPH — shared admission capture/crop pipeline */}
      <section aria-label="Photograph">
        <PhotoStep
          photoDataUrl={form.photo?.dataUrl ?? null}
          onChange={handlePhotoChange}
          title="Photograph"
          recordLabel="staff record"
          suppressToasts
        />
        {photoUploading && (
          <p className="text-[11px] text-muted-foreground -mt-1">Storing photo on the staff record…</p>
        )}
      </section>

      {/* SIGNATURE — upload / preview / replace / remove */}
      <section aria-label="Signature" className="pt-5 border-t border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 17c2 0 3-1 4-4s2-6 4-6 2 3 2 4-1 3-2 3-1-1 0-2 4-2 6 0 3 1 6 1 2 0 2-1" />
            </svg>
          </div>
          <h2 className="font-display text-sm font-bold tracking-tight">Signature</h2>
        </div>
        <SignatureUpload
          value={form.signature}
          onChange={(media) => setF('signature', media)}
        />
      </section>
    </div>
  )
}
