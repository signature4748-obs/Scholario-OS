'use client'

/**
 * StudentMarksheetViewer — the STUDENT'S FORMAL DIGITAL MARKSHEET, rendered
 * in the supplied A4 template's design language (§3/§25/§30): a real
 * official-looking school result document, NOT a generic SaaS card —
 *
 *   ┌═══════════════════════════════════════┐  ← double border frame
 *   │ [logo]  SCHOOL NAME                    │
 *   │         address · city · phone · board │
 *   │      PROGRESS EVALUATION REPORT        │
 *   │  ACADEMIC SESSION : …   CLASS : …      │
 *   │  student information grid              │
 *   │  SUBJECTS | EXAM…EXAM | TOTAL | GRADE  │  ← dynamic exam columns
 *   │  TOTAL row · summary strip             │
 *   │  attendance · remarks · signatures     │
 *   │  date of issue · provenance footer     │
 *   └═══════════════════════════════════════┘
 *
 * ONE canonical viewer (§2): every surface that shows the personal
 * marksheet opens THIS component. It is a pure presentation layer over the
 * payload of GET /api/teacher/students/[studentId]/marksheet — the SAME
 * canonical ExamMark / ExamSubjectConfig / GradeScale / Attendance /
 * School rows every other module uses (§8). No demo data, nothing
 * hardcoded: school branding, examination structure (any count), subjects,
 * max marks, grades, attendance and signatories all arrive from the
 * server, scoped to the student's own school (§4–§7, §27).
 *
 * HONESTY (§10/§11/§17): unentered marks render "—" — never 0; totals and
 * percentages are labeled "(to date)" while any examination is pending;
 * the final percentage/grade appear unqualified only when the whole
 * session is complete. Print / Save PDF unlocks only when at least one
 * examination's full result is in (summary.canPrint, §24) — and the
 * pending-examinations banner prints WITH the document so a printed
 * progressive result can never be mistaken for a final one.
 *
 * RESPONSIVE (§25): desktop centers the A4 sheet in a clean workspace with
 * the toolbar outside the document; mobile keeps the document readable
 * (compact typography, stacked marks, no page-wide overflow) with the
 * toolbar reachable. Print (§26) emits the clean A4 portrait sheet only —
 * no React chrome.
 */

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
  gradeScale: {
    source: 'school' | 'default'
    rows: { grade: string; minPct: number; maxPct: number }[]
  }
  config: {
    showAttendance: boolean
    showPercentage: boolean
    showGrade: boolean
    showCoScholastic: boolean
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

// the classic formal-document palette: black/white/gray with a restrained
// green accent — independent of app dark mode so the sheet always looks
// like a printed document on screen.
const DOC = 'border-slate-800 text-slate-900'

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
  // A4-friendly compact table when the school's structure has many exams (§15)
  const compact = nExams >= 4
  const showGrade = data.config.showGrade && data.gradeScale.rows.length > 0
  const toDate = s.partial

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="grid-cols-1 max-h-[94dvh] w-[calc(100vw-1rem)] max-w-[880px] gap-0 overflow-y-auto bg-muted/40 p-2.5 sm:max-w-[880px] sm:p-4 dark:bg-muted/40"
      >
        {/* marksheet-only print stylesheet — mounted while this dialog is
            open, so printing any other page stays untouched (§26). */}
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 8mm; }
            body * { visibility: hidden !important; }
            #student-marksheet-print, #student-marksheet-print * { visibility: visible !important; }
            #student-marksheet-print {
              position: absolute !important;
              left: 0 !important; top: 0 !important; right: 0 !important;
              width: 100% !important; max-width: none !important;
              margin: 0 !important; padding: 0 !important;
            }
            #student-marksheet-print, #student-marksheet-print * {
              print-color-adjust: exact !important;
              -webkit-print-color-adjust: exact !important;
            }
            .no-print { display: none !important; }
          }
        `}</style>

        {/* ── toolbar (screen only, outside the document §25) ─────────── */}
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

        {/* ── the A4 document ─────────────────────────────────────────── */}
        <div id="student-marksheet-print" className="mx-auto w-full max-w-[210mm] p-0.5">
          <div className="font-serif shadow-lg">
            {/* outer double frame */}
            <div className={cn('border-[2.5px] bg-white p-[3px]', DOC)}>
              <div className={cn('border px-3 py-4 sm:px-5 sm:py-5', DOC)}>

                {/* 1 · school identity (§4 — always this student's school) */}
                <header className="flex items-center gap-3 sm:gap-4">
                  {data.school.logoUrl ? (
                    <img
                      src={data.school.logoUrl}
                      alt={`${data.school.name} logo`}
                      className="h-14 w-14 shrink-0 rounded-full border border-slate-400 object-cover sm:h-16 sm:w-16"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-slate-800 text-lg font-bold sm:h-16 sm:w-16 sm:text-xl">
                      {data.school.name
                        .split(/\s+/)
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 3)
                        .join('')}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 text-center">
                    <h2 className="text-base font-bold uppercase leading-tight tracking-[0.08em] sm:text-xl">
                      {data.school.name}
                    </h2>
                    <p className="mt-1 text-[9.5px] leading-relaxed text-slate-600 sm:text-[11px]">
                      {[data.school.address, data.school.city].filter(Boolean).join(', ')}
                      {data.school.phone ? ` · ${data.school.phone}` : ''}
                    </p>
                    {data.school.board && (
                      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[10px]">
                        ({data.school.board})
                      </p>
                    )}
                  </div>
                  {/* keep the header optically centered: a spacer exactly the logo's width */}
                  <span className="hidden w-14 shrink-0 sm:block sm:w-16" aria-hidden="true" />
                </header>

                {/* 2 · document heading */}
                <div className="mt-4 flex items-center gap-2 sm:mt-5 sm:gap-4">
                  <span className="h-[2px] w-5 shrink-0 bg-slate-800 sm:w-auto sm:flex-1" aria-hidden="true" />
                  <div className="min-w-0 text-center">
                    <h3 className="text-[11.5px] font-bold uppercase leading-snug tracking-[0.14em] sm:text-lg sm:tracking-[0.16em]">
                      Progress Evaluation Report
                    </h3>
                    <p className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.34em] text-slate-600 sm:text-[9.5px]">
                      Statement of Marks
                    </p>
                  </div>
                  <span className="h-[2px] w-5 shrink-0 bg-slate-800 sm:w-auto sm:flex-1" aria-hidden="true" />
                </div>

                {/* 3 · session + class strip (§13) */}
                <div className={cn('mt-3 grid grid-cols-1 border text-[9.5px] font-bold uppercase tracking-[0.12em] sm:grid-cols-2 sm:text-[11px]', DOC)}>
                  <p className={cn('px-3 py-1.5 sm:border-r', DOC)}>
                    Academic Session : <span className="tracking-normal">{data.session ?? '—'}</span>
                  </p>
                  <p className={cn('px-3 py-1.5 sm:text-right', DOC)}>
                    Class : <span className="tracking-normal">{data.student.classLabel}</span>
                  </p>
                </div>

                {/* 4 · student information (§14 — real profile data, no fakes).
                    gap-px hairlines: uniform dividers at any breakpoint. */}
                <div className={cn('mt-3 grid grid-cols-2 gap-px border sm:grid-cols-4', DOC)}>
                  {[
                    ["Student's Name", data.student.name],
                    ["Father's / Guardian's Name", data.student.guardianName ?? null],
                    ['Roll No', data.student.rollNo ?? null],
                    ['Admission No', data.student.admissionNo ?? null],
                    ['Gender', data.student.gender === 'MALE' ? 'Male' : data.student.gender === 'FEMALE' ? 'Female' : data.student.gender],
                    ['Date of Birth', data.student.dob ? formatDate(data.student.dob) : null],
                  ]
                    .filter(([, v]) => v != null && String(v).trim() !== '')
                    .map(([label, value]) => (
                      <div key={String(label)} className="bg-white px-2.5 py-2">
                        <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
                        <p className="mt-0.5 break-words font-semibold leading-snug">{String(value)}</p>
                      </div>
                    ))}
                </div>

                {/* 5 · marks table — dynamic exam columns (§5/§9/§15/§16) */}
                <div className="mt-3">
                  <table
                    className={cn('w-full table-fixed border-collapse text-center', compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-[11px]')}
                  >
                    <colgroup>
                      <col style={{ width: compact ? '22%' : '26%' }} />
                      {data.exams.map((e) => (
                        <col key={e.examId} />
                      ))}
                      <col style={{ width: compact ? '12%' : '15%' }} />
                      {showGrade && <col style={{ width: '10%' }} />}
                    </colgroup>
                    <thead>
                      <tr className={cn('border-y-2 bg-slate-100 font-bold uppercase tracking-wider text-slate-900', DOC)}>
                        <th scope="col" className={cn('border-r border-slate-400 px-1.5 py-2 text-left', DOC)}>
                          Subjects
                        </th>
                        {data.exams.map((e) => (
                          <th
                            scope="col"
                            key={e.examId}
                            className={cn('break-words border-r border-slate-400 px-0.5 py-1.5 leading-tight', DOC)}
                          >
                            <span className="block break-words">{e.examName}</span>
                            {e.examDate && (
                              <span className="mt-0.5 block text-[7px] font-medium normal-case tracking-normal text-slate-500">
                                {formatDate(e.examDate)}
                              </span>
                            )}
                          </th>
                        ))}
                        <th scope="col" className={cn('break-words border-r border-slate-400 px-0.5 py-1.5', DOC)}>
                          Grand Total{toDate ? <span className="block text-[7px] font-medium normal-case tracking-normal text-slate-500">(to date)</span> : null}
                        </th>
                        {showGrade && <th scope="col" className={cn('break-words px-0.5 py-1.5', DOC)}>Grade</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {data.subjects.map((row) => (
                        <tr key={row.subjectId} className={cn('border-b border-slate-400', DOC)}>
                          <th scope="row" className="border-r border-slate-400 px-2 py-1.5 text-left font-semibold">
                            {row.subjectName}
                          </th>
                          {row.cells.map((c, i) => (
                            <td key={i} className={cn('break-words border-r border-slate-400 px-0.5 py-1', DOC)}>
                              {c.isSubmitted ? (
                                <>
                                  <span className="block font-bold tabular-nums leading-tight">
                                    {c.obtained != null ? c.obtained : <span className="text-[8px] tracking-widest">AB</span>}
                                  </span>
                                  {c.maxMarks != null && (
                                    <span className="block text-[7.5px] tabular-nums text-slate-500">/ {c.maxMarks}</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-400" aria-label="marks not entered">—</span>
                              )}
                            </td>
                          ))}
                          <td className={cn('break-words border-r px-1 py-1', 'border-slate-400', DOC)}>
                            {row.grandTotal != null ? (
                              <span className="font-bold tabular-nums">
                                {row.grandTotal}
                                <span className="font-medium text-slate-500"> / {row.grandMax}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          {showGrade && (
                            <td className={cn('px-1 py-1 font-bold', DOC)}>
                              {row.grade ?? <span className="text-slate-400">—</span>}
                            </td>
                          )}
                        </tr>
                      ))}
                      {/* TOTAL row (§17 — submitted marks only) */}
                      <tr className={cn('border-y-2 bg-slate-50 font-bold', DOC)}>
                        <th scope="row" className={cn('border-r border-slate-400 px-2 py-1.5 text-left uppercase tracking-wider', DOC)}>
                          Total
                        </th>
                        {data.exams.map((e) => (
                          <td key={e.examId} className={cn('break-words border-r border-slate-400 px-0.5 py-1', DOC)}>
                            {e.subjectsSubmitted > 0 && e.maxTotal > 0 ? (
                              <span className="tabular-nums">
                                {e.total}
                                <span className="font-medium text-slate-500"> / {e.maxTotal}</span>
                                {e.partial && (
                                  <span className="ml-0.5 align-super text-[7px] font-bold text-amber-700" title="partial — some subjects pending">*</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        ))}
                        <td className={cn('break-words border-r border-slate-400 px-0.5 py-1', DOC)}>
                          {s.grandMax > 0 ? (
                            <span className="tabular-nums">
                              {s.grandTotal}
                              <span className="font-medium text-slate-500"> / {s.grandMax}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        {showGrade && (
                          <td className={cn('break-words px-0.5 py-1', DOC)}>
                            {s.grade ?? <span className="text-slate-400">—</span>}
                          </td>
                        )}
                      </tr>
                    </tbody>
                  </table>
                  {/* grading scale (§18 — the scale actually used) */}
                  {showGrade && (
                    <p className="mt-2 text-[8px] leading-relaxed text-slate-500 sm:text-[9px]">
                      <span className="font-semibold uppercase tracking-wider">Grading Scale:</span>{' '}
                      {data.gradeScale.rows.map((g) => `${g.grade} ${Math.round(g.minPct)}${g.maxPct >= 100 ? '+' : `–${Math.floor(g.maxPct)}`}`).join(' · ')}
                      {data.gradeScale.source === 'default' && ' (school default)'}
                    </p>
                  )}
                </div>

                {/* 6 · summary strip (§17) */}
                <div className={cn('mt-3 grid gap-px border text-center', DOC, showGrade ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3')}>
                  <div className="bg-white px-2 py-2">
                    <p className="text-[15px] font-bold tabular-nums leading-none sm:text-lg">
                      {s.grandMax > 0 ? s.grandTotal : '—'}
                      {s.grandMax > 0 && <span className="text-[10px] font-medium text-slate-500"> / {s.grandMax}</span>}
                    </p>
                    <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-600">
                      Grand Total{toDate ? ' (to date)' : ''}
                    </p>
                  </div>
                  {data.config.showPercentage && (
                    <div className="bg-white px-2 py-2">
                      <p className="text-[15px] font-bold tabular-nums leading-none sm:text-lg">
                        {s.percentage != null ? `${s.percentage}%` : '—'}
                      </p>
                      <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-600">
                        Percentage{toDate ? ' (to date)' : ''}
                      </p>
                    </div>
                  )}
                  {showGrade && (
                    <div className="bg-white px-2 py-2">
                      <p className="text-[15px] font-bold leading-none sm:text-lg">{s.grade ?? '—'}</p>
                      <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-600">Overall Grade</p>
                    </div>
                  )}
                  <div className="bg-white px-2 py-2">
                    <p className="text-[11px] font-bold uppercase leading-none tracking-wider sm:text-[13px]">
                      {stateMeta.label}
                    </p>
                    <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-600">Result Status</p>
                  </div>
                </div>

                {/* honesty banners (§10/§11) — these PRINT with the document
                    so a progressive result can never be mistaken for final */}
                {s.partial && (
                  <p className="mt-2.5 border border-amber-600/60 bg-amber-50 px-3 py-2 text-center text-[9px] font-semibold leading-relaxed text-amber-800 sm:text-[10px]">
                    {s.pendingExams > 0 &&
                      `${s.pendingExams} examination${s.pendingExams === 1 ? '' : 's'} pending`}
                    {s.pendingExams > 0 && s.pendingCells > 0 && ' · '}
                    {s.pendingCells > 0 &&
                      `${s.pendingCells} subject mark${s.pendingCells === 1 ? '' : 's'} awaited`}
                    {' '}— totals shown are to date; this document updates automatically as marks are submitted. Unentered marks appear as “—”, never as zero.
                  </p>
                )}
                {s.state === 'NOT_STARTED' && (
                  <p className="mt-2.5 border border-slate-400 bg-slate-50 px-3 py-2 text-center text-[9px] leading-relaxed text-slate-600 sm:text-[10px]">
                    No examination marks have been submitted for this academic session yet.
                  </p>
                )}
                {s.state === 'FINALIZED' && (
                  <p className="mt-2.5 border border-emerald-700/60 bg-emerald-50 px-3 py-2 text-center text-[9px] font-semibold text-emerald-800 sm:text-[10px]">
                    Official result{data.summary.declaredAt ? ` · declared ${formatDate(data.summary.declaredAt)}` : ''}
                    {data.summary.outcome ? ` · ${data.summary.outcome}` : ''}
                  </p>
                )}

                {/* 7 · co-scholastic (§19 — only when the school configured it) */}
                {data.config.showCoScholastic && (
                  <div className="mt-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-700">Co-Scholastic Areas</p>
                    <div className={cn('mt-1 grid grid-cols-2 gap-px border sm:grid-cols-4', DOC)}>
                      {['Sports & Games', 'Art & Craft', 'Music & Dance', 'Discipline'].map((area) => (
                        <div key={area} className="bg-white px-2 py-1.5 text-center">
                          <p className="text-[8.5px] font-semibold">{area}</p>
                          <p className="mt-0.5 text-[10px] font-bold text-slate-400">—</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 8 · attendance + remarks (§20/§21) */}
                <div className={cn('mt-3 grid gap-px border text-[10px] sm:grid-cols-2', DOC)}>
                  {data.config.showAttendance && (
                    <p className="bg-white px-3 py-2">
                      <span className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-slate-600">Attendance : </span>
                      <span className="font-semibold tabular-nums">
                        {data.attendance.totalDays > 0
                          ? `${data.attendance.presentDays} / ${data.attendance.totalDays} days${data.attendance.pct != null ? ` (${data.attendance.pct}%)` : ''}`
                          : '—'}
                      </span>
                    </p>
                  )}
                  {data.config.showRemarks && (
                    <p className="bg-white px-3 py-2">
                      <span className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-slate-600">Remarks : </span>
                      <span className={s.remark ? 'font-semibold' : 'text-slate-400'}>
                        {s.remark ?? '—'}
                      </span>
                    </p>
                  )}
                </div>

                {/* 9 · signatures (§22) + date of issue (§23) */}
                <div className="mt-5 grid grid-cols-3 items-end gap-2 pb-1 text-center sm:mt-6">
                  <div>
                    {data.config.showClassTeacherSign && (
                      <>
                        <div className="mx-auto h-px w-full max-w-[7rem] bg-slate-500" aria-hidden="true" />
                        <p className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-slate-600">Class Teacher</p>
                        {data.classTeacherName && (
                          <p className="text-[8.5px] font-semibold">{data.classTeacherName}</p>
                        )}
                      </>
                    )}
                  </div>
                  <div>
                    <div className="mx-auto h-px w-full max-w-[7rem] bg-slate-500" aria-hidden="true" />
                    <p className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-slate-600">Date of Issue</p>
                    <p className="text-[8.5px] font-semibold tabular-nums">
                      {s.declaredAt ? formatDate(s.declaredAt) : <span className="font-normal text-slate-400">—</span>}
                    </p>
                  </div>
                  <div>
                    {data.config.showPrincipalSign && (
                      <>
                        <div className="mx-auto h-px w-full max-w-[7rem] bg-slate-500" aria-hidden="true" />
                        <p className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-slate-600">Principal / Authorised Signatory</p>
                        {data.principalName && (
                          <p className="text-[8.5px] font-semibold">{data.principalName}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 10 · provenance footer (§26) */}
                <p className={cn('mt-3 border-t pt-1.5 pb-0.5 text-center text-[8px] leading-relaxed text-slate-500', 'border-slate-300', DOC)}>
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
