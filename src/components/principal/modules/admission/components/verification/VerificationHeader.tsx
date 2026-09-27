'use client'

import {
  Edit3, AlertTriangle, XCircle, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import type { AdmissionApplication } from '@/lib/store/admission-store'

interface VerificationHeaderProps {
  app: AdmissionApplication
  verified: number
  total: number
  flagged: number
  onOpenWizardToEdit: (appId: string) => void
  onNeedCorrection: () => void
  onReject: () => void
  onApprove: () => void
}

/**
 * Compact review header (spec §13): who, which application, where, when,
 * real verification progress, and the three decision actions. Same
 * typographic system as Admission Settings — semibold headings, small
 * labels, compact pills, no hero section.
 */
export function VerificationHeader({
  app,
  verified,
  total,
  flagged,
  onOpenWizardToEdit,
  onNeedCorrection,
  onReject,
  onApprove,
}: VerificationHeaderProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 sm:px-5 py-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: applicant identity — compact */}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground truncate">
            {app.applicantName}
          </h2>
          <div className="flex items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="font-mono">{app.admissionNo}</span>
            <span aria-hidden>·</span>
            <span>
              Class {app.className}
              {app.section ? `-${app.section}` : ''}
            </span>
            <span aria-hidden>·</span>
            <span>Submitted {formatDate(app.submittedDate)}</span>
          </div>
        </div>

        {/* Right: real progress + decision actions */}
        <div className="flex flex-col items-stretch lg:items-end gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {verified}/{total} Verified
            </span>
            {flagged > 0 && (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] px-2 font-semibold">
                {flagged} flagged
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {app.status === 'Need Correction' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenWizardToEdit(app.id)}
                className="text-xs h-8 gap-1 border-amber-300 text-amber-800 dark:text-amber-300"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onNeedCorrection}
              className="text-xs h-8 gap-1 border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-amber-50"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Need Correction
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              className="text-xs h-8 gap-1 border-rose-300 text-rose-700 dark:text-rose-300 hover:bg-rose-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button
              size="sm"
              onClick={onApprove}
              className="text-xs h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
