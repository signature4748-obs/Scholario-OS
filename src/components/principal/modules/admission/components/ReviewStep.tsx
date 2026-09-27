'use client'

/**
 * Wizard Step 10 — Review & Submit (Wave 2 deep spec §25–§27).
 *
 * The single source of truth for what will be submitted. One review list —
 * Student / Parents / Address / Academic / Previous School / Transport /
 * Fee / Photo / Documents — each with a Complete ✓ / Incomplete / Optional
 * status so missing mandatory information is visible immediately.
 *
 * The Photo section shows the ACTUAL uploaded photo with Replace (spec §26);
 * Documents shows the required/optional business rule transparently (§27):
 * completion = Aadhaar (required) received — optional uploads never block.
 */
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Users, MapPin, GraduationCap, School as SchoolIcon, Bus, Wallet,
  Camera, FileText, Pencil, ChevronDown, CheckCircle2, AlertCircle, MinusCircle,
} from 'lucide-react'
import { school } from '@/lib/mock/school'
import { formatDate, formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import {
  useAdmissionFeatureFlags,
} from '../lib/admission-utils'
import {
  REQUIRED_DOCS, OPTIONAL_DOCS, getDocumentsCompletion,
} from '../lib/documents'
import { computeAdmissionFeeSummary } from '../lib/fee-summary'
import type { FormData } from '../constants'

type SectionStatus = 'complete' | 'incomplete' | 'optional'

const STATUS_CHIP: Record<SectionStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  complete: { label: 'Complete ✓', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25', Icon: CheckCircle2 },
  incomplete: { label: 'Incomplete', className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25', Icon: AlertCircle },
  optional: { label: 'Optional', className: 'bg-muted/40 text-muted-foreground border-border/60', Icon: MinusCircle },
}

export function ReviewStep({ data, flags, onJumpTo }: { data: FormData; flags: ReturnType<typeof useAdmissionFeatureFlags>; set: <K extends keyof FormData>(k: K, v: FormData[K]) => void; onJumpTo: (step: number) => void }) {
  // All sections expanded by default; track which are collapsed (manually closed)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleSection = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const admissionSettings = useSchoolSettingsStore((s) => s.admissionSettings)
  const photoRequired = admissionSettings.photoRequirement === 'required'

  // Documents summary (spec §27) — the business rule, transparent.
  const docs = useMemo(
    () => getDocumentsCompletion(data.docStatuses),
    [data.docStatuses],
  )
  const requiredUploadedNames = REQUIRED_DOCS
    .filter((d) => {
      const st = data.docStatuses[d.key]
      return st && (st.status === 'uploaded' || st.status === 'later')
    })
    .map((d) => d.name)

  // Fee summary — canonical engine, same numbers as the Fee step (spec §25).
  const feeSummary = useMemo(
    () => computeAdmissionFeeSummary(data.className || '', data.feeState, {
      enableTransport: !!flags.enableTransport,
      enableHostel: !!flags.enableHostel,
    }),
    [data.className, data.feeState, flags.enableTransport, flags.enableHostel],
  )

  const hasPhoto = !!data.photoDataUrl
  const prevSchoolRelevant = !!(data.previousSchool || data.previousClass || data.tcNumber)
  const transportRelevant = !!(flags.enableTransport || flags.enableHostel)

  const sections: Array<{
    id: string
    step: number
    icon: typeof User
    status: SectionStatus
    statusNote?: string
    rows: Array<{ label: string; value: string }>
    extra?: 'photo' | 'documents' | 'fee'
  }> = [
    {
      id: 'Student', step: 1, icon: User,
      status: data.firstName && data.lastName && data.dob ? 'complete' : 'incomplete',
      statusNote: !(data.firstName && data.lastName) ? 'Name missing' : !data.dob ? 'Date of birth missing' : undefined,
      rows: [
        { label: 'Name', value: `${data.firstName} ${data.lastName}`.trim() || '—' },
        { label: 'DOB', value: data.dob ? formatDate(data.dob) : '—' },
        { label: 'Gender', value: data.gender || '—' },
        ...(flags.enableBloodGroup && data.bloodGroup ? [{ label: 'Blood Group', value: data.bloodGroup }] : []),
        ...(flags.enableAadhaar && data.aadhaarNo ? [{ label: 'Aadhaar', value: data.aadhaarNo }] : []),
      ],
    },
    {
      id: 'Parents', step: 2, icon: Users,
      status: data.fatherName && data.fatherPhone ? 'complete' : 'incomplete',
      statusNote: !data.fatherName ? "Father's name missing" : !data.fatherPhone ? "Father's phone missing" : undefined,
      rows: [
        { label: 'Father', value: data.fatherName || '—' },
        { label: 'Father Phone', value: data.fatherPhone || '—' },
        { label: 'Mother', value: data.motherName || '—' },
        { label: 'Emergency', value: data.emergencyName || '—' },
      ],
    },
    {
      id: 'Address', step: 3, icon: MapPin,
      status: data.currentAddress && data.district ? 'complete' : 'incomplete',
      statusNote: !data.currentAddress ? 'Address line missing' : !data.district ? 'District missing' : undefined,
      rows: [
        { label: 'Current', value: [data.currentAddress, data.district, data.state].filter(Boolean).join(', ') || '—' },
        { label: 'PIN', value: data.pincode || '—' },
      ],
    },
    {
      id: 'Academic', step: 4, icon: GraduationCap,
      status: data.className ? 'complete' : 'incomplete',
      statusNote: !data.className ? 'Class not selected' : undefined,
      rows: [
        { label: 'Session', value: data.previousYear || school.academicYear },
        { label: 'Class', value: data.className || '—' },
        { label: 'Section', value: data.section || 'No preference' },
        ...(data.waitlisted ? [{ label: 'Status', value: 'Waitlisted' }] : []),
      ],
    },
    ...(prevSchoolRelevant ? [{
      id: 'Previous School', step: 5, icon: SchoolIcon, status: 'complete' as SectionStatus,
      rows: [
        { label: 'School', value: data.previousSchool || '—' },
        { label: 'Last Class', value: data.previousClass || '—' },
        ...(data.tcNumber ? [{ label: 'TC No.', value: data.tcNumber }] : []),
      ],
    }] : []),
    ...(transportRelevant ? [{
      id: 'Transport', step: 6, icon: Bus,
      status: (data.transportRequired || data.hostelRequired ? 'complete' : 'optional') as SectionStatus,
      rows: [
        { label: 'Transport', value: data.transportRequired ? data.transportRoute || 'Yes' : 'Not required' },
        ...(data.hostelRequired ? [{ label: 'Hostel', value: data.hostelRoomType || 'Yes' }] : []),
      ],
    }] : []),
    {
      id: 'Fee', step: 7, icon: Wallet, status: 'complete', extra: 'fee',
      rows: [],
    },
    {
      id: 'Photo', step: 8, icon: Camera,
      status: hasPhoto ? 'complete' : photoRequired ? 'incomplete' : 'optional',
      statusNote: hasPhoto ? undefined : photoRequired ? 'Photo required' : 'No photo selected',
      rows: [], extra: 'photo',
    },
    {
      id: 'Documents', step: 9, icon: FileText,
      status: docs.complete ? 'complete' : 'incomplete',
      statusNote: docs.complete ? undefined : 'Aadhaar Card required',
      rows: [], extra: 'documents',
    },
  ]

  const incompleteCount = sections.filter((s) => s.status === 'incomplete').length

  return (
    <div className="space-y-4">
      {/* Scanned-form provenance (spec §35 — subtle, only when useful) */}
      {data.scannedAttachment && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <FileText className="h-3 w-3" />
          Imported from scanned form ({data.scannedAttachment.fileName}, {data.scannedAttachment.confidence}% read confidence)
        </p>
      )}

      {/* Final readiness line */}
      <div
        className={cn(
          'rounded-xl border px-3.5 py-2.5 text-xs font-medium flex items-center gap-2',
          incompleteCount === 0
            ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
            : 'border-rose-500/25 bg-rose-500/5 text-rose-700 dark:text-rose-300',
        )}
      >
        {incompleteCount === 0 ? (
          <><CheckCircle2 className="h-4 w-4" /> Everything required is complete — ready to submit.</>
        ) : (
          <><AlertCircle className="h-4 w-4" /> {incompleteCount} {incompleteCount === 1 ? 'section needs' : 'sections need'} attention before this reads complete.</>
        )}
      </div>

      <div className="space-y-2.5">
        {sections.map((section) => {
          const Icon = section.icon
          const chip = STATUS_CHIP[section.status]
          const isOpen = !collapsed.has(section.id)
          return (
            <div key={section.id} className={cn('rounded-xl border bg-card overflow-hidden',
              section.status === 'incomplete' ? 'border-rose-500/25' : 'border-border')}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleSection(section.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(section.id) } }}
                className="w-full flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors cursor-pointer gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    section.status === 'complete' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : section.status === 'incomplete' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-muted text-muted-foreground')}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-sm">{section.id}</span>
                  <span className={cn('hidden xs:inline-flex sm:inline-flex items-center gap-1 text-[10px] font-semibold rounded-full border px-2 py-0.5', chip.className)}>
                    <chip.Icon className="h-3 w-3" />
                    {section.statusNote || chip.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onJumpTo(section.step) }}
                    className="flex items-center gap-1 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-md px-2 py-1 transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                </div>
              </div>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3.5 pt-0 space-y-1.5">
                      {/* Photo preview (spec §26) */}
                      {section.extra === 'photo' && (
                        <div className="flex items-center gap-4">
                          {hasPhoto ? (
                            <div className="h-28 w-24 rounded-lg border border-border overflow-hidden bg-muted/30 shrink-0">
                              { }
                              <img src={data.photoDataUrl!} alt="Student photo" className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <div className="h-28 w-24 rounded-lg border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center text-muted-foreground shrink-0">
                              <Camera className="h-5 w-5 mb-1" />
                              <span className="text-[9px] text-center px-1">No photo selected</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">
                              {hasPhoto ? '✓ Selected' : photoRequired ? 'Photo required' : 'Optional'}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              The same photo follows the application — dossier, admission letter, and the student record.
                            </p>
                            <button
                              type="button"
                              onClick={() => onJumpTo(8)}
                              className="mt-2 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-md px-2 py-1 transition-colors"
                            >
                              {hasPhoto ? 'Replace Photo' : 'Upload Photo'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Documents status (spec §27) */}
                      {section.extra === 'documents' && (
                        <div className="space-y-1.5 text-xs">
                          <p className="text-muted-foreground">
                            <span className="font-semibold text-foreground">Required:</span>{' '}
                            {docs.complete
                              ? requiredUploadedNames.map((n, i) => (
                                  <span key={n}><CheckCircle2 className="inline h-3 w-3 text-emerald-600 dark:text-emerald-400 mb-0.5" /> {n}{i < requiredUploadedNames.length - 1 ? ' · ' : ''}</span>
                                ))
                              : 'Aadhaar Card not received'}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-semibold text-foreground">Optional:</span>{' '}
                            {docs.optionalUploaded} of {docs.optionalTotal} uploaded — optional documents never block admission.
                          </p>
                          <p className={cn('font-semibold', docs.complete ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
                            Documents {docs.complete ? '✓ Complete' : 'Incomplete'}
                            {docs.requiredDeferred > 0 ? ` · ${docs.requiredDeferred} deferred` : ''}
                          </p>
                        </div>
                      )}

                      {/* Fee summary (spec §25 — owes / payable now / remains) */}
                      {section.extra === 'fee' && (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Annual payable</p>
                            <p className="font-bold text-foreground tabular-nums mt-0.5">{formatINR(feeSummary.netTotal)}</p>
                          </div>
                          <div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Payable now</p>
                            <p className="font-bold text-foreground tabular-nums mt-0.5">{formatINR(feeSummary.initialInstallment)}</p>
                          </div>
                          <div className="rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Remaining</p>
                            <p className="font-bold text-foreground tabular-nums mt-0.5">{formatINR(feeSummary.remainingBalance)}</p>
                          </div>
                        </div>
                      )}

                      {section.rows.map((row) => (
                        <div key={row.label} className="flex justify-between items-start text-xs gap-2">
                          <span className="text-muted-foreground shrink-0">{row.label}:</span>
                          <span className="font-medium text-foreground text-right">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
