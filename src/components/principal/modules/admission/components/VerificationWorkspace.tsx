'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useAdmissionStore,
  type SectionKey,
} from '@/lib/store/admission-store'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import { toast } from 'sonner'

import { getSectionsConfig } from './verification/sections-config'
import { countVerified } from './verification/section-status'
import { VerificationHeader } from './verification/VerificationHeader'
import { VerificationSectionCard } from './verification/VerificationSectionCard'
import { OfficerNotes, AuditHistory } from './verification/OfficerNotes'
import { CorrectionDialog } from './verification/CorrectionDialog'
import { RejectionDialog } from './verification/RejectionDialog'

interface VerificationWorkspaceProps {
  appId: string
  onBack: () => void
  onApprovedNext: (appId: string) => void
  onOpenWizardToEdit: (appId: string) => void
}

/**
 * Verification (Review) workspace — a VERIFICATION WORKSPACE, not a full
 * application reproduction (spec §11–§24):
 *
 *   primary   → compact header + section statuses + decision actions
 *   secondary → full section details (View expands a section)
 *   tertiary  → audit history (collapsed by default)
 *
 * Every status is derived from the application's actual data and the
 * school's admission configuration — nothing is hardcoded.
 */
export function VerificationWorkspace({
  appId,
  onBack,
  onApprovedNext,
  onOpenWizardToEdit,
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

  // Section list derives from the school's ACTUAL admission configuration.
  const visibleSections = getSectionsConfig({
    enableMedical: featureFlags.enableMedical,
    enablePreviousSchool: featureFlags.enablePreviousSchool,
    enableStudentPhoto: featureFlags.enableStudentPhoto,
  })

  const { verified, total, incomplete, flagged } = countVerified(visibleSections, app)

  const handleFlag = (
    key: SectionKey,
    status: 'Needs Review' | 'Incomplete',
    issue: string
  ) => {
    store.updateSectionReview(app.id, key, { status, remarks: issue })
    toast.success(`${status} — issue attached to the section`)
  }

  const handleClearFlag = (key: SectionKey) => {
    store.updateSectionReview(app.id, key, { status: 'Complete', remarks: '' })
    toast.success('Section flag cleared')
  }

  const handleApprove = () => {
    // Real ERP guard: data-incomplete sections block approval. Officer
    // "Needs Review" flags are advisory — the officer decides.
    if (incomplete > 0) {
      toast.error('Resolve incomplete sections before approving.', {
        description: 'Required data (documents, photo) is missing.',
      })
      return
    }
    store.approveApplication(app.id, overallRemarks)
    toast.success('Application approved — opening issuance workspace…')
    onApprovedNext(app.id)
  }

  const handleConfirmCorrection = () => {
    if (!overallRemarks.trim()) {
      toast.error('Please enter overall correction instructions for the applicant.')
      return
    }
    store.requestCorrection(app.id, overallRemarks)
    toast.success('Application returned for correction.')
    setCorrectionDialogOpen(false)
    onBack()
  }

  const handleConfirmReject = () => {
    if (!rejectionReason.trim()) {
      toast.error('Please specify a rejection reason for compliance auditing.')
      return
    }
    store.rejectApplication(
      app.id,
      rejectionReason,
      admissionSettings.rejectionRetentionDays || 60
    )
    toast.success('Application moved to the Rejected queue.')
    setRejectDialogOpen(false)
    onBack()
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Button variant="outline" size="sm" onClick={onBack} className="h-8 gap-1.5 text-xs w-fit">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Dashboard
      </Button>

      <VerificationHeader
        app={app}
        verified={verified}
        total={total}
        flagged={flagged}
        onOpenWizardToEdit={onOpenWizardToEdit}
        onNeedCorrection={() => setCorrectionDialogOpen(true)}
        onReject={() => setRejectDialogOpen(true)}
        onApprove={handleApprove}
      />

      {/* Compact verification rows */}
      <div className="space-y-2.5">
        {visibleSections.map(({ key, title, icon }) => (
          <VerificationSectionCard
            key={key}
            app={app}
            sectionKey={key}
            title={title}
            icon={icon}
            onFlag={handleFlag}
            onClearFlag={handleClearFlag}
          />
        ))}
      </div>

      {/* ONE overall officer-notes field, near the decision area */}
      <OfficerNotes value={overallRemarks} onChange={setOverallRemarks} />

      {/* Audit history — collapsed by default */}
      <AuditHistory app={app} />

      <CorrectionDialog
        open={correctionDialogOpen}
        onOpenChange={setCorrectionDialogOpen}
        overallRemarks={overallRemarks}
        onOverallRemarksChange={setOverallRemarks}
        onConfirm={handleConfirmCorrection}
      />

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
