'use client'

/**
 * Single document card — Wave 2 deep refinement (spec §3/§4).
 *
 * Communicates in 1–2 seconds: document name, Required/Optional,
 * uploaded state, verification status, and ONE primary action.
 * Required carries the green SCHOLARIO emphasis; Optional is neutral
 * (never reads like an error). OCR confidence is shown ONLY when a real
 * local OCR reading exists (images); PDFs simply have no OCR badge.
 */
import {
  FileText, Paperclip, Eye, RefreshCw, UploadCloud, Clock,
  ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DocStatus } from '../types'
import type { AdmissionDocDescriptor } from '../lib/documents'
import { DocActionButton } from './StepShared'

export type { AdmissionDocDescriptor as DocDescriptor } from '../lib/documents'

/** Below this REAL OCR confidence the badge asks for a human look. */
const OCR_REVIEW_THRESHOLD = 90

export function DocumentCard({
  doc,
  st,
  verificationEnabled,
  onUploadClick,
  onDefer,
  onVerify,
  onPreview,
}: {
  doc: AdmissionDocDescriptor
  st: DocStatus
  verificationEnabled: boolean
  onUploadClick: (key: string) => void
  onDefer: (key: string) => void
  onVerify: (key: string) => void
  onPreview: () => void
}) {
  const isUploaded = st.status === 'uploaded'
  const isLater = st.status === 'later'
  const vStatus = st.verificationStatus
  const isVerified = verificationEnabled && isUploaded && vStatus === 'verified'
  const isRejected = verificationEnabled && isUploaded && vStatus === 'rejected'
  const isReplaceRequested = verificationEnabled && isUploaded && vStatus === 'replace_requested'
  const isPendingReview = verificationEnabled && isUploaded && (!vStatus || vStatus === 'pending')

  // Verification / upload state badge
  let vBadge: { label: string; className: string; Icon: typeof CheckCircle2 }
  if (verificationEnabled && isUploaded) {
    if (isVerified) vBadge = { label: 'Verified', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', Icon: CheckCircle2 }
    else if (isRejected) vBadge = { label: 'Rejected', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30', Icon: AlertTriangle }
    else if (isReplaceRequested) vBadge = { label: 'Replace Requested', className: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30', Icon: RefreshCw }
    else vBadge = { label: 'Pending Review', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', Icon: Clock }
  } else if (isUploaded) {
    vBadge = { label: 'Uploaded', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', Icon: CheckCircle2 }
  } else if (isLater) {
    vBadge = { label: 'Deferred', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', Icon: Clock }
  } else {
    vBadge = { label: 'Not Uploaded', className: 'bg-muted/40 text-muted-foreground border-border/60', Icon: AlertCircle }
  }

  const fileName = st.fileName || (isUploaded ? `${doc.key}_document` : isLater ? 'Deferred for later submission' : 'No file attached')
  const ocr = st.ocrConfidence ?? 0
  const lowOcr = ocr > 0 && ocr < OCR_REVIEW_THRESHOLD
  const hasFile = isUploaded && !!st.dataUrl

  const accentBorder = isVerified
    ? 'border-emerald-500/30'
    : isRejected
    ? 'border-rose-500/30'
    : isReplaceRequested
    ? 'border-violet-500/30'
    : isPendingReview
    ? 'border-amber-500/30'
    : 'border-border/70'

  return (
    <div
      className={cn(
        'group rounded-xl border bg-card/80 backdrop-blur-md p-3 transition-all duration-150 shadow-sm hover:shadow-md hover:bg-card',
        accentBorder,
      )}
    >
      {/* Row 1: icon + name + badges (reads in 1–2 seconds) */}
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            'p-2 rounded-lg shrink-0 flex items-center justify-center',
            isUploaded
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : isLater
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <FileText className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="font-semibold text-sm text-foreground tracking-tight">{doc.name}</h4>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-2 py-0 font-semibold rounded-full border',
                doc.mandatory
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                  : 'bg-muted/40 text-muted-foreground border-border/60',
              )}
            >
              {doc.mandatory ? 'Required' : 'Optional'}
            </Badge>
            <Badge variant="outline" className={cn('text-[10px] px-2 py-0 font-semibold rounded-full border flex items-center gap-1', vBadge.className)}>
              <vBadge.Icon className="h-3 w-3 shrink-0" />
              <span>{vBadge.label}</span>
            </Badge>
            {/* Real OCR metadata — only when a genuine reading exists */}
            {isUploaded && ocr > 0 && (
              <span
                className={cn(
                  'text-[10px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded-full border',
                  lowOcr
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25'
                    : 'bg-muted/40 text-muted-foreground border-border/60',
                )}
              >
                {lowOcr ? 'Review OCR' : `${ocr}% OCR`}
              </span>
            )}
          </div>
          {/* Row 2: file name */}
          <div className="mt-1 flex items-center gap-1.5 min-w-0">
            <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground/70" />
            <span className={cn('text-[11px] font-mono truncate', isUploaded ? 'text-foreground/90' : 'text-muted-foreground italic')}>
              {fileName}
            </span>
          </div>
        </div>

        {/* Actions — one primary per state */}
        <div className="flex items-center gap-1.5 shrink-0 self-center">
          {!isUploaded ? (
            <>
              {!isLater && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onDefer(doc.key)}
                  className="h-7 text-[11px] px-2 gap-1 text-muted-foreground hover:text-foreground font-medium"
                  title={doc.mandatory ? 'Defer — must be received before final enrollment' : 'Collect this later'}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Submit Later</span>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => onUploadClick(doc.key)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs h-7 px-3 gap-1.5"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                {isLater ? 'Upload Now' : 'Upload'}
              </Button>
            </>
          ) : (
            <>
              <DocActionButton icon={Eye} label="Preview" onClick={onPreview} disabled={!hasFile} />
              <DocActionButton icon={RefreshCw} label="Replace" onClick={() => onUploadClick(doc.key)} />
              {isPendingReview && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onVerify(doc.key)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-7 px-3 gap-1.5 shadow-sm"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verify
                </Button>
              )}
              {isReplaceRequested && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onUploadClick(doc.key)}
                  className="h-7 text-[11px] px-2.5 gap-1 border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 font-medium"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Replace File
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Verifier info (when verified) — compact single line */}
      {isUploaded && isVerified && st.verifiedBy && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <UserCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            Verified by <strong className="text-foreground font-medium">{st.verifiedBy}</strong>
          </span>
          {st.verificationTime && <span className="tabular-nums">{st.verificationTime}</span>}
        </div>
      )}

      {/* Rejection reason (when rejected) */}
      {isUploaded && isRejected && st.rejectionReason && (
        <div className="mt-2 flex items-start gap-1.5 text-[11px] text-rose-700 dark:text-rose-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{st.rejectionReason}</span>
        </div>
      )}
    </div>
  )
}
