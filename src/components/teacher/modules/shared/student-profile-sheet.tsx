'use client'

/**
 * shared/student-profile-sheet — the ONE teacher-facing student profile
 * (master task §6/§25). Opened from the Student Directory, My Class,
 * Fees & Payments and Student Growth — the SAME canonical student, the
 * SAME architecture the Principal's profile uses (identity header →
 * quick metrics → tab pills → sections), with role-appropriate
 * visibility decided by the SERVER:
 *
 *   · Overview      identity + class info (real Student/User rows)
 *   · Attendance    canonical summary + counts + recent records
 *   · Marksheets    the PERSONAL DIGITAL RESULT RECORD (§7–§12): every
 *                  examination configured for the class with its honest
 *                  NOT_STARTED / IN_PROGRESS / READY / FINALIZED state,
 *                  opening the document-style digital marksheet viewer.
 *                  Same canonical marks as Marks Entry / Academics /
 *                  Results Submission — never a second marks record.
 *   · Fee & Receipts  class-teacher classes ONLY (subject teachers never
 *                   see a family's money — the payload simply omits it)
 *   · Growth        the canonical Growth Score + point ledger + the
 *                   quick Add Points action (§13); the fee standing chip
 *                   is administrative metadata — NEVER part of the score
 *                   (§3/§23)
 *   · Guardian      guardian contact + the parent conversation link
 *
 * Fetch-on-open: GET /api/teacher/students/[studentId] re-validates the
 * teacher's scope on every request. Nothing is fabricated — missing
 * records render honest "Not recorded" states.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Calendar,
  CalendarCheck,
  Clock3,
  Download,
  Eye,
  GraduationCap,
  Mail,
  MapPin,
  MessagesSquare,
  Phone,
  Plus,
  Receipt,
  TrendingUp,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { GradientAvatar, StatusBadge } from '@/components/shared/ui'
import { FeeReceiptViewer } from '@/components/shared/fee-collection/receipt-viewer'
import { StudentMarksheetViewer, type MarksheetDocumentPayload } from './student-marksheet-viewer'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatDate, formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/signout'
import type {
  FeeStandingDto,
  GrowthEventItem,
  GrowthPreset,
  GrowthScoreDto,
  GrowthSettingsDto,
} from '@/lib/teacher-hub-types'
import { FEE_STATUS_META, attendanceToneClass } from '../students/shared'
import { ActivityList } from '../student-growth/activity-list'
import { AddPointsDialog } from '../student-growth/add-points-dialog'
import {
  FeeStandingChip,
  GrowthDimensions,
  GrowthScoreRing,
  MonthDeltaChip,
} from '../student-growth/growth-summary'
import {
  PRIMARY_ACTION_CLASS,
  scoreTextClass,
  signedDelta,
} from '../student-growth/shared'

const THIN_SCROLLBAR =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent'

// ── payload contract (mirrors GET /api/teacher/students/[studentId]) ──

/** The per-exam personal result state (digital record §7/§11/§12) —
 * derived server-side from the canonical ExamMark + ExamSubjectConfig
 * rows, never stored twice. */
export interface StudentExamState {
  examId: string
  examName: string
  examDate: string | null
  type: string
  session: string | null
  resultStatus: string
  state: 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'FINALIZED'
  subjectsSubmitted: number
  subjectsTotal: number
  /** over submitted subjects only — labeled partial when incomplete */
  percentage: number | null
  partial: boolean
}

