'use client'

/**
 * DocumentPrivacyTab — DOCUMENT OUTPUT PRIVACY (Wave 2 deep spec §16/§17).
 *
 * The third settings concept: what the generated OFFICIAL documents expose.
 * Deliberately separate from form fields — collecting a field in the
 * admission form never automatically prints it on the admission letter.
 * Every switch here gates a real rendering path in the Official Admission
 * Letter (and its downloadable copy).
 */
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  SettingsCard, SettingsCardSection, ToggleRow,
} from '@/components/principal/modules/shared/settings-primitives'
import { useDirtyState } from '@/components/principal/modules/shared/use-settings-dirty'
import { ShieldCheck, FileText } from 'lucide-react'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import type { DocumentPrivacyConfig } from '@/lib/store/school-settings-store/types'

export function DocumentPrivacyTab() {
  const store = useSchoolSettingsStore()
  const privacy = store.admissionSettings.documentPrivacy

  const initial = useMemo<DocumentPrivacyConfig>(() => ({ ...privacy }), [privacy])
  const [draft, setDraft] = useState<DocumentPrivacyConfig>(initial)
  useEffect(() => { setDraft(initial) }, [initial])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial])

  const save = useCallback(async () => {
    store.updateAdmissionSettings({ documentPrivacy: draft })
  }, [draft, store])

  const discard = useCallback(() => setDraft(initial), [initial])
  useDirtyState('admission-document-privacy', dirty, save, discard)

  const toggle = (key: keyof DocumentPrivacyConfig) => (v: boolean) =>
    setDraft((prev) => ({ ...prev, [key]: v }))

  return (
    <SettingsCard>
      {/* Master protection */}
      <SettingsCardSection
        title="Sensitive Data Protection"
        icon={ShieldCheck}
        description="Keep sensitive demographics off all official documents"
        defaultOpen
      >
        <ToggleRow
          label="Protect sensitive fields"
          helper="Aadhaar, Religion, Category, Blood Group and medical details are collected internally but never printed on official documents"
          checked={draft.protectSensitiveFields}
          onCheckedChange={toggle('protectSensitiveFields')}
        />
        {!draft.protectSensitiveFields && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-2">
            Sensitive fields may appear in generated documents — this is an explicit school choice.
          </p>
        )}
      </SettingsCardSection>

      {/* Official Admission Letter exposure */}
      <SettingsCardSection
        title="Admission Letter"
        icon={FileText}
        description="What parents receive on the official printed letter"
        defaultOpen
      >
        <ToggleRow
          label="Fee summary section"
          helper="Annual payable, first installment and balance"
          checked={draft.letterShowsFeeSummary}
          onCheckedChange={toggle('letterShowsFeeSummary')}
        />
        <ToggleRow
          label="Parent phone"
          checked={draft.letterShowsParentPhone}
          onCheckedChange={toggle('letterShowsParentPhone')}
        />
        <ToggleRow
          label="Residential address"
          helper="Off by default — the letter is an admission confirmation, not a profile sheet"
          checked={draft.letterShowsAddress}
          onCheckedChange={toggle('letterShowsAddress')}
        />
        <ToggleRow
          label="Previous school"
          checked={draft.letterShowsPreviousSchool}
          onCheckedChange={toggle('letterShowsPreviousSchool')}
        />
        <ToggleRow
          label="Student photo"
          helper="The passport photo collected at admission"
          checked={draft.letterShowsPhoto}
          onCheckedChange={toggle('letterShowsPhoto')}
        />
      </SettingsCardSection>
    </SettingsCard>
  )
}
