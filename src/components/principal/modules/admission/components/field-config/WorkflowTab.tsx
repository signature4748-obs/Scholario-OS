'use client'

/**
 * WorkflowTab (General) — WORKFLOW-level admission settings only
 * (Wave 2 deep spec §13/§14).
 *
 * Mental model: this tab answers "What do applicants/officers must DO?"
 * — photo policy, document completion rule, duplicate detection, the
 * steps of the officer workflow, and rejection retention. Form-field
 * visibility lives in Fields; document output exposure lives in
 * Documents & Privacy.
 *
 * Every control here has a real, wired effect (spec §18) — the document
 * completion rule is school POLICY (fixed: required documents only) and
 * is therefore shown as a read-only statement, never a fake toggle.
 */
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  SettingsCard, SettingsCardSection, ToggleRow, ValueRow, RadioRowGroup,
} from '@/components/principal/modules/shared/settings-primitives'
import { useDirtyState } from '@/components/principal/modules/shared/use-settings-dirty'
import { Input } from '@/components/ui/input'
import {
  Lock, SlidersHorizontal, Stethoscope, Bus, Award, Camera, FileStack, History,
} from 'lucide-react'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'

export function WorkflowTab() {
  const store = useSchoolSettingsStore()
  const settings = store.admissionSettings
  const flags = settings.featureFlags

  // Draft state for ALL settings on this tab (single source of truth).
  const initial = useMemo(() => ({
    photoRequirement: settings.photoRequirement,
    dupEnabled: settings.duplicateDetection.enabled,
    retentionDays: settings.rejectionRetentionDays || 60,
    enableMedical: flags.enableMedical,
    enableTransport: flags.enableTransport,
    enableHostel: flags.enableHostel,
    enableScholarship: flags.enableScholarship,
    enableFeeWaiver: flags.enableFeeWaiver,
    enableStudentPhoto: flags.enableStudentPhoto,
  }), [settings.photoRequirement, settings.duplicateDetection.enabled,
       settings.rejectionRetentionDays, flags])

  const [draft, setDraft] = useState(initial)

  // Re-sync when store catches up from elsewhere (e.g. after Save).
  useEffect(() => { setDraft(initial) }, [initial])

  // Compute dirty by JSON compare — any change in any field flips this.
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial]
  )

  // Save commits every draft field to the real store at once.
  const save = useCallback(async () => {
    store.updateAdmissionSettings({
      photoRequirement: draft.photoRequirement,
      rejectionRetentionDays: draft.retentionDays,
    })
    store.updateDuplicateDetection({ enabled: draft.dupEnabled })
    store.updateAdmissionFeatureFlags({
      enableMedical: draft.enableMedical,
      enableTransport: draft.enableTransport,
      enableHostel: draft.enableHostel,
      enableScholarship: draft.enableScholarship,
      enableFeeWaiver: draft.enableFeeWaiver,
      enableStudentPhoto: draft.enableStudentPhoto,
    } as any)
  }, [draft, store])

  const discard = useCallback(() => {
    setDraft(initial)
  }, [initial])

  // Register this tab's dirty + commit fns with the global provider.
  useDirtyState('admission-workflow', dirty, save, discard)

  // Helper to flip a single draft boolean.
  const toggle = (key: keyof typeof draft) => (v: boolean) =>
    setDraft((prev) => ({ ...prev, [key]: v }))

  return (
    <SettingsCard>
      {/* ── Document completion (fixed school policy — read-only, §14) ── */}
      <SettingsCardSection title="Document Completion" icon={FileStack} description="What makes the Documents step complete" defaultOpen>
        <div className="rounded-lg border border-border/70 bg-muted/30 px-3.5 py-3 text-xs space-y-1.5">
          <p className="font-semibold text-foreground">Required documents only</p>
          <p className="text-muted-foreground leading-relaxed">
            Only the <strong>Student Aadhaar Card</strong> is required. Optional documents
            (Transfer Certificate, Character Certificate, Birth Certificate, Previous Mark
            Sheet, Migration Certificate) never block admission — they are verified when received.
          </p>
        </div>
      </SettingsCardSection>

      {/* ── Photo (workflow policy) ── */}
      <SettingsCardSection title="Photo" icon={Camera} description="Whether the photo is part of the required admission flow" defaultOpen>
        <ToggleRow
          label="Photo Step"
          helper="Collect a student photo during admission"
          checked={draft.enableStudentPhoto}
          onCheckedChange={toggle('enableStudentPhoto')}
        />
        {draft.enableStudentPhoto && (
          <RadioRowGroup
            name="photoRequirement"
            label="Photo Requirement"
            options={[
              { value: 'required', label: 'Required', hint: 'Submission is blocked until a photo is selected' },
              { value: 'optional', label: 'Optional', hint: 'Photo can be added later' },
            ]}
            value={draft.photoRequirement}
            onValueChange={(v) => setDraft((prev) => ({ ...prev, photoRequirement: v as 'required' | 'optional' }))}
          />
        )}
      </SettingsCardSection>

      {/* ── Duplicate detection (wired to submit-time checks) ── */}
      <SettingsCardSection title="Duplicate Detection" icon={SlidersHorizontal} description="Warns the admission desk before a duplicate student is created" defaultOpen>
        <ToggleRow
          label="Enable Duplicate Detection"
          helper={draft.dupEnabled
            ? `Active checks: Aadhaar · Name + DOB · Parent phone${settings.duplicateDetection.checkKeys.address ? ' · Address' : ''}`
            : 'OFF — applications are created without duplicate checks (explicit school choice)'}
          checked={draft.dupEnabled}
          onCheckedChange={toggle('dupEnabled')}
        />
      </SettingsCardSection>

      {/* ── Officer workflow: which steps the desk works through ── */}
      <SettingsCardSection title="Workflow Steps" icon={History} description="Sections and facilities the admission desk collects" defaultOpen>
        <ToggleRow label="Medical Section" checked={draft.enableMedical}
          helper="Health information collected during admission"
          onCheckedChange={toggle('enableMedical')} />
        <ToggleRow label="Transport Facility" checked={draft.enableTransport}
          onCheckedChange={toggle('enableTransport')} />
        <ToggleRow label="Hostel Facility" checked={draft.enableHostel}
          onCheckedChange={toggle('enableHostel')} />
        <ToggleRow label="Scholarship" checked={draft.enableScholarship}
          helper="Concession options in the fee structure step"
          onCheckedChange={toggle('enableScholarship')} />
        <ToggleRow label="Fee Waiver" checked={draft.enableFeeWaiver}
          onCheckedChange={toggle('enableFeeWaiver')} />
      </SettingsCardSection>

      {/* ── Retention (wired to the Rejected tab auto-cleanup rule) ── */}
      <SettingsCardSection title="Rejection Retention" icon={Lock} description="How long rejected application records are kept">
        <ValueRow label="Keep rejected records for">
          <div className="flex items-center gap-2">
            <Input type="number" min={30} max={90} value={draft.retentionDays}
              onChange={(e) => setDraft({
                ...draft,
                retentionDays: Math.max(30, Math.min(90, parseInt(e.target.value) || 60)),
              })}
              className="w-16 h-7 text-center text-xs" />
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        </ValueRow>
      </SettingsCardSection>
    </SettingsCard>
  )
}