export interface TeacherStudentProfile {
  student: {
    id: string
    name: string
    email: string | null
    rollNo: string | null
    admissionNo: string | null
    classId: string | null
    classLabel: string
    stream: string | null
    guardianName: string | null
    guardianPhone: string | null
    gender: string | null
    dob: string | null
    bloodGroup: string | null
    address: string | null
  }
  isClassTeacher: boolean
  taughtSubjects: string[]
  attendance: {
    pct: number | null
    records: number
    present: number
    absent: number
    late: number
    leave: number
    recent: { date: string; status: string }[]
  }
  academics: {
    latestExam: {
      examId: string
      examName: string
      subjects: { subjectId: string; subjectName: string; marks: number; maxMarks: number; pct: number }[]
      averagePct: number
    } | null
    /** EVERY examination configured for the student's class, newest
     * first, with its honest result state (§7/§12) */
    exams: StudentExamState[]
  }
  fees: {
    status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'NONE'
    totalBilled: number
    totalPaid: number
    outstanding: number
    awaitingVerification: number
    lastPaymentAt: string | null
    items: { id: string; title: string; amount: number; paid: number; outstanding: number; status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE'; dueDate: string | null }[]
    payments: { id: string; txnId: string | null; feeTitle: string; amount: number; method: string | null; status: string; createdAt: string; source: string | null; sourceLabel: string | null; receiptNo: string | null; collectedBy: string | null; verifiedBy: string | null; rejectionReason: string | null }[]
  } | null
  growth: {
    score: GrowthScoreDto | null
    events: GrowthEventItem[]
    feeStanding: FeeStandingDto | null
    presets: { positive: GrowthPreset[]; negative: GrowthPreset[] }
    settings: GrowthSettingsDto
    manualToday: boolean
    manualWeekCategories: string[]
  }
  conversationId: string | null
}

export type ProfileTab = 'overview' | 'attendance' | 'marksheets' | 'fees' | 'growth' | 'guardian'

// ── fetch hook (house discipline: no-store, {ok,data}, 401 → signOut once) ──

let sessionExpiredInFlight = false
function handleExpiredSession(): void {
  if (sessionExpiredInFlight) return
  sessionExpiredInFlight = true
  void signOut().finally(() => {
    window.setTimeout(() => {
      sessionExpiredInFlight = false
    }, 2000)
  })
}

async function fetchProfile(studentId: string): Promise<TeacherStudentProfile> {
  const res = await fetch(`/api/teacher/students/${studentId}`, {
    cache: 'no-store',
    credentials: 'same-origin',
  })
  if (res.status === 401) {
    handleExpiredSession()
    throw new Error('Your session has expired. Please sign in again.')
  }
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON error body */
  }
  const envelope = json as { ok?: unknown; error?: unknown; data?: TeacherStudentProfile } | null
  if (!res.ok || !envelope || envelope.ok !== true || !envelope.data) {
    const message =
      envelope && typeof envelope.error === 'string' && envelope.error
        ? envelope.error
        : `Request failed (${res.status})`
    throw new Error(message)
  }
  return envelope.data
}

// ── small presentational primitives (the shared sheet's own recipe) ──

function CountTile({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card/50 px-2 py-2 text-center">
      <p className={cn('truncate font-display text-lg font-bold tabular-nums', className)}>{value}</p>
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <span className="w-24 shrink-0 text-muted-foreground">{label}:</span>
      <span className="min-w-0 flex-1 break-words font-medium">{value}</span>
    </div>
  )
}

function ageFrom(dob: string | null): string | null {
  if (!dob) return null
  const birth = new Date(dob)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  if (beforeBirthday) years -= 1
  return years >= 0 ? `${years} yrs` : null
}

function attRecordClass(status: string): string {
  switch (status) {
    case 'PRESENT':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'LATE':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    case 'LEAVE':
      return 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
    default:
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
  }
}

function attStatusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

/** The four honest result states of a personal marksheet (§11). */
const EXAM_STATE_META: Record<
  StudentExamState['state'],
  { label: string; cls: string }
