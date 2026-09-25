'use client'

/**
 * StudentMarksheetViewer — the STUDENT'S FORMAL DIGITAL MARKSHEET, rendered
 * in the SBS Shiksha Niketan report-card design language (the canonical
 * visual template): a real printed-school-report-card look —
 *
 *   ╔═══════════════════════════════════════════════╗   ← DOUBLE MAROON
 *   ║ [crest]   S . B . S .-STYLE SCHOOL NAME        ║      BORDER FRAME
 *   ║           school address · board               ║
 *   ║        ( PROGRESS EVALUATION REPORT )           ║   ← maroon badge
 *   ║     ACADEMIC SESSION : …   ·   CLASS : …       ║   ← ink-blue line
 *   ║  ┌─────────────────────────────────────────┐   ║
 *   ║  │ STUDENT INFORMATION (light-cyan panel)  │   ║
 *   ║  └─────────────────────────────────────────┘   ║
 *   ║  SUBJECTS │ EXAM MM│OBT … │ GRAND TOTAL │ GRADE║   ← peach header,
 *   ║  … subject rows … TOTAL row                    ║      maroon grid
 *   ║  [ TOTAL MAXIMUM MARKS │ OBTAINED │ PERCENT ] ║   ← summary strip
 *   ║  CO-SCHOLASTIC AREA (only when configured)     ║
 *   ║  [ grade-scale strip ]                         ║
 *   ║  Remark │ Attendance │ Class Rank              ║
 *   ║  Date of Issue │ Class Teacher │ Principal     ║   ← signature lines
 *   ╚═══════════════════════════════════════════════╝
 *
 * DESIGN CONTRACT (the SBS correction round):
 *   SBS image       = VISUAL DESIGN / ART DIRECTION  (this file's look)
 *   supplied HTML   = engineering reference          (A4/print mechanics)
 *   SCHOLARIO DB    = the only data source           (nothing hardcoded)
 * Deep maroon #8F1D1D · warm peach #FCE7D2 · light cyan info panels ·
 * black/charcoal text · ink-blue only for session/secondary lines.
 * NO glassmorphism, NO SaaS cards inside the document — this is a formal
 * school report card, not a dashboard.
 *
 * ONE canonical viewer: every surface that shows the personal marksheet
 * opens THIS component — a pure presentation layer over the payload of
 * GET /api/teacher/students/[studentId]/marksheet (the SAME canonical
 * ExamMark / ExamSubjectConfig / GradeScale / Attendance / School rows
 * every other module uses). Examination groups are DYNAMIC: 2 exams → 2
 * MM|OBT groups, 6 exams → 6; nothing is hardcoded.
 *
 * HONESTY: unentered marks render "—" — never 0; totals/percentages are
 * labeled "(to date)" while any examination is pending; Print / Save PDF
 * unlocks only when at least one examination's result is in
 * (summary.canPrint). Print emits the clean A4 portrait sheet only — no
 * React chrome, colors preserved.
 */

import { Fragment } from 'react'
import { GraduationCap, Printer } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'

// ── payload contract (mirrors the API route) ─────────────────────────

export interface MarksheetCell {
  maxMarks: number | null
  obtained: number | null
  markStatus: string | null
  isSubmitted: boolean
}

export interface MarksheetSubjectRow {
  subjectId: string
  subjectName: string
  cells: MarksheetCell[]
  complete: boolean
  grandTotal: number | null
  grandMax: number | null
  grade: string | null
}

export interface MarksheetExamCol {
  examId: string
  examName: string
  type: string
  examDate: string | null
  resultStatus: string
  declaredAt: string | null
  state: 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'FINALIZED'
  subjectsSubmitted: number
  subjectsTotal: number
  total: number
  maxTotal: number
  percentage: number | null
  partial: boolean
}

