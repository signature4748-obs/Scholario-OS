'use client'

/**
 * Single document card used inside the Documents wizard step.
 *
 * Deliberately minimal (Wave 2 spec): document name, Required/Optional
 * tag, status, filename, and ONE clear action — [Upload] when missing,
 * or [Preview] / [Verify] (and [Remove]) once uploaded. No decorative
 * action rows, no invented OCR scores, no description paragraphs.
 */
import {
  FileText, UploadCloud, ShieldCheck, Trash2,
  Clock, AlertTriangle, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { DocStatus } from '../types'
import type { AdmissionDocumentDef } from '../lib/documents'

export type { AdmissionDocumentDef as DocDescriptor }

export function DocumentCard({
  doc,
  st,
  verificationEnabled,
  onUploadClick,
  onVerify,
  onRemove,
}: {
  doc: AdmissionDocumentDef
  st: DocStatus
  verificationEnabled: boolean
  onUploadClick: (key: string) => void
  onVerify: (key: string) => void
  onRemove: (key: string) => void
}) {
  const isUploaded = st.status === 'uploaded'
  const vStatus = st.verificationStatus
  const isVerified = verificationEnabled && isUploaded && vStatus === 'verified'
  const isRejected = verificationEnabled && isUploaded && vStatus === 'rejected'
  const isPendingReview =
    verificationEnabled && isUploaded && (!vStatus || vStatus === 'pending')

  // Status badge — the single most important signal on the card.
  let vBadge: { label: string; className: string; Icon: typeof CheckCircle2 }
  if (verificationEnabled && isUploaded) {
    if (isVerified)
      vBadge = { label: 'Verified', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', Icon: CheckCircle2 }
    else if (isRejected)
      vBadge = { label: 'Rejected', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30', Icon: AlertTriangle }
    else
      vBadge = { label: 'Pending Review', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', Icon: Clock }
  } else if (isUploaded) {
    vBadge = { label: 'Uploaded', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', Icon: CheckCircle2 }
  } else {
    vBadge = { label: 'Not Uploaded', className: 'bg-muted/40 text-muted-foreground border-border/60', Icon: AlertCircle }
  }

  const fileName =
    st.fileName || (isUploaded ? `${doc.key}.pdf` : 'No file attached')

  return (
    <div
      className={cn(
        'rounded-lg border bg-card px-3.5 py-3 transition-colors',
        isUploaded ? 'border-border' : 'border-dashed border-border/70 bg-muted/10',
        doc.required && !isUploaded && 'border-amber-500/40'
      )}
    >
      {/* Row 1: name + tags + status */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <FileText
          className={cn(
            'h-4 w-4 shrink-0',
            isUploaded ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
          )}
        />
        <span className="text-sm font-semibold text-foreground min-w-0 truncate flex-1 basis-full sm:basis-auto">
          {doc.name}
        </span>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-2 py-0 font-semibold rounded-full border shrink-0',
            doc.required
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
              : 'bg-muted/40 text-muted-foreground border-border/60'
          )}
        >
          {doc.required ? 'Required' : 'Optional'}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-2 py-0 font-semibold rounded-full border flex items-center gap-1 shrink-0',
            vBadge.className
          )}
        >
          <vBadge.Icon className="h-3 w-3 shrink-0" />
          <span>{vBadge.label}</span>
        </Badge>
      </div>

      {/* Row 2: filename */}
      {isUploaded && (
        <p className="mt-1.5 pl-6 text-[11px] text-muted-foreground font-mono truncate">
          {fileName}
        </p>
      )}
      {isUploaded && isRejected && st.rejectionReason && (
        <p className="mt-1 pl-6 text-[11px] text-rose-600 dark:text-rose-400 truncate">
          Reason: {st.rejectionReason}
        </p>
      )}

      {/* Row 3: ONE clear action */}
      <div className="mt-2 flex items-center gap-2">
        {!isUploaded ? (
          <Button
            type="button"
            size="sm"
            onClick={() => onUploadClick(doc.key)}
            className="h-7 text-[11px] px-3 gap-1.5 font-semibold"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Upload
          </Button>
        ) : (
          <div className="flex items-center gap-1.5">
            {isPendingReview && (
              <Button
                type="button"
                size="sm"
                onClick={() => onVerify(doc.key)}
                className="h-7 text-[11px] px-3 gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Verify
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                toast.info('Preview', {
                  description: `${doc.name} — ${fileName}`,
                })
              }
              className="h-7 text-[11px] px-2.5 gap-1 text-muted-foreground hover:text-foreground font-medium"
            >
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onRemove(doc.key)}
              className="h-7 text-[11px] px-2.5 gap-1 text-muted-foreground hover:text-rose-600 font-medium"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
