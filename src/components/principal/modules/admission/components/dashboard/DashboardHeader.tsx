import { Plus, SlidersHorizontal, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardHeaderProps {
  total: number
  inReview: number
  approved: number
  onOpenSettingsModal: () => void
  onOpenOcrModal?: () => void
  onOpenWizard: () => void
}

export function DashboardHeader({
  total,
  inReview,
  approved,
  onOpenSettingsModal,
  onOpenOcrModal,
  onOpenWizard,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
      {/* Brief PART 1: NO duplicate page title — topbar already shows "Admissions".
          Content begins directly with the contextual summary + controls. */}
      <p className="text-xs text-muted-foreground">
        {total} applications · {inReview} pending review · {approved} ready for issuance
      </p>
      <div className="flex items-center gap-2">
        {/* Settings */}
        <Button variant="outline" size="sm" onClick={onOpenSettingsModal} className="text-xs gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Settings
        </Button>
        {/* Scan / Import a filled paper application (real local OCR) */}
        {onOpenOcrModal && (
          <Button variant="outline" size="sm" onClick={onOpenOcrModal} className="text-xs gap-1.5">
            <ScanLine className="h-3.5 w-3.5" />
            Scan / Import
          </Button>
        )}
        {/* Single primary action */}
        <Button size="sm" onClick={() => onOpenWizard()} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5">
          <Plus className="h-4 w-4" />
          New Application
        </Button>
      </div>
    </div>
  )
}
