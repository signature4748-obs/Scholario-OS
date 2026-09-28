/**
 * Active-tenant reader (SaaS-STAGE-2A).
 *
 * Synchronous, dependency-free read of the active tenant directly from
 * localStorage. Used by:
 *   - tenant-storage.ts (composing per-tenant persist keys)
 *   - tenant-aware seed factories (fee-store-data, school-settings initial
 *     state, exam mock seeds) which run at module-eval / store-creation
 *     time, BEFORE any hook can be used.
 *
 * The tenant store itself persists under ACTIVE_TENANT_STORAGE_KEY with the
 * standard zustand-persist JSON envelope ({ state: { activeTenantId } }).
 */

import type { SchoolTenant, TenantId } from './types'
import { DEFAULT_TENANT_ID, getTenantById, isValidTenantId } from './schools'

export const ACTIVE_TENANT_STORAGE_KEY = 'scholario-tenant-control-v1'

export function getActiveTenantIdSync(): TenantId {
  if (typeof window === 'undefined') return DEFAULT_TENANT_ID
  try {
    const raw = window.localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY)
    if (!raw) return DEFAULT_TENANT_ID
    const parsed = JSON.parse(raw) as { state?: { activeTenantId?: TenantId } }
    const id = parsed?.state?.activeTenantId
    // Stale pointers (e.g. from removed registry entries) self-heal to the
    // default tenant so every store namespace stays valid.
    return isValidTenantId(id) ? id : DEFAULT_TENANT_ID
  } catch {
    return DEFAULT_TENANT_ID
  }
}

/** Resolve the full tenant identity for the currently active school. */
export function getActiveTenantSync(): SchoolTenant {
  return getTenantById(getActiveTenantIdSync())
}
