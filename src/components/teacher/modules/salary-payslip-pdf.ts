'use client'

/**
 * salary-payslip-pdf — the teacher's own monthly payslip, as a real PDF
 * download ("My Salary & Payments" → Payslips → Download PDF).
 *
 * CONFIGURATION-DRIVEN LAYOUT (the Principal's salary model decides):
 *   · SIMPLE (default) — the school's simple-salary workflow: Monthly
 *     Salary → adjustments (bonus/recovery, only when present) → Amount
 *     Paid. NO gross/deductions component tables are fabricated.
 *   · DETAILED — the Principal configured components: Earnings table +
 *     Deductions table + NET PAY band (single calculation path).
 *
 * Both share the official document frame: school header, identity strip,
 * payment details (method / reference / paid-on / receipt — only what
 * actually exists on the payment record), footer + timestamp.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { school } from '@/lib/mock/school'

export interface PayslipPdfComponent {
  name: string
  amount: number
}

export interface PayslipPdfPayment {
  method: string
  reference?: string
  /** YYYY-MM-DD */
  date: string
  receiptNo?: string
}

export type PayslipMode = 'simple' | 'detailed'

export interface TeacherPayslipInput {
  teacherName: string
  designation: string
  employeeId: string
  monthLabel: string
  /** Which salary model the Principal configured for this employee. */
  mode: PayslipMode
  /** SIMPLE mode — the configured fixed monthly salary. */
  monthlySalary?: number
  /** SIMPLE mode — that month's positive adjustments (bonus), if any. */
  bonus?: number
  /** SIMPLE mode — that month's negative adjustments (recovery), if any. */
  recovered?: number
  /** DETAILED mode — the configured component lines. */
  earnings?: PayslipPdfComponent[]
  deductions?: PayslipPdfComponent[]
  netPay: number
  payment: PayslipPdfPayment | null
}

// jsPDF's built-in helvetica has no ₹ glyph — "Rs" renders correctly
// everywhere (screen, print, PDF viewers) and stays audit-legible.
const inr = (n: number) => `Rs ${Math.round(n).toLocaleString('en-IN')}`

const fmtDate = (iso: string): string => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** "Rohan Mehta" + "Aug 2026" → "Payslip-RohanMehta-Aug2026.pdf" */
function payslipFileName(teacherName: string, monthLabel: string): string {
  const safe = (s: string) => s.replace(/\s+/g, '').replace(/[^A-Za-z0-9-]/g, '')
  return `Payslip-${safe(teacherName) || 'Teacher'}-${safe(monthLabel) || 'Month'}.pdf`
}

