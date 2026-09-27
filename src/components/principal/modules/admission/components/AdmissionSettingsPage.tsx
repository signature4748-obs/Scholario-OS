'use client'

import { useState, useCallback } from 'react'
import {
  PageHeader, SegmentedTabs, ActionBar,
} from '@/components/principal/modules/shared/settings-primitives'
import {
  SettingsDirtyProvider, useSettingsDirty,
} from '@/components/principal/modules/shared/use-settings-dirty'
import { toast } from 'sonner'
import type { AdmissionSettingsPageProps } from './field-config/types'
import { GeneralTab } from './field-config/GeneralTab'
import { SeatCapacityTab } from './field-config/SeatCapacityTab'

type TabId = 'general' | 'seats'

/**
 * AdmissionSettingsPage — two areas only: General and Seats.
 *
 * General holds every admission setting (workflow, duplicate detection,
 * field groups, medical, transport & hostel, financial, documents,
 * official documents, advanced) as expandable sections. Field
 * configuration is no longer a separate destination.
 *
 * Global dirty-state: any change on any section triggers the sticky
 * ActionBar; Save commits everything, Discard reverts everything.
 */
export function AdmissionSettingsPage({ onBack }: AdmissionSettingsPageProps) {
  return (
    <SettingsDirtyProvider>
      <AdmissionSettingsInner onBack={onBack} />
    </SettingsDirtyProvider>
  )
}

function AdmissionSettingsInner({ onBack }: AdmissionSettingsPageProps) {
  const [tab, setTab] = useState<TabId>('general')
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
        onBack={onBack}
        actions={
          <SegmentedTabs
            value={tab}
            onValueChange={setTab}
            tabs={[
              { value: 'general', label: 'General' },
              { value: 'seats', label: 'Seats' },
            ]}
          />
        }
      />

      {/* Both tabs stay mounted so their dirty state persists across switches */}
      <div className={tab === 'general' ? '' : 'hidden'}><GeneralTab /></div>
      <div className={tab === 'seats' ? '' : 'hidden'}><SeatCapacityTab /></div>

      <ActionBar
        dirty={dirty}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  )
}
