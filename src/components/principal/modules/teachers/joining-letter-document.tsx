'use client'

/**
 * Joining Letter — the employee JOINING / ACCEPTANCE RECORD (Wave 2.3 §10).
 *
 * Deliberately DISTINCT from the Appointment Letter:
 *   Appointment Letter → the school's formal offer of employment (A4,
 *                         terms & conditions, authorized signatory).
 *   Joining Letter     → the employee's record that they have JOINED and
 *                         accepted the appointment (compact, declaration
 *                         + employee signature + office receipt).
 *
 * Data comes from the teacher record's stable employment facts (name, ID,
 * designation, department, joining date). Print/Download share the same
 * canonical standalone HTML.
 */

import { Printer, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'
import { useSchoolProfile } from '@/lib/school-profile'
import { downloadHTMLFile, openPrintWindow, safeFileName } from '@/lib/download-file'
import type { TeacherRecord } from '@/lib/store/teachers-store'

interface Props {
  teacher: TeacherRecord
  onClose: () => void
}

interface JoiningRow { label: string; value: string }

function joiningRows(teacher: TeacherRecord): JoiningRow[] {
  return [
    { label: 'Employee Name', value: teacher.name },
    { label: 'Employee ID', value: teacher.employeeId },
    { label: 'Designation', value: teacher.designation },
    { label: 'Department', value: teacher.department },
    { label: 'Date of Joining', value: formatDate(teacher.joiningDate) },
    { label: 'Employment Type', value: teacher.employmentType },
  ]
}

function esc(v: unknown): string {
  return String(v ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function buildJoiningLetterHTML(teacher: TeacherRecord, profile: ReturnType<typeof useSchoolProfile>): string {
  const rows: [string, string][] = [
    ['Employee Name', teacher.name],
    ['Employee ID', teacher.employeeId],
    ['Designation', teacher.designation],
    ['Department', teacher.department],
    ['Date of Joining', formatDate(teacher.joiningDate)],
    ['Employment Type', teacher.employmentType],
  ]
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Joining Letter — ${esc(teacher.name)}</title>
<style>
  @page { size: A4 portrait; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111827; max-width: 178mm; margin: 0 auto; padding: 8mm 4mm; }
  .head { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 6px; }
  .school { font-family: 'Segoe UI', Arial, sans-serif; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; }
  .aff { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; font-weight: 700; color: #3f6212; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
  .addr { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #4b5563; margin-top: 3px; }
  h2 { text-align: center; font-size: 14px; letter-spacing: 0.24em; text-transform: uppercase; margin: 18px 0 4px; }
  .rule { width: 38%; margin: 0 auto 16px; border: 0; border-top: 1.5px solid #9ca3af; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0 18px; }
  th, td { font-size: 11px; padding: 6px 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  th { color: #6b7280; text-transform: uppercase; font-size: 9px; letter-spacing: 0.07em; width: 34%; font-family: 'Segoe UI', Arial, sans-serif; }
  td { font-weight: 700; }
  .decl { font-size: 12px; line-height: 1.85; text-align: justify; margin: 14px 0 26px; }
  .sign { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; border-top: 1px solid #d1d5db; padding-top: 24px; }
  .sig { text-align: center; }
  .sig .line { border-bottom: 1px solid #6b7280; width: 190px; margin: 0 auto 6px; height: 24px; }
  .sig .name { font-size: 12px; font-weight: 700; }
  .sig .role { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #4b5563; margin-top: 3px; letter-spacing: 0.07em; }
  .foot { text-align: center; font-size: 8.5px; color: #9ca3af; margin-top: 22px; font-family: 'Segoe UI', Arial, sans-serif; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="head">
    <div class="school">${esc(profile.name)}</div>
    <div class="aff">${esc(profile.affiliation)}</div>
    <div class="addr">${esc(profile.address)} · Tel: ${esc(profile.phone)}</div>
  </div>
  <h2>Joining Letter</h2>
  <hr class="rule" />
  <table><tbody>
    ${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
  </tbody></table>
  <p class="decl">
    I, <strong>${esc(teacher.name)}</strong> (Employee ID ${esc(teacher.employeeId)}), hereby
    record that I have joined ${esc(profile.name)} as <strong>${esc(teacher.designation)}</strong>
    in the Department of ${esc(teacher.department)} on <strong>${esc(formatDate(teacher.joiningDate))}</strong>.
    I confirm that I have received my letter of appointment, that I understand the terms and
    conditions of my employment, and that I accept the same. I undertake to abide by the rules,
    regulations and service conduct of the school as applicable to the teaching staff.
  </p>
  <div class="sign">
    <div class="sig">
      <div class="line"></div>
      <div class="name">${esc(teacher.name)}</div>
      <div class="role">Employee Signature &amp; Date</div>
    </div>
    <div class="sig">
      <div class="line"></div>
      <div class="name">${esc(profile.principal)}</div>
      <div class="role">Received &amp; Verified · Office Copy</div>
    </div>
  </div>
  <p class="foot">${esc(profile.name)} · Joining record of ${esc(teacher.name)} (${esc(teacher.employeeId)})</p>
</body>
</html>`
}

export function JoiningLetterDocument({ teacher, onClose }: Props) {
  const profile = useSchoolProfile()
  const html = buildJoiningLetterHTML(teacher, profile)
  const rows = joiningRows(teacher)

  const handlePrint = () => {
    const w = openPrintWindow(html, `Joining Letter — ${teacher.name}`)
    if (!w) toast.error('Print window was blocked', { description: 'Allow pop-ups for this site to print.' })
  }

  const handleDownload = () => {
    try {
      const filename = safeFileName(`joining-letter-${teacher.name}`, 'html')
      downloadHTMLFile(html, filename)
      toast.success('Joining Letter downloaded', { description: filename })
    } catch {
      toast.error('Unable to generate letter', { description: 'Please try again.' })
    }
  }

  return (
    <div className="p-4 sm:p-5 bg-muted/40 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          Joining Letter · {teacher.name}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs h-8 gap-1.5 bg-card">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button size="sm" onClick={handleDownload} className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-8" aria-label="Close">
            Close
          </Button>
        </div>
      </div>

      {/* A4 sheet preview — same content model as the printable HTML */}
      <div className="mx-auto w-full max-w-[210mm] min-h-[1000px] bg-white text-slate-900 rounded-lg shadow-lg border border-slate-200 px-[13mm] sm:px-[16mm] py-[14mm] font-serif">
        <div className="text-center border-b-2 border-slate-900 pb-3 mb-6">
          <h1 className="text-[18px] font-extrabold uppercase tracking-[0.03em] font-sans">{profile.name}</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-lime-800 font-sans mt-0.5">{profile.affiliation}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-sans">{profile.address} · Tel: {profile.phone}</p>
        </div>

        <div className="pb-4 text-center">
          <h2 className="text-[14px] font-bold uppercase tracking-[0.24em]">Joining Letter</h2>
          <hr className="w-[38%] mx-auto mt-2 border-t-[1.5px] border-slate-400" />
        </div>

        <table className="w-full my-3 border-collapse">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th className="text-left align-top w-[34%] py-[6px] pr-2 border-b border-slate-200 text-[9px] font-bold uppercase tracking-[0.07em] text-slate-500 font-sans">
                  {r.label}
                </th>
                <td className="py-[6px] px-2 border-b border-slate-200 text-[11px] font-bold">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[12px] leading-[1.85] text-justify mt-4">
          I, <strong>{teacher.name}</strong> (Employee ID {teacher.employeeId}), hereby record
          that I have joined {profile.name} as <strong>{teacher.designation}</strong> in the
          Department of {teacher.department} on <strong>{formatDate(teacher.joiningDate)}</strong>.
          I confirm that I have received my letter of appointment, that I understand the terms
          and conditions of my employment, and that I accept the same. I undertake to abide by
          the rules, regulations and service conduct of the school as applicable to the teaching
          staff.
        </p>

        <div className="mt-8 pt-6 border-t border-slate-300 flex items-end justify-between gap-6">
          <div className="text-center">
            <div className="h-6 border-b border-slate-500 w-[190px] mx-auto" />
            <p className="text-[12px] font-bold mt-1.5">{teacher.name}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-slate-600">Employee Signature &amp; Date</p>
          </div>
          <div className="text-center">
            <div className="h-6 border-b border-slate-500 w-[190px] mx-auto" />
            <p className="text-[12px] font-bold mt-1.5">{profile.principal}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-slate-600">Received &amp; Verified · Office Copy</p>
          </div>
        </div>

        <p className="text-center text-[8.5px] text-slate-400 mt-6 font-sans">
          {profile.name} · Joining record of {teacher.name} ({teacher.employeeId})
        </p>
      </div>
    </div>
  )
}
