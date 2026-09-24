'use client'

/**
 * monthly-report-pdf — official Excel-style attendance PDF exports.
 *
 * CANONICAL DATA ONLY: every number printed comes from the
 * /api/principal/attendance snapshot passed in by the caller:
 *   - `sections`  → the per-class rosters with each student's REAL
 *     status for the selected date (the attendance register)
 *   - `byClass`   → real per-class aggregates for the day
 *   - `monthTrend`→ real monthly rates for the session (summary table)
 *
 * The legacy fabricated per-student monthly grid (deterministic status
 * generators, 2025-12-10 "today", STAFF_DEFS roster) is retired — the
 * API exposes day-level rosters + session month trends, so the export
 * is an honest DAILY REGISTER plus a monthly-trend summary.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getSchoolInfo, formatDateLabel, formatMonthTick } from './data'
import type { ClassBreakdown, ClassSectionSnapshot, MonthPoint } from './data'

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  LEAVE: 'Leave',
}

const STATUS_COLORS: Record<string, [number, number, number]> = {
  Present: [16, 185, 129],   // emerald
  Late:    [245, 158, 11],   // amber
  Absent:  [244, 63, 94],    // rose
  Leave:   [14, 165, 233],   // sky
  '—':     [150, 150, 150],  // gray (not marked)
}

export interface RegisterPdfInput {
  /** The snapshot day (YYYY-MM-DD) */
  date: string
  /** 'all' or a classId — scopes the register */
  classId?: string
  sections: ClassSectionSnapshot[]
  byClass: ClassBreakdown[]
  monthTrend: MonthPoint[]
}

/**
 * generateAttendanceRegisterPDF — Excel-style attendance register for
 * the selected date: per-class rosters with each student's real status,
 * per-class summary rows, and a monthly-trend summary table (real
 * months only). Returns the generated filename.
 */
export async function generateAttendanceRegisterPDF({
  date, classId = 'all', sections, byClass, monthTrend,
}: RegisterPdfInput): Promise<{ filename: string }> {
  const school = await getSchoolInfo()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const dateLabel = formatDateLabel(date)

  const targetSections = classId === 'all'
    ? sections
    : sections.filter((s) => s.classId === classId)
  const scopeLabel = classId !== 'all'
    ? (byClass.find((c) => c.classId === classId)?.classLabel ?? 'Class')
    : 'ALL CLASSES'

  // ── REPORT HEADER ──
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(school.name.toUpperCase(), pageWidth / 2, 14, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('ATTENDANCE REGISTER', pageWidth / 2, 20, { align: 'center' })

  doc.setFontSize(10)
  doc.text(dateLabel.toUpperCase(), pageWidth / 2, 26, { align: 'center' })
  doc.text(scopeLabel, pageWidth / 2, 32, { align: 'center' })

  doc.setLineWidth(0.5)
  doc.line(14, 36, pageWidth - 14, 36)

  // ── METADATA ROW (real counts only) ──
  const scopedBreakdowns = byClass.filter((c) => classId === 'all' || c.classId === classId)
  const recorded = scopedBreakdowns.reduce((s, c) => s + c.recorded, 0)
  const onRoll = scopedBreakdowns.reduce((s, c) => s + c.students, 0)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Students on roll: ${onRoll}`, 14, 42)
  doc.text(`Attendance recorded: ${recorded}`, 70, 42)
  doc.text(`Classes: ${scopedBreakdowns.length}`, 120, 42)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - 60, 42)

  let yPos = 48

  for (const section of targetSections) {
    const breakdown = byClass.find((c) => c.classId === section.classId)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`CLASS: ${section.classLabel}`, 14, yPos)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const meta = breakdown
      ? `(${breakdown.recorded} of ${breakdown.students} recorded${breakdown.rate !== null ? ` · ${breakdown.rate}%` : ''})`
      : ''
    doc.text(meta, 14 + doc.getTextWidth(`CLASS: ${section.classLabel}`) + 5, yPos)
    yPos += 4

    const studentRows = section.roster.map((s, idx) => [
      String(idx + 1),
      s.rollNo,
      s.name,
      STATUS_LABEL[s.status ?? ''] ?? '—',
    ])

    const present = section.roster.filter((s) => s.status === 'PRESENT').length
    const late = section.roster.filter((s) => s.status === 'LATE').length
    const absent = section.roster.filter((s) => s.status === 'ABSENT').length
    const leave = section.roster.filter((s) => s.status === 'LEAVE').length
    const marked = present + late + absent + leave
    const rate = marked > 0 ? (((present + late) / marked) * 100).toFixed(1) + '%' : '—'

    autoTable(doc, {
      startY: yPos,
      head: [['S.No.', 'Roll', 'Student Name', 'Status']],
      body: studentRows,
      foot: [['', '', `CLASS SUMMARY · P ${present} · L ${late} · A ${absent} · LV ${leave}`, rate]],
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40], fontSize: 7, fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.2 },
      bodyStyles: { fontSize: 7, lineColor: [200, 200, 200], lineWidth: 0.1 },
      footStyles: { fillColor: [245, 245, 245], textColor: [40, 40, 40], fontSize: 7, fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 28, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const v = String(data.cell.raw ?? '')
          const color = STATUS_COLORS[v] ?? STATUS_COLORS['—']
          data.cell.styles.textColor = color
          if (v !== '—') data.cell.styles.fontStyle = 'bold'
        }
      },
      margin: { left: 14, right: 14 },
    })

    // @ts-expect-error jspdf-autotable attaches lastAutoTable to the doc
    yPos = doc.lastAutoTable.finalY + 8

    if (yPos > 170) {
      doc.addPage()
      yPos = 20
    }
  }

  // ── MONTHLY TREND SUMMARY (real months only) ──
  if (monthTrend.length > 0) {
    if (yPos > 150) {
      doc.addPage()
      yPos = 20
    }
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('MONTHLY ATTENDANCE TREND — SESSION TO DATE', 14, yPos)
    yPos += 4
    autoTable(doc, {
      startY: yPos,
      head: [['Month', 'Attendance Rows', 'Rate']],
      body: monthTrend.map((m) => [formatMonthTick(m.month), String(m.recorded), `${m.rate}%`]),
      theme: 'grid',
      // All columns are fixed-width — 'wrap' sizes the table to its
      // content instead of trying to stretch it to the full page width.
      tableWidth: 'wrap',
      headStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40], fontSize: 7, fontStyle: 'bold', lineColor: [180, 180, 180], lineWidth: 0.2 },
      bodyStyles: { fontSize: 7, lineColor: [200, 200, 200], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    })
    // @ts-expect-error jspdf-autotable attaches lastAutoTable to the doc
    yPos = doc.lastAutoTable.finalY + 8
  }

  // ── PAGE FOOTER ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`${school.name} · Scholario-OS`, 14, doc.internal.pageSize.getHeight() - 6)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 6)
    doc.setTextColor(0)
  }

  const scopeSlug = classId !== 'all'
    ? scopeLabel.replace(/[^a-zA-Z0-9]/g, '_')
    : 'All_Classes'
  const filename = `SCHOLARIO_Attendance_Register_${scopeSlug}_${date}.pdf`
  doc.save(filename)
  return { filename }
}
