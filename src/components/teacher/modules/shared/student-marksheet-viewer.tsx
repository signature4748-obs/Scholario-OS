'use client'

/**
 * StudentMarksheetViewer — the PERSONAL DIGITAL RESULT document (digital
 * record §7–§12). One component, one data source
 * (GET /api/teacher/students/[studentId]/marksheet?examId=), rendered as
 * a real school marksheet — NOT a generic card or bare table:
 *
 *   ─────────────────────────────────────────────
 *   SCHOOL NAME · logo/identity · Academic Session
 *   STATEMENT OF MARKS
 *   Student / Admission No / Class / Roll No
 *   EXAMINATION: …
 *   SUBJECT      MAX   MARKS   %
 *   …            …     —       —      (honest "—")
 *   TOTAL  n / m · PERCENTAGE · RESULT STATUS
 *   Attendance %
 *   Principal / Authorized Signature
 *   Generated from official school records
 *   ─────────────────────────────────────────────
 *
 * STATE MACHINE (§11): NOT_STARTED / IN_PROGRESS / READY / FINALIZED.
 * Print + PDF are exposed ONLY when every required subject is in
 * (summary.canPrint) — a partial result is clearly labeled as partial
 * and never offered as a final document.
 */

import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, GraduationCap, Loader2, Printer } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'

export interface StudentMarksheetPayload {
  school: {
    name: string
    address: string | null
    city: string | null
    phone: string | null
    email: string | null
    academicYear: string | null
    board: string | null
    logoUrl: string | null
  }
  student: {
    name: string
    admissionNo: string | null
    rollNo: string | null
    classLabel: string
  }
  exam: {
    examId: string
    examName: string
    type: string
    session: string | null
    examDate: string | null
    resultStatus: string
    declaredAt: string | null
  }
  subjects: {
    subjectId: string
    subjectName: string
    maxMarks: number
    obtained: number | null
    markStatus: string | null
    isSubmitted: boolean
  }[]
  summary: {
    state: 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'FINALIZED'
    subjectsSubmitted: number
    subjectsTotal: number
    total: number
    maxTotal: number
    percentage: number | null
    partial: boolean
    pendingSubjects: number
    canPrint: boolean
  }
  attendancePct: number | null
  principalName: string | null
  generatedAt: string
}

const STATE_META: Record<
  StudentMarksheetPayload['summary']['state'],
  { label: string; cls: string }