> = {
  NOT_STARTED: { label: 'Not started', cls: 'bg-muted text-muted-foreground' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  READY: { label: 'Ready', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  FINALIZED: { label: 'Declared', cls: 'bg-emerald-600 text-white' },
}

// ── the sheet ────────────────────────────────────────────────────────

export function TeacherStudentProfileSheet({
  studentId,
  onOpenChange,
  initialTab,
  onNavigate,
  onChanged,
}: {
  studentId: string | null
  onOpenChange: (open: boolean) => void
  /** which tab is selected when the sheet opens (defaults to Overview). */
  initialTab?: ProfileTab
  onNavigate?: (key: string) => void
  /** notifies the owning module after a mutation (follow-up completed). */
  onChanged?: () => void
}) {
  const [data, setData] = useState<TeacherStudentProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [tab, setTab] = useState<ProfileTab>(initialTab ?? 'overview')
  const [receiptTxnId, setReceiptTxnId] = useState<string | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptAutoPrint, setReceiptAutoPrint] = useState(false)
  const [marksheetDoc, setMarksheetDoc] = useState<MarksheetDocumentPayload | null>(null)
  const [marksheetLoading, setMarksheetLoading] = useState(false)
  const [marksheetError, setMarksheetError] = useState<string | null>(null)
  const [marksheetFetchedFor, setMarksheetFetchedFor] = useState<string | null>(null)
  const [marksheetOpen, setMarksheetOpen] = useState(false)
  const [addPointsOpen, setAddPointsOpen] = useState(false)

  useEffect(() => {
    setTab(initialTab ?? 'overview')
  }, [studentId, initialTab])

  // ── Marks & Results (§12/§29): the ONE canonical marksheet payload feeds
  // BOTH the drawer's read-only exam-wise summary AND the formal A4
  // document — one fetch, zero duplication. Lazy: loads when the tab is
  // first opened (or immediately when opened straight to it).
  useEffect(() => {
    if (!studentId || marksheetFetchedFor === studentId) return
    if (tab !== 'marksheets' && !marksheetOpen) return
    let cancelled = false
    setMarksheetLoading(true)
    setMarksheetError(null)
    fetch(`/api/teacher/students/${studentId}/marksheet`, {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean
          error?: string
          data?: MarksheetDocumentPayload
        } | null
        if (!res.ok || !json || json.ok !== true || !json.data) {
          throw new Error(json?.error || `Request failed (${res.status})`)
        }
        return json.data
      })
      .then((d) => {
        if (cancelled) return
        setMarksheetDoc(d)
        setMarksheetFetchedFor(studentId)
      })
      .catch((e: Error) => {
        if (!cancelled) setMarksheetError(e.message)
      })
      .finally(() => {
        if (!cancelled) setMarksheetLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [studentId, tab, marksheetOpen, marksheetFetchedFor])

  // reset the marksheet document when another student opens
  useEffect(() => {
    setMarksheetDoc(null)
    setMarksheetError(null)
    setMarksheetFetchedFor(null)
    setMarksheetOpen(false)
  }, [studentId])

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    setData(null)
    setError(null)
    fetchProfile(studentId)
      .then((p) => {
        if (!cancelled) setData(p)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [studentId, reload])

  // Add Points from anywhere (§12) — the presets ride along with the
  // profile payload; the compact sheet opens instantly.
  const openAddPoints = useCallback(() => {
    setAddPointsOpen(true)
  }, [])

  const tabs = useMemo<{ key: ProfileTab; label: string }[]>(() => {
    const list: { key: ProfileTab; label: string }[] = [
      { key: 'overview', label: 'Overview' },
      { key: 'attendance', label: 'Attendance' },
      { key: 'marksheets', label: 'Marks & Results' },
    ]
    if (data?.fees && data.fees.status !== 'NONE') list.push({ key: 'fees', label: 'Fee & Receipts' })
    list.push({ key: 'growth', label: 'Growth' })
    list.push({ key: 'guardian', label: 'Guardian' })
    return list
  }, [data])

  const student = data?.student
  const atRisk =
    data != null &&
    ((data.attendance.pct != null && data.attendance.pct < 75) ||
      (data.academics.latestExam != null && data.academics.latestExam.averagePct < 40))

  return (
    <Sheet open={!!studentId} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className={cn('w-full gap-0 sm:max-w-xl', THIN_SCROLLBAR)}
      >
        {/* A11y contract: the title ALWAYS exists — the student's name once
            loaded, a neutral label while the skeleton/error state shows. */}
        <SheetTitle className="sr-only">{student?.name ?? 'Student profile'}</SheetTitle>

        {/* ── identity header (the Principal profile's architecture) ── */}
        <SheetHeader className="border-b border-border px-4 py-4 sm:px-5">
          {error && !data ? (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setReload((r) => r + 1)}>
                Try again
              </Button>
            </div>
          ) : !data || !student ? (
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <GradientAvatar name={student.name} size="xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{student.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    Roll {student.rollNo ?? '—'} · {student.classLabel} · Adm {student.admissionNo ?? '—'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {data.isClassTeacher && (
                      <StatusBadge status="Your class" variant="success" dot />
                    )}
                    {atRisk && <StatusBadge status="At Risk" variant="danger" dot />}
                    {student.gender && (
                      <StatusBadge
                        status={
                          student.gender === 'MALE' ? 'Male' : student.gender === 'FEMALE' ? 'Female' : student.gender
                        }
                        variant="neutral"
                      />
                    )}
                    {student.stream && (
                      <StatusBadge status={student.stream.replace(/-/g, ' ')} variant="neutral" />
                    )}
                  </div>
                </div>
              </div>

              {/* quick metrics — the 3 numbers a teacher needs first */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border bg-card/50 p-2.5 text-center">
                  <p className={cn('font-display text-lg font-bold tabular-nums', attendanceToneClass(data.attendance.pct))}>
                    {data.attendance.pct != null ? `${data.attendance.pct}%` : '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Attendance</p>
                </div>
                <div className="rounded-xl border border-border bg-card/50 p-2.5 text-center">
                  <p
                    className={cn(
                      'font-display text-lg font-bold tabular-nums',
                      data.academics.latestExam
                        ? data.academics.latestExam.averagePct < 40
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground',
                    )}
                  >
                    {data.academics.latestExam ? `${data.academics.latestExam.averagePct}%` : '—'}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">Latest avg</p>
                </div>
                {data.fees ? (
                  <div className="rounded-xl border border-border bg-card/50 p-2.5 text-center">
                    <p className={cn('font-display text-lg font-bold tabular-nums', FEE_STATUS_META[data.fees.status].value)}>
                      {data.fees.status === 'PAID' || data.fees.status === 'NONE'
                        ? 'Clear'
                        : formatINR(data.fees.outstanding, true)}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">Fee balance</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card/50 p-2.5 text-center">
                    <p
                      className={cn(
                        'font-display text-lg font-bold tabular-nums',
                        data.growth.score?.score != null
                          ? scoreTextClass(data.growth.score.score)
                          : 'text-muted-foreground',
                      )}
                    >
                      {data.growth.score?.score != null ? data.growth.score.score : '—'}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">Growth</p>
                  </div>
                )}
              </div>

              {/* tab pills — the Principal profile's tab architecture */}
              <div
                className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Profile sections"
              >
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      'min-h-[34px] shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                      tab === t.key
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </SheetHeader>

        {/* ── tab content ─────────────────────────────────────────── */}
        <div className={cn('flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5', THIN_SCROLLBAR)}>
          {data && student && tab === 'overview' && (
            <div className="space-y-2 rounded-xl border border-border bg-card/40 p-3 text-xs">
              <InfoRow icon={<GraduationCap className="h-3 w-3" />} label="Class" value={student.classLabel} />
              <InfoRow icon={<User className="h-3 w-3" />} label="Roll No" value={student.rollNo ?? 'Not recorded'} />
              <InfoRow icon={<User className="h-3 w-3" />} label="Admission No" value={student.admissionNo ?? 'Not recorded'} />
              {student.email && <InfoRow icon={<Mail className="h-3 w-3" />} label="School Email" value={student.email} />}
              <InfoRow
                icon={<Calendar className="h-3 w-3" />}
                label="Date of Birth"
                value={
                  student.dob
                    ? `${formatDate(student.dob)}${ageFrom(student.dob) ? ` (${ageFrom(student.dob)})` : ''}`
                    : 'Not recorded'
                }
              />
              <InfoRow icon={<Activity className="h-3 w-3" />} label="Blood Group" value={student.bloodGroup ?? 'Not recorded'} />
              <InfoRow icon={<MapPin className="h-3 w-3" />} label="Address" value={student.address ?? 'Not recorded'} />
              {data.taughtSubjects.length > 0 && (
                <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
                  You teach {data.taughtSubjects.join(', ')} to this student&rsquo;s class.
                </p>
              )}
            </div>
          )}

          {data && tab === 'attendance' && (
            data.attendance.records === 0 ? (
              <p className="rounded-xl border border-border bg-card/40 px-3 py-3 text-xs text-muted-foreground">
                No attendance recorded yet.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border bg-card/40 p-2.5 text-center">
                    <p className={cn('font-display text-xl font-bold tabular-nums', attendanceToneClass(data.attendance.pct))}>
                      {data.attendance.pct != null ? `${data.attendance.pct}%` : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Attendance</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card/40 p-2.5 text-center">
                    <p className="font-display text-xl font-bold tabular-nums text-foreground">{data.attendance.records}</p>
                    <p className="text-[10px] text-muted-foreground">Days recorded</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <CountTile label="Present" value={data.attendance.present} className="text-emerald-600 dark:text-emerald-400" />
                  <CountTile label="Absent" value={data.attendance.absent} className="text-rose-600 dark:text-rose-400" />
                  <CountTile label="Late" value={data.attendance.late} className="text-amber-600 dark:text-amber-400" />
                  <CountTile label="On Leave" value={data.attendance.leave} className="text-sky-600 dark:text-sky-400" />
                </div>
                <div className="space-y-1.5 rounded-xl border border-border bg-card/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recent records</p>
                  {data.attendance.recent.map((r, i) => (
                    <div key={`${r.date}-${i}`} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{formatDate(r.date)}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', attRecordClass(r.status))}>
                        {attStatusLabel(r.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )
          )}

          {/* ── MARKS & RESULTS (§1/§12/§29) — the student's current academic
              data, READ-ONLY and exam-wise: every subject with its real
              marks ("—" when not yet entered), no per-exam print buttons,
              no duplicate viewers. ONE action below opens the formal A4
              digital marksheet document. */}
          {data && tab === 'marksheets' && (
            marksheetLoading && !marksheetDoc ? (
              <div className="space-y-2" aria-busy="true">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : marksheetError && !marksheetDoc ? (
              <div className="rounded-xl border border-border bg-card/40 px-3 py-4 text-center">
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{marksheetError}</p>
                <Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={() => setMarksheetFetchedFor(null)}>
                  Try again
                </Button>
              </div>
            ) : !marksheetDoc || marksheetDoc.exams.length === 0 ? (
              <p className="rounded-xl border border-border bg-card/40 px-3 py-3 text-xs text-muted-foreground">
                No examinations are configured for this student&rsquo;s class yet — the result record builds as exams and marks are set up.
              </p>
            ) : (
              <>
                <p className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Examinations · {marksheetDoc.session ?? 'session'}</span>
                  <span>{marksheetDoc.exams.length} on record</span>
                </p>
                <div className="space-y-2">
                  {marksheetDoc.exams.map((ex, i) => {
                    const rows = marksheetDoc.subjects
                      .map((s) => ({ name: s.subjectName, cell: s.cells[i] }))
                      .filter((r) => r.cell != null)
                    return (
                      <div key={ex.examId} className="rounded-xl border border-border bg-card/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-semibold">{ex.examName}</p>
                          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold', EXAM_STATE_META[ex.state].cls)}>
                            {EXAM_STATE_META[ex.state].label}
                          </span>
                        </div>
                        {rows.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {rows.map((r) => (
                              <li key={r.name} className="flex items-baseline justify-between gap-2 text-xs">
                                <span className="min-w-0 truncate text-muted-foreground">{r.name}</span>
                                <span
                                  className={cn(
                                    'shrink-0 tabular-nums',
                                    r.cell.isSubmitted ? 'font-semibold text-foreground' : 'text-muted-foreground/50',
                                  )}
                                >
                                  {r.cell.isSubmitted
                                    ? `${r.cell.obtained != null ? r.cell.obtained : 'AB'}${r.cell.maxMarks != null ? ` / ${r.cell.maxMarks}` : ''}`
                                    : '—'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {ex.percentage != null && (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Percentage{' '}
                            <span className="font-semibold tabular-nums text-foreground">{ex.percentage}%</span>
                            {ex.partial && <span className="text-amber-600 dark:text-amber-400"> (partial)</span>}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* §2/§29 — ONE action: open the formal marksheet document */}
                <Button
                  className="w-full gap-1.5"
                  onClick={() => setMarksheetOpen(true)}
                >
                  <GraduationCap className="h-4 w-4" aria-hidden="true" />
                  View Marksheet
                </Button>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Read-only view of the same canonical marks used by Marks Entry and Results Submission — pending
                  subjects show &ldquo;—&rdquo; and are never invented. The formal marksheet opens as its own document
                  with print / PDF controls.
                </p>
              </>
            )
          )}

          {data && data.fees && data.fees.status !== 'NONE' && tab === 'fees' && (
            <>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/40 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    {data.fees.items.length} fee line{data.fees.items.length === 1 ? '' : 's'} on record
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {data.fees.lastPaymentAt
                      ? `Last payment ${formatDate(data.fees.lastPaymentAt.slice(0, 10))}`
                      : 'No payments recorded yet'}
                  </p>
                </div>
                <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold', FEE_STATUS_META[data.fees.status].chip)}>
                  {FEE_STATUS_META[data.fees.status].label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <CountTile label="Billed" value={formatINR(data.fees.totalBilled, true)} />
                <CountTile label="Paid" value={formatINR(data.fees.totalPaid, true)} className="text-emerald-600 dark:text-emerald-400" />
                <CountTile
                  label="Outstanding"
                  value={formatINR(data.fees.outstanding, true)}
                  className={data.fees.outstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}
                />
              </div>
              {data.fees.awaitingVerification > 0 && (
                <p className="flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                  <Clock3 className="h-3 w-3 shrink-0" />
                  {formatINR(data.fees.awaitingVerification, true)} collected — awaiting the Principal&rsquo;s verification (not counted in the balance)
                </p>
              )}
              <div className="space-y-1.5 rounded-xl border border-border bg-card/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fee lines</p>
                {data.fees.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatINR(item.paid, true)} / {formatINR(item.amount, true)}
                    </span>
                    <span className={cn('w-[74px] shrink-0 rounded-full px-2 py-0.5 text-right text-[10px] font-semibold', FEE_STATUS_META[item.status].chip)}>
                      {FEE_STATUS_META[item.status].label}
                    </span>
                  </div>
                ))}
              </div>
              {data.fees.payments.length > 0 && (
                <div className="space-y-2 rounded-xl border border-border bg-card/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Payment records · {data.fees.payments.length}
                  </p>
                  {data.fees.payments.map((p) => {
                    const pending = p.status === 'UNDER_VERIFICATION'
                    const rejected = p.status === 'REJECTED'
                    const verified = p.status === 'SUCCESS' && !!p.txnId
                    return (
                      <div key={p.id} className="rounded-lg border border-border/70 bg-card px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              <span className="truncate text-xs font-semibold">{p.feeTitle}</span>
                              <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                                {formatINR(p.amount)}
                              </span>
                            </p>
                            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                              {formatDate(p.createdAt.slice(0, 10))}
                              {' · '}{(p.method ?? '—').replace(/_/g, ' ').toLowerCase()}
                              {p.source === 'CLASS_TEACHER'
                                ? p.collectedBy
                                  ? ` · collected by ${p.collectedBy}`
                                  : ' · class teacher'
                                : p.source === 'SCHOOL_OFFICE'
                                  ? p.sourceLabel ? ` · ${p.sourceLabel}` : ' · school office'
                                  : p.source === 'PRINCIPAL'
                                    ? ' · paid through the Principal'
                                    : p.sourceLabel
                                      ? ` · ${p.sourceLabel}`
                                      : ''}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold',
                              verified
                                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : pending
                                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                  : 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400',
                            )}
                          >
                            {verified ? 'Verified' : pending ? 'Pending verification' : 'Rejected'}
                          </span>
                        </div>
                        {/* receipt line — ONLY verified payments carry a
                            final official receipt (§6) */}
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-dashed border-border/70 pt-1.5">
                          {verified ? (
                            <p className="min-w-0 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Receipt className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                              <span className="truncate font-semibold tabular-nums text-foreground">
                                {p.receiptNo ?? `Receipt ${p.txnId!.slice(-8)}`}
                              </span>
                              {p.verifiedBy && <span className="truncate">· verified by {p.verifiedBy}</span>}
                            </p>
                          ) : (
                            <p className="text-[10px] italic text-muted-foreground">
                              {pending ? 'No final receipt yet — awaiting the Principal’s verification.' : 'No receipt — this payment was rejected.'}
                            </p>
                          )}
                          {verified && (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 gap-1 px-1.5 text-[10px]"
                                aria-label="View receipt"
                                onClick={() => {
                                  setReceiptTxnId(p.txnId)
                                  setReceiptAutoPrint(false)
                                  setReceiptOpen(true)
                                }}
                              >
                                <Eye className="h-3 w-3" aria-hidden="true" /> View receipt
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 gap-1 px-1.5 text-[10px]"
                                aria-label="Download receipt (print / save as PDF)"
                                onClick={() => {
                                  setReceiptTxnId(p.txnId)
                                  setReceiptAutoPrint(true)
                                  setReceiptOpen(true)
                                }}
                              >
                                <Download className="h-3 w-3" aria-hidden="true" /> Download
                              </Button>
                            </div>
                          )}
                        </div>
                        {rejected && p.rejectionReason && (
                          <p className="mt-1 line-clamp-2 text-[10px] text-rose-600 dark:text-rose-400">
                            Reason: {p.rejectionReason}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {data && tab === 'growth' && (
            <>
              {/* the score — ring + month delta + dimensions (§13) */}
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
                  <GrowthScoreRing
                    score={data.growth.score?.score ?? null}
                    monthDelta={data.growth.score?.monthDelta ?? 0}
                    size={104}
                  />
                  <div className="w-full min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Growth Score
                      </span>
                      <MonthDeltaChip monthDelta={data.growth.score?.monthDelta ?? 0} />
                    </div>
                    {data.growth.score ? (
                      <GrowthDimensions dimensions={data.growth.score.dimensions} columns />
                    ) : (
                      <p className="text-center text-xs text-muted-foreground sm:text-left">
                        Building from attendance and academic records.
                      </p>
                    )}
                  </div>
                </div>
                {data.growth.score?.score == null && (
                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    Not enough records yet — the score appears once attendance and marks build up.
                  </p>
                )}
                {data.growth.score && (
                  <p className="mt-3 border-t border-border pt-2 text-center text-[10px] text-muted-foreground">
                    Ledger: {signedDelta(data.growth.score.totalPoints)} lifetime points ·{' '}
                    {data.growth.score.eventCount} events · {signedDelta(data.growth.score.monthDelta)} this month
                  </p>
                )}
              </div>

              {/* fee standing — administrative, ALWAYS separate (§23) */}
              {data.growth.feeStanding && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/40 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">Fee standing</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {data.growth.feeStanding.detail} Never part of the growth score.
                    </p>
                  </div>
                  <FeeStandingChip standing={data.growth.feeStanding} />
                </div>
              )}

              {/* recent point activity (§13 — same canonical ledger) */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Recent activity
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {data.growth.events.length} event{data.growth.events.length === 1 ? '' : 's'}
                  </span>
                </div>
                <ActivityList
                  events={data.growth.events}
                  currentUserId={null}
                  onCorrected={() => {
                    setReload((r) => r + 1)
                    onChanged?.()
                  }}
                  emptyHint="Points from teachers, attendance and exams will appear here."
                />
              </div>

              <button type="button" onClick={openAddPoints} className={cn(PRIMARY_ACTION_CLASS, 'w-full justify-center')}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add Points
              </button>

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false)
                    onNavigate('growth')
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/30"
                >
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  View full growth history
                </button>
              )}
            </>
          )}

          {data && student && tab === 'guardian' && (
            <>
              <div className="space-y-2 rounded-xl border border-border bg-card/40 p-3 text-xs">
                <InfoRow icon={<Users className="h-3 w-3" />} label="Guardian" value={student.guardianName ?? 'Not recorded'} />
                <InfoRow icon={<Phone className="h-3 w-3" />} label="Phone" value={student.guardianPhone ?? 'Not recorded'} />
              </div>
              {data.conversationId && onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false)
                    onNavigate('communication')
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/30"
                >
                  <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  Message parent in Communication Hub
                </button>
              )}
            </>
          )}
        </div>
      </SheetContent>

      {/* the SAME receipt viewer the fee workspace and the Principal's
          queue open (canonical payment, canonical document) — with the
          download shortcut when opened via "Download" (§6) */}
      <FeeReceiptViewer txnId={receiptTxnId} open={receiptOpen} onOpenChange={setReceiptOpen} autoPrint={receiptAutoPrint} />

      {/* the student's FORMAL DIGITAL MARKSHEET (§25) — the ONE canonical
          A4 document viewer, fed by the same payload as the read-only
          Marks & Results tab. Print / Save PDF lives INSIDE it, gated by
          the result state (§24). */}
      {marksheetDoc && (
        <StudentMarksheetViewer
          data={marksheetDoc}
          open={marksheetOpen}
          onOpenChange={setMarksheetOpen}
        />
      )}

      {/* Add Points — the same compact sheet the Growth module uses, with
          this student preselected (presets ride along with the payload) */}
      {data && student && (
        <AddPointsDialog
          open={addPointsOpen}
          onOpenChange={setAddPointsOpen}
          students={[
            {
              id: student.id,
              name: student.name,
              rollNo: student.rollNo,
              classLabel: student.classLabel,
              manualToday: data.growth.manualToday,
              manualWeekCategories: data.growth.manualWeekCategories,
            },
          ]}
          presets={data.growth.presets}
          settings={data.growth.settings}
          prefillStudent={{
            id: student.id,
            name: student.name,
            rollNo: student.rollNo,
            classLabel: student.classLabel,
            manualToday: data.growth.manualToday,
            manualWeekCategories: data.growth.manualWeekCategories,
          }}
          onCreated={() => {
            setReload((r) => r + 1)
            onChanged?.()
          }}
        />
      )}
    </Sheet>
  )
}
