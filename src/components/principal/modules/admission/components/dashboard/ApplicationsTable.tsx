import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/shared/ui'
import { type AdmissionStoreState, type AdmissionApplication } from '@/lib/store/admission-store'
import { ApplicationRow } from './ApplicationRow'
import type { ActiveTab } from './types'

interface ApplicationsTableProps {
  filteredApps: AdmissionApplication[]
  store: AdmissionStoreState
  activeTab: ActiveTab
  searchQuery: string
  selectedClass: string
  onOpenWizard: (appId?: string) => void
  onOpenVerificationWorkspace: (appId: string) => void
  onOpenIssuanceWorkspace: (appId: string) => void
  setActiveTab: (tab: ActiveTab) => void
  setSearchQuery: (v: string) => void
  setSelectedClass: (v: string) => void
}

/** WHAT / WHY / WHAT NEXT per status tab (spec §24). */
const EMPTY_STATE_COPY: Partial<Record<ActiveTab, { title: string; body: string }>> = {
  All: { title: 'No applications yet', body: 'Applications you create or receive will appear here. Start a new one to begin the admission workflow.' },
  Submitted: { title: 'Nothing in review', body: 'Submitted applications land here for verification. New submissions appear automatically.' },
  'Need Correction': { title: 'No corrections pending', body: 'Applications you return for correction will wait here until the family resubmits.' },
  Approved: { title: 'No approved applications', body: 'Approve an application in the review workspace and it becomes ready for issuance here.' },
  Completed: { title: 'No enrollments yet', body: 'Completed admissions become enrolled students — their dossiers stay available here.' },
  Rejected: { title: 'No rejected records', body: 'Rejected applications are retained for their retention window before they can be deleted.' },
  Draft: { title: 'No drafts', body: 'Forms you start and leave unfinished are auto-saved here as drafts.' },
}

export function ApplicationsTable({
  filteredApps,
  store,
  activeTab,
  searchQuery,
  selectedClass,
  onOpenWizard,
  onOpenVerificationWorkspace,
  onOpenIssuanceWorkspace,
  setActiveTab,
  setSearchQuery,
  setSelectedClass,
}: ApplicationsTableProps) {
  // Search/class are FILTERS; the status tab is a VIEW — so the empty
  // state uses the tab-specific copy unless a real filter is active.
  const filtersActive = !!searchQuery.trim() || selectedClass !== 'All'

  return (
    <GlassCard className="overflow-hidden border">
      {filteredApps.length === 0 ? (
        <div className="p-10 sm:p-12 text-center space-y-3">
          <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <h3 className="font-bold text-sm">
            {filtersActive ? 'No applications match your filters' : EMPTY_STATE_COPY[activeTab]?.title || 'No applications here'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {filtersActive
              ? 'Try adjusting the status tab, class filter or search query.'
              : EMPTY_STATE_COPY[activeTab]?.body || 'Records will appear here.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            {filtersActive ? (
              <Button size="sm" variant="outline" onClick={() => { setActiveTab('All'); setSearchQuery(''); setSelectedClass('All') }} className="text-xs">
                Reset Filters
              </Button>
            ) : (
              <Button size="sm" onClick={() => onOpenWizard()} className="text-xs bg-primary text-primary-foreground">
                New Application
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="divide-y">
          {/* Table header — desktop only; mobile renders cards */}
          <div className="hidden md:grid grid-cols-12 gap-3 p-3 bg-muted/40 text-muted-foreground font-bold uppercase text-[10px] tracking-wider">
            <div className="col-span-3">Applicant</div>
            <div className="col-span-2">Class</div>
            <div className="col-span-2">Parent</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>

          {filteredApps.map((app) => (
            <ApplicationRow
              key={app.id}
              app={app}
              store={store}
              onOpenWizard={onOpenWizard}
              onOpenVerificationWorkspace={onOpenVerificationWorkspace}
              onOpenIssuanceWorkspace={onOpenIssuanceWorkspace}
            />
          ))}
        </div>
      )}
    </GlassCard>
  )
}
