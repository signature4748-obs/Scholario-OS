/**
 * marks-scan/pipeline — conventional (non-AI) document processing for the
 * Scan Marks Sheet workflow. Everything runs on plain browser Canvas APIs:
 *
 *   load → downscale → grayscale → contrast stretch → deskew (projection
 *   variance) → Otsu binarize → ruling-line detection → row bands →
 *   column ranges → cell boxes.
 *
 * The engine is tuned for the standard SCHOLARIO blank marks sheet
 * (well-ruled table, roll + printed name columns, wide marks column), but
 * degrades honestly: when the geometry checks fail, `detectTable` returns
 * null and the UI shows an actionable error instead of guessing.
 */

import type { CellBox } from './types'

/** Long-edge cap for OCR input — big enough for A4 @ 150dpi, small enough
 *  to keep per-cell recognition fast. */
const MAX_EDGE = 1800
/** Below this long edge the image is flagged as too low quality. */
const MIN_EDGE = 700

export interface ProcessedImage {
  canvas: HTMLCanvasElement
  width: number
  height: number
  /** Deskew angle applied (degrees, positive = rotated clockwise). */
  deskewAngle: number
  /** 0–100 rough ink/darkness contrast after normalisation. */
  contrastScore: number
  dataUrl: string
}

export interface DetectedTable {
  /** Row bands (top→bottom), each with the marks-cell box. */
  rows: { y: number; h: number; roll: CellBox; name: CellBox; marks: CellBox }[]
  /** Table bounding box on the processed canvas. */
  bounds: CellBox
}

// ─── Image loading ─────────────────────────────────────────────────────

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image could not be decoded'))
    img.src = dataUrl
  })
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('File could not be read'))
    reader.readAsDataURL(file)
  })
}

// ─── Grayscale + contrast stretch ──────────────────────────────────────

/** Grayscale + contrast stretch. The stretch normalises washed-out
 *  photos (grey paper → white) using the MEDIAN of the dark class and the
 *  median of the bright class as the range anchors — class medians are
 *  stable no matter how little ink the page carries (a fixed-percentile
 *  anchor collapses to span≈0 on sparse pages and blacks out the whole
 *  image). Clean scans (span already wide) pass through as plain
 *  grayscale. */
export function grayscaleStretch(src: CanvasRenderingContext2D, w: number, h: number): ImageData {
  const img = src.getImageData(0, 0, w, h)
  const d = img.data
  const hist = new Uint32Array(256)
  const gray = new Uint8ClampedArray(w * h)
  for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
    const v = g > 255 ? 255 : g < 0 ? 0 : g | 0
    gray[p] = v
    hist[v] += 1
  }
  // Class medians: median of pixels < 128 (ink) and median of ≥ 128 (paper).
  const total = w * h
  let darkCount = 0
  let brightCount = 0
  for (let v = 0; v < 128; v += 1) darkCount += hist[v]
  brightCount = total - darkCount
  let lo = 0
  let hi = 255
  if (darkCount >= total * 0.0005 && brightCount > 0) {
    let acc = 0
    const darkTarget = Math.ceil(darkCount / 2)
    for (let v = 0; v < 128; v += 1) {
      acc += hist[v]
      if (acc >= darkTarget) {
        lo = v
        break
      }
    }
    acc = 0
    const brightTarget = Math.ceil(brightCount / 2)
    for (let v = 128; v < 256; v += 1) {
      acc += hist[v]
      if (acc >= brightTarget) {
        hi = v
        break
      }
    }
  }
  // Always normalise to grayscale; the STRETCH is skipped when the class
  // span is already wide (re-stretching a clean scan only adds artifacts).
  const stretch = hi - lo <= 180 && darkCount >= total * 0.0005
  const span = Math.max(hi - lo, 1)
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
    const v = stretch
      ? Math.max(0, Math.min(255, (((gray[p] - lo) * 255) / span) | 0))
      : gray[p]
    d[i] = v
    d[i + 1] = v
    d[i + 2] = v
    d[i + 3] = 255
  }
  return img
}

// ─── Deskew (projection-variance, classic non-AI) ──────────────────────

