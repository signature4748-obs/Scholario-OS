'use client'

import { useState, useCallback } from 'react'
import {
  PageHeader, SegmentedTabs,
} from '@/components/principal/modules/shared/settings-primitives'
import { ActionBar } from '@/components/principal/modules/shared/settings-primitives'
import {
  SettingsDirtyProvider, useSettingsDirty,
} from '@/components/principal/modules/shared/use-settings-dirty'
import { toast } from 'sonner'
import type { AdmissionSettingsPageProps } from './field-config/types'
import { WorkflowTab } from './field-config/WorkflowTab'
import { SeatCapacityTab } from './field-config/SeatCapacityTab'
import { FieldRulesTab } from './field-config/FieldRulesTab'
import { DocumentPrivacyTab } from './field-config/DocumentPrivacyTab'

type TabId = 'workflow' | 'seats' | 'fields' | 'privacy'

/**
 * AdmissionSettingsPage — full-page settings sub-route.
 *
 * Three-concept architecture (Wave 2 deep spec §13):
 *   WORKFLOW  — what applicants/officers must do.
 *   FORM FIELDS — what information is collected.
 *   DOCUMENTS & PRIVACY — what appears on generated official documents.
 * (+ SEATS — the class capacity ledger.)
 *
 * Global dirty-state: any change on ANY tab triggers the sticky ActionBar
 * at the bottom. Save commits all tabs; Discard reverts all tabs.
 */
export function AdmissionSettingsPage({ onBack }: AdmissionSettingsPageProps) {
  return (
    <SettingsDirtyProvider>
      <AdmissionSettingsInner onBack={onBack} />
    </SettingsDirtyProvider>
  )
}

function AdmissionSettingsInner({ onBack }: AdmissionSettingsPageProps) {
  const [tab, setTab] = useState<TabId>('workflow')
  const { dirty, saveAll, discardAll } = useSettingsDirty()

  const handleSave = useCallback(async () => {
    try {
      await saveAll()
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    }
  }, [saveAll])

  const handleDiscard = useCallback(async () => {
    await discardAll()
    toast.info('Changes discarded')
  }, [discardAll])

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <PageHeader
        title="Admission Settings"
        subtitle="Workflow, form fields, seats, and document privacy."
        onBack={onBack}
        actions={
          <SegmentedTabs
            value={tab}
            onValueChange={setTab}
            tabs={[
              { value: 'workflow', label: 'Workflow' },
              { value: 'seats', label: 'Seats' },
              { value: 'fields', label: 'Fields' },
              { value: 'privacy', label: 'Documents & Privacy' },
            ]}
          />
        }
      />

      {/* All tabs stay mounted so their dirty state persists across switches */}
      <div className={tab === 'workflow' ? '' : 'hidden'}><WorkflowTab /></div>
      <div className={tab === 'seats' ? '' : 'hidden'}><SeatCapacityTab /></div>
      <div className={tab === 'fields' ? '' : 'hidden'}><FieldRulesTab /></div>
      <div className={tab === 'privacy' ? '' : 'hidden'}><DocumentPrivacyTab /></div>

      <ActionBar
        dirty={dirty}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  )
}
