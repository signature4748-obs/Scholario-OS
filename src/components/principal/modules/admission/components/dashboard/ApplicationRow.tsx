import { Edit3, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { type AdmissionStoreState, type AdmissionApplication } from '@/lib/store/admission-store'
import { StatusBadge } from './StatusBadge'

interface ApplicationRowProps {
  app: AdmissionApplication
  store: AdmissionStoreState
  onOpenWizard: (appId?: string) => void
  onOpenVerificationWorkspace: (appId: string) => void
  onOpenIssuanceWorkspace: (appId: string) => void
}

/** Contextual action for the current status — ONE primary action per row. */
function StatusActions({ app, store, onOpenWizard, onOpenVerificationWorkspace, onOpenIssuanceWorkspace }: ApplicationRowProps) {
  switch (app.status) {
    case 'Draft':
      return (
        <>
          <Button size="sm" variant="outline" onClick={() => { store.selectApplication(app.id); onOpenWizard(app.id) }} className="text-xs h-8">
            <Edit3 className="h-3.5 w-3.5 mr-1" /> Resume
          </Button>
          <Button size="sm" onClick={() => { store.submitApplication(app.id); toast.success('Application submitted') }} className="text-xs h-8 bg-primary text-primary-foreground">
            Submit
          </Button>
        </>
      )
    case 'Submitted':
    case 'Under Review':
    case 'Need Correction':
      return (
        <Button size="sm" onClick={() => { store.selectApplication(app.id); onOpenVerificationWorkspace(app.id) }} className="text-xs h-8 bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-1">
          <Search className="h-3.5 w-3.5" /> Review
        </Button>
      )
    case 'Approved':
      return (
        <Button size="sm" onClick={() => { store.selectApplication(app.id); onOpenIssuanceWorkspace(app.id) }} className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1">
          <Sparkles className="h-3.5 w-3.5" /> Issue Admission
        </Button>
      )
    case 'Rejected':
      return (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => { store.restoreRejectedApplication(app.id); toast.success('Application restored') }} className="text-xs h-8 text-teal-600 border-teal-300">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Restore
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { store.deleteArchivedApplication(app.id); toast.success('Record deleted') }} className="text-xs h-8 text-rose-600 hover:bg-rose-50" aria-label="Delete record">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )
    case 'Completed':
      return (
        <Button size="sm" variant="outline" onClick={() => { store.selectApplication(app.id); onOpenIssuanceWorkspace(app.id) }} className="text-xs h-8 border-teal-300 text-teal-800 dark:text-teal-300">
          View Dossier
        </Button>
      )
    default:
      return null
  }
}

export function ApplicationRow(props: ApplicationRowProps) {
  const { app } = props
  const flaggedCount = Object.values(app.sectionReviews || {}).filter(
    (s) => s.status === 'Needs Review' || s.status === 'Incomplete'
  ).length

  return (
    <>
      {/* ── Desktop row (≥md): grid table ── */}
      <div className="hidden md:grid grid-cols-12 gap-3 p-3 items-center hover:bg-muted/20 transition-colors text-xs">
        {/* Applicant — identity hierarchy: name → admission no → flagged */}
        <div className="col-span-3 space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-foreground truncate">{app.applicantName}</span>
            {flaggedCount > 0 && app.status === 'Need Correction' && (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] px-1.5 py-0 font-bold">
                {flaggedCount} flagged
              </Badge>
            )}
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">{app.admissionNo}</span>
        </div>

        {/* Class */}
        <div className="col-span-2 min-w-0">
          <span className="font-semibold text-foreground block truncate">{app.className} — {app.section}</span>
          <span className="text-[11px] text-muted-foreground font-mono">{app.academicSession}</span>
        </div>

        {/* Parent */}
        <div className="col-span-2 space-y-0.5 min-w-0">
          <span className="font-medium text-foreground block truncate">{app.formData.fatherName || app.formData.motherName}</span>
          <span className="text-[11px] text-muted-foreground font-mono">{app.formData.fatherPhone || app.formData.motherPhone}</span>
        </div>

        {/* Status */}
        <div className="col-span-2 space-y-1">
          <StatusBadge status={app.status} />
          {app.status === 'Rejected' && (
            <span className="text-[9px] text-rose-600 dark:text-rose-400 block">
              {app.rejectionRetentionDays || 60}d retention
            </span>
          )}
          {app.status === 'Completed' && app.generatedCredentials && (
            <span className="text-[9px] text-teal-600 dark:text-teal-400 block font-mono">
              {app.generatedCredentials.loginId}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="col-span-3 flex items-center justify-end gap-2">
          <StatusActions {...props} />
        </div>
      </div>

      {/* ── Mobile card (<md): compact structured card (spec §22) ── */}
      <div className="md:hidden p-3 space-y-2.5 hover:bg-muted/20 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-foreground truncate">{app.applicantName}</span>
              {flaggedCount > 0 && app.status === 'Need Correction' && (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] px-1.5 py-0 font-bold">
                  {flaggedCount} flagged
                </Badge>
              )}
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">{app.admissionNo}</span>
          </div>
          <StatusBadge status={app.status} />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{app.className} — {app.section}</span>
          <span className="text-border">·</span>
          <span className="font-mono">{app.academicSession}</span>
          <span className="text-border">·</span>
          <span className="truncate">{app.formData.fatherName || app.formData.motherName}</span>
        </div>
        <div className="flex items-center justify-end gap-2 pt-0.5">
          <StatusActions {...props} />
        </div>
      </div>
    </>
  )
}