/** Ink mask (dark pixels) of a grayscale image at a binarisation threshold. */
function inkMask(src: CanvasRenderingContext2D, w: number, h: number, threshold: number): Uint8Array {
  const d = src.getImageData(0, 0, w, h).data
  const mask = new Uint8Array(w * h)
  for (let p = 0, i = 0; p < mask.length; p += 1, i += 4) {
    mask[p] = d[i] < threshold ? 1 : 0
  }
  return mask
}

/** Otsu threshold over the grayscale histogram. */
export function otsuThreshold(src: CanvasRenderingContext2D, w: number, h: number): number {
  const d = src.getImageData(0, 0, w, h).data
  const hist = new Uint32Array(256)
  const n = w * h
  for (let p = 0, i = 0; p < n; p += 1, i += 4) {
    hist[d[i]] += 1
  }
  let sum = 0
  for (let v = 0; v < 256; v += 1) sum += v * hist[v]
  let sumB = 0
  let wB = 0
  let best = 0
  let threshold = 128
  for (let v = 0; v < 256; v += 1) {
    wB += hist[v]
    if (wB === 0) continue
    const wF = n - wB
    if (wF === 0) break
    sumB += v * hist[v]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > best) {
      best = between
      threshold = v
    }
  }
  return threshold
}

/** Dilate a binary mask by ±tol rows ("v") or ±tol columns ("h"). */
function dilateMask(mask: Uint8Array, w: number, h: number, tol: number, dir: 'v' | 'h'): Uint8Array {
  const out = new Uint8Array(mask.length)
  if (dir === 'v') {
    for (let y = 0; y < h; y += 1) {
      const lo = Math.max(0, y - tol)
      const hi = Math.min(h - 1, y + tol)
      for (let s = lo; s <= hi; s += 1) {
        const base = s * w
        const dst = y * w
        for (let x = 0; x < w; x += 1) {
          if (mask[base + x]) out[dst + x] = 1
        }
      }
    }
  } else {
    for (let y = 0; y < h; y += 1) {
      const base = y * w
      for (let x = 0; x < w; x += 1) {
        if (!mask[base + x]) continue
        const lo = Math.max(0, x - tol)
        const hi = Math.min(w - 1, x + tol)
        for (let d = lo; d <= hi; d += 1) out[base + d] = 1
      }
    }
  }
  return out
}

/** Row-projection count of ink for the mask rotated by `deg` (center origin). */
function projectionVariance(mask: Uint8Array, w: number, h: number, deg: number): number {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const cx = w / 2
  const cy = h / 2
  const rows = new Float64Array(h + 8)
  const x0 = Math.floor(w * 0.12)
  const x1 = Math.ceil(w * 0.88) // ignore page margins
  for (let y = 0; y < h; y += 1) {
    const dy = y - cy
    for (let x = x0; x < x1; x += 2) {
      if (!mask[y * w + x]) continue
      const dx = x - cx
      const ry = dy * cos + dx * sin + cy
      const r = ry | 0
      if (r >= 0 && r < rows.length) rows[r] += 1
    }
  }
  let mean = 0
  for (let i = 0; i < rows.length; i += 1) mean += rows[i]
  mean /= rows.length
  let variance = 0
  for (let i = 0; i < rows.length; i += 1) {
    const d = rows[i] - mean
    variance += d * d
  }
  return variance
}

/**
 * Estimate the skew of a ruled/text document between -6° and +6° by
 * maximising horizontal-projection variance (text lines align → sharp
 * projection peaks → maximum variance).
 */
export function estimateSkew(mask: Uint8Array, w: number, h: number): number {
  let bestAngle = 0
  let bestVariance = -1
  for (let deg = -6; deg <= 6; deg += 0.5) {
    const v = projectionVariance(mask, w, h, deg)
    if (v > bestVariance) {
      bestVariance = v
      bestAngle = deg
    }
  }
  return bestAngle
}

function rotateCanvas(canvas: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  const rad = (deg * Math.PI) / 180
  const w = canvas.width
  const h = canvas.height
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.translate(w / 2, h / 2)
  ctx.rotate(rad)
  ctx.drawImage(canvas, -w / 2, -h / 2)
  return out
}

