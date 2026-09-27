'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  SettingsCard, SettingsCardSection, ToggleRow, ValueRow,
} from '@/components/principal/modules/shared/settings-primitives'
import { useDirtyState } from '@/components/principal/modules/shared/use-settings-dirty'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ClipboardList, Fingerprint, Users, Building2, Stethoscope, Bus,
  Award, FileStack, FileCheck2, type LucideIcon,
} from 'lucide-react'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import type { DuplicateDetectionConfig } from '@/lib/store/school-settings-store'
import { REQUIRED_DOCUMENTS, OPTIONAL_DOCUMENTS } from '../../lib/documents'

/**
 * GeneralTab — ALL admission configuration in one place, as expandable
 * sections: Workflow, Duplicate Detection, the form field groups (Personal /
 * Parents / Previous School / Medical / Transport & Hostel), Financial,
 * Documents, and Official Documents.
 *
 * FORM vs OFFICIAL DOCUMENT are two different scopes (spec §1/§4/§5):
 *  - FORM sections control what the DIGITAL admission form collects.
 *  - The Official Documents section controls only what generated official
 *    documents may print. Collecting a field in the form never implies
 *    printing it on the letter — the two are configured independently.
 *
 * Only settings actually wired into the admission workflow are exposed.
 * Every change goes through the global dirty state — nothing applies
 * until Save.
 */

/* ------------------------------------------------------------------ */
/*  Field row — Visible / Required with hard linkage                   */
/* ------------------------------------------------------------------ */

function FieldRow({
  label, visible, required, onToggleVisible, onToggleRequired,
}: {
  label: string
  visible: boolean
  required: boolean
  onToggleVisible: () => void
  onToggleRequired: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-t border-border/40 first:border-t-0">
      <p className="text-sm text-foreground flex-1 min-w-0 truncate">{label}</p>
      <div className="flex items-center gap-5 shrink-0">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch checked={visible} onCheckedChange={onToggleVisible} />
          <span className={cn('text-[11px]', visible ? 'text-foreground' : 'text-muted-foreground')}>Visible</span>
        </label>
        <label className={cn('flex items-center gap-1.5', required ? 'cursor-pointer' : 'cursor-not-allowed opacity-60')}>
          <Switch disabled={!visible} checked={required} onCheckedChange={onToggleRequired} />
          <span className={cn('text-[11px]', required ? 'text-foreground' : 'text-muted-foreground')}>Required</span>
        </label>
      </div>
    </div>
  )
}

/** Read-only policy row for the canonical document list. */
function DocumentPolicyRow({ name, required }: { name: string; required: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-t border-border/40 first:border-t-0">
      <p className="text-sm text-foreground flex-1 min-w-0 truncate">{name}</p>
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] font-semibold shrink-0',
          required
            ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
            : 'text-muted-foreground'
        )}
      >
        {required ? 'Required' : 'Optional'}
      </Badge>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Field-section metadata                                             */
/* ------------------------------------------------------------------ */

const FIELD_SECTION_META: { id: string; title: string; icon: LucideIcon }[] = [
  { id: 'Personal', title: 'Personal', icon: Users },
  { id: 'Parents', title: 'Parents', icon: Users },
  { id: 'Previous School', title: 'Previous School', icon: Building2 },
]

/** Field sections that carry extra feature toggles next to their rows. */
const MEDICAL_SECTION = { id: 'Medical', title: 'Medical', icon: Stethoscope }
const TRANSPORT_SECTION = { id: 'Transport & Hostel', title: 'Transport & Hostel', icon: Bus }

const DUPLICATE_SIGNALS: { key: keyof DuplicateDetectionConfig['checkKeys']; label: string }[] = [
  { key: 'aadhaar', label: 'Aadhaar' },
  { key: 'nameDob', label: 'Name + DOB' },
  { key: 'parentPhone', label: 'Parent Phone' },
  { key: 'parents', label: 'Parent Names' },
  { key: 'previousSchool', label: 'Previous School' },
  { key: 'address', label: 'Address' },
]