export interface MarksheetDocumentPayload {
  school: {
    name: string
    address: string | null
    city: string | null
    phone: string | null
    email: string | null
    board: string | null
    logoUrl: string | null
  }
  student: {
    name: string
    admissionNo: string | null
    rollNo: string | null
    classLabel: string
    gender: string | null
    dob: string | null
    guardianName: string | null
  }
  session: string | null
  classTeacherName: string | null
  principalName: string | null
  exams: MarksheetExamCol[]
  subjects: MarksheetSubjectRow[]
  summary: {
    state: 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'FINALIZED'
    totalExams: number
    examsComplete: number
    examsWithMarks: number
    grandTotal: number
    grandMax: number
    percentage: number | null
    grade: string | null
    partial: boolean
    pendingExams: number
    pendingCells: number
    canPrint: boolean
    declaredAt: string | null
    remark: string | null
    outcome: string | null
  }
  attendance: { presentDays: number; totalDays: number; pct: number | null }
  classRank: { position: number; assessedCount: number } | null
  gradeScale: {
    source: 'school' | 'default'
    rows: { grade: string; minPct: number; maxPct: number }[]
  }
  config: {
    showAttendance: boolean
    showRank: boolean
    showPercentage: boolean
    showGrade: boolean
    showCoScholastic: boolean
    coScholasticAreas: string[]
    showRemarks: boolean
    showClassTeacherSign: boolean
    showPrincipalSign: boolean
  }
  generatedAt: string
}

const STATE_META: Record<
  MarksheetDocumentPayload['summary']['state'],
  { label: string; cls: string }
