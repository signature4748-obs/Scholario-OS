'use client'

/**
 * Wizard Step 9 — Documents.
 *
 * Canonical policy (lib/documents.ts): EXACTLY ONE required document
 * (Student Aadhaar Card); everything else is optional and informational.
 * The step shows two visually distinct groups — REQUIRED (emphasised,
 * green emphasis when complete) and OPTIONAL (neutral) — with minimal
 * document cards: name, Required/Optional tag, status, filename, and
 * one clear action ([Upload] or [Preview] / [Verify]).
 */
import { useMemo, useRef, useState } from 'react'
import { FileText, ShieldCheck, CheckCircle2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { DocStatus } from '../types'
import { useAdmissionFeatureFlags } from '../lib/admission-utils'
import {
  REQUIRED_DOCUMENTS,
  OPTIONAL_DOCUMENTS,
  getDocumentCompletion,
  type AdmissionDocumentDef,
} from '../lib/documents'
import type { FormData } from '../constants'
import { StepHeader } from './StepShared'
import { DocumentCard } from './DocumentCard'

const nowTimeStr = () =>
  new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export function DocumentsStep({
  data,
  set,
  flags,
}: {
  data: FormData
  set: <K extends keyof FormData>(k: K, v: FormData[K]) => void
  flags: ReturnType<typeof useAdmissionFeatureFlags>
}) {
  const verificationEnabled = !!flags.enableDocumentVerification
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeUploadKey, setActiveUploadKey] = useState<string | null>(null)

  const completion = useMemo(
    () => getDocumentCompletion(data.docStatuses),
    [data.docStatuses]
  )

  const handleUpdateDoc = (key: string, patch: Partial<DocStatus>) => {
    const existing = data.docStatuses[key] || { status: 'pending' as const }
    set('docStatuses', {
      ...data.docStatuses,
      [key]: { ...existing, ...patch },
    })
  }

  const handleUploadClick = (key: string) => {
    setActiveUploadKey(key)
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!activeUploadKey) return
    const doc = [...REQUIRED_DOCUMENTS, ...OPTIONAL_DOCUMENTS].find(
      (d) => d.key === activeUploadKey
    )
    const fileName = file ? file.name : `${activeUploadKey}_document.pdf`
    handleUpdateDoc(activeUploadKey, {
      status: 'uploaded',
      fileName,
      // Honest upload — no invented OCR score. OCR confidence is only
      // ever set by the real OCR scan flow.
      ocrConfidence: undefined,
      verificationStatus: verificationEnabled ? 'pending' : undefined,
      verifiedBy: undefined,
      verificationTime: undefined,
      rejectionReason: undefined,
    })
    toast.success(`${doc?.name} uploaded`, {
      description: verificationEnabled
        ? 'Awaiting verifier review'
        : doc?.required
          ? 'Required document received'
          : undefined,
    })
    setActiveUploadKey(null)
    if (e.target) e.target.value = ''
  }

  const handleVerify = (key: string) => {
    const timeStr = nowTimeStr()
    handleUpdateDoc(key, {
      verificationStatus: 'verified',
      verifiedBy: 'Principal',
      verificationTime: timeStr,
      rejectionReason: undefined,
    })
    toast.success('Document verified', {
      description: `Verified by Principal · ${timeStr}`,
    })
  }

  const handleRemove = (key: string) => {
    handleUpdateDoc(key, {
      status: 'pending',
      fileName: undefined,
      ocrConfidence: undefined,
      verificationStatus: verificationEnabled ? undefined : undefined,
      verifiedBy: undefined,
      verificationTime: undefined,
      rejectionReason: undefined,
    })
    const doc = [...REQUIRED_DOCUMENTS, ...OPTIONAL_DOCUMENTS].find(
      (d) => d.key === key
    )
    if (doc?.required) {
      toast.warning(`${doc.name} removed`, {
        description: 'This application cannot be submitted without it.',
      })
    } else {
      toast.info(`${doc?.name} removed`)
    }
  }

  const renderDoc = (doc: AdmissionDocumentDef) => {
    const st = data.docStatuses[doc.key] || { status: 'pending' as const }
    return (
      <DocumentCard
        key={doc.key}
        doc={doc}
        st={st}
        verificationEnabled={verificationEnabled}
        onUploadClick={handleUploadClick}
        onVerify={handleVerify}
        onRemove={handleRemove}
      />
    )
  }

  return (
    <div className="space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <StepHeader
        title="Documents"
        subtitle="Upload the required document. Optional documents can be added now or later."
        icon={<FileText className="h-5 w-5" />}
      />

      {/* Completion summary — full-width row (no collision with the header on narrow screens) */}
      <div
        className={
          completion.complete
            ? 'flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold'
            : 'flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold'
        }
      >
        {completion.complete ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        ) : (
          <ShieldCheck className="h-4 w-4 shrink-0" />
        )}
        <span className="min-w-0">{completion.summaryLine}</span>
      </div>

      {/* REQUIRED group — emphasised */}
      <section aria-label="Required documents">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Required
          </h3>
          <span className="text-[11px] text-muted-foreground">
            needed to submit this application
          </span>
        </div>
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-3 space-y-2.5">
          {REQUIRED_DOCUMENTS.map(renderDoc)}
        </div>
      </section>

      {/* OPTIONAL group — neutral */}
      <section aria-label="Optional documents">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Optional
          </h3>
          <span className="text-[11px] text-muted-foreground">
            accepted if available — never block submission
          </span>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2.5">
          {OPTIONAL_DOCUMENTS.map(renderDoc)}
        </div>
      </section>
    </div>
  )
}
