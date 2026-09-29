'use client'

/**
 * marks/scan/use-scan — the Scan Marks Sheet workflow state machine.
 *
 *   input → (upload / camera capture) → processing (REAL staged
 *   progress: preprocess → deskew → table → rows → OCR cells → roster
 *   match → validate) → review (Excel-like grid) → teacher corrects →
 *   [Save Draft] / [Submit].
 *
 * Invariants enforced here:
 *  · OCR results NEVER reach the marks database — submission goes through
 *    the SAME canonical /api/teacher/marks-entry/save + /submit routes
 *    the manual roster uses.
 *  · The official roster (from the canonical grid payload) is the source
 *    of truth for identity; OCR never creates students.
 *  · Adding a page only fills untouched rows — it never overwrites a
 *    value the teacher has edited; re-scanning asks first (UI guard).
 *  · Duplicate rolls across pages are re-detected over the COMBINED
 *    detections after every page import.
 *  · Drafts persist server-side keyed to school+teacher+exam+class+subject.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { GridSelection, MarksGrid } from '../types'
import type {
  RawRow,
  ScanError,
  ScanPage,
  ScanRow,
  ScanStage,
  ScanStageState,
} from '@/lib/marks-scan/types'
import { preprocessScanImage, detectTable, cropCell } from '@/lib/marks-scan/pipeline'
import { recognizeDigits, recognizeText, releaseOcrWorker } from '@/lib/marks-scan/ocr'
import { matchRowsToRoster, validateRows, cleanRoll, type ValidationSummary } from '@/lib/marks-scan/roster-match'
import { marksScanRequest } from './api'

export type ScanPhase = 'input' | 'processing' | 'review'

const STAGE_ORDER: ScanStage[] = [
  'reading',
  'document',
  'deskew',
  'table',
  'rows',
  'marks',
  'validating',
  'done',
]

export const STAGE_LABELS: Record<ScanStage, string> = {
  reading: 'Reading sheet',
  document: 'Document detected',
  deskew: 'Orientation corrected',
  table: 'Marks table detected',
  rows: 'Student rows detected',
  marks: 'Marks extracted',
  validating: 'Validating marks',
  done: 'Ready for review',
}

export interface UseScanArgs {
  selection: GridSelection
  grid: MarksGrid
  /** Reload the manual grid after a successful submission. */
  onSubmitted: () => void
}

