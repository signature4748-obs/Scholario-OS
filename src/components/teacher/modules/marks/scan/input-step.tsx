'use client'

/**
 * marks/scan/input-step — image input for the scan workflow: Upload /
 * Use Camera (live getUserMedia where available, native capture input
 * otherwise) / drag & drop. Shows the saved-draft resume banner and the
 * actionable error states (never a generic "something went wrong").
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  FileWarning,
  ImageUp,
  Keyboard,
  Loader2,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ScanError } from '@/lib/marks-scan/types'

const ACCEPTED = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'

interface InputStepProps {
  busy: boolean
  error: ScanError | null
  savedDraftAt: string | null
  onUpload: (dataUrl: string, fileName: string) => void
  onResumeDraft: () => void
  onDiscardDraft: () => void
  onEnterManually: () => void
}

export function InputStep({
  busy,
  error,
  savedDraftAt,
  onUpload,
  onResumeDraft,
  onDiscardDraft,
  onEnterManually,
}: InputStepProps) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [hasLiveCamera, setHasLiveCamera] = useState<boolean | null>(null)

  useEffect(() => {
    setHasLiveCamera(
      typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia ? true : false,
    )
  }, [])

  const readFile = useCallback(
    (file: File) => {
      const ok = /image\/(jpeg|jpg|png|webp)/i.test(file.type)
      if (!ok) {
        return // the accept filter already prevents this; stay silent
      }
      if (file.size > 18 * 1024 * 1024) {
        return
      }
      const reader = new FileReader()
      reader.onload = () => onUpload(String(reader.result), file.name)
      reader.readAsDataURL(file)
    },
    [onUpload],
  )

  return (
    <div className="space-y-4">
      {/* Saved draft banner — resume review without re-scanning. */}
      {savedDraftAt && !busy && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3.5 py-2.5">
          <p className="text-xs text-foreground">
            <span className="font-semibold">Saved scan draft found</span>
            <span className="text-muted-foreground">
              {' '}
              · last saved {new Date(savedDraftAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onResumeDraft}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Resume review
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={onDiscardDraft}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* Actionable error (spec part 22). */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.05] p-3.5">
          <div className="flex items-start gap-2.5">
            <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{error.hint}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={() => uploadRef.current?.click()}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => uploadRef.current?.click()}
                >
                  <ImageUp className="h-3.5 w-3.5" aria-hidden="true" /> Upload a clearer image
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onEnterManually}>
                  <Keyboard className="h-3.5 w-3.5" aria-hidden="true" /> Enter manually
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drop zone / input tiles */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files?.[0]
          if (file && !busy) readFile(file)
        }}
        className={cn(
          'rounded-xl border-2 border-dashed p-1 transition-colors',
          dragging ? 'border-primary bg-primary/[0.05]' : 'border-border bg-muted/20',
        )}
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => uploadRef.current?.click()}
            className="group flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-5 text-center shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.04] disabled:opacity-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Upload className="h-5 w-5" aria-hidden="true" />}
            </span>
            <span className="text-sm font-semibold">Upload Image</span>
            <span className="text-[11px] text-muted-foreground">JPG · PNG · WEBP — or drop it here</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => (hasLiveCamera ? setCameraOpen(true) : captureRef.current?.click())}
            className="group flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-5 text-center shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.04] disabled:opacity-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Camera className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold">Use Camera</span>
            <span className="text-[11px] text-muted-foreground">
              {hasLiveCamera == null ? 'Checking camera…' : hasLiveCamera ? 'Point at the sheet and capture' : 'Opens your device camera'}
            </span>
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Best results with a printed SCHOLARIO blank marks sheet — the roster is already on it, so
        only the marks need to be written.
      </p>

      <input
        ref={uploadRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
          e.target.value = ''
        }}
      />
      {/* Native camera capture (mobile fallback / primary on iOS file picker). */}
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
          e.target.value = ''
        }}
      />

      {cameraOpen && (
        <CameraDialog
          onClose={() => setCameraOpen(false)}
          onCapture={(dataUrl, name) => {
            setCameraOpen(false)
            onUpload(dataUrl, name)
          }}
        />
      )}
    </div>
  )
}

/** Live document camera via getUserMedia (rear camera preferred). */
function CameraDialog({
  onClose,
  onCapture,
}: {
  onClose: () => void
  onCapture: (dataUrl: string, name: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let dead = false
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      })
      .then((stream) => {
        if (dead) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().then(() => setReady(true)).catch(() => setErr('Camera stream could not start.'))
          }
        }
      })
      .catch(() => setErr('Camera permission was denied. Use Upload instead.'))
    return () => {
      dead = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const c = document.createElement('canvas')
    c.width = video.videoWidth
    c.height = video.videoHeight
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    onCapture(c.toDataURL('image/jpeg', 0.92), `camera-${new Date().toISOString().slice(11, 19)}.jpg`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ScanLine className="h-4 w-4 text-primary" aria-hidden="true" />
            Position the marks sheet
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close camera"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative aspect-[4/3] bg-black">
          {err ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-xs text-white/80">
              {err}
            </div>
          ) : (
            <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />
          )}
        </div>
        <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="h-9 px-6 text-xs" disabled={!ready} onClick={capture}>
            <Camera className="h-4 w-4" aria-hidden="true" /> Capture
          </Button>
        </div>
      </div>
    </div>
  )
}
