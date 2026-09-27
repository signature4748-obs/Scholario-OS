'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { MAX_FILE_SIZE, MIN_DIMENSION } from './types'

interface UseFileUploadArgs {
  /** Called after an uploaded file is decoded into an HTMLImageElement. */
  onImageLoaded: (img: HTMLImageElement) => void
}

/**
 * Returns a stable `handleFileChange` callback enforcing the photo upload
 * policy (spec §8):
 *
 *   1. file type — JPG / JPEG / PNG
 *   2. file size — ≤ 2 MB
 *   3. dimensions — decoded image must be at least 200 × 200 px so the
 *      passport crop stays sharp (the crop pipeline later optimizes to a
 *      420 × 540 JPEG — best practical quality, small storage size).
 *
 * The file is read as a data URL, decoded to an HTMLImageElement, then
 * `onImageLoaded` fires. The native file input value is reset so the same
 * file can be re-selected later.
 */
export function useFileUpload({ onImageLoaded }: UseFileUploadArgs) {
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        toast.error('Only JPG and PNG photos are allowed')
        e.target.value = ''
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File is too large. Maximum size is 2 MB.')
        e.target.value = ''
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          // Dimension validation — reject images too small to crop sharply.
          if (img.naturalWidth < MIN_DIMENSION || img.naturalHeight < MIN_DIMENSION) {
            toast.error(
              `Photo is too small (${img.naturalWidth} × ${img.naturalHeight} px). Use a photo at least ${MIN_DIMENSION} × ${MIN_DIMENSION} px.`
            )
            return
          }
          onImageLoaded(img)
        }
        img.onerror = () => toast.error('Failed to decode image file')
        img.src = reader.result as string
      }
      reader.onerror = () => toast.error('Failed to read file')
      reader.readAsDataURL(file)
      e.target.value = ''
    },
    [onImageLoaded]
  )

  return handleFileChange
}
