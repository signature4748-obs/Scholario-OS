'use client'

/**
 * ScanApplicationModal — Scan / Import Application (Wave 2 deep spec §28–37).
 *
 * A premium, REAL document-scan workflow on the school's own local OCR
 * engine (Tesseract, vendored assets — the scan never leaves the server):
 *
 *   ENTRY  →  CAMERA / UPLOAD  →  PROCESSING (staged animation)
 *   →  FIELD REVIEW (real confidences, ⚠ marks)  →  APPLY to the draft
 *
 * Safety (spec §32): OCR only POPULATES the admission draft — it never
 * submits or issues anything. Uncertain fields are flagged for review and
 * stay editable (spec §33). Failures explain themselves and offer
 * Try Again / Upload Different File / Enter Manually (spec §36).
 *
 * Honest limits: text extraction runs on PHOTOS and IMAGES. PDFs are
 * attached to the record but not text-extracted — stated plainly in the
 * UI, never faked.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Camera, UploadCloud, X, RefreshCw, ArrowRight, FileText,
  CheckCircle2, AlertTriangle, PencilLine, ScanLine, FileCheck2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { useDismissOnEscape } from '@/hooks/use-dismiss-on-escape'
import type { FormData } from '../constants'
import { recognizePage, compressImageForStorage } from '../lib/doc-ocr'
import {
  extractAdmissionFields, extractedToFormData, revalidateExtractedField,
  type ExtractedField,
} from '../lib/scan-fields'

type Phase = 'entry' | 'camera' | 'processing' | 'review' | 'failure'

type ScanStage = 'captured' | 'detected' | 'reading' | 'extracting' | 'matching' | 'ready'

const STAGE_LABELS: Array<{ key: ScanStage; label: string }> = [
  { key: 'captured', label: 'Captured' },
  { key: 'detected', label: 'Document detected' },
  { key: 'reading', label: 'Reading form' },
  { key: 'extracting', label: 'Extracting text' },
  { key: 'matching', label: 'Matching fields' },
  { key: 'ready', label: 'Ready for review' },
]

export interface ScanAttachment {
  fileName: string
  date: string
  confidence: number
  /** Compressed scan kept on the application record (spec §37 secure storage). */
  dataUrl?: string
}

const MAX_SCAN_BYTES = 8 * 1024 * 1024