// ─── Ruling-line / table detection ─────────────────────────────────────

interface LineRuns {
  /** Horizontal ruling lines: y positions (center), sorted. */
  hLines: number[]
  /** Vertical ruling lines: x positions (center), sorted. */
  vLines: number[]
}

function detectRulingLines(
  src: CanvasRenderingContext2D,
  w: number,
  h: number,
  threshold: number,
): LineRuns {
  const mask = inkMask(src, w, h, threshold)

  // Residual-skew tolerance. Deskew quantises to 0.5° steps, so after
  // correction a ruling line can still drift up to ~4–5 px vertically
  // across the sheet width. A drifted line never reaches the ≥55% ink
  // threshold in a single pixel row, so the projection is computed on a
  // mask dilated ±2px ALONG the line direction — enough to absorb the
  // drift without merging adjacent rows (rows are ≥14px apart).
  const maskV = dilateMask(mask, w, h, 2, 'v') // for horizontal lines
  const maskH = dilateMask(mask, w, h, 2, 'h') // for vertical lines

  // Horizontal lines: rows where ≥55% of the analysed width is ink.
  const x0 = Math.floor(w * 0.08)
  const x1 = Math.ceil(w * 0.92)
  const hNeed = (x1 - x0) * 0.55
  const rowInk = new Uint32Array(h)
  for (let y = 0; y < h; y += 1) {
    let count = 0
    const base = y * w
    for (let x = x0; x < x1; x += 1) {
      if (maskV[base + x]) count += 1
    }
    rowInk[y] = count
  }
  const hLines: number[] = []
  let y = 0
  while (y < h) {
    if (rowInk[y] >= hNeed) {
      let end = y
      let peak = y
      while (end + 1 < h && rowInk[end + 1] >= hNeed) {
        end += 1
        if (rowInk[end] > rowInk[peak]) peak = end
      }
      // A THICK qualifying run is a filled band (the standard sheet's dark
      // header strip ≈7.5 mm ≈44px, not a ruling line ≤~13px even after
      // dilation). The row-divider the student rows attach to is the band's
      // BOTTOM edge — using the run centre would fuse the header with
      // row 1 and OCR would see both texts in a single cell.
      hLines.push(end - y > 16 ? end : (y + end) / 2)
      y = end + 1
    } else {
      y += 1
    }
  }

  // Vertical lines: columns where ≥45% of the span between the first and
  // last horizontal line is ink.
  const vLines: number[] = []
  if (hLines.length >= 2) {
    const y0 = Math.max(0, Math.floor(hLines[0]))
    const y1 = Math.min(h - 1, Math.ceil(hLines[hLines.length - 1]))
    const vNeed = (y1 - y0) * 0.45
    for (let x = 1; x < w - 1; x += 1) {
      let count = 0
      for (let yy = y0; yy <= y1; yy += 1) {
        if (maskH[yy * w + x]) count += 1
      }
      // Group adjacent hits so one thick line = one detection.
      if (count >= vNeed) {
        let endX = x
        let bestCount = count
        while (endX + 1 < w - 1) {
          let c2 = 0
          for (let yy = y0; yy <= y1; yy += 1) {
            if (maskH[yy * w + endX + 1]) c2 += 1
          }
          if (c2 < vNeed) break
          endX += 1
          if (c2 > bestCount) bestCount = c2
        }
        vLines.push((x + endX) / 2)
        x = endX + 1
      }
    }
  }
  return { hLines, vLines }
}

export interface TableDetectionResult {
  table: DetectedTable | null
  /** Quality diagnostics for actionable errors. */
  hLineCount: number
  vLineCount: number
  contrastScore: number
}

/**
 * Detect the marks table on a processed (deskewed, grayscale) canvas.
 * Geometry model — matches the standard SCHOLARIO blank marks sheet, a
 * 4-column grid (ROLL 13% | NAME 45% | MARKS 19% | REMARKS 23% → five
 * vertical ruling lines). The teacher writes marks in the MARKS column,
 * i.e. the SECOND-TO-LAST column band. Generic 3-column sheets (roll |
 * name | marks → four lines) keep marks as the last band.
 * Rows = bands between consecutive horizontal ruling lines (≥3 required).
 */
