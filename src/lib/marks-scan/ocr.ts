/**
 * marks-scan/ocr — the conventional OCR engine wrapper (Tesseract.js,
 * LSTM-only, fully LOCAL assets served from /public/tesseract — student
 * data never leaves the school's own server; no third-party OCR service).
 *
 * The worker is a lazy singleton: the ~7 MB of engine assets are only
 * fetched the first time a teacher actually scans. Cell recognition runs
 * with a digits whitelist (PSM 7 — single word) for roll/marks cells and
 * an open charset for name cells (secondary matching only).
 *
 * Confidence numbers surfaced by this module are Tesseract's own word
 * confidences — never fabricated, never smoothed.
 */

import type { ScanStageState } from './types'

// Lazily created module-level singleton (worker survives page session).
type OcrWorker = {
  setParameters: (params: Record<string, string>) => Promise<unknown>
  recognize: (
    image: string,
  ) => Promise<{ data: { text: string; confidence: number } }>
  terminate: () => Promise<void>
}

type TesseractModule = {
  createWorker: (
    langs: string,
    oem: number,
    options: Record<string, unknown>,
  ) => Promise<OcrWorker>
}

let workerPromise: Promise<OcrWorker> | null = null
let modulePromise: Promise<TesseractModule> | null = null
let currentMode: 'digits' | 'text' | null = null

/** Stage reporter — wired to the processing UI (no fake percentages). */
export type StageReporter = (stage: ScanStageState) => void

async function loadModule(): Promise<TesseractModule> {
  if (!modulePromise) {
    // Dynamic import keeps the engine OUT of the main bundle.
    modulePromise = import('tesseract.js').then((m) => {
      const mod = (m as unknown as { default?: TesseractModule }).default ?? m
      return mod as TesseractModule
    })
  }
  return modulePromise
}

/**
 * Get (or create) the shared OCR worker. Assets resolve to the vendored
 * copies in /public/tesseract — identical version to the npm dependency.
 */
export async function getOcrWorker(onProgress?: (label: string) => void): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const mod = await loadModule()
      return mod.createWorker('eng', 1 /* OEM.LSTM_ONLY */, {
        workerPath: '/tesseract/worker.min.js',
        workerBlobURL: false,
        corePath: '/tesseract',
        langPath: '/tesseract',
        logger: (m: { status?: string; progress?: number }) => {
          if (onProgress && m.status) onProgress(m.status)
        },
      })
    })().catch((e) => {
      workerPromise = null // retry possible on next scan
      throw e
    })
  }
  return workerPromise
}

/** Release the worker (called when the scan workspace unmounts). */
export async function releaseOcrWorker(): Promise<void> {
  if (!workerPromise) return
  const w = await workerPromise.catch(() => null)
  workerPromise = null
  currentMode = null
  if (w) await w.terminate().catch(() => undefined)
}

async function setMode(worker: OcrWorker, mode: 'digits' | 'text'): Promise<void> {
  if (currentMode === mode) return
  const params =
    mode === 'digits'
      ? // Digits plus the canonical ABSENT marker — the standard sheet
        // instructs teachers to write "AB" in the marks column, so the
        // marks/roll cells must be able to read it (classifyMarks already
        // routes "AB" readings to REVIEW for teacher confirmation).
        { tessedit_char_whitelist: '0123456789AB', tessedit_pageseg_mode: '7' }
      : { tessedit_char_whitelist: '', tessedit_pageseg_mode: '7' }
  await worker.setParameters(params)
  currentMode = mode
}

export interface CellReading {
  /** Raw text exactly as recognised (trimmed, control chars removed). */
  text: string
  /** Tesseract confidence 0–100 (real; -1 when nothing was read). */
  confidence: number
}

/** Recognise a roll/marks cell (digits whitelist). */
export async function recognizeDigits(dataUrl: string): Promise<CellReading> {
  const worker = await getOcrWorker()
  await setMode(worker, 'digits')
  const { data } = await worker.recognize(dataUrl)
  return {
    text: (data.text || '').replace(/[\r\n\t]/g, ' ').trim(),
    confidence: typeof data.confidence === 'number' ? data.confidence : -1,
  }
}

/** Recognise a name cell (open charset — secondary matching only). */
export async function recognizeText(dataUrl: string): Promise<CellReading> {
  const worker = await getOcrWorker()
  await setMode(worker, 'text')
  const { data } = await worker.recognize(dataUrl)
  return {
    text: (data.text || '').replace(/[\r\n\t]/g, ' ').replace(/\s{2,}/g, ' ').trim(),
    confidence: typeof data.confidence === 'number' ? data.confidence : -1,
  }
}
