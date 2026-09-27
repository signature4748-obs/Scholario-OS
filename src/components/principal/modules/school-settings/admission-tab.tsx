'use client'

// Admission Config tab — school-level admission facts. The operational
// admission settings (workflow, form fields, seats, document privacy) are
// configured in Admissions → Settings; this tab shows the school-level
// facility toggle plus the LIVE admission policy as read-only facts
// (Wave 2 deep §18 — no fake editable controls that nothing reads).

import { FileText, Building2, CheckCircle2, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import { toast } from 'sonner'
import { SettingsTab } from './shared'
import { ADMISSION_DOCS } from '@/components/principal/modules/admission/lib/documents'

export function AdmissionTab() {
  const store = useSchoolSettingsStore()
  const admissionSettings = store.admissionSettings

  return (
    <SettingsTab
      icon={FileText}
      title="Admission Facts & Facilities"
      description="School-level admission configuration. The full workflow, form-field, seat and document-privacy settings live in Admissions → Settings."
    >
      {/* Facilities Config (Hostel Toggle) — wired to the admission workflow */}
      <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
        <h4 className="font-semibold text-xs text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-emerald-600" /> School Facilities
        </h4>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-xs text-foreground">Hostel Boarding Facility Enabled</p>
            <p className="text-[11px] text-muted-foreground">
              When disabled, Hostel options will be completely hidden from student admission forms and validation.
            </p>
          </div>
          <Switch
            checked={store.facilities?.hasHostelFacility ?? true}
            onCheckedChange={(checked) => {
              store.updateFacilities({ hasHostelFacility: checked })
              toast.success(checked ? 'Hostel Facility Enabled for Admissions' : 'Hostel Facility Disabled for Admissions')
            }}
          />
        </div>
      </div>

      {/* Live admission policy — read-only facts from the canonical catalogue */}
      <div className="space-y-3 text-xs">
        <div>
          <p className="font-semibold text-foreground mb-1.5">Admission document policy</p>
          <div className="flex flex-wrap gap-2">
            {ADMISSION_DOCS.map((doc) => (
              <Badge
                key={doc.key}
                variant="secondary"
                className={
                  doc.mandatory
                    ? 'px-3 py-1 text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25'
                    : 'px-3 py-1 text-xs bg-muted/40 text-muted-foreground border border-border/60'
                }
              >
                {doc.mandatory ? <CheckCircle2 className="h-3 w-3 mr-1" /> : null}
                {doc.name}{doc.mandatory ? '' : ' · optional'}
              </Badge>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Only required documents block admission completion — optional documents are verified when received.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl border border-border/70 bg-muted/20">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Student photo</p>
            <p className="font-semibold text-foreground mt-0.5">
              {admissionSettings.photoRequirement === 'required' ? 'Required at admission' : 'Optional'}
            </p>
          </div>
          <div className="p-3 rounded-xl border border-border/70 bg-muted/20">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Duplicate detection</p>
            <p className="font-semibold text-foreground mt-0.5">
              {admissionSettings.duplicateDetection.enabled ? 'Active at submission' : 'Disabled (school choice)'}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
          <ArrowRight className="h-3 w-3" />
          To change workflow, fields, seats, or document privacy, open Admissions → Settings.
        </p>
      </div>
    </SettingsTab>
  )
}
