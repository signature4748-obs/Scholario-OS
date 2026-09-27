/**
 * Admission Hooks — React hooks backed by the persisted school settings store.
 */
'use client'

import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import type {
  AdmissionFeatureFlags,
  ClassSeatConfig,
  DuplicateDetectionConfig,
} from '@/lib/store/school-settings-store'

/* ---------- Feature flag accessor (React hook) ---------- */
export function useAdmissionFeatureFlags(): AdmissionFeatureFlags {
  return useSchoolSettingsStore((s) => s.admissionSettings.featureFlags)
}

export function useSeatCapacity(): ClassSeatConfig[] {
  return useSchoolSettingsStore((s) => s.admissionSettings.seatCapacity)
}

export function useDuplicateDetectionConfig(): DuplicateDetectionConfig {
  return useSchoolSettingsStore((s) => s.admissionSettings.duplicateDetection)
}

/* ---------- Field-rule visibility (Fields tab → live form) ---------- */

/**
 * Fine-grained field visibility from the Fields settings tab (fieldRules),
 * keyed by fieldKey. Fields without a configured rule default to visible.
 * Used alongside the coarse workflow featureFlags — a field renders only
 * when BOTH its feature flag AND its field rule allow it (spec §15–§16).
 */
export function useAdmissionFieldVisibility(): Record<string, boolean> {
  const fieldRules = useSchoolSettingsStore((s) => s.admissionSettings.fieldRules)
  const map: Record<string, boolean> = {}
  for (const rule of Object.values(fieldRules)) {
    if (rule && typeof rule === 'object' && 'fieldKey' in rule) {
      map[(rule as { fieldKey: string }).fieldKey] = (rule as { visible?: boolean }).visible !== false
    }
  }
  return map
}
