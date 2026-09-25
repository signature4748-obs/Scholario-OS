'use client'

/**
 * shared/student-profile-sheet — the ONE teacher-facing student profile
 * (master task §6/§25). Opened from the Student Directory, My Class,
 * Fees & Payments and Student Behavior — the SAME canonical student, the
 * SAME architecture the Principal's profile uses (identity header →
 * quick metrics → tab pills → sections), with role-appropriate
 * visibility decided by the SERVER:
 *
 *   · Overview      identity + class info (real Student/User rows)
 *   · Attendance    canonical summary + counts + recent records
 *   · Academics     latest exam with entered marks, per subject
 *   · Fees          class-teacher classes ONLY (subject teachers never
 *                   see a family's money — the payload simply omits it)
 *   · Behavior      records visible to THIS teacher + open follow-ups
 *                   (private staff notes stay inside the staff surface)
 *   · Guardian      guardian contact + the parent conversation link
 *
 * Fetch-on-open: GET /api/teacher/students/[studentId] re-validates the
 * teacher's scope on every request. Nothing is fabricated — missing
 * records render honest "Not recorded" states.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Award,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Mail,
  MapPin,
  MessagesSquare,
  Phone,
  Plus,
  Receipt,
  Shield,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { GradientAvatar, StatusBadge } from '@/components/shared/ui'
import { FeeReceiptViewer } from '@/components/shared/fee-collection/receipt-viewer'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatDate, formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/signout'
import type { BehaviorCategoryItem, BehaviorRecordItem, FollowUpItem } from '@/lib/teacher-hub-types'
import { FEE_STATUS_META, attendanceToneClass } from '../students/shared'
import { TYPE_CONFIG, STATUS_CONFIG, categoryLabelOf, compactDate, dueState, PRIMARY_ACTION_CLASS } from '../student-behavior/shared'
import { RecordDialog } from '../student-behavior/record-dialog'

const THIN_SCROLLBAR =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent'

// ── payload contract (mirrors GET /api/teacher/students/[studentId]) ──

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
  behavior: {
    records: BehaviorRecordItem[]
    counts: { positive: number; observation: number; concern: number; open: number }
    followUps: FollowUpItem[]
  }
  conversationId: string | null
}

export type ProfileTab = 'overview' | 'attendance' | 'academics' | 'fees' | 'behavior' | 'guardian'

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
  const [recordOpen, setRecordOpen] = useState(false)
  const [categories, setCategories] = useState<BehaviorCategoryItem[] | null>(null)

  useEffect(() => {
    setTab(initialTab ?? 'overview')
  }, [studentId, initialTab])

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
    // the school's behavior taxonomy rides along (tiny payload) so the
    // Behavior tab resolves real category labels from the first render
    if (!categories) {
      fetch('/api/teacher/behavior/categories', { cache: 'no-store', credentials: 'same-origin' })
        .then((r) => r.json() as Promise<{ ok?: boolean; data?: { categories: BehaviorCategoryItem[] } }>)
        .then((json) => {
          if (!cancelled && json.ok && json.data) setCategories(json.data.categories)
        })
        .catch(() => {
          /* labels fall back to the raw keys */
        })
    }
    return () => {
      cancelled = true
    }
  }, [studentId, reload, categories])

  // Record Observation from anywhere (§12) — the taxonomy is already
  // loaded with the profile; the dialog opens instantly.
  const openRecordDialog = useCallback(() => {
    setRecordOpen(true)
  }, [])

  const completeFollowUp = async (id: string) => {
    try {
      const res = await fetch(`/api/teacher/follow-ups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status: 'done' }),
      })
      if (!res.ok) throw new Error('Could not complete the follow-up')
      setReload((r) => r + 1)
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete the follow-up')
    }
  }

  const tabs = useMemo<{ key: ProfileTab; label: string }[]>(() => {
    const list: { key: ProfileTab; label: string }[] = [
      { key: 'overview', label: 'Overview' },
      { key: 'attendance', label: 'Attendance' },
      { key: 'academics', label: 'Academics' },
    ]
    if (data?.fees && data.fees.status !== 'NONE') list.push({ key: 'fees', label: 'Fees' })
    list.push({ key: 'behavior', label: 'Behavior' })
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
                    <p className="font-display text-lg font-bold tabular-nums text-muted-foreground">
                      {data.behavior.counts.open > 0 ? data.behavior.counts.open : '0'}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">Open concerns</p>
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

          {data && tab === 'academics' && (
            data.academics.latestExam == null ? (
              <p className="rounded-xl border border-border bg-card/40 px-3 py-3 text-xs text-muted-foreground">
                No exam marks entered for this student yet.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/40 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{data.academics.latestExam.examName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Latest exam with entered marks · {data.academics.latestExam.subjects.length}{' '}
                      subject{data.academics.latestExam.subjects.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <p
                    className={cn(
                      'font-display text-lg font-bold tabular-nums',
                      data.academics.latestExam.averagePct < 40
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400',
                    )}
                  >
                    {data.academics.latestExam.averagePct}%
                  </p>
                </div>
                <div className="space-y-1.5 rounded-xl border border-border bg-card/40 p-3">
                  {data.academics.latestExam.subjects.map((sub) => (
                    <div key={sub.subjectId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium">{sub.subjectName}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {sub.marks} / {sub.maxMarks}
                      </span>
                      <span
                        className={cn(
                          'w-11 shrink-0 rounded-full px-2 py-0.5 text-right text-[10px] font-semibold tabular-nums',
                          sub.pct < 40
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        {sub.pct}%
                      </span>
                    </div>
                  ))}
                </div>
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
                <div className="space-y-1.5 rounded-xl border border-border bg-card/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recent payments</p>
                  {data.fees.payments.map((p) => {
                    const pending = p.status === 'UNDER_VERIFICATION'
                    const rejected = p.status === 'REJECTED'
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="min-w-0 truncate font-medium">{p.feeTitle}</span>
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[9px] font-semibold',
                                pending
                                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                  : rejected
                                    ? 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                                    : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                              )}
                            >
                              {pending ? 'Awaiting verification' : rejected ? 'Rejected' : p.txnId ? 'Verified' : 'Paid'}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {formatDate(p.createdAt.slice(0, 10))} · {(p.method ?? '—').replace('_', ' ').toLowerCase()}
                            {p.txnId
                              ? p.source === 'CLASS_TEACHER'
                                ? p.collectedBy
                                  ? ` · collected by ${p.collectedBy}`
                                  : ' · class teacher'
                                : p.source === 'SCHOOL_OFFICE'
                                  ? ' · paid through School Office'
                                  : p.source === 'PRINCIPAL'
                                    ? ' · paid through the Principal'
                                    : ''
                              : p.sourceLabel
                                ? ` · ${p.sourceLabel}`
                                : ''}
                            {p.receiptNo ? ` · receipt ${p.receiptNo}` : ''}
                          </p>
                          {rejected && p.rejectionReason && (
                            <p className="mt-0.5 line-clamp-2 text-[10px] text-rose-600 dark:text-rose-400">
                              Reason: {p.rejectionReason}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={cn(
                              'tabular-nums font-semibold',
                              rejected
                                ? 'text-rose-600 line-through dark:text-rose-400'
                                : pending
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-emerald-600 dark:text-emerald-400',
                            )}
                          >
                            {formatINR(p.amount, true)}
                          </span>
                          {p.txnId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              aria-label="View payment document"
                              onClick={() => {
                                setReceiptTxnId(p.txnId)
                                setReceiptOpen(true)
                              }}
                            >
                              <Receipt className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {data && tab === 'behavior' && (
            <>
              <div className="grid grid-cols-4 gap-2">
                <CountTile label="Positive" value={data.behavior.counts.positive} className="text-emerald-600 dark:text-emerald-400" />
                <CountTile label="Observations" value={data.behavior.counts.observation} className="text-sky-600 dark:text-sky-400" />
                <CountTile label="Concerns" value={data.behavior.counts.concern} className="text-rose-600 dark:text-rose-400" />
                <CountTile
                  label="Open"
                  value={data.behavior.counts.open}
                  className={data.behavior.counts.open > 0 ? 'text-rose-600 dark:text-rose-400' : undefined}
                />
              </div>

              {data.behavior.followUps.length > 0 && (
                <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Your open follow-ups
                  </p>
                  {data.behavior.followUps.map((f) => {
                    const state = dueState(f.dueDate)
                    return (
                      <div key={f.id} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{f.reason}</p>
                          <p className={cn('text-[10px]', state === 'overdue' ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
                            Due {compactDate(f.dueDate)}
                            {state === 'overdue' ? ' · overdue' : state === 'today' ? ' · today' : ''}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 shrink-0 px-2.5 text-[11px]" onClick={() => completeFollowUp(f.id)}>
                          <CheckCircle2 className="h-3 w-3" /> Complete
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}

              {data.behavior.records.length === 0 ? (
                <p className="rounded-xl border border-border bg-card/40 px-3 py-3 text-xs text-muted-foreground">
                  No behavior records for this student yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.behavior.records.map((r) => {
                    const cfg = TYPE_CONFIG[r.type]
                    const status = STATUS_CONFIG[r.status]
                    return (
                      <div key={r.id} className={cn('rounded-lg border border-border border-l-2 bg-card/40 p-2.5', cfg.border)}>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className={cn('flex items-center gap-1 font-semibold', cfg.text)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                            {cfg.label}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-medium text-muted-foreground">
                            {categoryLabelOf(categories ?? [], r.category)}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{compactDate(r.date)}</span>
                          <span className={cn('ml-auto flex items-center gap-1 font-semibold', status.text)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed">{r.description}</p>
                        {r.actionTaken && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            <span className="font-medium">Action:</span> {r.actionTaken}
                          </p>
                        )}
                        {r.privateNote && (
                          <p className="mt-1.5 rounded-md bg-muted/60 px-2 py-1 text-[11px] italic text-muted-foreground">
                            Staff note — {r.privateNote}
                          </p>
                        )}
                        <p className="mt-1.5 text-[10px] text-muted-foreground">Recorded by {r.recordedBy?.name ?? 'Staff'}</p>
                      </div>
                    )
                  })}
                </div>
              )}

              <button type="button" onClick={openRecordDialog} className={cn(PRIMARY_ACTION_CLASS, 'w-full justify-center')}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Record Observation
              </button>
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
          queue open (canonical payment, canonical document) */}
      <FeeReceiptViewer txnId={receiptTxnId} open={receiptOpen} onOpenChange={setReceiptOpen} />

      {/* Record Observation — the same dialog the Behavior module uses,
          with this student preselected (categories lazily fetched) */}
      {data && student && (
        <RecordDialog
          open={recordOpen}
          onOpenChange={setRecordOpen}
          students={[
            {
              id: student.id,
              name: student.name,
              rollNo: student.rollNo,
              classLabel: student.classLabel,
              classId: student.classId,
            },
          ]}
          categories={categories ?? []}
          prefillStudent={{
            id: student.id,
            name: student.name,
            rollNo: student.rollNo,
            classLabel: student.classLabel,
            classId: student.classId,
          }}
          onCreated={() => setReload((r) => r + 1)}
        />
      )}
    </Sheet>
  )
}
