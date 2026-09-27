/**
 * Admission Utilities — shared logic layer
 * Feature flags · duplicate detection · seat validation
 *
 * Single source of truth: reads from useSchoolSettingsStore (Zustand persisted).
 *
 * NOTE: This file is a barrel that re-exports the modular utilities for backwards
 * compatibility. Consumers can keep importing from './admission-utils' unchanged.
 */
'use client'

export {
  useAdmissionFeatureFlags,
  useSeatCapacity,
  useDuplicateDetectionConfig,
  useAdmissionDocumentPolicy,
} from './hooks'
export { getSeatInfo, type SeatStatus, type SeatInfo } from './seats'
export { checkDuplicates, type DuplicateMatch } from './duplicate-detection'
export {
  shouldShowPreviousSchool,
  ADMISSION_TYPE_LABELS,
  type AdmissionType,
} from './admission-type'
