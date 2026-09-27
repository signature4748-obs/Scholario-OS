'use client'

import type { IssuanceArtifacts } from './letter-data'
import type { AdmissionApplication } from '@/lib/store/admission-store'

interface IdentifiersMatrixProps {
  app: AdmissionApplication
  artifacts: IssuanceArtifacts
}

/** The four essential identifiers — label + value only (spec §26), in the
 *  same card language as Admission Settings (rounded-xl, thin border). */
export function IdentifiersMatrix({ app, artifacts }: IdentifiersMatrixProps) {
  const { admissionNo, studentId, rollNo, regNo } = artifacts
  const formData = app.formData

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1">
        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Admission No.</span>
        <span className="font-mono font-bold text-sm text-foreground block break-all">{admissionNo}</span>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1">
        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Student ID</span>
        <span className="font-mono font-bold text-sm text-foreground block break-all">{studentId}</span>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1">
        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Class & Roll No.</span>
        <span className="font-semibold text-sm text-foreground block">{formData.className} · Roll {rollNo}</span>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1">
        <span className="text-[10px] uppercase font-bold text-muted-foreground block">CBSE Reference</span>
        <span className="font-mono font-bold text-xs text-foreground block break-all">{regNo}</span>
      </div>
    </div>
  )
}
