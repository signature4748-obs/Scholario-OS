'use client'

import { ArrowLeft, UserCheck, Printer, FileDown, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AdmissionApplication } from '@/lib/store/admission-store'
import { getAdmissionStatusMeta } from '@/lib/store/admission-store/status'
import type { IssuanceTabKey } from './IssuanceTabs'

interface IssuanceHeaderProps {
  app: AdmissionApplication
  isCompleted: boolean
  /** Required-document policy blocks final enrolment. */
  blockEnroll: boolean
  onBack: () => void
  onCompleteAndEnroll: () => void
  onOpenTab: (tab: IssuanceTabKey) => void
  onPrintDossier: () => void
}

export function IssuanceHeader({
  app,
  isCompleted,
  blockEnroll,
  onBack,
  onCompleteAndEnroll,
  onOpenTab,
  onPrintDossier,
}: IssuanceHeaderProps) {
  const statusMeta = getAdmissionStatusMeta(app.status)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="outline" size="sm" onClick={onBack} className="h-8 gap-1 text-xs shrink-0">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back to Dashboard</span>
          <span className="sm:hidden">Back</span>
        </Button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold tracking-tight text-foreground truncate">
              Admission Dossier — {app.applicantName}
            </h2>
            <Badge variant="outline" className={`text-[11px] font-bold ${statusMeta.className}`}>
              {statusMeta.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {app.className} · {app.academicSession} · {app.admissionNo}
          </p>
        </div>
      </div>

      {/* Action hierarchy (spec §7): one primary, compact secondary menu. */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {!isCompleted ? (
          <Button
            size="sm"
            onClick={onCompleteAndEnroll}
            disabled={blockEnroll}
            title={blockEnroll ? 'Upload or defer the missing required documents first' : 'Issue the admission and enroll the student'}
            className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1.5 shadow-md px-4 disabled:opacity-50"
          >
            <UserCheck className="h-4 w-4" />
            Complete & Enroll
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onOpenTab.bind(null, 'letter')}
            className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1.5 shadow-md px-4"
          >
            <Printer className="h-4 w-4" />
            Admission Letter
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="text-xs gap-1.5">
              <FileDown className="h-3.5 w-3.5" />
              Documents
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Official documents</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onOpenTab('letter')} className="text-xs gap-2">
              <Printer className="h-3.5 w-3.5" /> Admission Letter
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenTab('receipt')} className="text-xs gap-2">
              <Printer className="h-3.5 w-3.5" /> Fee Receipt
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenTab('credentials')} className="text-xs gap-2">
              <Printer className="h-3.5 w-3.5" /> Portal Credentials
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenTab('welcome')} className="text-xs gap-2">
              <Printer className="h-3.5 w-3.5" /> Welcome Letter
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPrintDossier} className="text-xs gap-2">
              <Printer className="h-3.5 w-3.5" /> Print Complete Dossier
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
