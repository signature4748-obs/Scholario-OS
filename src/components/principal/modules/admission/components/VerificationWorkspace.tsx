'use client'

import { useState } from 'react'
import { ArrowLeft, ShieldCheck, FileWarning, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useAdmissionStore,
  SectionKey,
} from '@/lib/store/admission-store'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import { toast } from 'sonner'

import { getSectionsConfig } from './verification/sections-config'
import { VerificationHeader } from './verification/VerificationHeader'
import { VerificationSectionCard } from './verification/VerificationSectionCard'
import { VerificationSidebar } from './verification/VerificationSidebar'
import { CorrectionDialog } from './verification/CorrectionDialog'
import { RejectionDialog } from './verification/RejectionDialog'
import { evaluateRequiredDocs } from '../lib/documents'

interface VerificationWorkspaceProps {
  appId: string
  onBack: () => void
  onApprovedNext: (appId: string) => void
  onOpenWizardToEdit: (appId: string) => void
  /** Jump straight to the wizard's Documents step (missing-required-docs banner). */
  onOpenWizardToDocuments?: (appId: string) => void
}

export function VerificationWorkspace({
  appId,
  onBack,
  onApprovedNext,
  onOpenWizardToEdit,
  onOpenWizardToDocuments,
}: VerificationWorkspaceProps) {
  const store = useAdmissionStore()
  const admissionSettings = useSchoolSettingsStore((s) => s.admissionSettings)
  const featureFlags = admissionSettings.featureFlags
  const app = store.applications.find((a) => a.id === appId)

  const [overallRemarks, setOverallRemarks] = useState(app?.generalRemarks || '')
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false)

  if (!app) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-sm text-muted-foreground">Application record not found.</p>
        <Button onClick={onBack}>Back to Dashboard</Button>
      </div>
    )
  }

  // Build the verification checklist once, honoring admission feature flags.
  // Settings like enableMedical / enablePreviousSchool / enableStudentPhoto
  // actually hide the corresponding sections — they're not visual-only.
  const visibleSections = getSectionsConfig({
    enableMedical: featureFlags.enableMedical,
    enablePreviousSchool: featureFlags.enablePreviousSchool,
    enableStudentPhoto: featureFlags.enableStudentPhoto,
  })

  const sectionReviews = app.sectionReviews || {}

  const handleSectionStatusChange = (key: SectionKey, status: 'Complete' | 'Incomplete' | 'Needs Review') => {
    store.updateSectionReview(app.id, key, { status })
    toast.success(`Section status updated to ${status}`)
  }

  const handleSectionRemarkChange = (key: SectionKey, remarks: string) => {
    store.updateSectionReview(app.id, key, { remarks })
  }

  // Required-document policy (spec §3): missing required docs block approval;
  // deferred ones are allowed but stay visible to the officer.
  const requiredIssues = evaluateRequiredDocs(app.formData.docStatuses || {})
  const missingRequired = requiredIssues.filter((i) => i.kind === 'missing')
  const deferredRequired = requiredIssues.filter((i) => i.kind === 'deferred')
  const blockApprove = missingRequired.length > 0

  const handleApprove = () => {
    if (blockApprove) {
      toast.error('Required documents missing', {
        description: 'Upload the missing required documents (or defer them) before approving.',
      })
      return
    }
    store.approveApplication(app.id, overallRemarks)
    toast.success('Application Approved! Opening Admission Issuance Workspace...')
    onApprovedNext(app.id)
  }

  const handleConfirmCorrection = () => {
    if (!overallRemarks.trim()) {
      toast.error('Please enter overall correction instructions for the applicant.')
      return
    }
    store.requestCorrection(app.id, overallRemarks)
    toast.success('Application returned for correction with section remarks.')
    setCorrectionDialogOpen(false)
    onBack()
  }

  const handleConfirmReject = () => {
    if (!rejectionReason.trim()) {
      toast.error('Please specify a rejection reason for compliance auditing.')
      return
    }
    store.rejectApplication(app.id, rejectionReason, 60)
    toast.success('Application moved to Rejected Queue (Retention active).')
    setRejectDialogOpen(false)
    onBack()
  }

  // Count flagged sections
  const flaggedCount = Object.values(sectionReviews).filter(
    (s) => s.status === 'Needs Review' || s.status === 'Incomplete'
  ).length

  return (
    <div className="space-y-5">
      {/* Back button — standalone, clean */}
      <Button variant="outline" size="sm" onClick={onBack} className="h-8 gap-1.5 text-xs w-fit">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Dashboard
      </Button>

      <VerificationHeader
        app={app}
        flaggedCount={flaggedCount}
        sectionCount={visibleSections.length}
        blockApprove={blockApprove}
        onOpenWizardToEdit={onOpenWizardToEdit}
        onNeedCorrection={() => setCorrectionDialogOpen(true)}
        onReject={() => setRejectDialogOpen(true)}
        onApprove={handleApprove}
      />

      {/* Required-document policy banners (spec §3) */}
      {blockApprove && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <FileWarning className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                {missingRequired.length} required {missingRequired.length === 1 ? 'document is' : 'documents are'} missing — approval blocked
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {missingRequired.map((m) => m.doc.name).join(', ')} must be uploaded (or explicitly deferred) before this application can be approved.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => (onOpenWizardToDocuments ? onOpenWizardToDocuments(app.id) : onOpenWizardToEdit(app.id))}
            className="text-xs h-7 shrink-0 border-rose-300 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
          >
            Open Documents
          </Button>
        </div>
      )}
      {!blockApprove && deferredRequired.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 px-4 py-3 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>{deferredRequired.length} required {deferredRequired.length === 1 ? 'document' : 'documents'} deferred:</strong>{' '}
            {deferredRequired.map((d) => d.doc.name).join(', ')} — submission permitted, but must be received before final enrollment.
          </p>
        </div>
      )}

      {/* Main Grid: Section Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              {visibleSections.length}-Section Verification Checklist
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              {visibleSections.length - flaggedCount} / {visibleSections.length} Verified
            </span>
          </div>

          {visibleSections.map(({ key, title, icon }) => {
            const review = sectionReviews[key] || { status: 'Complete', remarks: '' }
            return (
              <VerificationSectionCard
                key={key}
                app={app}
                sectionKey={key}
                title={title}
                icon={icon}
                review={review}
                onStatusChange={handleSectionStatusChange}
                onRemarkChange={handleSectionRemarkChange}
              />
            )
          })}
        </div>

        {/* Sidebar: Overall Audit Trail & Summary */}
        <div className="lg:col-span-4 space-y-4">
          <VerificationSidebar
            app={app}
            flaggedCount={flaggedCount}
            overallRemarks={overallRemarks}
            onOverallRemarksChange={setOverallRemarks}
          />
        </div>
      </div>

      {/* Need Correction Confirmation Dialog */}
      <CorrectionDialog
        open={correctionDialogOpen}
        onOpenChange={setCorrectionDialogOpen}
        overallRemarks={overallRemarks}
        onOverallRemarksChange={setOverallRemarks}
        onConfirm={handleConfirmCorrection}
      />

      {/* Rejection Confirmation Dialog */}
      <RejectionDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        rejectionReason={rejectionReason}
        onRejectionReasonChange={setRejectionReason}
        onConfirm={handleConfirmReject}
      />
    </div>
  )
}
