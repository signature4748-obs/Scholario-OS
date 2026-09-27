import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AdmissionStoreState } from './types'
import { initialApplications } from './seed-data'
import { createSelectionSlice } from './slices/selection-slice'
import { createDraftSlice } from './slices/draft-slice'
import { createReviewSlice } from './slices/review-slice'
import { createDecisionSlice } from './slices/decision-slice'
import { createCompletionSlice } from './slices/completion-slice'
// SaaS-STAGE-2A — tenant-scoped persistence (per-school admissions data).
import { migrateLegacyScopedStore, createTenantScopedStorage, TENANT_SCOPED_BASES } from '@/lib/tenant/tenant-storage'
import { DEFAULT_TENANT_ID } from '@/lib/tenant/schools'

migrateLegacyScopedStore(TENANT_SCOPED_BASES.admission, DEFAULT_TENANT_ID)

export const useAdmissionStore = create<AdmissionStoreState>()(
  persist(
    (...a) => ({
      applications: initialApplications,
      ...createSelectionSlice(...a),
      ...createDraftSlice(...a),
      ...createReviewSlice(...a),
      ...createDecisionSlice(...a),
      ...createCompletionSlice(...a),
    }),
    {
      name: TENANT_SCOPED_BASES.admission,
      storage: createTenantScopedStorage(TENANT_SCOPED_BASES.admission),
      version: 2,
      /**
       * v1→v2: normalize legacy document-status keys to the canonical
       * catalogue keys (lib/documents.ts). Seed/defaults previously stored
       * `birth_cert`; the wizard + shared document policy read `birthCert`.
       */
      migrate: (persisted: unknown) => {
        const state = persisted as { applications?: Array<Record<string, unknown>> } | undefined
        if (!state?.applications) return state as never
        state.applications = state.applications.map((app) => {
          const formData = app.formData as
            | { docStatuses?: Record<string, unknown> }
            | undefined
          const ds = formData?.docStatuses as Record<string, Record<string, unknown>> | undefined
          if (!ds || !ds.birth_cert || ds.birthCert) return app
          const normalized: Record<string, Record<string, unknown>> = { ...ds, birthCert: ds.birth_cert }
          delete normalized.birth_cert
          return { ...app, formData: { ...(app.formData as object), docStatuses: normalized } }
        })
        return state as never
      },
    }
  )
)