export function downloadTeacherPayslip(input: TeacherPayslipInput): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 40

  const generatedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const isSimple = input.mode === 'simple'
  // Single calculation path: net is derived, never independently supplied.
  const earnings = input.earnings ?? []
  const deductions = input.deductions ?? []
  const gross = earnings.reduce((s, c) => s + c.amount, 0)
  const totalDeductions = deductions.reduce((s, c) => s + c.amount, 0)

  // ── Official school header ───────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(16, 24, 40)
  doc.text(school.name, marginX, 46)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(`${school.tagline}  ·  ${school.affiliation}`, marginX, 60)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(16, 24, 40)
  doc.text('Payslip', marginX, 92)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105)
  doc.text(input.monthLabel, marginX, 106)

  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`Generated ${generatedAt}`, pageWidth - marginX, 106, { align: 'right' })

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.75)
  doc.line(marginX, 118, pageWidth - marginX, 118)

  // ── Identity strip ───────────────────────────────────────────────────
  const identity: Array<[string, string]> = [
    ['Employee Name', input.teacherName],
    ['Designation', input.designation],
    ['Employee ID', input.employeeId],
  ]
  let y = 140
  identity.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(148, 163, 184)
    doc.text(label.toUpperCase(), marginX, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(16, 24, 40)
    doc.text(value, marginX + 110, y)
    y += 18
  })

  // ── Earnings / Deductions — DETAILED mode only ────────────────────
  const tableStyles = {
    styles: { fontSize: 9, cellPadding: 5, lineColor: [226, 232, 240] as [number, number, number], lineWidth: 0.5 },
    headStyles: { fillColor: [22, 101, 80] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249] as [number, number, number], textColor: [51, 65, 85] as [number, number, number], fontStyle: 'bold' as const },
    columnStyles: { 1: { halign: 'right' as const } },
    margin: { left: marginX, right: marginX },
  }

  let afterTables = y + 8
  if (!isSimple) {
    autoTable(doc, {
      startY: y + 2,
      theme: 'grid',
      ...tableStyles,
      head: [['Earnings', 'Amount']],
      body: earnings.map((c) => [c.name, inr(c.amount)]),
      foot: [['Gross Earnings', inr(gross)]],
    })

    // ── Deductions ───────────────────────────────────────────────────────
    const afterEarnings = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 60
    autoTable(doc, {
      startY: afterEarnings + 14,
      theme: 'grid',
      ...tableStyles,
      head: [['Deductions', 'Amount']],
      body: deductions.length > 0
        ? deductions.map((c) => [c.name, inr(c.amount)])
        : [['—', '—']],
      foot: [['Total Deductions', inr(totalDeductions)]],
    })
    afterTables = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? afterEarnings + 60
  } else {
    // ── SIMPLE — Monthly Salary → adjustments (only when present) ─────
    const rows: Array<[string, string]> = [['Monthly Salary', inr(input.monthlySalary ?? input.netPay)]]
    if (input.bonus && input.bonus > 0) rows.push(['Bonus / Additional', `+ ${inr(input.bonus)}`])
    if (input.recovered && input.recovered > 0) rows.push(['Recovery / Adjustment', `− ${inr(input.recovered)}`])
    autoTable(doc, {
      startY: y + 2,
      theme: 'grid',
      ...tableStyles,
      head: [['Salary for the month', 'Amount']],
      body: rows,
    })
    afterTables = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 80
  }

  // ── Net pay band — the amount actually paid (both modes) ────────────
  const bandY = afterTables + 16
  const bandH = 26
  doc.setFillColor(22, 101, 80)
  doc.rect(marginX, bandY, pageWidth - marginX * 2, bandH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text(isSimple ? 'AMOUNT PAID' : 'NET PAY', marginX + 10, bandY + bandH / 2 + 3.5)
  doc.setFontSize(12)
  doc.text(inr(input.netPay), pageWidth - marginX - 10, bandY + bandH / 2 + 3.5, { align: 'right' })

  // ── Payment details ──────────────────────────────────────────────────
  let py = bandY + bandH + 26
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(16, 24, 40)
  doc.text('Payment Details', marginX, py)
  py += 6
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(marginX, py, pageWidth - marginX, py)

  if (input.payment) {
    const details: Array<[string, string]> = [
      ['Paid On', fmtDate(input.payment.date)],
      ['Method', input.payment.method],
      ...(input.payment.reference ? [['Payment Reference', input.payment.reference] as [string, string]] : []),
      ...(input.payment.receiptNo ? [['Receipt No.', input.payment.receiptNo] as [string, string]] : []),
    ]
    py += 14
    details.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(148, 163, 184)
      doc.text(label.toUpperCase(), marginX, py)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(16, 24, 40)
      doc.text(value, marginX + 130, py)
      py += 16
    })
  } else {
    py += 16
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text('No payment has been recorded for this month yet.', marginX, py)
  }

  // ── Footer ───────────────────────────────────────────────────────────
  doc.setDrawColor(226, 232, 240)
  doc.line(marginX, pageHeight - 40, pageWidth - marginX, pageHeight - 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`${school.name} — system-generated payslip for employee records`, marginX, pageHeight - 26)
  doc.text(`Generated ${generatedAt}`, pageWidth - marginX, pageHeight - 26, { align: 'right' })

  doc.save(payslipFileName(input.teacherName, input.monthLabel))
}
