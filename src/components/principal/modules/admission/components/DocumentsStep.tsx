'use client'

/**
 * Wizard Step 9 — Documents (Wave 2 deep refinement).
 *
 * Canonical policy (spec §1–§4):
 *   REQUIRED — Student Aadhaar Card only. Optional documents never block.
 *   Completion = requiredCompleted === requiredTotal (getDocumentsCompletion).
 *
 * Uploads store the REAL file (data URL) and run REAL local OCR (Tesseract)
 * on images — the "N% OCR" badge is a genuine page confidence, never a
 * random number. PDFs are stored and previewable; OCR text extraction is
 * image-only (stated honestly in the UI, no fake confidence).
 * Preview / Replace are real actions on the stored file.
 */
import { useMemo, useRef, useState } from 'react'
import { FileText, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { DocStatus } from '../types'
import { useAdmissionFeatureFlags } from '../lib/admission-utils'
import { useCurrentUser } from '@/lib/store/current-user-store'
import {
  ADMISSION_DOCS, OPTIONAL_DOCS, REQUIRED_DOCS, getDocumentsCompletion,
  summarizeDocGroup, type AdmissionDocDescriptor,
} from '../lib/documents'
import { recognizePage, compressImageForStorage } from '../lib/doc-ocr'
import type { FormData } from '../constants'
import { StepHeader } from './StepShared'
import { DocumentCard } from './DocumentCard'

type DocFilter = 'all' | 'required' | 'optional' | 'pending' | 'verified' | 'rejected'

const FILTER_TABS: { key: DocFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'required', label: 'Required' },
  { key: 'optional', label: 'Optional' },
  { key: 'pending', label: 'Pending' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
]

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

const nowTimeStr = () =>
  new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function DocumentsStep({ data, set, flags }: { data: FormData; set: <K extends keyof FormData>(k: K, v: FormData[K]) => void; flags: ReturnType<typeof useAdmissionFeatureFlags> }) {
  const verificationEnabled = !!flags.enableDocumentVerification
  const officerName = useCurrentUser((s) => s.me?.name) || 'Admission Officer'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeUploadKey, setActiveUploadKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<DocFilter>('all')
  const [confirmVerifyAll, setConfirmVerifyAll] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<{ name: string; st: DocStatus } | null>(null)

  // Latest docStatuses via ref — async OCR callbacks must merge into the
  // CURRENT statuses, never the stale snapshot captured at upload time.
  const docStatusesRef = useRef(data.docStatuses)
  docStatusesRef.current = data.docStatuses

  const handleUpdateDoc = (key: string, patch: Partial<DocStatus>) => {
    const existing = docStatusesRef.current[key] || { status: 'pending' as const }
    set('docStatuses', { ...docStatusesRef.current, [key]: { ...existing, ...patch } })
  }

  const handleUploadClick = (key: string) => {
    setActiveUploadKey(key)
    fileInputRef.current?.click()
  }

  /** Real file ingestion: store the data URL, run REAL OCR on images. */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const targetKey = activeUploadKey
    setActiveUploadKey(null)
    if (e.target) e.target.value = ''
    if (!file || !targetKey) return
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('File too large', { description: `${file.name} is over 5 MB. Please upload a smaller scan.` })
      return
    }

    const doc = ADMISSION_DOCS.find((d) => d.key === targetKey)
    const isImage = /^image\/(png|jpe?g)$/.test(file.type)
    const reader = new FileReader()
    reader.onload = async () => {
      const rawUrl = String(reader.result || '')
      // Compress image scans before storing (keeps the persisted draft in budget).
      const dataUrl = isImage ? await compressImageForStorage(rawUrl) : rawUrl
      handleUpdateDoc(targetKey, {
        status: 'uploaded',
        fileName: file.name,
        dataUrl,
        ocrConfidence: undefined, // reset — real value arrives below
        verificationStatus: verificationEnabled ? 'pending' : undefined,
        verifiedBy: undefined,
        verificationTime: undefined,
        rejectionReason: undefined,
      })
      if (isImage) {
        toast.success(`${doc?.name} uploaded`, {
          description: 'Reading the document locally…',
        })
        // Real local OCR (image only). Result replaces any provisional state.
        try {
          const result = await recognizePage(dataUrl)
          const conf = result.confidence
          handleUpdateDoc(targetKey, { ocrConfidence: conf >= 0 ? conf : undefined })
          if (conf >= 0) {
            toast.success(`${doc?.name} — OCR complete`, {
              description: `Text read at ${conf}% confidence${verificationEnabled ? ' · Awaiting verifier review' : ''}.`,
            })
          } else {
            toast.info(`${doc?.name} uploaded`, { description: 'No text could be read from this scan — verify it manually.' })
          }
        } catch {
          toast.warning(`${doc?.name} uploaded`, { description: 'OCR could not run on this file — the scan is stored for manual review.' })
        }
      } else {
        toast.success(`${doc?.name} uploaded`, {
          description: verificationEnabled ? 'Stored · Awaiting verifier review' : 'Stored.',
        })
      }
    }
    reader.onerror = () => toast.error('Could not read the file', { description: file.name })
    reader.readAsDataURL(file)
  }

  const handleDefer = (key: string) => {
    const doc = ADMISSION_DOCS.find((d) => d.key === key)
    handleUpdateDoc(key, { status: 'later', fileName: '' })
    toast.info(`${doc?.name} deferred`, {
      description: 'You can return to upload this before final enrollment confirmation.',
    })
  }

  const handleVerify = (key: string) => {
    const timeStr = nowTimeStr()
    handleUpdateDoc(key, {
      verificationStatus: 'verified',
      verifiedBy: officerName,
      verificationTime: timeStr,
      rejectionReason: undefined,
    })
    toast.success('Document verified', { description: `Verified by ${officerName} · ${timeStr}` })
  }

  /** Documents currently awaiting verification (pending or replace-requested). */
  const pendingVerifyKeys = useMemo(() => {
    const keys: string[] = []
    for (const doc of ADMISSION_DOCS) {
      const st = data.docStatuses[doc.key]
      if (
        st && st.status === 'uploaded' &&
        (!st.verificationStatus || st.verificationStatus === 'pending' || st.verificationStatus === 'replace_requested')
      ) keys.push(doc.key)
    }
    return keys
  }, [data.docStatuses])

  const handleConfirmVerifyAll = () => {
    const timeStr = nowTimeStr()
    const updated: Record<string, DocStatus> = { ...data.docStatuses }
    for (const key of pendingVerifyKeys) {
      updated[key] = {
        ...updated[key],
        verificationStatus: 'verified',
        verifiedBy: officerName,
        verificationTime: timeStr,
        rejectionReason: undefined,
      }
    }
    set('docStatuses', updated)
    setConfirmVerifyAll(false)
    toast.success(`${pendingVerifyKeys.length} ${pendingVerifyKeys.length === 1 ? 'document' : 'documents'} verified`, {
      description: `Verified by ${officerName} · ${timeStr}`,
    })
  }

  const completion = useMemo(
    () => getDocumentsCompletion(data.docStatuses),
    [data.docStatuses],
  )
  const optSummary = useMemo(
    () => summarizeDocGroup(OPTIONAL_DOCS, data.docStatuses, verificationEnabled),
    [data.docStatuses, verificationEnabled],
  )
  const pendingVerifyCount = pendingVerifyKeys.length

  /** Filter predicate per tab (spec §4 — filters query the full catalogue). */
  const matchesFilter = (doc: AdmissionDocDescriptor): boolean => {
    const st = data.docStatuses[doc.key]
    switch (filter) {
      case 'required': return doc.mandatory
      case 'optional': return !doc.mandatory
      case 'pending': {
        if (!verificationEnabled) return !!st && st.status === 'uploaded'
        return !!st && st.status === 'uploaded' &&
          (!st.verificationStatus || st.verificationStatus === 'pending' || st.verificationStatus === 'replace_requested')
      }
      case 'verified': {
        if (!verificationEnabled) return !!st && st.status === 'uploaded'
        return !!st && st.status === 'uploaded' && st.verificationStatus === 'verified'
      }
      case 'rejected': return !!st && st.status === 'uploaded' && st.verificationStatus === 'rejected'
      default: return true
    }
  }

  const requiredVisible = REQUIRED_DOCS.filter(matchesFilter)
  const optionalVisible = OPTIONAL_DOCS.filter(matchesFilter)

  const renderGroup = (title: string, docs: AdmissionDocDescriptor[], countLabel: string, accent: string) => {
    if (docs.length === 0) return null
    return (
      <section className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-0.5">
          <h4 className={cn('text-[11px] font-bold uppercase tracking-wider', accent)}>{title}</h4>
          <p className="text-[11px] text-muted-foreground tabular-nums">{countLabel}</p>
        </div>
        <div className="space-y-2.5">
          {docs.map((doc) => (
            <DocumentCard
              key={doc.key}
              doc={doc}
              st={data.docStatuses[doc.key] || { status: 'pending' }}
              verificationEnabled={verificationEnabled}
              onUploadClick={handleUploadClick}
              onDefer={handleDefer}
              onVerify={handleVerify}
              onPreview={() => {
                const st = data.docStatuses[doc.key]
                if (st) setPreviewDoc({ name: doc.name, st })
              }}
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
      />

      <StepHeader
        title="Documents"
        subtitle="Required and optional admission documents"
        icon={<FileText className="h-5 w-5" />}
      />

      {/* Compact completion summary (spec §2) + bulk verify */}
      <div className="rounded-xl border border-border/70 bg-card/70 backdrop-blur-md p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 min-w-0">
          <div className="text-xs">
            <span className="font-bold text-foreground">Required</span>{' '}
            <span className="text-muted-foreground tabular-nums">
              {completion.requiredCompleted}/{completion.requiredTotal} complete
              {completion.requiredDeferred > 0 ? ` · ${completion.requiredDeferred} deferred` : ''}
            </span>
          </div>
          <div className="hidden sm:block text-border">|</div>
          <div className="text-xs">
            <span className="font-bold text-foreground">Optional</span>{' '}
            <span className="text-muted-foreground tabular-nums">
              {completion.optionalUploaded}/{completion.optionalTotal} uploaded
            </span>
          </div>
          <div className="hidden sm:block text-border">|</div>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 border w-fit',
              completion.complete
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                : 'bg-muted/40 text-muted-foreground border-border/60',
            )}
          >
            <ShieldCheck className="h-3 w-3" />
            Documents {completion.complete ? '✓ Complete' : 'Incomplete'}
          </span>
        </div>
        {verificationEnabled && (
          <Button
            type="button"
            size="sm"
            onClick={() => setConfirmVerifyAll(true)}
            disabled={pendingVerifyCount === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 px-3 gap-1.5 shadow-sm disabled:opacity-50"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Verify All Pending{pendingVerifyCount > 0 ? ` (${pendingVerifyCount})` : ''}
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors border',
              filter === tab.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground border-transparent hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* REQUIRED group — the policy blocker (green emphasis, spec §4) */}
      {renderGroup('Required Documents', requiredVisible, `${completion.requiredCompleted}/${completion.requiredTotal} complete${completion.requiredDeferred > 0 ? ` · ${completion.requiredDeferred} deferred` : ''}`, 'text-emerald-700 dark:text-emerald-300')}

      {/* OPTIONAL group — neutral, never blocks (spec §4) */}
      {renderGroup('Optional Documents', optionalVisible, `${optSummary.uploaded}/${optSummary.total} uploaded`, 'text-muted-foreground')}

      {/* Empty state per filter */}
      {requiredVisible.length === 0 && optionalVisible.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/70 p-8 text-center space-y-1.5">
          <p className="text-sm font-semibold text-foreground">No documents match this filter</p>
          <p className="text-xs text-muted-foreground">
            {filter === 'rejected' ? 'No documents have been rejected.'
              : filter === 'verified' ? 'No verified documents yet — uploaded documents appear here once verified.'
              : filter === 'pending' ? 'No documents are awaiting verification.'
              : 'Try a different filter to see all documents.'}
          </p>
        </div>
      )}

      {/* Real preview dialog — renders the stored file (image or PDF) */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-6">{previewDoc?.name}</DialogTitle>
            <DialogDescription className="truncate font-mono text-[11px]">
              {previewDoc?.st.fileName || 'No file attached'}
            </DialogDescription>
          </DialogHeader>
          {previewDoc?.st.dataUrl ? (
            previewDoc.st.dataUrl.startsWith('data:image/') ? (
              <div className="rounded-lg border border-border overflow-hidden bg-muted/30 max-h-[65vh] flex items-center justify-center">
                { }
                <img
                  src={previewDoc.st.dataUrl}
                  alt={`${previewDoc.name} scan preview`}
                  className="max-h-[65vh] w-auto max-w-full object-contain"
                />
              </div>
            ) : (
              <object
                data={previewDoc.st.dataUrl}
                type="application/pdf"
                className="w-full h-[65vh] rounded-lg border border-border bg-muted/30"
                aria-label={`${previewDoc.name} PDF preview`}
              >
                <div className="p-6 text-center text-xs text-muted-foreground">
                  PDF preview is not available in this browser.{' '}
                  <a href={previewDoc.st.dataUrl} download={previewDoc.st.fileName || 'document.pdf'} className="text-primary underline">
                    Download the file
                  </a>{' '}
                  to view it.
                </div>
              </object>
            )
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">
              This document record has no stored file (legacy record).
            </p>
          )}
          <DialogFooter className="sm:justify-between gap-2">
            <span className="text-[11px] text-muted-foreground self-center">
              {previewDoc?.st.ocrConfidence != null ? `OCR confidence ${previewDoc.st.ocrConfidence}%` : 'No OCR reading (PDF or legacy record)'}
            </span>
            <Button size="sm" variant="outline" onClick={() => setPreviewDoc(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk verification confirmation (spec §21) */}
      <Dialog open={confirmVerifyAll} onOpenChange={setConfirmVerifyAll}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Verify {pendingVerifyCount} {pendingVerifyCount === 1 ? 'document' : 'documents'}?</DialogTitle>
            <DialogDescription>
              This will mark all currently pending documents as verified under your name.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setConfirmVerifyAll(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleConfirmVerifyAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