export function detectTable(
  src: CanvasRenderingContext2D,
  w: number,
  h: number,
  contrastScore: number,
): TableDetectionResult {
  const threshold = otsuThreshold(src, w, h)
  const { hLines, vLines } = detectRulingLines(src, w, h, threshold)

  if (hLines.length < 3 || vLines.length < 3) {
    return { table: null, hLineCount: hLines.length, vLineCount: vLines.length, contrastScore }
  }

  // Column assignment: leftmost→roll, then the marks band (see model
  // above). Anchors are the standard sheet's measured fractions.
  const tableLeft = vLines[0]
  const tableRight = vLines[vLines.length - 1]
  // Prefer the inner dividers closest to the standard sheet's positions.
  const tableW = tableRight - tableLeft
  const pickNear = (target: number): number => {
    let best = vLines[1]
    let bestDist = Infinity
    for (let i = 1; i < vLines.length - 1; i += 1) {
      const dist = Math.abs(vLines[i] - (tableLeft + tableW * target))
      if (dist < bestDist) {
        bestDist = dist
        best = vLines[i]
      }
    }
    return best
  }
  const standardSheet = vLines.length >= 5 // 4 printed columns
  const rollDivider = pickNear(standardSheet ? 0.132 : 0.24)
  // MARKS = [name|marks divider, marks|remarks divider] on the standard
  // sheet (≈58%→77% of the table width); the LAST band on a 3-column sheet.
  const marksStart = pickNear(standardSheet ? 0.582 : 0.72)
  const marksEnd = standardSheet ? pickNear(0.769) : tableRight
  if (marksEnd <= rollDivider + tableW * 0.15) {
    return { table: null, hLineCount: hLines.length, vLineCount: vLines.length, contrastScore }
  }

  const rows: DetectedTable['rows'] = []
  // Full inter-line cell spans — cropCell applies the OCR inset.
  for (let i = 0; i + 1 < hLines.length; i += 1) {
    const top = hLines[i]
    const bottom = hLines[i + 1]
    const rowH = bottom - top
    if (rowH < 14) continue // hairline gap / header artifacts
    rows.push({
      y: top,
      h: rowH,
      roll: { x: tableLeft, y: top, w: rollDivider - tableLeft, h: rowH },
      name: { x: rollDivider, y: top, w: marksStart - rollDivider, h: rowH },
      marks: { x: marksStart, y: top, w: marksEnd - marksStart, h: rowH },
    })
  }

  if (rows.length < 2) {
    return { table: null, hLineCount: hLines.length, vLineCount: vLines.length, contrastScore }
  }

  return {
    table: {
      rows,
      bounds: { x: tableLeft, y: hLines[0], w: tableW, h: hLines[hLines.length - 1] - hLines[0] },
    },
    hLineCount: hLines.length,
    vLineCount: vLines.length,
    contrastScore,
  }
}

// ─── The full pre-OCR process ──────────────────────────────────────

/** Ink/paper separation — stable quality metric independent of how MUCH
 *  ink the page carries (a 2-row page scores the same as a 40-row one).
 *  Returns the mean separation between the dark class and the bright
 *  class, or 0 when either class is (near-)missing. */
function dynamicRange(src: CanvasRenderingContext2D, w: number, h: number): number {
  const d = src.getImageData(0, 0, w, h).data
  const total = w * h
  let darkCount = 0
  let brightCount = 0
  let darkSum = 0
  let brightSum = 0
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
    if (g < 128) {
      darkCount += 1
      darkSum += g
    } else {
      brightCount += 1
      brightSum += g
    }
  }
  // Need real ink (≥0.05% dark pixels) AND real paper (≥30% bright).
  if (darkCount < total * 0.0005 || brightCount < total * 0.3) return 0
  return Math.abs(brightSum / brightCount - darkSum / darkCount)
}

export interface PreprocessResult {
  image: ProcessedImage
  /** Preview data URL (smaller, for the split-screen source view). */
  previewUrl: string
}

