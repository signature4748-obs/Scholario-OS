'use client'

import { Printer, Download, X, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useSchoolProfile } from '@/lib/school-profile'
import { downloadHTMLFile, openPrintWindow, safeFileName } from '@/lib/download-file'
import type { TeacherRecord } from '@/lib/store/teachers-store'
import {
  getAppointmentLetterContent,
  buildAppointmentLetterHTML,
} from './appointment-letter-content'

interface Props {
  letter: TeacherRecord['appointmentLetter']
  teacher: TeacherRecord
  onClose: () => void
}

/**
 * Official Appointment Letter — a genuine A4 institutional document
 * (Wave 2.3 §8).
 *
 *   · renders ONLY the letter's immutable issue-time snapshot + school
 *     profile — no live profile data, no QR, no portal credentials, no
 *     decorative verification graphics
 *   · Print and Download both use the SAME canonical standalone HTML
 *     (buildAppointmentLetterHTML) — the downloaded file and the printed
 *     sheet are literally the same document
 *   · the on-screen preview renders the same content model on an A4 sheet
 */
export function AppointmentLetterDocument({ letter, teacher, onClose }: Props) {
  const profile = useSchoolProfile()

  if (!letter) return null
  const c = getAppointmentLetterContent(letter, profile)
  const html = buildAppointmentLetterHTML(letter, profile)

  const handlePrint = () => {
    const w = openPrintWindow(html, `Appointment Letter — ${c.teacherName}`)
    if (!w) {
      toast.error('Print window was blocked', {
        description: 'Allow pop-ups for this site to print the letter.',
      })
    }
  }

  const handleDownload = () => {
    try {
      const filename = safeFileName(`appointment-letter-${c.teacherName}`, 'html')
      downloadHTMLFile(html, filename)
      toast.success('Appointment Letter downloaded', { description: filename })
    } catch {
      toast.error('Unable to generate letter', { description: 'Please try again.' })
    }
  }

  const archiveCount = teacher.letterArchive?.length ?? 0

  return (
    <div className="p-4 sm:p-5 bg-muted/40 space-y-4">
      {/* Action bar — never printed */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">
            Appointment Letter · {c.teacherName}
          </p>
          <Badge variant="outline" className="text-[9px] font-mono shrink-0">
            {c.refNo}
          </Badge>
          {archiveCount > 0 && (
            <Badge variant="outline" className="text-[9px] text-muted-foreground shrink-0 gap-1">
              <Archive className="h-2.5 w-2.5" /> {archiveCount} earlier issued
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs h-8 gap-1.5 bg-card">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button size="sm" onClick={handleDownload} className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-8 w-8 p-0" aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ================= A4 SHEET ================= */}
      <div
        className="mx-auto w-full max-w-[210mm] min-h-[1120px] bg-white text-slate-900 rounded-lg shadow-lg border border-slate-200 px-[13mm] sm:px-[16mm] py-[14mm] font-serif"
      >
        {/* ---- Letterhead ---- */}
        <header className="flex items-start justify-between gap-4 pb-3.5 border-b-[2.5px] border-slate-900">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[10px] bg-slate-900 text-white text-2xl font-black font-sans">
              {c.schoolShort.charAt(0)}
            </div>
            <div className="min-w-0">
              <h1 className="text-[19px] leading-tight font-extrabold uppercase tracking-[0.03em] text-slate-900 font-sans truncate">
                {c.schoolName}
              </h1>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-lime-800 font-sans mt-0.5">
                {c.affiliation}
              </p>
              <p className="text-[10px] text-slate-600 mt-1 leading-snug font-sans max-w-[400px]">
                {c.contactLine}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-[11px] font-bold text-slate-800">Ref. No: {c.refNo}</p>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">Date: {c.issueDate}</p>
          </div>
        </header>

        {/* ---- Title ---- */}
        <div className="pt-6 pb-4 text-center">
          <h2 className="text-[15px] font-bold uppercase tracking-[0.28em] text-slate-900">
            Appointment Letter
          </h2>
          <hr className="w-[42%] mx-auto mt-2 border-t-[1.5px] border-slate-400" />
        </div>

        {/* ---- Addressee ---- */}
        <div className="text-[12px] leading-relaxed mb-3.5">
          To,<br />
          <strong className="text-[13.5px]">{c.teacherName}</strong>
          {c.teacherAddress && (
            <>
              <br />
              <span className="text-slate-600">{c.teacherAddress}</span>
            </>
          )}
        </div>

        {/* ---- Body ---- */}
        <p className="text-[12px] leading-[1.85] text-justify mb-3">Dear {c.teacherName},</p>
        <p className="text-[12px] leading-[1.85] text-justify mb-1">{c.offerParagraph}</p>

        {/* ---- Employee details table ---- */}
        <table className="w-full my-3.5 border-collapse">
          <tbody>
            {c.details.map((d) => (
              <tr key={d.label}>
                <th className="text-left align-top w-[34%] py-[6.5px] pr-2 border-b border-slate-200 text-[9px] font-bold uppercase tracking-[0.07em] text-slate-500 font-sans">
                  {d.label}
                </th>
                <td className="py-[6.5px] px-2 border-b border-slate-200 text-[11px] font-bold text-slate-900">
                  {d.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ---- Terms ---- */}
        <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-900 mt-4 mb-2 font-sans">
          Terms &amp; Conditions of Appointment
        </p>
        <ol className="list-decimal pl-5 space-y-[5px] text-[11px] leading-[1.75] text-slate-800">
          {c.terms.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>

        <p className="text-[12px] leading-[1.85] text-justify mt-4">{c.closingParagraph}</p>

        {/* ---- Signatures ---- */}
        <div className="mt-6 pt-6 border-t border-slate-300 flex items-end justify-between gap-6">
          <div className="text-center">
            <div className="w-[84px] h-[84px] rounded-full border-[1.5px] border-dashed border-slate-500 flex items-center justify-center text-center text-[8.5px] font-bold uppercase tracking-[0.1em] text-slate-500 leading-[1.5] p-1.5 mx-auto mb-2">
              School<br />Seal
            </div>
            <div className="h-[26px] border-b border-slate-500 w-[200px] mx-auto" />
            <p className="text-[12px] font-bold mt-1.5">{c.principalName}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-slate-600">
              Authorized Signatory · Principal
            </p>
          </div>
          <div className="text-center">
            <div className="h-[26px] border-b border-slate-500 w-[200px] mx-auto" />
            <p className="text-[12px] font-bold mt-1.5">{c.teacherName}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-slate-600">
              Employee Signature
            </p>
          </div>
        </div>

        {/* ---- Acceptance block ---- */}
        <div className="mt-5">
          <div className="border border-slate-300 rounded-lg px-4 py-3.5 flex flex-wrap justify-between items-end gap-x-5 gap-y-3">
            <p className="text-[11px] leading-relaxed max-w-[300px]">
              <span className="font-bold">Employee Acceptance</span> — I have read and accepted
              the terms of appointment stated above.
            </p>
            <div className="text-[11px] text-right space-y-3">
              <p>
                Signature <span className="inline-block border-b border-slate-500 w-[150px]" />
              </p>
              <p>
                Date <span className="inline-block border-b border-slate-500 w-[90px]" />
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-[8.5px] text-slate-400 mt-6 font-sans">
          Issued by {c.schoolName} · {c.refNo} · This is a computer-printed document.
        </p>
      </div>
    </div>
  )
}
