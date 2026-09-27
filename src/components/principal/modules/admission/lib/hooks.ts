/**
 * Admission Hooks — React hooks backed by the persisted school settings store.
 */
'use client'

import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import type {
  AdmissionDocumentPolicy,
  AdmissionFeatureFlags,
  ClassSeatConfig,
  DuplicateDetectionConfig,
} from '@/lib/store/school-settings-store'
import { resolveDocumentPolicy } from './documents'

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

/**
 * The school's admission document policy — resolved against the registry
 * defaults so a persisted store that pre-dates the policy system still
 * returns a complete map. This is the ONE source every document surface
 * (form step, review, verification, issuance gate) must read from.
 */
export function useAdmissionDocumentPolicy(): AdmissionDocumentPolicy {
  const stored = useSchoolSettingsStore(
    (s) => s.admissionSettings.documentPolicy
  )
  return resolveDocumentPolicy(stored)
}
