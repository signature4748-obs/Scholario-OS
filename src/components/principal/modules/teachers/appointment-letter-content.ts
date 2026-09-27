import { formatDate, formatINR } from '@/lib/format'
import type { SchoolProfile } from '@/lib/school-profile'
import type { AppointmentLetterData } from '@/lib/store/teachers-store'

/**
 * appointment-letter-content — the CANONICAL content model for the
 * official Appointment Letter (Wave 2.3 §8/§9).
 *
 * One builder produces the structured content; BOTH renderers consume it:
 *   - appointment-letter-document.tsx  → on-screen A4 preview + Print
 *   - buildAppointmentLetterHTML()     → standalone downloaded document
 *
 * Every value comes from the letter's IMMUTABLE ISSUE-TIME SNAPSHOT and
 * the school profile — never from the teacher's current mutable record,
 * never invented (no QR ids, no fake verification, no credentials).
 */

export interface LetterDetailRow {
  label: string
  value: string
}

export interface AppointmentLetterContent {
  /** Letterhead */
  schoolName: string
  schoolShort: string
  affiliation: string
  contactLine: string
  /** Reference block */
  refNo: string
  issueDate: string
  /** Addressee */
  teacherName: string
  teacherAddress: string
  /** Employee details table */
  details: LetterDetailRow[]
  /** Appointment body paragraphs (first = offer paragraph). */
  offerParagraph: string
  closingParagraph: string
  /** Configured terms (school policy clauses). */
  terms: string[]
  /** Signatures */
  principalName: string
  placeOfPosting: string
  /** Employment facts, exposed for conditional rendering. */
  probationMonths: number
}

export function getAppointmentLetterContent(
  letter: AppointmentLetterData,
  profile: SchoolProfile
): AppointmentLetterContent {
  const schoolName = letter.teacherName ? profile.name : profile.name

  const details: LetterDetailRow[] = [
    { label: 'Employee Name', value: letter.teacherName },
    { label: 'Employee ID', value: letter.employeeId },
    { label: 'Designation', value: letter.designation },
    { label: 'Department', value: letter.department },
    { label: 'Date of Joining', value: formatDate(letter.joiningDate) },
    { label: 'Place of Posting', value: profile.address },
    { label: 'Reporting To', value: letter.reportingAuthority },
    { label: 'Working Hours', value: letter.workingHours },
    { label: 'Monthly Remuneration', value: `${formatINR(letter.monthlySalary)} per month` },
  ]
  if (letter.probationMonths > 0) {
    details.push({
      label: 'Probation Period',
      value: `${letter.probationMonths} months from the date of joining`,
    })
  }
  if (letter.noticePeriodDays > 0) {
    details.push({
      label: 'Notice Period',
      value: `${letter.noticePeriodDays} days`,
    })
  }

  return {
    schoolName,
    schoolShort: profile.shortName,
    affiliation: profile.affiliation,
    contactLine: `${profile.address} · Tel: ${profile.phone} · ${profile.email}`,
    refNo: letter.officialLetterNo || letter.id,
    issueDate: formatDate(letter.generatedDate),
    teacherName: letter.teacherName,
    teacherAddress: letter.teacherAddress || '',
    details,
    offerParagraph:
      `With reference to your application and the subsequent interview, the Management of ` +
      `${profile.name} is pleased to appoint you as ${letter.designation} in the Department of ` +
      `${letter.department}. You are requested to report for duty on ${formatDate(letter.joiningDate)}.`,
    closingParagraph:
      `Kindly sign and return a copy of this letter as acceptance of the above terms and ` +
      `conditions. We welcome you to our institution and look forward to a long and ` +
      `rewarding association.`,
    terms: letter.termsAndConditions,
    principalName: letter.principalName,
    placeOfPosting: profile.address,
    probationMonths: letter.probationMonths,
  }
}

/* ------------------------------------------------------------------ */
/*  esc — minimal HTML escaping for the standalone builder.            */
/* ------------------------------------------------------------------ */

