/**
 * admission/lib/doc-ocr — the REAL local OCR engine for the Admissions
 * module (Tesseract.js LSTM, vendored assets from /public/tesseract —
 * documents never leave the school's own server; no third-party service).
 *
 * Powers two surfaces with the same worker:
 *   1. Document upload (DocumentsStep) — genuine page confidence for the
 *      "N% OCR" badge. Never fabricated.
 *   2. Scan / Import Application — full-page text extraction + canonical
 *      admission-field mapping with per-field (line) confidences.
 *
 * The worker is a lazy singleton with PSM 3 (auto page segmentation) for
 * full-page recognition; the marks-scan module keeps its own PSM 7 worker.
 */

type OcrWorker = {
  setParameters: (params: Record<string, string>) => Promise<unknown>
  recognize: (
    image: string,
    options?: Record<string, unknown>,
    output?: Record<string, boolean>,
  ) => Promise<{
    data: {
      text: string
      confidence: number
      blocks: Array<{
        paragraphs?: Array<{
          lines?: Array<{ text: string; confidence: number; bbox?: { x0: number; y0: number; x1: number; y1: number } }>
        }>
      }> | null
    }
  }>
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

async function loadModule(): Promise<TesseractModule> {
  if (!modulePromise) {
    modulePromise = import('tesseract.js').then((m) => {
      const mod = (m as unknown as { default?: TesseractModule }).default ?? m
      return mod as TesseractModule
    })
  }
  return modulePromise
}

export type OcrProgressReporter = (label: string) => void

/** Get (or create) the shared full-page OCR worker. */
export function getDocOcrWorker(onProgress?: OcrProgressReporter): Promise<OcrWorker> {
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
export async function releaseDocOcrWorker(): Promise<void> {
  if (!workerPromise) return
  const w = await workerPromise.catch(() => null)
  workerPromise = null
  if (w) await w.terminate().catch(() => undefined)
}

export interface OcrPageResult {
  /** Full page text (normalized whitespace, kept line-by-line before normalize). */
  text: string
  /** Tesseract's overall page confidence 0–100 (real). */
  confidence: number
  /** Recognized lines with their own real confidences + geometry (for columnar forms). */
  lines: Array<OcrLine>
}

/** A recognized line: text + real confidence + bounding box (page pixels). */
export interface OcrLine {
  text: string
  confidence: number
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * Compress an image data URL for durable storage (long edge ≤ 1400px,
 * JPEG q0.72). Keeps scans legible while respecting the localStorage
 * budget of the persisted admission draft.
 */
export async function compressImageForStorage(dataUrl: string, maxEdge = 1400): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = dataUrl
    })
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
    if (scale >= 1 && dataUrl.length < 400_000) return dataUrl // already small
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const out = canvas.toDataURL('image/jpeg', 0.72)
    return out.length < dataUrl.length ? out : dataUrl
  } catch {
    return dataUrl
  }
}

/** Recognize a full page (image data URL). PSM 3 auto segmentation. */
export async function recognizePage(dataUrl: string, onProgress?: OcrProgressReporter): Promise<OcrPageResult> {
  const worker = await getDocOcrWorker(onProgress)
  await worker.setParameters({ tessedit_pageseg_mode: '3', tessedit_char_whitelist: '' })
  const { data } = await worker.recognize(dataUrl, {}, { text: true, blocks: true })
  const lines: OcrLine[] = []
  for (const block of data.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const t = (line.text || '').trim()
        if (!t) continue
        lines.push({
          text: t,
          confidence: Math.round(line.confidence),
          x0: line.bbox?.x0 ?? 0,
          y0: line.bbox?.y0 ?? 0,
          x1: line.bbox?.x1 ?? 0,
          y1: line.bbox?.y1 ?? 0,
        })
      }
    }
  }
  return {
    text: (data.text || '').trim(),
    confidence: typeof data.confidence === 'number' ? Math.round(data.confidence) : -1,
    lines,
  }
}
