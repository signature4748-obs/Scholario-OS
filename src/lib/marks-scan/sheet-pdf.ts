'use client'

/**
 * marks-scan/sheet-pdf — the standard SCHOLARIO blank marks sheet.
 *
 * "Print Blank Marks Sheet" (Marks Entry) generates an A4 PDF designed
 * for the scan workflow: school header, exam/class/subject context, and
 * a well-ruled table with the OFFICIAL ROSTER pre-printed (roll + name).
 * Teachers only write marks — so OCR never has to guess handwriting for
 * identity, and the scan engine can anchor on the ruling lines.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { RosterStudent } from './types'

export interface BlankSheetInput {
  schoolName: string
  session: string
  examName: string
  className: string
  subjectName: string
  maxMarks: number
  passMarks?: number
  roster: RosterStudent[]
}

export function downloadBlankMarksSheetPdf(input: BlankSheetInput): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14

  // ── School header ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(input.schoolName.slice(0, 60), pageW / 2, 16, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(`Academic Session ${input.session}`, pageW / 2, 21.5, { align: 'center' })
  doc.setTextColor(20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.text('MARKS ENTRY SHEET', pageW / 2, 28.5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(110)
  doc.text('SCHOLARIO · print, complete in ink, scan back for review', pageW / 2, 33, {
    align: 'center',
  })
  doc.setTextColor(20)

  // ── Context strip (machine-readable header the scan anchors on) ─────
  const stripY = 38
  doc.setFillColor(243, 244, 246)
  doc.roundedRect(margin, stripY, pageW - margin * 2, 12, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('EXAMINATION:', margin + 4, stripY + 4.9)
  doc.setFont('helvetica', 'normal')
  doc.text(input.examName.slice(0, 38), margin + 35, stripY + 4.9)
  doc.setFont('helvetica', 'bold')
  doc.text('CLASS:', margin + 4, stripY + 9.7)
  doc.setFont('helvetica', 'normal')
  doc.text(input.className.slice(0, 20), margin + 35, stripY + 9.7)
  doc.setFont('helvetica', 'bold')
  doc.text('SUBJECT:', pageW / 2 + 4, stripY + 4.9)
  doc.setFont('helvetica', 'normal')
  doc.text(input.subjectName.slice(0, 26), pageW / 2 + 26, stripY + 4.9)
  doc.setFont('helvetica', 'bold')
  doc.text('MAX MARKS:', pageW / 2 + 4, stripY + 9.7)
  doc.setFont('helvetica', 'normal')
  doc.text(String(input.maxMarks), pageW / 2 + 26, stripY + 9.7)
  if (input.passMarks != null) {
    doc.setFont('helvetica', 'bold')
    doc.text('PASS:', pageW / 2 + 47, stripY + 9.7)
    doc.setFont('helvetica', 'normal')
    doc.text(String(input.passMarks), pageW / 2 + 58, stripY + 9.7)
  }

  // ── Roster table (generous rows for handwritten marks) ───────────────
  const rowH = 11.2 // mm — enough whitespace for legible handwriting
  autoTable(doc, {
    startY: stripY + 17,
    margin: { left: margin, right: margin },
    head: [['ROLL NO.', 'STUDENT NAME', 'MARKS', 'REMARKS']],
    body: input.roster.map((s) => [s.rollNo || '—', s.name, '', '']),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: { top: 3.2, bottom: 3.2, left: 2.5, right: 2.5 },
      lineColor: [55, 65, 81],
      lineWidth: 0.35,
      minCellHeight: rowH,
      textColor: 20,
      halign: 'left',
    },
    headStyles: {
      fillColor: [17, 24, 39],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      minCellHeight: 7.5,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 },
    },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 82 },
      2: { cellWidth: 34, halign: 'center', fontSize: 12 },
      3: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      // Empty marks cells stay empty — the teacher writes them by hand.
      if (data.section === 'body' && (data.column.index === 2 || data.column.index === 3)) {
        data.cell.raw = ''
      }
    },
  })

  // ── Footer: signatures + scan hint ───────────────────────────────────
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14
  if (y > 262) {
    doc.addPage()
    y = 30
  }
  doc.setDrawColor(55, 65, 81)
  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + 52, y)
  doc.line(pageW / 2 - 26, y, pageW / 2 + 26, y)
  doc.line(pageW - margin - 52, y, pageW - margin, y)
  doc.setFontSize(8)
  doc.setTextColor(90)
  doc.text('Subject Teacher', margin + 26, y + 4.5, { align: 'center' })
  doc.text('Checked By', pageW / 2, y + 4.5, { align: 'center' })
  doc.text('Date', pageW - margin - 26, y + 4.5, { align: 'center' })
  doc.setTextColor(130)
  doc.setFontSize(7.5)
  doc.text(
    `Absent students: write "AB" in the marks column. This sheet is optimised for SCHOLARIO scan entry.`,
    pageW / 2,
    y + 12,
    { align: 'center' },
  )

  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '')
  doc.save(
    `marks-sheet-${safe(input.className)}-${safe(input.subjectName)}-${safe(input.examName)}.pdf`,
  )
}
