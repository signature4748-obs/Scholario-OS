'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  SettingsCard, SettingsCardSection,
} from '@/components/principal/modules/shared/settings-primitives'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import { useDirtyState } from '@/components/principal/modules/shared/use-settings-dirty'
import { FIELD_SECTIONS } from './types'

/**
 * FieldRow — FIELD · VISIBILITY · REQUIRED (spec §10).
 *
 * Invariant: Required can only be ON when Visible is ON. Turning Visible
 * OFF automatically turns Required OFF (never an impossible state).
 * Mobile: the switches stack under the field label instead of squeezing.
 */
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
    <div className="py-3 border-t border-border/40 first:border-t-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <p className="text-sm text-foreground flex-1 min-w-0 truncate" title={label}>{label}</p>
        <div className="flex items-center gap-4 sm:gap-6 shrink-0 sm:pr-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Switch checked={visible} onCheckedChange={onToggleVisible} aria-label={`${label} visible`} />
            <span className={cn('text-[11px] w-11', visible ? 'text-foreground font-medium' : 'text-muted-foreground')}>Visible</span>
          </label>
          <label
            className={cn('flex items-center gap-2 select-none', visible ? 'cursor-pointer' : 'cursor-not-allowed')}
            title={visible ? undefined : 'Required needs Visible to be enabled first'}
          >
            <Switch
              disabled={!visible}
              checked={required && visible}
              onCheckedChange={onToggleRequired}
              aria-label={`${label} required`}
            />
            <span className={cn('text-[11px] w-13', required && visible ? 'text-foreground font-medium' : 'text-muted-foreground')}>Required</span>
          </label>
        </div>
      </div>
    </div>
  )
}

export function FieldRulesTab() {
  const store = useSchoolSettingsStore()
  const fieldRules = store.admissionSettings.fieldRules || []

  const fieldRulesKey = JSON.stringify(fieldRules)
  const initial = useMemo(() => fieldRules.map((r) => ({ ...r })), [fieldRulesKey])
  const [draft, setDraft] = useState(initial)
  useEffect(() => { setDraft(initial) }, [initial])

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial]
  )

  const save = useCallback(async () => {
    // Sanitize on save: Required implies Visible (spec §10 — no impossible states).
    store.updateAdmissionSettings({
      fieldRules: draft.map((r) => ({ ...r, required: r.required && r.visible })),
    })
  }, [draft, store])

  const discard = useCallback(() => { setDraft(initial) }, [initial])

  useDirtyState('admission-fields', dirty, save, discard)

  // Cascade rule: turning Visible OFF forces Required OFF immediately.
  const toggleVisible = (fieldKey: string) => {
    setDraft((prev) => prev.map((r) =>
      r.fieldKey === fieldKey
        ? { ...r, visible: !r.visible, required: !r.visible ? false : r.required }
        : r
    ))
  }
  const toggleRequired = (fieldKey: string) => {
    setDraft((prev) => prev.map((r) =>
      r.fieldKey === fieldKey ? { ...r, required: !r.required } : r
    ))
  }

  const grouped = useMemo(() => {
    const map: Record<string, typeof draft> = {}
    for (const rule of draft) {
      const k = rule.section || 'Other'
      ;(map[k] = map[k] || []).push(rule)
    }
    return map
  }, [draft])

  const knownIds = FIELD_SECTIONS.map((s) => s.id)
  const extras = Object.keys(grouped).filter((k) => !knownIds.includes(k))

  return (
    <SettingsCard>
      {/* Contextual line (spec §15) — states exactly what this tab controls. */}
      <p className="text-xs text-muted-foreground -mt-1 mb-3">
        Choose which fields appear on the admission form and which are mandatory.
      </p>
      {/* Column header — makes the FIELD / VISIBILITY / REQUIRED relationship obvious (spec §10) */}
      <div className="hidden sm:flex items-center justify-end gap-6 pr-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 border-b border-border/30">
        <span className="w-11 text-center">Visibility</span>
        <span className="w-13 text-center">Required</span>
      </div>

      {FIELD_SECTIONS.map((meta, idx) => {
        const rules = grouped[meta.id] || []
        if (rules.length === 0) return null
        return (
          <SettingsCardSection
            key={meta.id}
            defaultOpen={idx === 0}
            icon={meta.icon}
            title={meta.title}
            description={meta.description}
          >
            {rules.map((rule) => (
              <FieldRow
                key={rule.fieldKey}
                label={rule.label}
                visible={rule.visible}
                required={rule.required}
                onToggleVisible={() => toggleVisible(rule.fieldKey)}
                onToggleRequired={() => toggleRequired(rule.fieldKey)}
              />
            ))}
          </SettingsCardSection>
        )
      })}

      {extras.map((sectionId) => {
        const rules = grouped[sectionId] || []
        if (rules.length === 0) return null
        return (
          <SettingsCardSection key={sectionId} defaultOpen={false} icon={FIELD_SECTIONS[0].icon} title={sectionId}>
            {rules.map((rule) => (
              <FieldRow
                key={rule.fieldKey}
                label={rule.label}
                visible={rule.visible}
                required={rule.required}
                onToggleVisible={() => toggleVisible(rule.fieldKey)}
                onToggleRequired={() => toggleRequired(rule.fieldKey)}
              />
            ))}
          </SettingsCardSection>
        )
      })}

      <p className="text-[11px] text-muted-foreground px-1 pt-1">
        A field must be visible before it can be required — turning visibility off clears the required flag.
      </p>
    </SettingsCard>
  )
}