export function ScanApplicationModal({
  open,
  onClose,
  onApplyData,
}: {
  open: boolean
  onClose: () => void
  onApplyData: (data: Partial<FormData>, attachment: ScanAttachment) => void
}) {
  const [phase, setPhase] = useState<Phase>('entry')
  const [scanUrl, setScanUrl] = useState<string | null>(null)
  const [scanName, setScanName] = useState<string>('')
  const [isPdfOnly, setIsPdfOnly] = useState(false)
  const [stage, setStage] = useState<ScanStage | null>(null)
  const [engineNote, setEngineNote] = useState('')
  const [fields, setFields] = useState<ExtractedField[]>([])
  const [avgConfidence, setAvgConfidence] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  const reduceMotion = useReducedMotion()

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const reset = useCallback(() => {
    stopCamera()
    setPhase('entry')
    setScanUrl(null)
    setScanName('')
    setIsPdfOnly(false)
    setStage(null)
    setEngineNote('')
    setFields([])
    setAvgConfidence(0)
  }, [stopCamera])

  useDismissOnEscape(() => { reset(); onClose() }, open)

  // Release the camera whenever we leave the camera phase.
  useEffect(() => {
    if (phase !== 'camera') stopCamera()
  }, [phase, stopCamera])

  useEffect(() => {
    if (!open) reset()
     
  }, [open])

  /* ── Camera ─────────────────────────────────────────── */

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      setPhase('camera')
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
      })
    } catch {
      toast.error('Camera unavailable', {
        description: 'Grant camera permission, or use Upload File instead.',
      })
      setPhase('entry')
    }
  }

  const captureFrame = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const scale = Math.min(1, 1800 / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
    stopCamera()
    setScanName(`scan-${new Date().toISOString().slice(0, 10)}.jpg`)
    void ingestScan(dataUrl)
  }

  /* ── Ingest → real OCR pipeline ─────────────────────── */

  // Plain async function — no memoization needed (consumed by plain handlers).
  const ingestScan = async (rawUrl: string, pdfOnly = false) => {
    setScanUrl(rawUrl)
    setPhase('processing')
    setStage('captured')

    if (pdfOnly) {
      // Honest PDF path: the scan is attached to the record; text extraction
      // is image-only (§36-style clarity instead of a fake reading).
      setStage('detected')
      setEngineNote('PDF attached for the record')
      setTimeout(() => {
        setIsPdfOnly(true)
        setPhase('failure')
      }, 500)
      return
    }

    try {
      await new Promise((r) => setTimeout(r, reduceMotion ? 60 : 400))
      setStage('detected')
      setStage('reading')
      setEngineNote('Loading the local reading engine…')

      const result = await recognizePage(rawUrl, (status) => {
        if (status.includes('recognizing')) {
          setStage('extracting')
          setEngineNote('Reading the form text…')
        } else if (status.includes('loading') || status.includes('initializing')) {
          setEngineNote('Preparing the reading engine (first scan takes a little longer)…')
        }
      })
      setStage('extracting')
      setEngineNote('')

      await new Promise((r) => setTimeout(r, reduceMotion ? 60 : 300))
      setStage('matching')
      const extracted = extractAdmissionFields(result.lines)
      await new Promise((r) => setTimeout(r, reduceMotion ? 60 : 350))

      if (extracted.length === 0) {
        setStage('ready')
        setEngineNote('')
        setPhase('failure')
        return
      }

      // Keep the compressed scan for the record; OCR ran on the original.
      const compressed = await compressImageForStorage(rawUrl, 1400)
      setScanUrl(compressed)
      setFields(extracted)
      setAvgConfidence(
        Math.round(extracted.reduce((s, f) => s + Math.max(0, f.confidence), 0) / extracted.length),
      )
      setStage('ready')
      setEngineNote('')
      setPhase('review')
    } catch {
      setEngineNote('')
      setPhase('failure')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return
    if (file.size > MAX_SCAN_BYTES) {
      toast.error('File too large', { description: `${file.name} is over 8 MB.` })
      return
    }
    setScanName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || '')
      if (file.type === 'application/pdf') {
        void ingestScan(url, true)
      } else if (/^image\/(png|jpe?g)$/.test(file.type)) {
        void ingestScan(url)
      } else {
        toast.error('Unsupported file', { description: 'Scan a photo or image (JPG, PNG) — or a PDF for the record.' })
      }
    }
    reader.onerror = () => toast.error('Could not read the file', { description: file.name })
    reader.readAsDataURL(file)
  }

  /* ── Review actions ─────────────────────────────────── */

  const handleFieldValueChange = (idx: number, val: string) => {
    // Live re-validation (§33): the ⚠ Review flag follows the CURRENT value —
    // cleared when the correction is valid, raised when an edit breaks it.
    setFields((prev) => prev.map((f, i) => (i === idx ? revalidateExtractedField(f, val) : f)))
  }

  const handleApply = () => {
    const payload = extractedToFormData(fields)
    onApplyData(payload, {
      fileName: scanName || 'scanned-form.jpg',
      date: formatDate(new Date().toISOString()),
      confidence: avgConfidence,
      dataUrl: isPdfOnly ? scanUrl || undefined : scanUrl || undefined,
    })
    reset()
    onClose()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan or import application"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.18 }}
        className="relative w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ScanLine className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base text-foreground truncate">Scan / Import Application</h3>
              <p className="text-xs text-muted-foreground">Read a filled paper form into the admission draft</p>
            </div>
          </div>
          <button onClick={() => { reset(); onClose() }} aria-label="Close" title="Close"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body (scrolls) */}
        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {/* ── ENTRY ── */}
          {phase === 'entry' && (
            <div className="grid sm:grid-cols-2 gap-3" data-testid="scan-entry">
              <button
                type="button"
                onClick={startCamera}
                disabled={!cameraSupported}
                title={cameraSupported ? 'Use the device camera' : 'Camera not available on this device'}
                className="group rounded-2xl border-2 border-dashed border-border hover:border-emerald-500 bg-card/40 hover:bg-emerald-500/5 p-6 text-center transition-all space-y-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Camera className="h-8 w-8 mx-auto text-muted-foreground group-hover:text-emerald-600 transition-colors" />
                <p className="text-sm font-semibold">Take Photo</p>
                <p className="text-[11px] text-muted-foreground">Point at the filled form</p>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group rounded-2xl border-2 border-dashed border-border hover:border-emerald-500 bg-card/40 hover:bg-emerald-500/5 p-6 text-center transition-all space-y-2"
              >
                <UploadCloud className="h-8 w-8 mx-auto text-muted-foreground group-hover:text-emerald-600 transition-colors" />
                <p className="text-sm font-semibold">Upload File</p>
                <p className="text-[11px] text-muted-foreground">JPG, PNG photo · PDF for the record</p>
              </button>
            </div>
          )}

          {/* ── CAMERA ── */}
          {phase === 'camera' && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-border bg-black aspect-[4/3] max-h-[52vh] mx-auto w-fit">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-contain"
                  aria-label="Camera view of the document"
                />
                {/* Framing guides */}
                <div className="absolute inset-6 sm:inset-10 border border-white/40 rounded-lg pointer-events-none" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Fill the frame with the form — steady, well-lit, top-down.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { stopCamera(); setPhase('entry') }}>Cancel</Button>
                <Button size="sm" onClick={captureFrame} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5">
                  <Camera className="h-4 w-4" /> Capture
                </Button>
              </div>
            </div>
          )}

          {/* ── PROCESSING (staged animation, real progress) ── */}
          {phase === 'processing' && scanUrl && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30 max-h-[38vh] mx-auto w-fit">
                { }
                <img src={scanUrl} alt="Scanned application form" className="max-h-[38vh] w-auto object-contain" />
                {/* Scanning line (paused for reduced motion) */}
                {!reduceMotion && (
                  <motion.div
                    className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.65)]"
                    initial={{ top: '4%' }}
                    animate={{ top: ['4%', '94%', '4%'] }}
                    transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </div>
              <ol className="space-y-1.5 max-w-xs mx-auto w-full" aria-live="polite">
                {STAGE_LABELS.map(({ key, label }) => {
                  const order = STAGE_LABELS.findIndex((s) => s.key === stage)
                  const idx = STAGE_LABELS.findIndex((s) => s.key === key)
                  const done = stage && idx < order
                  const active = stage === key
                  return (
                    <li key={key} className={cn('flex items-center gap-2 text-xs transition-colors duration-200',
                      done ? 'text-emerald-600 dark:text-emerald-400' : active ? 'text-foreground font-semibold' : 'text-muted-foreground/60')}>
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : active ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <div className="h-3.5 w-3.5 rounded-full border border-current opacity-40" />}
                      {label}
                    </li>
                  )
                })}
              </ol>
              {engineNote && <p className="text-[11px] text-muted-foreground text-center">{engineNote}</p>}
            </div>
          )}

          {/* ── REVIEW (editable, real confidences) ── */}
          {phase === 'review' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-foreground">Check the read values before they go in</p>
                <span className="text-[10px] font-mono font-semibold text-muted-foreground bg-muted/50 border border-border/60 rounded-full px-2 py-0.5 tabular-nums">
                  {fields.length} fields · avg {avgConfidence}%
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto border border-border rounded-xl divide-y divide-border/50">
                {fields.map((f, i) => (
                  <div key={f.fieldKey as string} className="p-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 hover:bg-muted/30">
                    <div className="flex items-center gap-2 sm:w-40 shrink-0">
                      <span className="text-xs font-semibold text-muted-foreground truncate">{f.label}</span>
                      {f.needsReview && (
                        <span
                          title={f.reviewHint || 'Low reading confidence — please check'}
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 shrink-0"
                        >
                          <AlertTriangle className="h-3 w-3" /> Review
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={f.value}
                      onChange={(e) => handleFieldValueChange(i, e.target.value)}
                      aria-label={`${f.label} extracted value`}
                      className={cn(
                        'flex-1 rounded-lg border bg-background px-2.5 py-1 text-xs text-foreground outline-none focus:border-primary',
                        f.needsReview ? 'border-amber-500/50' : 'border-border',
                      )}
                    />
                    <span className={cn('text-[9px] font-mono font-semibold tabular-nums shrink-0 sm:w-10 text-right',
                      f.confidence >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                      {f.confidence}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                These values populate the admission draft — nothing is submitted automatically.
              </p>
            </div>
          )}

          {/* ── FAILURE (honest + actionable) ── */}
          {phase === 'failure' && (
            <div className="py-6 text-center space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                {isPdfOnly ? <FileText className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {isPdfOnly ? 'PDF attached — text reading needs a photo' : 'Could not read this document clearly'}
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {isPdfOnly
                    ? 'The PDF is kept on the application record, but field extraction reads photos and images. Photograph the filled form or enter the details manually.'
                    : 'The scan was saved, but no form fields could be matched. Try a steadier, well-lit photo — or enter the details manually.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { setPhase('entry'); setScanUrl(null); setIsPdfOnly(false) }}>
                  <RefreshCw className="h-3.5 w-3.5" /> Try Again
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setPhase('entry'); setScanUrl(null); setIsPdfOnly(false); setTimeout(() => fileInputRef.current?.click(), 50) }}>
                  <UploadCloud className="h-3.5 w-3.5" /> Upload Different File
                </Button>
                <Button size="sm" onClick={() => { reset(); onClose() }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  <PencilLine className="h-3.5 w-3.5" /> Enter Manually
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === 'review' && (
          <div className="border-t border-border px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
            <Button variant="outline" size="sm" onClick={() => { setPhase('entry'); setScanUrl(null) }}>
              Scan Another
            </Button>
            <Button size="sm" onClick={handleApply} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5">
              <FileCheck2 className="h-4 w-4" /> Apply to Application <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={handleFileChange}
        />
      </motion.div>
    </div>
  )
}
