'use client'

/**
 * Wizard Step 9 — Verification Documents (Wave 2 redesign).
 *
 * Information hierarchy (spec §2/§4):
 *   1. Compact REQUIRED / OPTIONAL summary line
 *   2. Filter tabs (All · Required · Optional · Pending · Verified · Rejected)
 *   3. REQUIRED DOCUMENTS group — policy blockers
 *   4. OPTIONAL DOCUMENTS group — supporting, never blocks
 *
 * Bulk verification asks for confirmation (spec §21). Required-document
 * business rules live in ../lib/documents.ts and are enforced at submit /
 * approve / issuance time (not here).
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
import {
  ADMISSION_DOCS, OPTIONAL_DOCS, REQUIRED_DOCS,
  summarizeDocGroup, type AdmissionDocDescriptor,
} from '../lib/documents'
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

const nowTimeStr = () =>
  new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Compact group summary line, e.g. "4 total · 3 uploaded · 1 pending". */
function GroupSummaryText({ s, verificationEnabled }: { s: ReturnType<typeof summarizeDocGroup>; verificationEnabled: boolean }) {
  const parts = [`${s.total} total`, `${s.uploaded} uploaded`]
  if (verificationEnabled && s.pending > 0) parts.push(`${s.pending} pending`)
  if (verificationEnabled && s.rejected > 0) parts.push(`${s.rejected} rejected`)
  if (s.deferred > 0) parts.push(`${s.deferred} deferred`)
  return <span className="tabular-nums">{parts.join(' · ')}</span>
}

export function DocumentsStep({ data, set, flags }: { data: FormData; set: <K extends keyof FormData>(k: K, v: FormData[K]) => void; flags: ReturnType<typeof useAdmissionFeatureFlags> }) {
  const verificationEnabled = !!flags.enableDocumentVerification
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeUploadKey, setActiveUploadKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<DocFilter>('all')
  const [confirmVerifyAll, setConfirmVerifyAll] = useState(false)

  const handleUpdateDoc = (key: string, patch: Partial<DocStatus>) => {
    const existing = data.docStatuses[key] || { status: 'pending' as const }
    set('docStatuses', { ...data.docStatuses, [key]: { ...existing, ...patch } })
  }

  const handleUploadClick = (key: string) => {
    setActiveUploadKey(key)
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!activeUploadKey) return
    const doc = ADMISSION_DOCS.find((d) => d.key === activeUploadKey)
    const fileName = file ? file.name : `${activeUploadKey}_Verified_Document.pdf`
    const ocrScore = Math.floor(Math.random() * 5) + 95
    handleUpdateDoc(activeUploadKey, {
      status: 'uploaded',
      fileName,
      ocrConfidence: ocrScore,
      verificationStatus: verificationEnabled ? 'pending' : undefined,
      verifiedBy: undefined,
      verificationTime: undefined,
      rejectionReason: undefined,
    })
    toast.success(`${doc?.name} uploaded`, {
      description: `OCR confidence ${ocrScore}%${verificationEnabled ? ' · Awaiting verifier review' : ''}`,
    })
    setActiveUploadKey(null)
    if (e.target) e.target.value = ''
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
      verifiedBy: 'Dr. Ananya Iyer',
      verificationTime: timeStr,
      rejectionReason: undefined,
    })
    toast.success('Document verified', { description: `Verified by Dr. Ananya Iyer · ${timeStr}` })
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
        verifiedBy: 'Dr. Ananya Iyer',
        verificationTime: timeStr,
        rejectionReason: undefined,
      }
    }
    set('docStatuses', updated)
    setConfirmVerifyAll(false)
    toast.success(`${pendingVerifyKeys.length} ${pendingVerifyKeys.length === 1 ? 'document' : 'documents'} verified`, {
      description: `Verified by Dr. Ananya Iyer · ${timeStr}`,
    })
  }

  const reqSummary = useMemo(
    () => summarizeDocGroup(REQUIRED_DOCS, data.docStatuses, verificationEnabled),
    [data.docStatuses, verificationEnabled],
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

  const renderGroup = (title: string, docs: AdmissionDocDescriptor[], summary: ReturnType<typeof summarizeDocGroup>, accent: string) => {
    if (docs.length === 0) return null
    return (
      <section className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-0.5">
          <h4 className={cn('text-[11px] font-bold uppercase tracking-wider', accent)}>{title}</h4>
          <p className="text-[11px] text-muted-foreground">
            <GroupSummaryText s={summary} verificationEnabled={verificationEnabled} />
          </p>
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
        title="Verification Documents"
        subtitle={
          verificationEnabled
            ? 'Upload and verify student documents with OCR-backed audit trail'
            : 'Upload student documents with automated OCR checks'
        }
        icon={<FileText className="h-5 w-5" />}
      />

      {/* Compact REQUIRED / OPTIONAL summary + bulk verify (spec §4) */}
      <div className="rounded-xl border border-border/70 bg-card/70 backdrop-blur-md p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 min-w-0">
          <div className="text-xs">
            <span className="font-bold text-rose-700 dark:text-rose-300">Required</span>{' '}
            <span className="text-muted-foreground">
              <GroupSummaryText s={reqSummary} verificationEnabled={verificationEnabled} />
            </span>
          </div>
          <div className="hidden sm:block text-border">|</div>
          <div className="text-xs">
            <span className="font-bold text-cyan-700 dark:text-cyan-300">Optional</span>{' '}
            <span className="text-muted-foreground">
              <GroupSummaryText s={optSummary} verificationEnabled={verificationEnabled} />
            </span>
          </div>
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

      {/* Filter tabs (spec §4) */}
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

      {/* REQUIRED group — policy blockers (spec §2) */}
      {renderGroup('Required Documents', requiredVisible, reqSummary, 'text-rose-700 dark:text-rose-300')}

      {/* OPTIONAL group — supporting documents (spec §2) */}
      {renderGroup('Optional Documents', optionalVisible, optSummary, 'text-cyan-700 dark:text-cyan-300')}

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
