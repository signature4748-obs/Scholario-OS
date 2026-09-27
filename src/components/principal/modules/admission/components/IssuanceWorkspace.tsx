'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAdmissionStore } from '@/lib/store/admission-store'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import { toast } from 'sonner'

import { buildIssuanceArtifacts } from './issuance/letter-data'
import { computeAdmissionFeeSummary } from '../lib/fee-summary'
import { evaluateRequiredDocs } from '../lib/documents'
import { IssuanceHeader } from './issuance/IssuanceHeader'
import { DossierSummary } from './issuance/DossierSummary'
import { IssuanceTabs, type IssuanceTabKey } from './issuance/IssuanceTabs'
import { LetterTab } from './issuance/LetterTab'
import { FeeReceiptTab } from './issuance/FeeReceiptTab'
import { CredentialsTab } from './issuance/CredentialsTab'
import { WelcomeLetterTab } from './issuance/WelcomeLetterTab'
import { DispatchesTab } from './issuance/DispatchesTab'

interface IssuanceWorkspaceProps {
  appId: string
  onBack: () => void
  onCompleted: () => void
}

export function IssuanceWorkspace({
  appId,
  onBack,
  onCompleted,
}: IssuanceWorkspaceProps) {
  const store = useAdmissionStore()
  // Subscribe to admission settings so the fee summary recomputes when the
  // school's fee configuration changes (canonical engine, reactive read).
  const admissionSettings = useSchoolSettingsStore((s) => s.admissionSettings)
  const app = store.applications.find((a) => a.id === appId)

  const [activeTab, setActiveTab] = useState<IssuanceTabKey>('letter')

  // Canonical fee derivation (spec §28) — same engine as the Fee Structure
  // wizard step; recomputed when settings or the application change.
  const feeSummary = useMemo(
    () => computeAdmissionFeeSummary(app?.formData.className || '', app?.feeData, {
      enableTransport: admissionSettings.featureFlags.enableTransport,
      enableHostel: admissionSettings.featureFlags.enableHostel,
    }),
    [app?.formData.className, app?.feeData, admissionSettings.featureFlags.enableTransport, admissionSettings.featureFlags.enableHostel],
  )

  if (!app) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-sm text-muted-foreground">Application record not found.</p>
        <Button onClick={onBack}>Back to Dashboard</Button>
      </div>
    )
  }

  const formData = app.formData
  const isCompleted = app.status === 'Completed'
  const artifacts = buildIssuanceArtifacts(app, feeSummary)

  // Required-document policy (spec §3): final enrollment is blocked while a
  // required document is missing (deferred ones are allowed but tracked).
  const requiredIssues = evaluateRequiredDocs(formData.docStatuses || {})
  const missingRequired = requiredIssues.filter((i) => i.kind === 'missing')
  const deferredRequired = requiredIssues.filter((i) => i.kind === 'deferred')
  const blockEnroll = missingRequired.length > 0

  const handleCompleteAndEnroll = () => {
    if (blockEnroll) {
      toast.error('Required documents missing', {
        description: 'Enrollment is blocked until the missing required documents are received.',
      })
      return
    }
    const newStudent = store.completeAdmission(app.id, {
      admissionNo: artifacts.admissionNo,
      studentId: artifacts.studentId,
      rollNo: artifacts.rollNo,
      regNo: artifacts.regNo,
    })

    toast.success(
      `Admission Issued! ${formData.firstName} ${formData.lastName} enrolled into ${formData.className} (${artifacts.rollNo}).`
    )
    if (deferredRequired.length > 0) {
      toast.info(`${deferredRequired.length} required ${deferredRequired.length === 1 ? 'document' : 'documents'} still deferred`, {
        description: 'Follow up with the family before the session starts.',
      })
    }
    onCompleted()
  }

  const handleCopyCredentials = () => {
    navigator.clipboard.writeText(`Portal URL: https://portal.scholario.app\nLogin ID: ${artifacts.loginId}\nTemp Password: ${artifacts.tempPassword}`)
    toast.success('Credentials copied to clipboard!')
  }

  return (
    <div className="space-y-6">
      {/* Header — action hierarchy: primary CTA + Documents menu (spec §7) */}
      <IssuanceHeader
        app={app}
        isCompleted={isCompleted}
        blockEnroll={blockEnroll}
        onBack={onBack}
        onCompleteAndEnroll={handleCompleteAndEnroll}
        onOpenTab={setActiveTab}
        onPrintDossier={() => window.print()}
      />

      {/* Official record — identity → admission → parent → docs → fee → timeline (spec §6) */}
      <DossierSummary
        app={app}
        artifacts={artifacts}
        feeSummary={feeSummary}
        verificationEnabled={!!admissionSettings.featureFlags.enableDocumentVerification}
      />

      {/* Documents navigation (compact, scrollable on mobile) */}
      <IssuanceTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab 1: Embedded Official Admission Letter */}
      {activeTab === 'letter' && (
        <LetterTab artifacts={artifacts} onBack={onBack} />
      )}

      {/* Tab 2: Fee Receipt (canonical fee engine) */}
      {activeTab === 'receipt' && (
        <FeeReceiptTab app={app} artifacts={artifacts} feeSummary={feeSummary} />
      )}

      {/* Tab 3: Credentials */}
      {activeTab === 'credentials' && (
        <CredentialsTab artifacts={artifacts} onCopy={handleCopyCredentials} />
      )}

      {/* Tab 4: Welcome Letter */}
      {activeTab === 'welcome' && (
        <WelcomeLetterTab app={app} />
      )}

      {/* Tab 5: Multi-channel Dispatches */}
      {activeTab === 'dispatches' && (
        <DispatchesTab app={app} />
      )}
    </div>
  )
}
