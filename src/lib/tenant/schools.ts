/**
 * School tenants — the platform's school registry.
 *
 * The authenticated user's school is the single registered tenant; the
 * tenant record carries the school's identity and platform configuration
 * (module/feature/capability flags). There is no school switcher in the
 * product UI — a switcher only becomes relevant when a user's session
 * carries multiple REAL, authorized school memberships.
 *
 * NOTE: tenant IDs are STABLE storage keys (every tenant-scoped store
 * namespace is keyed by them) — never rename an id, only its identity.
 */

import type {
  FeatureKey,
  ModuleKey,
  SchoolTenant,
  TenantConfig,
} from './types'
import { CAPABILITY_CATALOG, MODULE_CATALOG, SUB_FEATURE_CATALOG } from './registry'

export const DEFAULT_TENANT_ID = 't-dsg-gur-01'

// ─── Config factories ───────────────────────────────────────────────────

function allModulesOn(): Record<ModuleKey, boolean> {
  const out = {} as Record<ModuleKey, boolean>
  for (const m of MODULE_CATALOG) out[m.key] = true
  return out
}

function allSubFeaturesOn(): Record<FeatureKey, boolean> {
  const out = {} as Record<FeatureKey, boolean>
  for (const f of SUB_FEATURE_CATALOG) out[f.key] = true
  return out
}

function defaultCapabilities(): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const c of CAPABILITY_CATALOG) {
    // fee_structure_delete is platform-reserved — never granted to schools.
    out[c.key] = !c.platformReserved
  }
  return out
}

function baseConfig(): TenantConfig {
  return {
    status: 'active',
    plan: 'growth',
    features: allModulesOn(),
    subFeatures: allSubFeaturesOn(),
    capabilities: defaultCapabilities() as TenantConfig['capabilities'],
    examTemplateId: 'ut4-hy-annual',
    archiveRetentionDays: 30,
  }
}

// ─── The registered school ──────────────────────────────────────────────

export const TENANTS: SchoolTenant[] = [
  {
    id: DEFAULT_TENANT_ID,
    code: 'GWS-001',
    name: 'Greenwood Public School',
    shortName: 'Greenwood',
    city: 'Gurugram, NCR',
    initials: 'GW',
    session: '2026-2027',
    principalName: 'Dr. Ananya Iyer',
    principalEmail: 'principal@greenwood.edu.in',
    established: 2020,
    vicePrincipalName: 'Mr. Suresh Nair',
    stats: { students: 1842, teachers: 96, classes: 12, users: 2010 },
    feeProfile: { scale: 1, examTemplateId: 'ut4-hy-annual' },
    config: { ...baseConfig(), plan: 'enterprise' },
  },
]

/** All valid tenant ids — used to normalize persisted active-tenant pointers. */
const TENANT_IDS = new Set(TENANTS.map((t) => t.id))

/** True when the id belongs to a registered tenant (stale ids self-heal). */
export function isValidTenantId(id: string | null | undefined): id is string {
  return typeof id === 'string' && TENANT_IDS.has(id)
}

export function getTenantById(id: string | null | undefined): SchoolTenant {
  return TENANTS.find((t) => t.id === id) ?? TENANTS[0]
}