export function GeneralTab() {
  const store = useSchoolSettingsStore()
  const settings = store.admissionSettings
  const flags = settings.featureFlags

  /* ---------- Draft A: workflow / financial / document toggles ---------- */

  const initialA = useMemo(() => ({
    enablePreviousSchool: flags.enablePreviousSchool,
    enableDocumentVerification: flags.enableDocumentVerification,
    enableStudentPhoto: flags.enableStudentPhoto,
    enableMedical: flags.enableMedical,
    enableTransport: flags.enableTransport,
    enableHostel: flags.enableHostel,
    enableScholarship: flags.enableScholarship,
    enableFeeWaiver: flags.enableFeeWaiver,
    retentionDays: settings.rejectionRetentionDays || 60,
  }), [flags, settings.rejectionRetentionDays])

  const [draftA, setDraftA] = useState(initialA)
  useEffect(() => { setDraftA(initialA) }, [initialA])

  const dirtyA = useMemo(
    () => JSON.stringify(draftA) !== JSON.stringify(initialA),
    [draftA, initialA]
  )

  const saveA = useCallback(() => {
    store.updateAdmissionSettings({ rejectionRetentionDays: draftA.retentionDays })
    store.updateAdmissionFeatureFlags({
      enablePreviousSchool: draftA.enablePreviousSchool,
      enableDocumentVerification: draftA.enableDocumentVerification,
      enableStudentPhoto: draftA.enableStudentPhoto,
      enableMedical: draftA.enableMedical,
      enableTransport: draftA.enableTransport,
      enableHostel: draftA.enableHostel,
      enableScholarship: draftA.enableScholarship,
      enableFeeWaiver: draftA.enableFeeWaiver,
    } as any)
  }, [draftA, store])

  const discardA = useCallback(() => { setDraftA(initialA) }, [initialA])
  useDirtyState('admission-general', dirtyA, saveA, discardA)

  const toggleA = (key: keyof typeof draftA) => (v: boolean) =>
    setDraftA((prev) => ({ ...prev, [key]: v }))

  /* ---------- Draft B: duplicate detection ---------- */

  const initialB = useMemo(() => ({
    enabled: settings.duplicateDetection.enabled,
    checkKeys: { ...settings.duplicateDetection.checkKeys },
  }), [settings.duplicateDetection])

  const [draftB, setDraftB] = useState(initialB)
  useEffect(() => { setDraftB(initialB) }, [initialB])

  const dirtyB = useMemo(
    () => JSON.stringify(draftB) !== JSON.stringify(initialB),
    [draftB, initialB]
  )

  const saveB = useCallback(() => {
    store.updateDuplicateDetection(draftB)
  }, [draftB, store])

  const discardB = useCallback(() => { setDraftB(initialB) }, [initialB])
  useDirtyState('admission-duplicate', dirtyB, saveB, discardB)

  /* ---------- Draft C: field rules (Visible / Required) ---------- */

  const fieldRules = settings.fieldRules || []
  const fieldRulesKey = JSON.stringify(fieldRules)
  const initialC = useMemo(() => fieldRules.map((r) => ({ ...r })), [fieldRulesKey])
  const [draftC, setDraftC] = useState(initialC)
  useEffect(() => { setDraftC(initialC) }, [initialC])

  const dirtyC = useMemo(
    () => JSON.stringify(draftC) !== JSON.stringify(initialC),
    [draftC, initialC]
  )

  const saveC = useCallback(() => {
    // Sanitize before persisting: a hidden field can never stay required.
    const sanitized = draftC.map((r) => ({
      ...r,
      required: r.visible ? r.required : false,
    }))
    setDraftC(sanitized)
    store.updateAdmissionSettings({ fieldRules: sanitized })
  }, [draftC, store])

  const discardC = useCallback(() => { setDraftC(initialC) }, [initialC])
  useDirtyState('admission-fields', dirtyC, saveC, discardC)

  const toggleVisible = (fieldKey: string) => {
    setDraftC((prev) => prev.map((r) =>
      // Linkage: turning Visible OFF always turns Required OFF too.
      r.fieldKey === fieldKey
        ? { ...r, visible: !r.visible, required: r.visible ? false : r.required }
        : r
    ))
  }
  const toggleRequired = (fieldKey: string) => {
    setDraftC((prev) => prev.map((r) =>
      r.fieldKey === fieldKey ? { ...r, required: !r.required } : r
    ))
  }

  const rulesBySection = useMemo(() => {
    const map: Record<string, typeof draftC> = {}
    for (const rule of draftC) {
      const k = rule.section || 'Other'
      ;(map[k] = map[k] || []).push(rule)
    }
    return map
  }, [draftC])

  const renderFieldRows = (sectionId: string) =>
    (rulesBySection[sectionId] || []).map((rule) => (
      <FieldRow
        key={rule.fieldKey}
        label={rule.label}
        visible={rule.visible}
        required={rule.required}
        onToggleVisible={() => toggleVisible(rule.fieldKey)}
        onToggleRequired={() => toggleRequired(rule.fieldKey)}
      />
    ))

  /* ---------- Draft D: official document print policy ---------- */

  const initialD = useMemo(() => ({
    showPersonalData: settings.showPersonalDataOnLetter,
  }), [settings.showPersonalDataOnLetter])
  const [draftD, setDraftD] = useState(initialD)
  useEffect(() => { setDraftD(initialD) }, [initialD])
  const dirtyD = useMemo(
    () => JSON.stringify(draftD) !== JSON.stringify(initialD),
    [draftD, initialD]
  )
  const saveD = useCallback(() => {
    store.updateAdmissionSettings({ showPersonalDataOnLetter: draftD.showPersonalData })
  }, [draftD, store])
  const discardD = useCallback(() => setDraftD(initialD), [initialD])
  useDirtyState('admission-letter-privacy', dirtyD, saveD, discardD)

  /* ---------- Render ---------- */

  return (
    <SettingsCard>
      {/* 1. ADMISSION WORKFLOW */}
      <SettingsCardSection title="Admission Workflow" icon={ClipboardList} tag="Form" defaultOpen>
        <ToggleRow label="Student Photo" checked={draftA.enableStudentPhoto}
          onCheckedChange={toggleA('enableStudentPhoto')} />
        <ToggleRow label="Previous School" checked={draftA.enablePreviousSchool}
          onCheckedChange={toggleA('enablePreviousSchool')} />
        <ToggleRow label="Document Verification" checked={draftA.enableDocumentVerification}
          onCheckedChange={toggleA('enableDocumentVerification')} />
        <ValueRow label="Rejection Retention" helper="How long rejected applications stay restorable.">
          <div className="flex items-center gap-2">
            <Input type="number" min={30} max={90} value={draftA.retentionDays}
              onChange={(e) => setDraftA({
                ...draftA,
                retentionDays: Math.max(30, Math.min(90, parseInt(e.target.value) || 60)),
              })}
              className="w-16 h-7 text-center text-xs" />
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        </ValueRow>
      </SettingsCardSection>

      {/* 2. DUPLICATE DETECTION */}
      <SettingsCardSection title="Duplicate Detection" icon={Fingerprint} tag="Form">
        <ToggleRow label="Check for duplicates" checked={draftB.enabled}
          onCheckedChange={(v) => setDraftB((prev) => ({ ...prev, enabled: v }))} />
        {draftB.enabled && DUPLICATE_SIGNALS.map(({ key, label }) => (
          <ToggleRow key={key} label={label}
            checked={draftB.checkKeys[key]}
            onCheckedChange={(v) =>
              setDraftB((prev) => ({
                ...prev,
                checkKeys: { ...prev.checkKeys, [key]: v },
              }))
            } />
        ))}
      </SettingsCardSection>

      {/* 3–5. FIELD GROUPS: Personal / Parents / Previous School */}
      {FIELD_SECTION_META.map((meta) => (
        <SettingsCardSection key={meta.id} title={meta.title} icon={meta.icon} tag="Form">
          {renderFieldRows(meta.id)}
        </SettingsCardSection>
      ))}

      {/* 6. MEDICAL — feature toggle + medical fields */}
      <SettingsCardSection title={MEDICAL_SECTION.title} icon={MEDICAL_SECTION.icon} tag="Form">
        <ToggleRow label="Medical Section" checked={draftA.enableMedical}
          onCheckedChange={toggleA('enableMedical')} />
        {draftA.enableMedical && renderFieldRows(MEDICAL_SECTION.id)}
      </SettingsCardSection>

      {/* 7. TRANSPORT & HOSTEL — feature toggles + fields */}
      <SettingsCardSection title={TRANSPORT_SECTION.title} icon={TRANSPORT_SECTION.icon} tag="Form">
        <ToggleRow label="Transport" checked={draftA.enableTransport}
          onCheckedChange={toggleA('enableTransport')} />
        <ToggleRow label="Hostel" checked={draftA.enableHostel}
          onCheckedChange={toggleA('enableHostel')} />
        {(draftA.enableTransport || draftA.enableHostel) && renderFieldRows(TRANSPORT_SECTION.id)}
      </SettingsCardSection>

      {/* 8. FINANCIAL */}
      <SettingsCardSection title="Financial" icon={Award} tag="Form">
        <ToggleRow label="Scholarship" checked={draftA.enableScholarship}
          onCheckedChange={toggleA('enableScholarship')} />
        <ToggleRow label="Fee Waiver" checked={draftA.enableFeeWaiver}
          onCheckedChange={toggleA('enableFeeWaiver')} />
      </SettingsCardSection>

      {/* 9. DOCUMENTS — applicant uploads + the canonical policy (read-only) */}
      <SettingsCardSection title="Documents" icon={FileStack} tag="Form">
        {REQUIRED_DOCUMENTS.map((d) => (
          <DocumentPolicyRow key={d.key} name={d.name} required />
        ))}
        {OPTIONAL_DOCUMENTS.map((d) => (
          <DocumentPolicyRow key={d.key} name={d.name} required={false} />
        ))}
      </SettingsCardSection>

      {/* 10. OFFICIAL DOCUMENTS — what may PRINT on generated documents.
          Independent of form collection: Aadhaar, religion, category, blood
          group and medical details are never printed; parent contacts print
          only when this is ON. */}
      <SettingsCardSection title="Official Documents" icon={FileCheck2} tag="Official Document">
        <ToggleRow
          label="Show sensitive details on official documents"
          helper="Parent contact numbers print only while ON. Aadhaar, religion, category, blood group and medical details never print."
          checked={draftD.showPersonalData}
          onCheckedChange={(v) => setDraftD({ ...draftD, showPersonalData: v })}
        />
      </SettingsCardSection>
    </SettingsCard>
  )
}
