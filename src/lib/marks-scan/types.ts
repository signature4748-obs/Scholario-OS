/**
 * marks-scan/types — the client-side contract for the Scan Marks Sheet
 * workflow (TWC-SCAN).
 *
 * OCR is ONLY an input mechanism here: every type below describes
 * *unverified, pre-review* data. Nothing in this module is ever written to
 * the marks database directly — after teacher review, values flow through
 * the SAME canonical /api/teacher/marks-entry/save + /submit services the
 * manual roster uses.
 */

/** Result state of one detected marks cell (spec: no fake confidence). */
export type CellStatus =
  /** OCR read a clean, in-range number with high confidence. */
  | 'CONFIRMED'
  /** OCR read something, but it needs the teacher's eye (low confidence /
   *  ambiguous glyphs like "8?" / out-of-range / absent guess). */
  | 'REVIEW'
  /** Rejected value — non-numeric, out of range (e.g. 101, -2, "abc"). */
  | 'INVALID'
  /** Nothing detected for this student (blank cell / not on any page). */
  | 'UNREAD'

/** How a scanned row was tied to the official roster. */
export type MatchKind =
  /** Roll number read cleanly and matches the official roster. */
  | 'ROLL'
  /** Roll number unclear — matched by OCR'd name similarity (secondary). */
  | 'NAME'
  /** Roll number read but not in the official roster (extra/unknown row). */
  | 'UNMATCHED'

/** Normalized pixel box on a scanned page's processed image. */
export interface CellBox {
  x: number
  y: number
  w: number
  h: number
}

/** One scanned source page (image + its processed geometry). */
export interface ScanPage {
  id: string
  /** 1-based page order. */
  index: number
  /** Original file name (display only). */
  name: string
  /** Processed (deskewed, contrast-normalised) image data URL — JPEG. */
  dataUrl: string
  width: number
  height: number
}

/** A raw OCR detection for one table row, before roster matching. */
export interface RawRow {
  /** Roll-number cell text (cleaned digits, '' when unreadable). */
  rollRaw: string
  /** OCR confidence of the roll cell, 0–100 (null = nothing read). */
  rollConfidence: number | null
  /** Student-name cell text ('' when unreadable) — secondary matching only. */
  nameRaw: string
  /** Marks cell text exactly as read (e.g. '78', '8?', 'AB', ''). */
  marksRaw: string
  /** OCR confidence of the marks cell, 0–100 (null = nothing read). */
  marksConfidence: number | null
  /** Marks-cell box on the page (for the source-region highlight). */
  box: CellBox
  /** Page the row was detected on. */
  pageId: string
}

/** One review-grid row: the roster student + the best detection for them. */
export interface ScanRow {
  /** Roster student id ('' for unmatched extra rows). */
  studentId: string
  /** Official roster roll no (source of truth). */
  rollNo: string
  /** Official roster name (source of truth). */
  name: string
  /** Current value in the grid: digits, 'AB', or '' (cleared/blank). */
  value: string
  status: CellStatus
  /** Real OCR confidence of the reading that produced `value` (0–100). */
  confidence: number | null
  match: MatchKind
  /** OCR'd name (when a detection exists) — for the "vs roster" hint. */
  detectedName: string
  /** Source marks-cell box (page preview highlight). Null when UNREAD. */
  box: CellBox | null
  pageId: string | null
  /** True when the same roll was detected on more than one page. */
  duplicate: boolean
  /** Pages this roll appeared on (for the duplicate note). */
  duplicatePages: number[]
  /** True once the teacher has manually edited/confirmed this row. */
  touched: boolean
  /** Optional OCR note (e.g. "Read as '8?' — 62% confidence"). */
  note: string
}

/** Roster entry used for matching (from the canonical grid payload). */
export interface RosterStudent {
  id: string
  rollNo: string
  name: string
}

/** Real processing stages — surfaced verbatim in the processing UI. */
export type ScanStage =
  | 'reading'
  | 'document'
  | 'deskew'
  | 'table'
  | 'rows'
  | 'marks'
  | 'validating'
  | 'done'

export interface ScanStageState {
  stage: ScanStage
  /** 'active' shows an indeterminate shimmer (no fake percentages). */
  state: 'active' | 'done' | 'error'
  /** Optional one-line detail (e.g. "12 rows"). */
  detail?: string
}

/** Actionable scan failure (spec part 22 — never a generic error). */
export type ScanErrorKind =
  | 'not-a-marks-table'
  | 'low-quality'
  | 'no-marks'
  | 'ocr-engine'
  | 'too-large'

export interface ScanError {
  kind: ScanErrorKind
  message: string
  hint: string
}

/** Draft payload persisted server-side (school+teacher+exam+class+subject). */
export interface ScanDraftPayload {
  maxMarks: number
  rows: ScanRow[]
  pages: ScanPage[]
  savedAt: string
}
