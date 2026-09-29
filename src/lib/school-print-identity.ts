'use client'

/**
 * school-print-identity — the ACTIVE TENANT's school identity for
 * teacher-side print/PDF surfaces (timetable exports, payslip PDFs).
 *
 * Multi-tenant honesty: these documents must never print the hardcoded
 * demo-school profile ("Demo School of Scholario", a fake CBSE
 * affiliation number) for a different tenant. The tenant registry is the
 * same source the app shell footer uses — one identity everywhere.
 *
 * Read via getState() so plain (non-hook) export functions can use it.
 */

import { useTenantStore } from '@/lib/tenant/store'
import { TENANTS } from '@/lib/tenant/schools'

export interface SchoolPrintIdentity {
  /** School display name (tenant identity). */
  name: string
  /** Secondary line under the name: city · academic session. */
  line2: string
}

export function schoolPrintIdentity(): SchoolPrintIdentity {
  const state = useTenantStore.getState()
  const tenant = TENANTS.find((t) => t.id === state.activeTenantId) ?? TENANTS[0]
  const session = (tenant.session || '').replace('-', '–')
  return {
    name: tenant.name,
    line2: [tenant.city, session ? `Session ${session}` : ''].filter(Boolean).join(' · '),
  }
}