function esc(v: unknown): string {
  return String(v ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Standalone branded A4 HTML for the Appointment Letter download action.
 * Mirrors the React preview exactly (same canonical content model) so the
 * downloaded file matches what the Principal sees on screen. Prints
 * cleanly on A4: @page A4 portrait with 15 mm margins.
 */
export function buildAppointmentLetterHTML(
  letter: AppointmentLetterData,
  profile: SchoolProfile
): string {
  const c = getAppointmentLetterContent(letter, profile)
  const detailRows = c.details
    .map(
      (d) =>
        `<tr><th>${esc(d.label)}</th><td>${esc(d.value)}</td></tr>`
    )
    .join('')
  const termItems = c.terms.map((t) => `<li>${esc(t)}</li>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Appointment Letter — ${esc(c.teacherName)} (${esc(c.refNo)})</title>
<style>
  @page { size: A4 portrait; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; margin: 0 auto; max-width: 180mm; color: #111827; background: #fff; padding: 10mm 6mm; }
  .letterhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 2.5px solid #111827; padding-bottom: 14px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo { width: 54px; height: 54px; border-radius: 10px; background: #111827; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; font-family: 'Segoe UI', Arial, sans-serif; }
  .school { font-size: 19px; font-weight: 800; letter-spacing: 0.03em; color: #111827; text-transform: uppercase; font-family: 'Segoe UI', Arial, sans-serif; }
  .aff { font-size: 10.5px; font-weight: 700; color: #3f6212; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 3px; font-family: 'Segoe UI', Arial, sans-serif; }
  .contact { font-size: 10px; color: #4b5563; margin-top: 4px; max-width: 400px; line-height: 1.45; font-family: 'Segoe UI', Arial, sans-serif; }
  .refbox { text-align: right; font-family: 'Segoe UI', Arial, sans-serif; }
  .ref { font-family: ui-monospace, monospace; font-size: 11px; font-weight: 700; color: #1f2937; }
  .ref small { display: block; font-weight: 500; color: #6b7280; font-size: 10px; margin-top: 2px; }
  h2.title { text-align: center; font-size: 15px; letter-spacing: 0.28em; color: #111827; margin: 24px 0 4px; text-transform: uppercase; }
  .rule { width: 42%; margin: 0 auto 18px; border: 0; border-top: 1.5px solid #9ca3af; }
  .addressee { font-size: 12px; line-height: 1.7; margin-bottom: 14px; }
  .addressee strong { font-size: 13.5px; }
  .body { font-size: 12px; line-height: 1.85; text-align: justify; margin: 0 0 14px; }
  table.details { border-collapse: collapse; width: 100%; margin: 14px 0 16px; }
  table.details th, table.details td { font-size: 11px; padding: 6.5px 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  table.details th { color: #6b7280; text-transform: uppercase; font-size: 9px; letter-spacing: 0.07em; width: 34%; font-family: 'Segoe UI', Arial, sans-serif; }
  table.details td { font-weight: 700; }
  .terms-head { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #111827; margin: 16px 0 8px; font-family: 'Segoe UI', Arial, sans-serif; }
  ol.terms { font-size: 11px; line-height: 1.75; color: #1f2937; margin: 0; padding-left: 20px; }
  ol.terms li { margin-bottom: 5px; }
  .sign { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; border-top: 1px solid #d1d5db; padding-top: 26px; margin-top: 26px; }
  .sig { text-align: center; }
  .sig .line { border-bottom: 1px solid #6b7280; width: 200px; margin: 0 auto 6px; height: 26px; }
  .sig .name { font-size: 12px; font-weight: 700; }
  .sig .role { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #4b5563; margin-top: 3px; letter-spacing: 0.07em; }
  .seal { width: 84px; height: 84px; border: 1.5px dashed #6b7280; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 8.5px; font-weight: 700; letter-spacing: 0.1em; color: #6b7280; text-transform: uppercase; text-align: center; line-height: 1.5; padding: 6px; margin: 0 auto 8px; }
  .accept { margin-top: 22px; font-size: 11px; line-height: 1.7; }
  .accept .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 14px 16px; display: flex; justify-content: space-between; gap: 20px; align-items: flex-end; }
  .accept .box .k { font-weight: 700; }
  .accept .box .fill { border-bottom: 1px solid #6b7280; min-width: 150px; display: inline-block; }
  .foot { text-align: center; font-size: 8.5px; color: #9ca3af; margin-top: 24px; font-family: 'Segoe UI', Arial, sans-serif; }
  @media print { body { padding: 0; max-width: none; } }
</style>
</head>
<body>
  <div class="letterhead">
    <div class="brand">
      <div class="logo">${esc(c.schoolShort.charAt(0))}</div>
      <div>
        <div class="school">${esc(c.schoolName)}</div>
        <div class="aff">${esc(c.affiliation)}</div>
        <div class="contact">${esc(c.contactLine)}</div>
      </div>
    </div>
    <div class="refbox">
      <p class="ref">Ref. No: ${esc(c.refNo)}
        <small>Date: ${esc(c.issueDate)}</small>
      </p>
    </div>
  </div>

  <h2 class="title">Appointment Letter</h2>
  <hr class="rule" />

  <div class="addressee">
    To,<br />
    <strong>${esc(c.teacherName)}</strong>${c.teacherAddress ? `<br />${esc(c.teacherAddress)}` : ''}
  </div>

  <p class="body">Dear ${esc(c.teacherName)},</p>
  <p class="body">${esc(c.offerParagraph)}</p>

  <table class="details">
    <tbody>${detailRows}</tbody>
  </table>

  <p class="terms-head">Terms &amp; Conditions of Appointment</p>
  <ol class="terms">${termItems}</ol>

  <p class="body" style="margin-top: 14px;">${esc(c.closingParagraph)}</p>

  <div class="sign">
    <div class="sig">
      <div class="seal">School<br />Seal</div>
      <div class="line"></div>
      <div class="name">${esc(c.principalName)}</div>
      <div class="role">Authorized Signatory · Principal</div>
    </div>
    <div class="sig">
      <div class="line"></div>
      <div class="name">${esc(c.teacherName)}</div>
      <div class="role">Employee Signature</div>
    </div>
  </div>

  <div class="accept">
    <div class="box">
      <div>
        <span class="k">Employee Acceptance</span> — I have read and accepted the terms of
        appointment stated above.
      </div>
      <div style="text-align: right; white-space: nowrap;">
        Signature <span class="fill"></span><br />
        Date <span class="fill" style="min-width: 90px;"></span>
      </div>
    </div>
  </div>

  <p class="foot">Issued by ${esc(c.schoolName)} · ${esc(c.refNo)} · This is a computer-printed document.</p>
</body>
</html>`
}
