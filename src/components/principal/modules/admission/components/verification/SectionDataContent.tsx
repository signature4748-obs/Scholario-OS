'use client'

import type { AdmissionApplication } from '@/lib/store/admission-store'
import type { SectionKey } from '@/lib/store/admission-store'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import { ADMISSION_DOCS } from '../../lib/documents'
import type { DocStatus } from '../../types'

interface SectionDataContentProps {
  sectionKey: SectionKey
  app: AdmissionApplication
}

/** Compact read-only document status rows for the verification checklist. */
function DocumentStatusRows({ app }: { app: AdmissionApplication }) {
  const docStatuses = app.formData.docStatuses || {}
  const st = (key: string): DocStatus => docStatuses[key] || { status: 'pending' }

  const statusLabel = (s: DocStatus): string => {
    if (s.status === 'later') return 'Deferred'
    if (s.status !== 'uploaded') return 'Not Uploaded'
    switch (s.verificationStatus) {
      case 'verified': return 'Verified'
      case 'rejected': return 'Rejected'
      case 'replace_requested': return 'Replace Requested'
      default: return 'Uploaded · Pending Review'
    }
  }
  const statusClass = (s: DocStatus): string => {
    if (s.status === 'later') return 'text-amber-600 dark:text-amber-400'
    if (s.status !== 'uploaded') return 'text-muted-foreground'
    switch (s.verificationStatus) {
      case 'verified': return 'text-emerald-600 dark:text-emerald-400'
      case 'rejected': return 'text-rose-600 dark:text-rose-400'
      case 'replace_requested': return 'text-violet-600 dark:text-violet-400'
      default: return 'text-amber-600 dark:text-amber-400'
    }
  }

  return (
    <div className="space-y-1 w-full">
      {ADMISSION_DOCS.map((doc) => {
        const s = st(doc.key)
        return (
          <div key={doc.key} className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate">
              <strong className="text-foreground">{doc.name}</strong>
              <span className={doc.mandatory ? 'text-rose-600 dark:text-rose-400 ml-1.5' : 'text-muted-foreground ml-1.5'}>
                {doc.mandatory ? 'Required' : 'Optional'}
              </span>
            </span>
            <span className={`shrink-0 font-medium ${statusClass(s)}`}>
              {statusLabel(s)}
              {s.status === 'uploaded' && s.ocrConfidence ? ` · ${s.ocrConfidence}% OCR` : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function SectionDataContent({ sectionKey, app }: SectionDataContentProps) {
  const formData = app.formData

  if (sectionKey === 'personal') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div><span className="text-muted-foreground block text-[10px]">Name:</span> <strong>{formData.firstName} {formData.lastName}</strong></div>
        <div><span className="text-muted-foreground block text-[10px]">DOB:</span> <strong>{formData.dob}</strong></div>
        <div><span className="text-muted-foreground block text-[10px]">Gender & Blood:</span> <strong>{formData.gender} ({formData.bloodGroup || 'O+'})</strong></div>
        <div><span className="text-muted-foreground block text-[10px]">Nationality & Category:</span> <strong>{formData.nationality} ({formData.category})</strong></div>
        <div><span className="text-muted-foreground block text-[10px]">Aadhaar No:</span> <strong>{formData.aadhaarNo || 'Verified'}</strong></div>
      </div>
    )
  }

  if (sectionKey === 'parents') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div><span className="text-muted-foreground block text-[10px]">Father:</span> <strong>{formData.fatherName} ({formData.fatherOccupation}) · {formData.fatherPhone}</strong></div>
        <div><span className="text-muted-foreground block text-[10px]">Mother:</span> <strong>{formData.motherName} ({formData.motherOccupation}) · {formData.motherPhone}</strong></div>
        <div><span className="text-muted-foreground block text-[10px]">Emergency Contact:</span> <strong>{formData.emergencyName} ({formData.emergencyRelation}) · {formData.emergencyPhone}</strong></div>
      </div>
    )
  }

  if (sectionKey === 'address') {
    return (
      <div className="space-y-1">
        <div><span className="text-muted-foreground block text-[10px]">Current Residence:</span> <strong>{formData.currentAddress}, {formData.district}, {formData.state} - {formData.pincode}</strong></div>
      </div>
    )
  }

  if (sectionKey === 'previousSchool') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div><span className="text-muted-foreground block text-[10px]">Previous School:</span> <strong>{formData.previousSchool} ({formData.previousBoard})</strong></div>
        <div><span className="text-muted-foreground block text-[10px]">Academic Session Selector:</span> <strong>{formData.previousYear || '2025–2026'}</strong></div>
        <div><span className="text-muted-foreground block text-[10px]">TC Status & No:</span> <strong>{formData.tcStatus} · No: {formData.tcNumber || 'TC-2025-8841'}</strong></div>
      </div>
    )
  }

  if (sectionKey === 'medical') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div><span className="text-muted-foreground block text-[10px]">Allergies / Special Needs:</span> <strong>{formData.allergies || 'None'}</strong></div>
        <div><span className="text-muted-foreground block text-[10px]">Doctor Contact:</span> <strong>{formData.doctorName} ({formData.doctorPhone})</strong></div>
      </div>
    )
  }

  if (sectionKey === 'classAllocation') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div><span className="text-muted-foreground block text-[10px]">Admitted Class & Section:</span> <strong>{formData.className} — Section {formData.section}</strong></div>
      </div>
    )
  }

  if (sectionKey === 'fees') {
    return (
      <div className="space-y-1">
        <div><span className="text-muted-foreground block text-[10px]">Payment Plan & Selected Heads:</span> <strong>{app.feeData?.paymentMethod || 'UPI / Bank Transfer'} · Heads Selected: {app.feeData?.selectedFeeHeadIds?.length || 5}</strong></div>
      </div>
    )
  }

  if (sectionKey === 'documents') {
    return <DocumentStatusRows app={app} />
  }

  if (sectionKey === 'photo') {
    const photoUrl = formData.photoDataUrl
    const photoRequired = useSchoolSettingsStore.getState().admissionSettings.photoRequirement === 'required'
    return (
      <div className="flex items-center gap-3">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={`${formData.firstName} ${formData.lastName} passport photo`} className="h-12 w-12 rounded-lg object-cover border border-border" />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold text-lg">
            {formData.firstName[0]}{formData.lastName[0]}
          </div>
        )}
        <div className="text-xs">
          <span className={photoUrl ? 'font-semibold block text-emerald-800 dark:text-emerald-300' : 'font-semibold block text-muted-foreground'}>
            {photoUrl ? 'Photo attached' : photoRequired ? 'Photo required — not provided' : 'No photo selected'}
          </span>
          <span className="text-muted-foreground text-[10px]">
            {photoUrl ? 'The same photo follows the application — dossier, admission letter, and the student record.' : 'Upload a passport photo from the Photo step.'}
          </span>
        </div>
      </div>
    )
  }

  return null
}