> = {
  NOT_STARTED: { label: 'Not started', cls: 'bg-muted text-muted-foreground' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  READY: { label: 'Ready', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  FINALIZED: { label: 'Result Declared', cls: 'bg-emerald-600 text-white' },
}

interface Props {
  studentId: string | null
  examId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** open the browser print dialog as soon as the document loads (the
   *  "Download" shortcut — File → Save as PDF is the school's canonical
   *  document export, the same path the fee receipt uses) */
  autoPrint?: boolean
}

export function StudentMarksheetViewer({ studentId, examId, open, onOpenChange, autoPrint = false }: Props) {
  const [data, setData] = useState<StudentMarksheetPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const autoPrintDone = useRef(false)

  useEffect(() => {
    if (!open || !studentId || !examId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    autoPrintDone.current = false
    fetch(`/api/teacher/students/${studentId}/marksheet?examId=${examId}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; data?: StudentMarksheetPayload } | null
        if (!res.ok || !json || json.ok !== true || !json.data) {
          throw new Error(json?.error || `Request failed (${res.status})`)
        }
        return json.data
      })
      .then((d) => {
        if (cancelled) return
        setData(d)
        if (autoPrint && d.summary.canPrint && !autoPrintDone.current) {
          autoPrintDone.current = true
          // let the document paint before the print dialog opens
          window.setTimeout(() => window.print(), 350)
        }
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, studentId, examId, autoPrint])

  const s = data?.summary
  const stateMeta = s ? STATE_META[s.state] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-2xl gap-0 overflow-y-auto p-0 sm:w-full"
      >
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
            {data ? `${data.student.name} — ${data.exam.examName}` : 'Digital marksheet'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Statement of marks generated from the official school records — the same canonical marks every module uses.
          </DialogDescription>
        </DialogHeader>

        {/* marksheet-only print stylesheet — mounted while this dialog is
            open, so printing any other page stays untouched. */}
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #student-marksheet-print, #student-marksheet-print * { visibility: visible !important; }
            #student-marksheet-print { position: absolute; inset: 0; width: 100%; padding: 16px; }
            .no-print { display: none !important; }
          }
        `}</style>

        {loading ? (
          <div className="space-y-3 px-5 py-6" aria-busy="true">
            <div className="flex items-center justify-center gap-2 pb-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading marksheet…
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : !data || !s || !stateMeta ? null : (
          <>
            {/* ── the document ─────────────────────────────────────── */}
            <div id="student-marksheet-print" className="px-4 py-4 sm:px-5">
              <div className="rounded-xl border border-border bg-card shadow-xs">
                {/* school identity */}
                <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
                  {data.school.logoUrl ? (
                    <img
                      src={data.school.logoUrl}
                      alt={`${data.school.name} logo`}
                      className="h-12 w-12 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <GraduationCap className="h-6 w-6" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 text-center">
                    <h3 className="font-display text-base font-bold uppercase leading-tight tracking-wide sm:text-lg">
                      {data.school.name}
                    </h3>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground sm:text-[11px]">
                      {[data.school.address, data.school.city].filter(Boolean).join(', ')}
                      {data.school.board ? ` · ${data.school.board}` : ''}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 px-4 py-4 sm:px-5">
                  {/* title + session */}
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Academic Session {data.exam.session ?? data.school.academicYear ?? '—'}
                    </p>
                    <h4 className="mt-1 font-display text-sm font-bold uppercase tracking-widest text-foreground sm:text-base">
                      Statement of Marks
                    </h4>
                  </div>

                  {/* student identity grid — never truncated: a formal
                      document shows full identifiers (wraps if needed) */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/30 px-3.5 py-3 text-xs sm:grid-cols-4">
                    {[
                      ['Student', data.student.name],
                      ['Admission No', data.student.admissionNo ?? '—'],
                      ['Class', data.student.classLabel],
                      ['Roll No', data.student.rollNo ?? '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                        <p className="mt-0.5 break-words font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* examination */}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-xs">
                      <span className="font-bold uppercase tracking-wider text-muted-foreground">Examination: </span>
                      <span className="font-semibold">{data.exam.examName}</span>
                      <span className="text-muted-foreground"> · {data.exam.type}</span>
                    </p>
                    {data.exam.examDate && (
                      <p className="text-[11px] text-muted-foreground">{formatDate(data.exam.examDate)}</p>
                    )}
                  </div>

                  {/* subject table — every required subject, honest "—" */}
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[380px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          <th scope="col" className="px-3 py-2">Subject</th>
                          <th scope="col" className="px-3 py-2 text-center">Max</th>
                          <th scope="col" className="px-3 py-2 text-center">Marks</th>
                          <th scope="col" className="px-3 py-2 text-right">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {data.subjects.map((sub) => {
                          const pct = sub.isSubmitted && sub.obtained != null && sub.maxMarks > 0
                            ? Math.round((sub.obtained / sub.maxMarks) * 100)
                            : null
                          return (
                            <tr key={sub.subjectId}>
                              <td className="px-3 py-2 font-medium">{sub.subjectName}</td>
                              <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{sub.maxMarks}</td>
                              <td className="px-3 py-2 text-center font-semibold tabular-nums">
                                {sub.obtained != null ? (
                                  sub.obtained
                                ) : sub.markStatus === 'ABSENT' ? (
                                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">AB</span>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {pct != null ? (
                                  <span className={cn(
                                    'font-semibold',
                                    pct >= 75 ? 'text-emerald-600 dark:text-emerald-400'
                                      : pct >= 40 ? 'text-foreground'
                                        : 'text-rose-600 dark:text-rose-400',
                                  )}>
                                    {pct}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* total / percentage / result status */}
                  <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border/50">
                    <div className="bg-card px-3 py-2.5 text-center">
                      <p className="font-display text-sm font-bold tabular-nums sm:text-base">
                        {s.total} / {s.maxTotal}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Total{s.partial ? ' (partial)' : ''}
                      </p>
                    </div>
                    <div className="bg-card px-3 py-2.5 text-center">
                      <p className="font-display text-sm font-bold tabular-nums sm:text-base">
                        {s.percentage != null ? `${s.percentage}%` : '—'}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Percentage{s.partial ? ' (partial)' : ''}
                      </p>
                    </div>
                    <div className="bg-card px-3 py-2.5 text-center">
                      <p className="mt-0.5">
                        <span className={cn('inline-block rounded-full px-2.5 py-1 text-[10px] font-bold', stateMeta.cls)}>
                          {stateMeta.label}
                        </span>
                      </p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Result status</p>
                    </div>
                  </div>

                  {/* honesty banners */}
                  {s.partial && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-[11px] font-medium leading-relaxed text-amber-800 dark:text-amber-300">
                      {s.pendingSubjects} of {s.subjectsTotal} subject{s.pendingSubjects === 1 ? '' : 's'} still pending —
                      this is a <strong>partial result</strong> computed from the {s.subjectsSubmitted} submitted subject{s.subjectsSubmitted === 1 ? '' : 's'} only.
                      It updates automatically as subject teachers submit marks.
                    </p>
                  )}
                  {s.state === 'NOT_STARTED' && (
                    <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-center text-[11px] text-muted-foreground">
                      No subject marks have been submitted for this examination yet.
                    </p>
                  )}
                  {s.state === 'FINALIZED' && (
                    <p className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Official result{data.exam.declaredAt ? ` · declared ${formatDate(data.exam.declaredAt)}` : ''}
                    </p>
                  )}

                  {/* attendance */}
                  <div className="flex items-center justify-between gap-2 border-t border-dashed border-border pt-3 text-xs">
                    <span className="text-muted-foreground">Attendance (session to date)</span>
                    <span className="font-bold tabular-nums">
                      {data.attendancePct != null ? `${data.attendancePct}%` : '—'}
                    </span>
                  </div>

                  {/* signature + provenance */}
                  <div className="flex flex-col items-end gap-1 border-t border-dashed border-border pt-4 text-right">
                    <p className="font-[cursive] text-sm italic text-muted-foreground">
                      {data.principalName ?? ''}
                    </p>
                    <div className="h-px w-40 bg-border" aria-hidden="true" />
                    <p className="text-[10px] font-semibold">
                      Principal / Authorized Signature
                    </p>
                  </div>
                </div>

                <p className="border-t border-border bg-muted/20 px-4 py-2 text-center text-[10px] leading-relaxed text-muted-foreground sm:px-5">
                  Generated from official school records
                  {data.generatedAt ? ` · ${formatDate(data.generatedAt.slice(0, 10))}` : ''}
                  {' '}· {data.school.name}
                </p>
              </div>
            </div>

            {/* ── actions (screen only) ─────────────────────────────── */}
            <div className="no-print flex flex-col items-center gap-2 border-t border-border px-5 py-3.5 sm:flex-row sm:justify-between">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {s.canPrint
                  ? s.state === 'FINALIZED'
                    ? 'Official result — print or save as PDF.'
                    : `All ${s.subjectsTotal} subjects submitted${data.exam.resultStatus !== 'Declared' ? ' · awaiting result declaration' : ''}.`
                  : `${s.pendingSubjects} subject${s.pendingSubjects === 1 ? '' : 's'} pending — the printable result unlocks once every subject is submitted.`}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {s.canPrint && (
                  <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()}>
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    {s.state === 'FINALIZED' ? 'Download PDF' : 'Print / Save PDF'}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