export function useScan({ selection, grid, onSubmitted }: UseScanArgs) {
  const [phase, setPhase] = useState<ScanPhase>('input')
  const [stages, setStages] = useState<ScanStageState[]>([])
  const [pages, setPages] = useState<ScanPage[]>([])
  const [rows, setRows] = useState<ScanRow[]>([])
  const [error, setError] = useState<ScanError | null>(null)
  const [activeRow, setActiveRow] = useState<number | null>(null)
  const [activePage, setActivePage] = useState(0)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [draftDirty, setDraftDirty] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedDraft, setSavedDraft] = useState<{
    rows: ScanRow[]
    pages: ScanPage[]
    maxMarks: number
    savedAt: string
  } | null>(null)
  const [scanningPage, setScanningPage] = useState(false)

  // Undo/redo (committed cell edits, bounded).
  const undoStack = useRef<{ rowIdx: number; prev: ScanRow }[]>([])
  const redoStack = useRef<{ rowIdx: number; row: ScanRow }[]>([])
  const [historyMeta, setHistoryMeta] = useState({ undo: 0, redo: 0 })

  const gridRef = useRef(grid)
  const selectionRef = useRef(selection)
  const rawRowsRef = useRef<RawRow[]>([]) // combined detections, all pages
  const pageCountRef = useRef(0)
  useEffect(() => {
    gridRef.current = grid
  }, [grid])
  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  // ── Stage helpers ──────────────────────────────────────────────────
  const setStage = useCallback((stage: ScanStage, state: ScanStageState['state'], detail?: string) => {
    const idx = STAGE_ORDER.indexOf(stage)
    setStages((prev) => {
      const next = prev.slice()
      for (let i = 0; i < idx; i += 1) {
        if (!next[i] || next[i].state === 'active') next[i] = { stage: STAGE_ORDER[i], state: 'done' }
      }
      next[idx] = { stage, state, detail }
      return next
    })
  }, [])

  const failScan = useCallback((err: ScanError) => {
    setError(err)
    setPhase('input')
    setStages((prev) => {
      const next = prev.slice()
      const i = next.findIndex((s) => s.state === 'active')
      if (i >= 0) next[i] = { ...next[i], state: 'error' }
      return next
    })
  }, [])

  // ── The scan pipeline (one image → page + raw rows) ────────────────
  const processImage = useCallback(
    async (dataUrl: string, fileName: string): Promise<{ page: ScanPage; rawRows: RawRow[] }> => {
      const rosterRolls = new Set(gridRef.current.students.map((s) => s.rollNo.trim()))
      setStage('reading', 'active', fileName)
      let pre: Awaited<ReturnType<typeof preprocessScanImage>>
      try {
        pre = await preprocessScanImage(dataUrl)
      } catch (e) {
        const code = (e as Error & { code?: string }).code
        if (code === 'low-quality') {
          throw {
            kind: 'low-quality' as const,
            message: 'Image quality is too low for reliable extraction.',
            hint: 'Use a brighter, sharper photo of the completed sheet.',
          }
        }
        throw {
          kind: 'ocr-engine' as const,
          message: e instanceof Error ? e.message : 'The image could not be processed.',
          hint: 'Try a JPG, PNG or WEBP image of the sheet.',
        }
      }
      setStage('reading', 'done', fileName)
      setStage('document', 'done', `Contrast ${pre.image.contrastScore}`)
      setStage(
        'deskew',
        'done',
        pre.image.deskewAngle === 0 ? 'No rotation needed' : `Rotated ${Math.abs(pre.image.deskewAngle).toFixed(1)}°`,
      )

      setStage('table', 'active')
      const ctx = pre.image.canvas.getContext('2d')
      if (!ctx) {
        throw { kind: 'ocr-engine' as const, message: 'Canvas is not available.', hint: 'Try a different browser.' }
      }
      const det = detectTable(ctx, pre.image.width, pre.image.height, pre.image.contrastScore)
      if (!det.table) {
        throw {
          kind: 'not-a-marks-table' as const,
          message: 'Could not reliably detect the marks table.',
          hint: 'Use a SCHOLARIO blank marks sheet, or a clearly ruled sheet with the marks column visible.',
        }
      }
      setStage('table', 'done', `${det.hLineCount} ruling lines`)
      const tableRows = det.table.rows
      setStage('rows', 'done', `${tableRows.length} rows`)

      setStage('marks', 'active', `0 of ${tableRows.length}`)
      const pageId = `p${pageCountRef.current + 1}-${Date.now().toString(36)}`
      const rawRows: RawRow[] = []
      let done = 0
      for (const band of tableRows) {
        const rollRead = await recognizeDigits(cropCell(pre.image.canvas, band.roll))
        const marksRead = await recognizeDigits(cropCell(pre.image.canvas, band.marks))
        done += 1
        // A band with neither roll nor marks is a header or an empty
        // spacer — it can never contribute a value (roster rows already
        // exist for every student), so it is skipped honestly.
        if (!rollRead.text && !marksRead.text) {
          setStage('marks', 'active', `${done} of ${tableRows.length}`)
          continue
        }
        // Names are read only when they can matter: the SECONDARY match
        // when the roll is unclear, or to show who an extra row belongs
        // to when its roll is not in the official roster.
        let nameRead = { text: '', confidence: -1 }
        if (!rollRead.text || !rosterRolls.has(cleanRoll(rollRead.text))) {
          nameRead = await recognizeText(cropCell(pre.image.canvas, band.name))
        }
        rawRows.push({
          rollRaw: rollRead.text,
          rollConfidence: rollRead.confidence,
          nameRaw: nameRead.text,
          marksRaw: marksRead.text,
          marksConfidence: marksRead.confidence,
          box: band.marks,
          pageId,
        })
        setStage('marks', 'active', `${done} of ${tableRows.length}`)
      }
      setStage('marks', 'done', `${rawRows.length} rows read`)

      if (rawRows.every((r) => r.marksRaw.trim() === '')) {
        throw {
          kind: 'no-marks' as const,
          message: 'No valid marks were detected. Check that the marks column is visible.',
          hint: 'Photograph the sheet straight-on with the marks column fully in frame.',
        }
      }

      pageCountRef.current += 1
      const page: ScanPage = {
        id: pageId,
        index: pageCountRef.current,
        name: fileName,
        dataUrl: pre.image.dataUrl,
        width: pre.image.width,
        height: pre.image.height,
      }
      return { page, rawRows }
    },
    [setStage],
  )

  /** Merge the COMBINED detections into the review dataset. */
  const applyDetections = useCallback(
    (mode: 'fresh' | 'append') => {
      const g = gridRef.current
      setStage('validating', 'active')
      const roster = g.students.map((s) => ({ id: s.id, rollNo: s.rollNo, name: s.name }))
      const matched = matchRowsToRoster(rawRowsRef.current, roster, g.maxMarks)
      if (mode === 'fresh') {
        setRows(matched.rows)
      } else {
        // Append (another page): keep every teacher-touched value; fill
        // only untouched/empty rows from the combined detections.
        setRows((prev) =>
          prev.map((old) => {
            if (old.touched) return old
            const fresh = matched.rows.find((m) => m.studentId === old.studentId)
            if (!fresh) return old
            if (old.value !== '' && old.value === fresh.value) {
              // Same value again — keep old but inherit duplicate flags.
              return { ...old, duplicate: old.duplicate || fresh.duplicate, duplicatePages: fresh.duplicatePages.length ? fresh.duplicatePages : old.duplicatePages }
            }
            if (old.value !== '') return old
            return fresh
          }),
        )
      }
      setStage('validating', 'done')
      setStage('done', 'done')
      if (matched.duplicateRolls.length > 0) {
        toast.warning('Duplicate roll number detected', {
          description: `Roll ${matched.duplicateRolls.map((d) => d.roll).join(', ')} — keep the correct value in review.`,
        })
      }
      setDraftDirty(true)
    },
    [setStage],
  )

  // ── Public actions ─────────────────────────────────────────────────

  const runScan = useCallback(
    async (dataUrl: string, fileName: string) => {
      setError(null)
      setStages([])
      setPhase('processing')
      try {
        const { page, rawRows } = await processImage(dataUrl, fileName)
        rawRowsRef.current = rawRows
        setPages([page])
        setActivePage(0)
        applyDetections('fresh')
        setPhase('review')
      } catch (e) {
        const err = e as ScanError
        if (err && err.kind && err.message) {
          failScan(err as ScanError)
        } else {
          failScan({
            kind: 'ocr-engine',
            message: 'The scan engine could not be started.',
            hint: 'Check your connection and try again, or enter marks manually.',
          })
        }
      }
    },
    [applyDetections, failScan, processImage],
  )

  /** Import another page into the SAME review dataset. */
  const addPage = useCallback(
    async (dataUrl: string, fileName: string) => {
      if (scanningPage) return
      setScanningPage(true)
      try {
        const { page, rawRows } = await processImage(dataUrl, fileName)
        rawRowsRef.current = [...rawRowsRef.current, ...rawRows]
        setPages((prev) => [...prev, page])
        setActivePage(page.index - 1)
        applyDetections('append')
      } catch (e) {
        const err = e as ScanError
        toast.error(err && err.message ? err.message : 'The page could not be processed', {
          description: err && err.hint ? err.hint : undefined,
        })
      } finally {
        setScanningPage(false)
      }
    },
    [applyDetections, processImage, scanningPage],
  )

  /** Re-scan: replaces every detection (guarded by the UI confirm). */
  const rescan = useCallback(
    async (dataUrl: string, fileName: string) => {
      undoStack.current = []
      redoStack.current = []
      setHistoryMeta({ undo: 0, redo: 0 })
      rawRowsRef.current = []
      pageCountRef.current = 0
      setPages([])
      setRows([])
      setActiveRow(null)
      await runScan(dataUrl, fileName)
    },
    [runScan],
  )

  // ── Review edits (with undo/redo) ──────────────────────────────────

  const commitEdit = useCallback((rowIdx: number, value: string) => {
    const max = gridRef.current.maxMarks
    setRows((prev) => {
      const old = prev[rowIdx]
      if (!old || old.value === value) return prev
      undoStack.current.push({ rowIdx, prev: old })
      if (undoStack.current.length > 60) undoStack.current.shift()
      redoStack.current = []
      setHistoryMeta({ undo: undoStack.current.length, redo: 0 })
      let status: ScanRow['status'] = 'CONFIRMED'
      let note = ''
      if (value === '') {
        status = 'UNREAD'
        note = 'Cleared'
      } else if (value === 'AB') {
        status = 'CONFIRMED'
        note = 'Absent'
      } else if (!/^\d{1,3}$/.test(value) || Number.parseInt(value, 10) > max) {
        status = 'INVALID'
        note = /^\d+$/.test(value) ? `${value} is outside 0–${max}` : 'Numbers only'
      }
      const next = prev.slice()
      next[rowIdx] = { ...old, value, status, note, touched: true }
      return next
    })
    setDraftDirty(true)
  }, [])

  /** Confirm a REVIEW cell as-is (teacher verified the OCR value). */
  const confirmRow = useCallback((rowIdx: number) => {
    setRows((prev) => {
      const old = prev[rowIdx]
      if (!old || old.status !== 'REVIEW') return prev
      undoStack.current.push({ rowIdx, prev: old })
      redoStack.current = []
      setHistoryMeta({ undo: undoStack.current.length, redo: 0 })
      const next = prev.slice()
      next[rowIdx] = { ...old, status: 'CONFIRMED', touched: true, note: old.value === 'AB' ? 'Absent' : '' }
      return next
    })
    setDraftDirty(true)
  }, [])

  const undo = useCallback(() => {
    const entry = undoStack.current.pop()
    if (!entry) return
    setRows((prev) => {
      const cur = prev[entry.rowIdx]
      redoStack.current.push({ rowIdx: entry.rowIdx, row: cur })
      const next = prev.slice()
      next[entry.rowIdx] = entry.prev
      return next
    })
    setHistoryMeta({ undo: undoStack.current.length, redo: redoStack.current.length })
    setDraftDirty(true)
  }, [])

  const redo = useCallback(() => {
    const entry = redoStack.current.pop()
    if (!entry) return
    setRows((prev) => {
      const cur = prev[entry.rowIdx]
      undoStack.current.push({ rowIdx: entry.rowIdx, prev: cur })
      const next = prev.slice()
      next[entry.rowIdx] = entry.row
      return next
    })
    setHistoryMeta({ undo: undoStack.current.length, redo: redoStack.current.length })
    setDraftDirty(true)
  }, [])

  // ── Drafts ─────────────────────────────────────────────────────────

  const saveDraft = useCallback(async (): Promise<boolean> => {
    const sel = selectionRef.current
    try {
      const r = await marksScanRequest<{ savedAt: string }>(
        '/api/teacher/marks-entry/scan-draft/save',
        {
          method: 'POST',
          body: JSON.stringify({
            examId: sel.examId,
            classId: sel.classId,
            subjectId: sel.subjectId,
            maxMarks: gridRef.current.maxMarks,
            rows,
            pages,
          }),
        },
      )
      setDraftSavedAt(r.savedAt)
      setDraftDirty(false)
      setSavedDraft({ rows, pages, maxMarks: gridRef.current.maxMarks, savedAt: r.savedAt })
      toast.success('Scan draft saved', {
        description: 'Resume review any time — drafts are never official marks.',
      })
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Draft could not be saved')
      return false
    }
  }, [pages, rows])

  const loadDraft = useCallback(async (): Promise<boolean> => {
    const sel = selectionRef.current
    try {
      const d = await marksScanRequest<{
        rows: ScanRow[]
        pages: ScanPage[]
        maxMarks: number
        savedAt: string
      } | null>(
        `/api/teacher/marks-entry/scan-draft?examId=${sel.examId}&classId=${sel.classId}&subjectId=${sel.subjectId}`,
      )
      if (d && Array.isArray(d.rows) && d.rows.length > 0) {
        setSavedDraft(d)
        return true
      }
      setSavedDraft(null)
      return false
    } catch {
      return false // draft loading is best-effort
    }
  }, [])

  const resumeDraft = useCallback(() => {
    if (!savedDraft) return
    setRows(savedDraft.rows)
    setPages(savedDraft.pages)
    setDraftSavedAt(savedDraft.savedAt)
    setDraftDirty(false)
    pageCountRef.current = savedDraft.pages.length
    setPhase('review')
    setActivePage(0)
  }, [savedDraft])

  const discardDraft = useCallback(async () => {
    const sel = selectionRef.current
    setSavedDraft(null)
    try {
      const q = `examId=${sel.examId}&classId=${sel.classId}&subjectId=${sel.subjectId}`
      await marksScanRequest(`/api/teacher/marks-entry/scan-draft?${q}`, { method: 'DELETE' })
    } catch {
      /* best effort */
    }
  }, [])

  // ── Submission (canonical services only) ───────────────────────────

  const submit = useCallback(async (): Promise<boolean> => {
    const sel = selectionRef.current
    const g = gridRef.current
    if (submitting) return false
    setSubmitting(true)
    try {
      const entries = rows
        .filter((r) => r.match !== 'UNMATCHED' && r.studentId)
        .map((r) =>
          r.value === ''
            ? { studentId: r.studentId, marks: null }
            : r.value === 'AB'
              ? { studentId: r.studentId, marks: null, absent: true }
              : { studentId: r.studentId, marks: Number.parseInt(r.value, 10) },
        )
      await marksScanRequest('/api/teacher/marks-entry/save', {
        method: 'POST',
        body: JSON.stringify({
          examId: sel.examId,
          classId: sel.classId,
          subjectId: sel.subjectId,
          entries,
        }),
      })
      await marksScanRequest('/api/teacher/marks-entry/submit', {
        method: 'POST',
        body: JSON.stringify({
          examId: sel.examId,
          classId: sel.classId,
          subjectId: sel.subjectId,
        }),
      })
      // The draft is consumed — remove it so it can never look official.
      await discardDraft()
      toast.success('Marks submitted', {
        description: `${g.subjectName} · ${g.label} · ${g.exam.name} — via scan review`,
      })
      onSubmitted()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Marks could not be submitted')
      return false
    } finally {
      setSubmitting(false)
    }
  }, [discardDraft, onSubmitted, rows, submitting])

  // Release the OCR worker when the workspace unmounts.
  useEffect(() => () => void releaseOcrWorker(), [])

  const validation: ValidationSummary = useMemo(
    () => validateRows(rows, grid.maxMarks),
    [rows, grid.maxMarks],
  )

  const hasEdits = useMemo(() => rows.some((r) => r.touched), [rows])

  return {
    phase,
    stages,
    pages,
    rows,
    error,
    validation,
    activeRow,
    activePage,
    setActiveRow,
    setActivePage,
    draftSavedAt,
    draftDirty,
    savedDraft,
    submitting,
    scanningPage,
    hasEdits,
    historyMeta,
    runScan,
    addPage,
    rescan,
    commitEdit,
    confirmRow,
    undo,
    redo,
    saveDraft,
    loadDraft,
    resumeDraft,
    discardDraft,
    submit,
  }
}
