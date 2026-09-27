export interface PhotoStepProps {
  photoDataUrl: string | null
  onChange: (dataUrl: string | null) => void
  /** What the applied photo is attached to — used in toast copy only.
   *  Defaults to 'admission record' (Admissions wizard). */
  recordLabel?: string
  /** Section title shown in the step header (defaults to 'Photo'). */
  title?: string
  /** When true, the internal toasts are suppressed — the caller shows
   *  its own after the server confirms the upload (teacher flow). */
  suppressToasts?: boolean
  /** When true and a photo already exists, the step starts in the calm
   *  empty/preview mode instead of the crop editor (view-first contexts
   *  like the teacher Profile tab). Default: start in the editor
   *  (admission draft-resume behavior). */
  startInPreview?: boolean
}

export type Mode = 'empty' | 'camera' | 'editing'

export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

export interface DragState {
  startX: number
  startY: number
  cx: number
  cy: number
  cw: number
  ch: number
}

// Internal canvas pixel size — square for clean rotation behaviour
export const CANVAS_SIZE = 600
export const PREVIEW_W = 120
export const PREVIEW_H = 155
export const PASSPORT_RATIO = 3.5 / 4.5 // w/h

// Upload policy (spec §8): JPG / JPEG / PNG, max 2 MB. The crop pipeline
// then optimizes to the passport output size (420×540 JPEG) — best practical
// quality at a small storage size, never a blurry over-compression.
export const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
/** Minimum source resolution so the passport crop stays sharp. */
export const MIN_DIMENSION = 200
export const MIN_CROP_W = 100
export const MIN_CROP_H = MIN_CROP_W / PASSPORT_RATIO
export const OUTPUT_W = 420
export const OUTPUT_H = 540