/**
 * Full conventional pre-processing: downscale → grayscale+contrast →
 * deskew estimate → rotate → re-stretch. Throws `ScanError`-style Errors
 * with actionable `code` properties for the UI.
 */
export async function preprocessScanImage(
  dataUrl: string,
): Promise<PreprocessResult> {
  const img = await loadImageFromDataUrl(dataUrl)
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight)
  if (longEdge < MIN_EDGE) {
    const err = new Error('Image quality is too low for reliable extraction.')
    ;(err as Error & { code?: string }).code = 'low-quality'
    throw err
  }

  const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))

  const base = document.createElement('canvas')
  base.width = w
  base.height = h
  const bctx = base.getContext('2d')
  if (!bctx) throw new Error('Canvas is not available in this browser')
  bctx.fillStyle = '#ffffff'
  bctx.fillRect(0, 0, w, h)
  bctx.drawImage(img, 0, 0, w, h)

  // Pass 1: grayscale (+ contrast stretch only when the tonal range is
  // narrow — e.g. grey phone photos). Clean scans pass through as plain
  // grayscale; over-stretching a clean scan would add mid-tone halos.
  // Quality gate: the RAW dynamic range must show real ink-vs-paper
  // separation (stable regardless of how many rows are on the page).
  const contrastScore = dynamicRange(bctx, w, h)
  if (contrastScore < 35) {
    const err = new Error('Image quality is too low for reliable extraction.')
    ;(err as Error & { code?: string }).code = 'low-quality'
    throw err
  }
  bctx.putImageData(grayscaleStretch(bctx, w, h), 0, 0)

  // Pass 2: deskew (small angles only — a straight scan is never rotated).
  const t1 = otsuThreshold(bctx, w, h)
  const mask = inkMask(bctx, w, h, t1)
  const angle = estimateSkew(mask, w, h)
  let processed = Math.abs(angle) >= 0.5 ? rotateCanvas(base, angle) : base
  // NOTE: no second contrast pass — re-stretching an already-normalised
  // scan over-darkens antialiased strokes into mid-tone halos that
  // destroy OCR binarisation (found via pixel forensics on real crops).

  // Preview for the split view: JPEG, capped at 1100px long edge.
  const previewScale = Math.min(1, 1100 / Math.max(processed.width, processed.height))
  const preview = document.createElement('canvas')
  preview.width = Math.max(1, Math.round(processed.width * previewScale))
  preview.height = Math.max(1, Math.round(processed.height * previewScale))
  const prCtx = preview.getContext('2d')
  if (prCtx) {
    prCtx.fillStyle = '#ffffff'
    prCtx.fillRect(0, 0, preview.width, preview.height)
    prCtx.drawImage(processed, 0, 0, preview.width, preview.height)
  }

  return {
    image: {
      canvas: processed,
      width: processed.width,
      height: processed.height,
      deskewAngle: angle,
      contrastScore: Math.round(contrastScore),
      dataUrl: preview.toDataURL('image/jpeg', 0.72),
    },
    previewUrl: preview.toDataURL('image/jpeg', 0.72),
  }
}

/** Crop a cell box off a canvas as an upscaled, OCR-ready data URL.
 *  A generous inset (≈14% of cell height, min 6px) removes ruling-line
 *  remnants — leftover line antialiasing at the cell edge collapses
 *  single-word OCR (measured: "01"@29% → "01"@94% with the inset). */
export function cropCell(canvas: HTMLCanvasElement, box: CellBox, scale = 4): string {
  const pad = Math.max(6, Math.round(Math.min(box.h, box.w) * 0.14))
  const innerW = Math.max(2, box.w - pad * 2)
  const innerH = Math.max(2, box.h - pad * 2)
  const out = document.createElement('canvas')
  out.width = Math.round(innerW * scale)
  out.height = Math.round(innerH * scale)
  const ctx = out.getContext('2d')
  if (!ctx) return ''
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(
    canvas,
    box.x + pad,
    box.y + pad,
    innerW,
    innerH,
    0,
    0,
    out.width,
    out.height,
  )
  return out.toDataURL('image/png')
}
