import { formatDate, formatINR } from '@/lib/format'
import type { SchoolProfile } from '@/lib/school-profile'
import type { AdmissionLetterData } from './types'

/**
 * letter-html — standalone branded HTML builder for the Official Admission
 * Letter "Download" action.
 *
 * Mirrors the React preview exactly (Wave 2 deep §19–§24): SchoolHeader →
 * Student Information (photo per policy) → Confirmation of Admission →
 * Annual Fee Summary (policy-gated) → Authorization → subtle document
 * footer. NO QR, NO portal credentials, NO fabricated verification ids,
 * NO payment-status claims.
 */

function esc(v: unknown): string {
  return String(v ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const feeRow = (label: string, amount: number, cls = '') =>
  `<tr class="${cls}"><td>${esc(label)}</td><td class="num">${esc(formatINR(amount))}</td></tr>`

export function buildAdmissionLetterHTML(data: AdmissionLetterData, profile: SchoolProfile): string {
  const fullName = `${data.student.firstName} ${data.student.lastName}`
  const privacy = data.documentPrivacy
  const showPhoto = (privacy ? privacy.letterShowsPhoto : true) && !!data.student.photoUrl
  const showParentPhone = privacy ? privacy.letterShowsParentPhone : true
  const showAddress = privacy ? privacy.letterShowsAddress : false
  const showPreviousSchool = privacy ? privacy.letterShowsPreviousSchool : true
  const showFees = privacy ? privacy.letterShowsFeeSummary : true

  const fees = data.fees
  const subtotal = fees.subtotal ?? fees.totalAnnualFee ?? 0
  const discountAmount = fees.discountAmount ?? fees.discountApplied ?? 0

  const infoRow = (label: string, value: string | number) =>
    `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`

  const infoRows = [
    infoRow('Name of Student', fullName),
    infoRow('Admission Number', data.admissionNo),
    ...(data.studentId ? [infoRow('Student ID', data.studentId)] : []),
    infoRow('Class & Section', `${data.academic.className}${data.academic.section ? ` — ${data.academic.section}` : ''}`),
    infoRow('Roll Number', data.academic.rollNo || '—'),
    infoRow('Date of Birth', data.student.dob ? formatDate(data.student.dob) : '—'),
    infoRow('Date of Admission', formatDate(data.admissionDate)),
    infoRow('Academic Session', data.academicSession || '2025–2026'),
    infoRow('Parent / Guardian', `${data.parents.fatherName || data.parents.motherName || '—'}${showParentPhone && data.parents.fatherPhone ? ` · ${data.parents.fatherPhone}` : ''}`),
    ...(showPreviousSchool && data.academic.previousSchool ? [infoRow('Previous School', data.academic.previousSchool)] : []),
    ...(showAddress && data.address?.currentAddress
      ? [infoRow('Residence', [data.address.currentAddress, data.address.district, data.address.state, data.address.pincode].filter(Boolean).join(', '))]
      : []),
  ].join('')

  const feeRows = showFees
    ? [
        feeRow('Registration Fee', fees.registrationFee || 0),
        feeRow('Admission Fee (One-Time)', fees.admissionFee),
        feeRow('Annual Tuition Fee', fees.tuitionFee),
        ...((fees.annualCharges || 0) > 0 ? [feeRow('Development & Activity Charges', fees.annualCharges || 0)] : []),
        ...((fees.booksTotal || 0) > 0 ? [feeRow('Books & Course Material', fees.booksTotal || 0)] : []),
        ...((fees.examFee || 0) > 0 ? [feeRow('Examination Charges', fees.examFee || 0)] : []),
        ...((fees.transportFee || 0) > 0 ? [feeRow('Transport Charges', fees.transportFee || 0)] : []),
        feeRow('Subtotal', subtotal, 'sub'),
        ...(discountAmount > 0
          ? [feeRow(`Concession (${fees.discountName || 'Approved Concession'})`, -discountAmount)]
          : []),
        feeRow('Net Annual Payable', fees.finalPayable, 'total'),
      ].join('')
    : ''

  const docId = `DOC-${data.admissionNo.replace(/[^A-Z0-9]/gi, '')}`
  const generated = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Official Admission Letter — ${esc(fullName)} (${esc(data.admissionNo)})</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 36px auto; max-width: 780px; color: #1e293b; background: #fff; }
  .letterhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 3px solid #0f172a; padding-bottom: 18px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo { width: 56px; height: 56px; border-radius: 12px; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; }
  .school { font-size: 21px; font-weight: 800; letter-spacing: 0.02em; color: #0f172a; text-transform: uppercase; }
  .aff { font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 3px; }
  .contact { font-size: 10.5px; color: #475569; margin-top: 5px; max-width: 420px; }
  .refbox { text-align: right; }
  .badge { display: inline-block; background: #0f172a; color: #fff; font-family: ui-monospace, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; padding: 5px 10px; border-radius: 4px; text-transform: uppercase; }
  .ref { font-family: ui-monospace, monospace; font-size: 11px; font-weight: 700; color: #334155; margin-top: 6px; }
  .ref small { display: block; font-weight: 500; color: #64748b; font-size: 10px; margin-top: 2px; }
  h2 { font-size: 11px; letter-spacing: 0.2em; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin: 24px 0 12px; font-weight: 700; }
  .info { display: flex; gap: 20px; align-items: flex-start; }
  .photo { width: 96px; height: 112px; border: 1px solid #cbd5e1; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
  table.profile { border-collapse: collapse; width: 100%; }
  .profile th, .profile td { font-size: 11.5px; padding: 5px 10px; border-bottom: 1px solid #eef2f7; text-align: left; vertical-align: top; }
  .profile tr:last-child th, .profile tr:last-child td { border-bottom: 0; }
  .profile th { color: #64748b; text-transform: uppercase; font-size: 9px; letter-spacing: 0.06em; width: 30%; }
  .confirm p { font-size: 12.5px; line-height: 1.65; color: #1e293b; margin: 0 0 10px; }
  .fees { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
  .fees thead th { background: #f1f5f9; color: #334155; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 10px; text-align: left; }
  .fees td, .fees tfoot td { font-size: 11.5px; padding: 7px 10px; border-top: 1px solid #eef2f7; }
  .fees .num { text-align: right; font-family: ui-monospace, monospace; white-space: nowrap; }
  .fees .sub td { background: #f8fafc; font-weight: 700; }
  .fees .total td { background: #0f172a; color: #fff; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; }
  .feenote { font-size: 9.5px; color: #94a3b8; margin-top: 6px; }
  .sign { display: flex; justify-content: space-between; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 26px; margin-top: 26px; }
  .sign .name { font-family: Georgia, serif; font-style: italic; font-weight: 700; font-size: 13px; color: #1e293b; border-bottom: 1px solid #94a3b8; padding: 0 18px 6px; display: inline-block; }
  .sign .role { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #475569; margin-top: 6px; letter-spacing: 0.06em; }
  .foot { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 10px; font-family: ui-monospace, monospace; font-size: 9px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="letterhead">
    <div class="brand">
      <div class="logo">${esc(profile.shortName.charAt(0))}</div>
      <div>
        <div class="school">${esc(profile.name)}</div>
        <div class="aff">${esc(profile.affiliation)}</div>
        <div class="contact">${esc(profile.address)} · Tel: ${esc(profile.phone)} · Email: ${esc(profile.email)}</div>
      </div>
    </div>
    <div class="refbox">
      <span class="badge">Official Admission Letter</span>
      <p class="ref">Ref: ${esc(data.refNo ?? data.admissionNo)}
        <small>Date: ${esc(formatDate(data.admissionDate))}</small>
        <small>Session: ${esc(data.academicSession)}</small>
      </p>
    </div>
  </div>

  <h2>Student Information</h2>
  <div class="info">
    ${showPhoto ? `<img class="photo" src="${data.student.photoUrl}" alt="${esc(fullName)} photograph" />` : ''}
    <table class="profile"><tbody>${infoRows}</tbody></table>
  </div>

  <h2>Confirmation of Admission</h2>
  <div class="confirm">
    <p>This is to certify that <strong>${esc(fullName)}</strong> has been granted admission to <strong>${esc(profile.name)}</strong> for the academic session <strong>${esc(data.academicSession)}</strong>, to <strong>${esc(data.academic.className)}${data.academic.section ? ` — Section ${esc(data.academic.section)}` : ''}</strong>${data.academic.rollNo ? `, Roll Number ${esc(data.academic.rollNo)}` : ''}.</p>
    <p>The student&rsquo;s application and supporting documents have been examined and found in order. This admission is subject to the school&rsquo;s rules and code of conduct in force, and to the regular payment of applicable fees.</p>
  </div>

  ${showFees ? `<h2>Annual Fee Summary</h2>
  <table class="fees">
    <thead><tr><th>Fee Head</th><th class="num">Amount (INR)</th></tr></thead>
    <tbody>${feeRows}</tbody>
  </table>
  <p class="feenote">Fee payments are acknowledged separately by official receipts issued by the school office.</p>` : ''}

  <div class="sign">
    <div>
      <span class="name">${esc(data.parents.fatherName || data.parents.motherName || 'Parent / Guardian')}</span>
      <div class="role">Parent / Guardian</div>
    </div>
    <div>
      <span class="name">${esc(profile.principal)}</span>
      <div class="role">Principal</div>
    </div>
  </div>

  <div class="foot">
    <span>Admission No: ${esc(data.admissionNo)}${data.studentId ? ` · Student ID: ${esc(data.studentId)}` : ''}</span>
    <span>Document ID: ${esc(docId)} · Generated ${esc(generated)}</span>
  </div>
</body>
</html>`
}