> = {
  NOT_STARTED: { label: 'Not started', cls: 'bg-muted text-muted-foreground' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  READY: { label: 'Ready', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  FINALIZED: { label: 'Result Declared', cls: 'bg-emerald-600 text-white' },
}

// ── the SBS document palette (fixed hex — the sheet is a paper, never an
//    app-theme surface; dark mode cannot leak into a printed document) ──
const MAROON = '#8F1D1D' // primary identity — frame, grid, emphasis
const MAROON_DEEP = '#6E1414' // display headings
const PEACH = '#FCE7D2' // table-header / total-row fill
const PEACH_DEEP = '#F7DCC2' // MM|OBT sub-header fill
const CYAN = '#E3EFF5' // student-information + summary panels
const INK = '#1C1917' // body text — black/charcoal
const INK_SOFT = '#57534E' // secondary text
const BLUE_INK = '#1F3A5F' // session/secondary informational lines

/** 1 → 1st, 2 → 2nd, 11 → 11th … (class-rank display) */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

interface Props {
  data: MarksheetDocumentPayload | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StudentMarksheetViewer({ data, open, onOpenChange }: Props) {
  if (!data) return null
  const s = data.summary
  const stateMeta = STATE_META[s.state]
  const nExams = data.exams.length
  if (nExams === 0) return null
  // A4-friendly compact typography when the school's structure has many
  // examination groups (6 exams → 12 MM|OBT sub-columns stay legible)
  const compact = nExams >= 4
  const showGrade = data.config.showGrade && data.gradeScale.rows.length > 0
  const toDate = s.partial
  const coScholastic =
    data.config.showCoScholastic && data.config.coScholasticAreas.length > 0
      ? data.config.coScholasticAreas
      : []

  const monogram = data.school.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 3)
    .join('')

  // bottom information row — only the configured cells (equal widths)
  const infoCells: { label: string; value: React.ReactNode }[] = []
  if (data.config.showRemarks) {
    infoCells.push({
      label: 'Remark',
      value: s.remark ?? <span style={{ color: `${INK_SOFT}b0` }}>—</span>,
    })
  }
  if (data.config.showAttendance) {
    infoCells.push({
      label: 'Attendance',
      value:
        data.attendance.totalDays > 0 ? (
          <>
            <span className="font-bold tabular-nums">
              {data.attendance.presentDays} / {data.attendance.totalDays} days
            </span>
            {data.attendance.pct != null && (
              <span className="font-semibold tabular-nums"> ({data.attendance.pct}%)</span>
            )}
          </>
        ) : (
          <span style={{ color: `${INK_SOFT}b0` }}>—</span>
        ),
    })
  }
  if (data.config.showRank) {
    infoCells.push({
      label: 'Class Rank',
      value: data.classRank ? (
        <>
          <span className="font-bold tabular-nums">{ordinal(data.classRank.position)}</span>
          <span className="font-semibold"> of {data.classRank.assessedCount} assessed</span>
        </>
      ) : (
        <span style={{ color: `${INK_SOFT}b0` }}>—</span>
      ),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="marksheet-viewer-dialog grid-cols-1 max-h-[94dvh] w-[calc(100vw-1rem)] max-w-[880px] gap-0 overflow-y-auto bg-muted/40 p-2.5 sm:max-w-[880px] sm:p-4 dark:bg-muted/40"
      >
        {/* marksheet-only print stylesheet — mounted while this dialog is
            open, so printing any other page stays untouched. Strategy:
            the app, the drawer and the toolbar are display:none'd away and
            the dialog is neutralised into a static in-flow page, so the SBS
            document prints (and paginates) as a real A4 sheet with exact
            colors — no React chrome, no clipping. */}
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 8mm; }
            body > *:not(.marksheet-viewer-dialog) { display: none !important; }
            .marksheet-viewer-dialog > *:not(.marksheet-sheet-viewport) { display: none !important; }
            .marksheet-viewer-dialog {
              position: static !important; display: block !important;
              top: auto !important; left: auto !important;
              /* Tailwind v4 centers fixed dialogs via the standalone
                 "translate" CSS property — transform:none alone does
                 NOT reset it, which shifts the printed sheet off-page */
              transform: none !important;
              translate: none !important;
              rotate: none !important;
              scale: none !important;
              z-index: auto !important;
              width: 100% !important; max-width: none !important;
              max-height: none !important;
              margin: 0 !important; padding: 0 !important; gap: 0 !important;
              border: none !important; border-radius: 0 !important;
              background: #fff !important; box-shadow: none !important;
              overflow: visible !important; animation: none !important;
            }
            .marksheet-sheet-viewport {
              overflow: visible !important; border: none !important; border-radius: 0 !important;
              padding: 0 !important; margin: 0 !important; background: transparent !important;
            }
            #student-marksheet-print {
              width: 100% !important; min-width: 0 !important; max-width: none !important;
              margin: 0 !important; box-shadow: none !important; overflow: visible !important;
            }
            #student-marksheet-print, #student-marksheet-print * {
              print-color-adjust: exact !important;
              -webkit-print-color-adjust: exact !important;
            }
            .no-print { display: none !important; }
          }
        `}</style>

        {/* ── toolbar (screen only, outside the document) ─────────── */}
        <DialogHeader className="no-print rounded-t-xl border border-border border-b-0 bg-background px-4 py-3.5 sm:px-5">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <GraduationCap className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
            <span className="truncate">Digital Marksheet — {data.student.name}</span>
            <span className={cn('ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold', stateMeta.cls)}>
              {stateMeta.label}
            </span>
          </DialogTitle>
          <DialogDescription className="flex flex-col gap-1.5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span>
              {data.student.classLabel}
              {data.session ? ` · Session ${data.session}` : ''} · {nExams} examination{nExams === 1 ? '' : 's'} ·
              {' '}built from the official school records
            </span>
            {s.canPrint ? (
              <Button size="sm" className="h-8 shrink-0 gap-1.5 text-xs" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                Print / Save PDF
              </Button>
            ) : (
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                {s.pendingExams > 0
                  ? `${s.pendingExams} examination${s.pendingExams === 1 ? '' : 's'} pending — printing unlocks when an exam is complete`
                  : 'Printing unlocks once an examination is complete'}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* ── the A4 document — the SBS report-card template ─────────
            Mobile (§24): the document keeps its proportions inside a
            horizontally scrollable viewport; it is never squashed into
            stacked cards. */}
        <div className="marksheet-sheet-viewport overflow-x-auto rounded-b-xl border border-border bg-muted/60 p-2 sm:p-3">
          <div
            id="student-marksheet-print"
            className="mx-auto w-full min-w-[660px] max-w-[208mm] bg-white font-serif text-[#1C1917] shadow-lg"
            style={{ color: INK }}
          >
            {/* ══ outer + inner MAROON double frame (SBS §4) ══ */}
            <div style={{ border: `3px solid ${MAROON}`, padding: '4px', background: '#fff' }}>
              <div style={{ border: `1.5px solid ${MAROON}`, padding: '14px 16px 12px' }}>

                {/* 1 · school identity — crest directly in the header,
                       large maroon school name, formal address block */}
                <header className="flex items-center gap-3">
                  {data.school.logoUrl ? (
                    <img
                      src={data.school.logoUrl}
                      alt={`${data.school.name} crest`}
                      className="h-[64px] w-auto max-w-[86px] shrink-0 object-contain sm:h-[78px]"
                    />
                  ) : (
                    <span
                      className="flex h-[64px] w-[64px] shrink-0 items-center justify-center text-[19px] font-bold sm:h-[78px] sm:w-[78px] sm:text-[22px]"
                      style={{ border: `1.5px solid ${MAROON}`, color: MAROON_DEEP }}
                      aria-hidden="true"
                    >
                      {monogram}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 text-center">
                    <h2
                      className="text-balance text-[19px] font-bold uppercase leading-[1.12] tracking-[0.045em] sm:text-[25px]"
                      style={{ color: MAROON_DEEP }}
                    >
                      {data.school.name}
                    </h2>
                    <p className="mt-1 text-[9.5px] leading-relaxed sm:text-[10.5px]" style={{ color: INK }}>
                      {[data.school.address, data.school.city].filter(Boolean).join(', ')}
                      {data.school.phone ? ` · ${data.school.phone}` : ''}
                    </p>
                    {data.school.board && (
                      <p
                        className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.2em] sm:text-[9.5px]"
                        style={{ color: BLUE_INK }}
                      >
                        (Affiliated to {data.school.board})
                      </p>
                    )}
                  </div>
                  {/* spacer — keeps the name block optically centred like the SBS letterhead */}
                  <span className="hidden w-[78px] shrink-0 sm:block" aria-hidden="true" />
                </header>

                {/* 2 · report title badge (SBS §8) */}
                <div className="mt-3.5 flex justify-center">
                  <span
                    className="rounded-full px-5 py-[5px] text-[10.5px] font-bold uppercase tracking-[0.22em] text-white sm:text-[12px]"
                    style={{ background: MAROON }}
                  >
                    Progress Evaluation Report
                  </span>
                </div>

                {/* 3 · academic session + class (ink-blue, centred) */}
                <p
                  className="mt-2.5 text-center text-[9.5px] font-bold uppercase tracking-[0.14em] sm:text-[11px]"
                  style={{ color: BLUE_INK }}
                >
                  Academic Session :{' '}
                  <span className="tracking-normal" style={{ color: INK }}>
                    {data.session ?? '—'}
                  </span>
                  <span className="mx-2.5" style={{ color: MAROON }}>•</span>
                  Class :{' '}
                  <span className="tracking-normal" style={{ color: INK }}>
                    {data.student.classLabel}
                  </span>
                </p>

                {/* 4 · student information — the SBS bordered light-cyan
                    panel. FIXED field set (layout never breaks); missing
                    canonical values honestly show “—”. The 1px maroon gap
                    grid guarantees uniform dividers at any width. */}
                <div
                  className="mt-3 grid"
                  style={{
                    border: `1px solid ${MAROON}`,
                    background: MAROON,
                    gap: '1px',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  }}
                >
                  {(
                    [
                      ["Student's Name", data.student.name, true],
                      ['Roll No.', data.student.rollNo ?? null, false],
                      ["Father's / Guardian's Name", data.student.guardianName ?? null, false],
                      ['Gender', data.student.gender === 'MALE' ? 'Male' : data.student.gender === 'FEMALE' ? 'Female' : data.student.gender, false],
                      ['Admission No.', data.student.admissionNo ?? null, false],
                    ] as [string, string | null, boolean][]
                  ).map(([label, value, span2]) => (
                    <div
                      key={label}
                      className={cn('px-2.5 py-[7px]', span2 && 'col-span-2')}
                      style={{ background: CYAN }}
                    >
                      <p
                        className="text-[7.5px] font-bold uppercase tracking-[0.16em] sm:text-[8px]"
                        style={{ color: `${INK}b3` }}
                      >
                        {label}
                      </p>
                      <p className="mt-[3px] break-words text-[10.5px] font-semibold leading-tight sm:text-[11.5px]">
                        {value != null && String(value).trim() !== '' ? String(value) : <span style={{ color: `${INK_SOFT}99` }}>—</span>}
                      </p>
                    </div>
                  ))}
                </div>

                {/* 5 · the marks table — SBS peach header + maroon grid.
                       DYNAMIC examination groups: every configured exam
                       renders its own MM | OBT pair (§12/§13). */}
                <table
                  className="mt-3 w-full table-fixed border-collapse text-center"
                  style={{ fontSize: compact ? '8.5px' : '10px' }}
                >
                  <colgroup>
                    <col style={{ width: compact ? '17%' : '21%' }} />
                    {data.exams.map((e) => (
                      <Fragment key={e.examId}>
                        <col />
                        <col />
                      </Fragment>
                    ))}
                    <col style={{ width: compact ? '12%' : '14%' }} />
                    {showGrade && <col style={{ width: compact ? '8%' : '10%' }} />}
                  </colgroup>
                  <thead>
                    {/* exam-name row — peach fill, strong uppercase headings */}
                    <tr style={{ background: PEACH }}>
                      <th
                        scope="col"
                        rowSpan={2}
                        className="px-2 py-[7px] text-left font-bold uppercase tracking-[0.08em]"
                        style={{
                          border: `1px solid ${MAROON}`,
                          color: MAROON_DEEP,
                          fontSize: compact ? '8.5px' : '10px',
                        }}
                      >
                        Subjects
                      </th>
                      {data.exams.map((e) => (
                        <th
                          scope="col"
                          key={e.examId}
                          colSpan={2}
                          className="break-words px-1 py-[6px] font-bold uppercase leading-[1.25] tracking-[0.05em]"
                          style={{ border: `1px solid ${MAROON}`, color: MAROON_DEEP }}
                        >
                          {e.examName}
                        </th>
                      ))}
                      <th
                        scope="col"
                        rowSpan={2}
                        className="break-words px-1 py-[6px] font-bold uppercase leading-[1.25] tracking-[0.05em]"
                        style={{ border: `1px solid ${MAROON}`, color: MAROON_DEEP }}
                      >
                        Grand Total{toDate && <span className="block text-[6.5px] font-medium normal-case tracking-normal" style={{ color: INK_SOFT }}>(to date)</span>}
                      </th>
                      {showGrade && (
                        <th
                          scope="col"
                          rowSpan={2}
                          className="px-1 py-[6px] font-bold uppercase tracking-[0.05em]"
                          style={{ border: `1px solid ${MAROON}`, color: MAROON_DEEP }}
                        >
                          Grade
                        </th>
                      )}
                    </tr>
                    {/* MM | OBT sub-header row — deeper peach */}
                    <tr style={{ background: PEACH_DEEP }}>
                      {data.exams.map((e) => (
                        <Fragment key={e.examId}>
                          <th
                            scope="col"
                            className="py-[3px] font-bold uppercase"
                            style={{ border: `1px solid ${MAROON}`, color: MAROON_DEEP, fontSize: compact ? '7px' : '8px', letterSpacing: '0.06em' }}
                          >
                            MM
                          </th>
                          <th
                            scope="col"
                            className="py-[3px] font-bold uppercase"
                            style={{ border: `1px solid ${MAROON}`, color: MAROON_DEEP, fontSize: compact ? '7px' : '8px', letterSpacing: '0.06em' }}
                          >
                            OBT
                          </th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.subjects.map((row) => (
                      <tr key={row.subjectId}>
                        <th
                          scope="row"
                          className="break-words px-2 py-[5px] text-left font-semibold leading-snug"
                          style={{
                            border: `1px solid ${MAROON}b3`,
                            fontSize: compact ? '8.5px' : '10px',
                          }}
                        >
                          {row.subjectName}
                        </th>
                        {row.cells.map((c, i) => (
                          <Fragment key={i}>
                            {/* maximum marks (the school's configured value) */}
                            <td
                              className="tabular-nums"
                              style={{
                                border: `1px solid ${MAROON}b3`,
                                color: INK_SOFT,
                                padding: compact ? '4px 1px' : '5px 2px',
                                fontSize: compact ? '8px' : '9.5px',
                              }}
                            >
                              {c.maxMarks != null ? c.maxMarks : <span style={{ color: `${INK_SOFT}99` }}>—</span>}
                            </td>
                            {/* obtained — never a fake 0: pending shows “—”,
                                absent shows AB */}
                            <td
                              className="tabular-nums"
                              style={{
                                border: `1px solid ${MAROON}b3`,
                                padding: compact ? '4px 1px' : '5px 2px',
                                fontSize: compact ? '8.5px' : '10px',
                              }}
                            >
                              {c.isSubmitted ? (
                                <span className="font-bold">{c.obtained != null ? c.obtained : 'AB'}</span>
                              ) : (
                                <span aria-label="marks not entered" style={{ color: `${INK_SOFT}99` }}>—</span>
                              )}
                            </td>
                          </Fragment>
                        ))}
                        <td
                          className="tabular-nums"
                          style={{
                            border: `1px solid ${MAROON}b3`,
                            padding: compact ? '4px 1px' : '5px 2px',
                            fontSize: compact ? '8.5px' : '10px',
                          }}
                        >
                          {row.grandTotal != null ? (
                            <>
                              <span className="font-bold">{row.grandTotal}</span>
                              <span className="font-medium" style={{ color: INK_SOFT }}> / {row.grandMax}</span>
                            </>
                          ) : (
                            <span style={{ color: `${INK_SOFT}99` }}>—</span>
                          )}
                        </td>
                        {showGrade && (
                          <td
                            className="font-bold"
                            style={{
                              border: `1px solid ${MAROON}b3`,
                              padding: compact ? '4px 1px' : '5px 2px',
                              fontSize: compact ? '8.5px' : '10px',
                            }}
                          >
                            {row.grade ?? <span style={{ color: `${INK_SOFT}99` }}>—</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* TOTAL row — peach emphasis, submitted marks only */}
                    <tr className="font-bold" style={{ background: PEACH }}>
                      <th
                        scope="row"
                        className="px-2 py-[6px] text-left uppercase tracking-[0.08em]"
                        style={{ border: `1.5px solid ${MAROON}`, color: MAROON_DEEP, fontSize: compact ? '8.5px' : '10px' }}
                      >
                        Total
                      </th>
                      {data.exams.map((e) => (
                        <Fragment key={e.examId}>
                          <td
                            className="tabular-nums"
                            style={{ border: `1.5px solid ${MAROON}`, color: MAROON_DEEP, padding: compact ? '5px 1px' : '6px 2px', fontSize: compact ? '8px' : '9.5px' }}
                          >
                            {e.subjectsSubmitted > 0 && e.maxTotal > 0 ? e.maxTotal : <span style={{ color: `${INK_SOFT}99` }}>—</span>}
                          </td>
                          <td
                            className="tabular-nums"
                            style={{ border: `1.5px solid ${MAROON}`, color: MAROON_DEEP, padding: compact ? '5px 1px' : '6px 2px', fontSize: compact ? '8.5px' : '10px' }}
                          >
                            {e.subjectsSubmitted > 0 ? (
                              <>
                                {e.total}
                                {e.partial && (
                                  <span
                                    className="align-super font-bold"
                                    style={{ fontSize: '6.5px', color: '#B45309' }}
                                    title="partial — some subjects pending"
                                  >
                                    *
                                  </span>
                                )}
                              </>
                            ) : (
                              <span style={{ color: `${INK_SOFT}99` }}>—</span>
                            )}
                          </td>
                        </Fragment>
                      ))}
                      <td
                        className="tabular-nums"
                        style={{ border: `1.5px solid ${MAROON}`, color: MAROON_DEEP, padding: compact ? '5px 1px' : '6px 2px', fontSize: compact ? '8.5px' : '10px' }}
                      >
                        {s.grandMax > 0 ? (
                          <>
                            {s.grandTotal}
                            <span className="font-medium" style={{ color: INK_SOFT }}> / {s.grandMax}</span>
                          </>
                        ) : (
                          <span style={{ color: `${INK_SOFT}99` }}>—</span>
                        )}
                      </td>
                      {showGrade && (
                        <td
                          style={{ border: `1.5px solid ${MAROON}`, color: MAROON_DEEP, padding: compact ? '5px 1px' : '6px 2px', fontSize: compact ? '8.5px' : '10px' }}
                        >
                          {s.grade ?? <span style={{ color: `${INK_SOFT}99` }}>—</span>}
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>

                {/* 6 · summary strip — TOTAL MAXIMUM MARKS / TOTAL OBTAINED /
                       PERCENTAGE (+ grade) in the SBS bordered-cyan band */}
                <div
                  className="mt-3 grid"
                  style={{
                    border: `1px solid ${MAROON}`,
                    gridTemplateColumns: `repeat(${showGrade ? 4 : 3}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="px-2 py-2 text-center" style={{ background: CYAN, borderRight: `1px solid ${MAROON}80` }}>
                    <p className="text-[14px] font-bold leading-none tabular-nums sm:text-[16px]" style={{ color: MAROON_DEEP }}>
                      {s.grandMax > 0 ? s.grandMax : '—'}
                    </p>
                    <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.14em] sm:text-[7.5px]" style={{ color: INK }}>
                      Total Maximum Marks{toDate ? ' (to date)' : ''}
                    </p>
                  </div>
                  <div className="px-2 py-2 text-center" style={{ background: CYAN, borderRight: `1px solid ${MAROON}80` }}>
                    <p className="text-[14px] font-bold leading-none tabular-nums sm:text-[16px]" style={{ color: MAROON_DEEP }}>
                      {s.grandMax > 0 ? s.grandTotal : '—'}
                    </p>
                    <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.14em] sm:text-[7.5px]" style={{ color: INK }}>
                      Total Obtained{toDate ? ' (to date)' : ''}
                    </p>
                  </div>
                  {data.config.showPercentage && (
                    <div className="px-2 py-2 text-center" style={{ background: CYAN, borderRight: showGrade ? `1px solid ${MAROON}80` : 'none' }}>
                      <p className="text-[14px] font-bold leading-none tabular-nums sm:text-[16px]" style={{ color: MAROON_DEEP }}>
                        {s.percentage != null ? `${s.percentage}%` : '—'}
                      </p>
                      <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.14em] sm:text-[7.5px]" style={{ color: INK }}>
                        Percentage{toDate ? ' (to date)' : ''}
                      </p>
                    </div>
                  )}
                  {showGrade && (
                    <div className="px-2 py-2 text-center" style={{ background: CYAN }}>
                      <p className="text-[14px] font-bold leading-none sm:text-[16px]" style={{ color: MAROON_DEEP }}>
                        {s.grade ?? '—'}
                      </p>
                      <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.14em] sm:text-[7.5px]" style={{ color: INK }}>
                        Overall Grade
                      </p>
                    </div>
                  )}
                </div>

                {/* honesty banners (§16/§17) — they PRINT with the document
                    so a progressive result can never be mistaken for final */}
                {s.partial && (
                  <p
                    className="mt-2.5 px-3 py-[7px] text-center text-[8.5px] font-semibold leading-relaxed sm:text-[9.5px]"
                    style={{ border: '1px solid #B4530966', background: '#FFF8EE', color: '#92400E' }}
                  >
                    {s.pendingExams > 0 &&
                      `${s.pendingExams} examination${s.pendingExams === 1 ? '' : 's'} pending`}
                    {s.pendingExams > 0 && s.pendingCells > 0 && ' · '}
                    {s.pendingCells > 0 &&
                      `${s.pendingCells} subject mark${s.pendingCells === 1 ? '' : 's'} awaited`}
                    {' '}— totals shown are to date; this document updates automatically as marks are submitted. Unentered marks appear as “—”, never as zero.
                  </p>
                )}
                {s.state === 'NOT_STARTED' && (
                  <p
                    className="mt-2.5 px-3 py-[7px] text-center text-[8.5px] leading-relaxed sm:text-[9.5px]"
                    style={{ border: `1px solid ${MAROON}55`, background: '#FCF9F4', color: INK_SOFT }}
                  >
                    No examination marks have been submitted for this academic session yet.
                  </p>
                )}
                {s.state === 'FINALIZED' && (
                  <p
                    className="mt-2.5 px-3 py-[7px] text-center text-[8.5px] font-semibold sm:text-[9.5px]"
                    style={{ border: `1px solid ${MAROON}66`, background: PEACH, color: MAROON_DEEP }}
                  >
                    Official result{data.summary.declaredAt ? ` · declared ${formatDate(data.summary.declaredAt)}` : ''}
                    {data.summary.outcome ? ` · ${data.summary.outcome}` : ''}
                  </p>
                )}

                {/* 7 · co-scholastic area — ONLY the school's configured
                       areas (rendered while no canonical co-scholastic
                       grades exist, values stay honest “—”) */}
                {coScholastic.length > 0 && (
                  <div className="mt-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p
                        className="text-[9px] font-bold uppercase tracking-[0.18em] sm:text-[10px]"
                        style={{ color: MAROON_DEEP }}
                      >
                        Co-Scholastic Area
                      </p>
                      <p className="text-[7px] font-semibold uppercase tracking-[0.1em] sm:text-[7.5px]" style={{ color: INK_SOFT }}>
                        A* Outstanding · A Excellent · B Good · C Fair
                      </p>
                    </div>
                    <div
                      className="mt-1 grid"
                      style={{
                        border: `1px solid ${MAROON}`,
                        background: MAROON,
                        gap: '1px',
                        gridTemplateColumns: `repeat(${Math.min(coScholastic.length, 4)}, minmax(0, 1fr))`,
                      }}
                    >
                      {coScholastic.map((area) => (
                        <div key={area} className="px-1.5 py-[7px] text-center" style={{ background: '#fff' }}>
                          <p className="break-words text-[8px] font-semibold uppercase leading-tight tracking-[0.06em] sm:text-[8.5px]">
                            {area}
                          </p>
                          <p className="mt-[3px] text-[11px] font-bold" style={{ color: `${INK_SOFT}99` }}>
                            —
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 8 · grade scale — horizontal SBS strip from the school's
                       configured scheme (fallback clearly labelled) */}
                {showGrade && (
                  <div
                    className="mt-3 flex"
                    style={{ border: `1px solid ${MAROON}` }}
                    role="group"
                    aria-label="Grading scale"
                  >
                    {data.gradeScale.rows.map((g, i) => (
                      <div
                        key={g.grade}
                        className="flex-1 px-0.5 py-[6px] text-center"
                        style={{
                          borderRight: i < data.gradeScale.rows.length - 1 ? `1px solid ${MAROON}80` : 'none',
                          background: `${PEACH}a6`,
                        }}
                      >
                        <p className="text-[7px] font-semibold tabular-nums leading-none sm:text-[7.5px]" style={{ color: INK_SOFT }}>
                          {Math.round(g.minPct)}
                          {g.maxPct >= 100 ? '+' : `–${Math.floor(g.maxPct)}`}
                        </p>
                        <p className="mt-[3px] text-[10px] font-bold leading-none sm:text-[11px]" style={{ color: MAROON_DEEP }}>
                          {g.grade}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 9 · remark / attendance / class rank — the SBS bottom
                       information row (real canonical data only) */}
                {infoCells.length > 0 && (
                  <div
                    className="mt-3 grid"
                    style={{
                      border: `1px solid ${MAROON}`,
                      gridTemplateColumns: `repeat(${infoCells.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {infoCells.map((cell, i) => (
                      <div
                        key={cell.label}
                        className="px-2.5 py-[7px]"
                        style={{
                          borderRight: i < infoCells.length - 1 ? `1px solid ${MAROON}80` : 'none',
                          background: '#fff',
                        }}
                      >
                        <p
                          className="text-[7.5px] font-bold uppercase tracking-[0.16em] sm:text-[8px]"
                          style={{ color: MAROON_DEEP }}
                        >
                          {cell.label} :
                        </p>
                        <p className="mt-[3px] break-words text-[9px] leading-snug sm:text-[10px]">{cell.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 10 · signatures — Date of Issue · Class Teacher · Principal */}
                <div className="mt-7 grid gap-3 text-center" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <div>
                    <p className="text-[9.5px] font-semibold tabular-nums sm:text-[10.5px]">
                      {s.declaredAt ? formatDate(s.declaredAt) : <span style={{ color: `${INK_SOFT}99` }}>—</span>}
                    </p>
                    <div className="mx-auto mt-1 h-px w-full max-w-[7.5rem]" style={{ background: `${INK}80` }} aria-hidden="true" />
                    <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] sm:text-[8.5px]" style={{ color: INK_SOFT }}>
                      Date of Issue
                    </p>
                  </div>
                  {data.config.showClassTeacherSign && (
                    <div>
                      <div className="h-[15px]" aria-hidden="true" />
                      <div className="mx-auto mt-1 h-px w-full max-w-[7.5rem]" style={{ background: `${INK}80` }} aria-hidden="true" />
                      <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] sm:text-[8.5px]" style={{ color: INK_SOFT }}>
                        Class Teacher
                      </p>
                      {data.classTeacherName && (
                        <p className="text-[8px] font-semibold sm:text-[8.5px]">{data.classTeacherName}</p>
                      )}
                    </div>
                  )}
                  {data.config.showPrincipalSign && (
                    <div>
                      <div className="h-[15px]" aria-hidden="true" />
                      <div className="mx-auto mt-1 h-px w-full max-w-[7.5rem]" style={{ background: `${INK}80` }} aria-hidden="true" />
                      <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] sm:text-[8.5px]" style={{ color: INK_SOFT }}>
                        Principal / Authorised Signatory
                      </p>
                      {data.principalName && (
                        <p className="text-[8px] font-semibold sm:text-[8.5px]">{data.principalName}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* 11 · provenance footer */}
                <p
                  className="mt-4 pb-0.5 pt-2 text-center text-[7px] leading-relaxed tracking-[0.04em] sm:text-[7.5px]"
                  style={{ borderTop: `1px solid ${MAROON}55`, color: INK_SOFT }}
                >
                  Generated from official school records · {formatDate(data.generatedAt.slice(0, 10))} · {data.school.name}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
