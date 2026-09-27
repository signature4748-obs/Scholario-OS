'use client'

import { ArrowLeft, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { AdmissionApplication } from '@/lib/store/admission-store'

interface IssuanceHeaderProps {
  app: AdmissionApplication
  isCompleted: boolean
  onBack: () => void
  onCompleteAndEnroll: () => void
}

/**
 * Issued-workspace header — student name + issuance status, nothing else.
 * The state is NOT repeated in a second heading or a description
 * paragraph; the identifiers and documents below carry the substance.
 */
export function IssuanceHeader({
  app,
  isCompleted,
  onBack,
  onCompleteAndEnroll,
}: IssuanceHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="outline" size="sm" onClick={onBack} className="h-8 gap-1 text-xs shrink-0">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>

        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
            {app.applicantName}
          </h2>
          {isCompleted ? (
            <Badge className="bg-teal-600 text-white text-xs font-bold shrink-0">
              ✓ Issued & Enrolled
            </Badge>
          ) : (
            <Badge className="bg-emerald-600/10 text-emerald-800 border-emerald-300 text-xs font-semibold shrink-0">
              Ready for Issuance
            </Badge>
          )}
        </div>
      </div>

      {!isCompleted && (
        <Button
          size="sm"
          onClick={onCompleteAndEnroll}
          className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1.5 shadow-md px-4 shrink-0"
        >
          <UserCheck className="h-4 w-4" />
          Complete Admission & Enroll
        </Button>
      )}
    </div>
  )
}
