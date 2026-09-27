'use client'

import { useCallback, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  AuditLogEntry,
  CompactEnterpriseDocCardProps,
} from './types'

/**
 * Owns the doc-card state, computed metadata, and event handlers.
 *
 * Honest-state rules (Wave 2):
 *  - Upload is an upload: no invented OCR score, no auto-"Verified",
 *    no fake "AI Vision" verifier. OCR confidence appears only when a
 *    real scan produced it.
 *  - History starts empty; entries are appended as real actions happen.
 */
export function useDocCard({
  doc,
  statusState,
  onUpdateStatus,
}: CompactEnterpriseDocCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const isUploaded = statusState.status === 'uploaded'
  const isLater = statusState.status === 'later'

  // Default computed metadata if not set
  const effectiveFileName = isUploaded
    ? statusState.fileName || `${doc.key}_document.pdf`
    : isLater
    ? 'Deferred for later submission'
    : 'No file attached yet'

  const effectiveOcr = statusState.ocrConfidence
  const effectiveVerifiedBy = statusState.verifiedBy || '—'
  const effectiveVerificationTime = statusState.verificationTime || '—'

  // Real history — starts empty, grows with actual actions.
  const [historyLogs, setHistoryLogs] = useState<AuditLogEntry[]>([])

  // Handle file selection — an honest upload (no invented confidence).
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      const selectedFileName = file ? file.name : `${doc.key}_document.pdf`
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const timeString = `Today, ${nowTime}`

      onUpdateStatus(
        doc.key,
        'uploaded',
        selectedFileName,
        0,
        '',
        timeString
      )

      setHistoryLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          timestamp: timeString,
          action: isUploaded ? 'Document Replaced' : 'Document Uploaded',
          actor: 'Admission Office',
          details: `File "${selectedFileName}" attached.`,
        },
      ])

      toast.success(`${doc.name} uploaded`)

      if (e.target) e.target.value = ''
    },
    [doc.key, doc.name, isUploaded, onUpdateStatus]
  )

  const handleDownload = useCallback(() => {
    if (!isUploaded) {
      toast.error('No document uploaded yet')
      return
    }
    toast.success(`Downloading ${effectiveFileName}`, {
      description: 'Document package generated for official record.',
    })
  }, [effectiveFileName, isUploaded])

  const handleDefer = useCallback(() => {
    onUpdateStatus(doc.key, 'later', '', 0, '', '')
    toast.info(`${doc.name} marked for later submission`, {
      description:
        'You can return to upload this certificate before final enrollment confirmation.',
    })
  }, [doc.key, doc.name, onUpdateStatus])

  // Determine top badge styling
  let statusLabel = 'Pending Upload'
  let statusBadgeStyle =
    'bg-muted/10 text-muted-foreground dark:text-muted-foreground border-muted-foreground/20'
  let StatusIcon: LucideIcon = AlertCircle

  if (isUploaded) {
    const isVerifiedDoc = !!statusState.verifiedBy
    statusLabel = isVerifiedDoc ? 'Verified' : 'Uploaded'
    statusBadgeStyle = isVerifiedDoc
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
      : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
    StatusIcon = isVerifiedDoc ? CheckCircle2 : CheckCircle2
  } else if (isLater) {
    statusLabel = 'Deferred'
    statusBadgeStyle =
      'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    StatusIcon = Clock
  }

  return {
    fileInputRef,
    isPreviewOpen,
    setIsPreviewOpen,
    isHistoryOpen,
    setIsHistoryOpen,
    historyLogs,
    isUploaded,
    isLater,
    effectiveFileName,
    effectiveOcr,
    effectiveVerifiedBy,
    effectiveVerificationTime,
    statusLabel,
    statusBadgeStyle,
    StatusIcon,
    handleFileChange,
    handleDownload,
    handleDefer,
  }
}

export type UseDocCardReturn = ReturnType<typeof useDocCard>
