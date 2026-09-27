'use client'

import { GlassCard } from '@/components/shared/ui'
import type { IssuanceArtifacts } from './letter-data'
import type { AdmissionApplication } from '@/lib/store/admission-store'

interface IdentifiersMatrixProps {
  app: AdmissionApplication
  artifacts: IssuanceArtifacts
}

/** The four essential identifiers — label + value only. The values are
 *  self-explanatory; no invented status captions underneath. */
export function IdentifiersMatrix({ app, artifacts }: IdentifiersMatrixProps) {
  const { admissionNo, studentId, rollNo, regNo } = artifacts
  const formData = app.formData

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <GlassCard className="p-3.5 space-y-1">
        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Admission No.</span>
        <span className="font-mono font-extrabold text-sm text-foreground block break-all">{admissionNo}</span>
      </GlassCard>

      <GlassCard className="p-3.5 space-y-1">
        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Student ID</span>
        <span className="font-mono font-extrabold text-sm text-foreground block break-all">{studentId}</span>
      </GlassCard>

      <GlassCard className="p-3.5 space-y-1">
        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Class & Roll No.</span>
        <span className="font-bold text-sm text-foreground block">{formData.className} · Roll {rollNo}</span>
      </GlassCard>

      <GlassCard className="p-3.5 space-y-1">
        <span className="text-[10px] uppercase font-bold text-muted-foreground block">CBSE Reference</span>
        <span className="font-mono font-extrabold text-xs text-foreground block break-all">{regNo}</span>
      </GlassCard>
    </div>
  )
}
