'use client'

import { useRef } from 'react'
import { toast } from 'sonner'
import { school } from '@/lib/mock/school'
import { useSchoolProfile } from '@/lib/school-profile'
import { downloadHTMLFile, safeFileName } from '@/lib/download-file'
import { TopActionBar } from './OfficialAdmissionLetter/TopActionBar'
import { Watermark, SchoolHeader } from './OfficialAdmissionLetter/SchoolHeader'
import { StudentProfileGrid } from './OfficialAdmissionLetter/StudentProfileGrid'
import { ConfirmationStatement } from './OfficialAdmissionLetter/ConfirmationStatement'
import { FeeBreakdownTable } from './OfficialAdmissionLetter/FeeBreakdownTable'
import { Signatures, DocumentFooter } from './OfficialAdmissionLetter/Authorization'
import { buildAdmissionLetterHTML } from './OfficialAdmissionLetter/letter-html'
import type { OfficialAdmissionLetterProps as Props } from './OfficialAdmissionLetter/types'

export type { AdmissionLetterData } from './OfficialAdmissionLetter/types'

/**
 * OFFICIAL ADMISSION LETTER (Wave 2 deep spec §19–§24).
 *
 * Institutional document structure:
 *   HEADER (school identity, affiliation, contact)
 *   → DOCUMENT META (title, ref, date, session)
 *   → STUDENT INFORMATION (photo per policy, identifiers)
 *   → CONFIRMATION (formal admission statement)
 *   → FEE SUMMARY (only when the school's document policy allows)
 *   → AUTHORIZATION (Parent/Guardian + Principal signatures)
 *   → FOOTER (subtle document reference — no QR, §20)
 *
 * No portal credentials (§23), no ERP vocabulary (§22), no fabricated
 * verification identifiers. Sensitive demographics are excluded by the
 * school's document privacy policy (§17).
 */
export function OfficialAdmissionLetter({ data, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const profile = useSchoolProfile()

  const handlePrint = () => {
    window.print()
  }

  const fullName = `${data.student.firstName} ${data.student.lastName}`

  // REAL download — a standalone branded HTML letter mirroring the preview.
  const handleDownloadPdf = () => {
    try {
      const html = buildAdmissionLetterHTML(data, profile)
      const filename = safeFileName(`admission-letter-${fullName}`, 'html')
      downloadHTMLFile(html, filename)
      toast.success('Admission Letter downloaded', {
        description: filename,
      })
    } catch {
      toast.error('Unable to generate letter', {
        description: 'Please try again.',
      })
    }
  }

  const principalName = profile.principal || school.principal || 'Principal'

  return (
    <div className="space-y-6">
      {/* Top Action Bar (hidden on print) */}
      <TopActionBar
        admissionNo={data.admissionNo}
        onPrint={handlePrint}
        onDownloadPdf={handleDownloadPdf}
        onClose={onClose}
      />

      {/* Printable Institutional Document */}
      <div
        ref={printRef}
        className="bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-xl border border-slate-200 relative overflow-hidden font-sans print:shadow-none print:border-none print:p-0 print:m-0"
      >
        {/* Subtle watermark */}
        <Watermark />

        {/* HEADER — school identity, affiliation, contact + document meta */}
        <SchoolHeader data={data} />

        {/* STUDENT INFORMATION */}
        <StudentProfileGrid data={data} fullName={fullName} />

        {/* CONFIRMATION */}
        <ConfirmationStatement data={data} schoolName={school.name} fullName={fullName} />

        {/* FEE SUMMARY — only when policy allows */}
        <FeeBreakdownTable data={data} />

        {/* AUTHORIZATION */}
        <Signatures data={data} principalName={principalName} />

        {/* FOOTER — subtle document reference, no QR */}
        <DocumentFooter data={data} />
      </div>
    </div>
  )
}
