'use client'

/**
 * ProfileModule — the STUDENT's own profile, canonical-data edition.
 *
 * Product principle (final simplification pass): a student needs
 * "Who am I? · How am I doing? · Where are my important records?" —
 * NOT a mirrored copy of the Principal's administrative record.
 *
 * DATA SOURCES (stabilization §8/§10 — ONE canonical student record):
 *   · Identity: /api/auth/me → me.student (the DB Student row). The
 *     retired client-side demo roster (STU-58 · Class 2-A) is no longer
 *     consulted anywhere — unknown fields render '—', never fabricated.
 *   · Attendance: /api/student/attendance (the rows staff write).
 *   · Results: /api/student/results (declared Exam + Result rows).
 *   · Fees: /api/student/fees (the Fee/FeeTransaction ledger).
 *   · Transport: /api/student/transport (the Route/Vehicle rows).
 *
 * Structure:
 *   1. Identity card (avatar, name, Active, Class · Roll, View School ID)
 *   2. ONE academic snapshot (live canonical figures)
 *   3. Three tabs: Personal · Parents · Records
 *   4. A compact "My Responsibility" strip (only while a position is
 *      ACTIVE for THIS student — canonical session-scoped resolver)
 */

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  User, Phone, Calendar, Droplet, Crown, GraduationCap,
  Activity, TrendingUp, IndianRupee, IdCard, Award, Bus,
  ChevronRight, ClipboardList, ShieldCheck, Users,
} from 'lucide-react'
import { GlassCard, StatusBadge, GradientAvatar } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { computeStats } from '@/lib/store/student-attendance-store'
import { useMyServerAttendance } from '@/hooks/use-my-attendance'
import { POSITION_DEFS, filterActivePositions } from '@/lib/student-positions'
import { useAcademicSession, ACTIVE_SESSION_ID, formatSessionLabel } from '@/lib/academic-session'
import { useStudentsStore } from '@/lib/store/students-store'
import { useCurrentUser } from '@/lib/store/current-user-store'
import { formatDate } from '@/lib/format'
import { StudentIdCardDialog } from '@/components/student/shell/student-id-card'
import {
  useCanonicalStudent, useMyServerFees, useMyServerResults, useMyServerTransport,
} from './shared/canonical'

const TABS = [
  { key: 'personal', label: 'Personal' },
  { key: 'parents', label: 'Parents' },
  { key: 'records', label: 'Records' },
] as const
type TabKey = (typeof TABS)[number]['key']

export function ProfileModule({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const [activeTab, setActiveTab] = useState<TabKey>('personal')
  const [idOpen, setIdOpen] = useState(false)

  // ── Canonical identity — server session truth ────────────────────────
  const { student, resolving } = useCanonicalStudent()
  const me = useCurrentUser((s) => s.me)
  const displayName = me?.name || 'Student'
  const initials =
    displayName === 'Student'
      ? '·'
      : displayName.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  // STU-ATT — attendance derives LIVE from the server's canonical
  // attendance records (the same rows Teacher/Principal write).
  const { records: myAttendance, loading: attendanceLoading } = useMyServerAttendance()
  const attendancePct = useMemo(() => computeStats(myAttendance).percent, [myAttendance])

  // STU-RES — declared exam history from the server's Result rows.
  const { latest: latestExam, loading: resultsLoading } = useMyServerResults()

  // Live fee figures — the ONE server fee ledger (same derivation as the
  // Fees module: outstanding = billed − verified paid).
  const { ledger, loading: feesLoading } = useMyServerFees()
  const feeStatus =
    ledger == null ? '—'
    : ledger.totals.outstanding <= 0 && ledger.totals.billed > 0 ? 'Paid'
    : ledger.totals.paid > 0 ? 'Partial'
    : ledger.totals.billed > 0 ? 'Pending'
    : '—'

  // Transport — the student's own route assignment (server).
  const { assigned: hasTransport, route: transportRoute } = useMyServerTransport()

  // Positions held by THIS student — only ACTIVE ones in the live session
  // surface (RB-1 canonical resolver, keyed to the canonical student id).
  const sessionId = useAcademicSession().id
  const allPositions = useStudentsStore((st) => st.studentPositions)
  const positions = useMemo(
    () => (student ? filterActivePositions(allPositions, student.studentId, sessionId) : []),
    [allPositions, student, sessionId],
  )

  if (resolving) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading profile" />
      </div>
    )
  }

  if (!student) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="text-sm font-semibold">Student record unavailable</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your account is not linked to a student record. Please contact the school office.
        </p>
      </GlassCard>
    )
  }

  const s = student // alias for readability below

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl">
      {/* ── Identity card — flat institutional surface, no banner ────── */}
      <GlassCard className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="relative shrink-0 mx-auto sm:mx-0"
          >
            <div className="flex h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl sm:text-2xl font-extrabold shadow-premium-lg ring-1 ring-emerald-500/25">
              {initials}
            </div>
            <span
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white border-[3px] border-background"
              title="Active student"
              aria-label="Active student"
            >
              <ShieldCheck className="h-2.5 w-2.5" />
            </span>
          </motion.div>

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight truncate">{displayName}</h2>
              <StatusBadge status="Active" variant="success" dot />
              {positions.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                >
                  <Crown className="h-3 w-3" />
                  {POSITION_DEFS[p.key]?.short ?? 'Monitor'}
                </span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-1.5">
              {s.classLabel ?? '—'}{s.rollNo ? ` · Roll #${s.rollNo}` : ''}
            </p>
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">
              {s.admissionNo ? `Admission No ${s.admissionNo} · ` : ''}{formatSessionLabel(ACTIVE_SESSION_ID)}
            </p>
          </div>

          <div className="shrink-0 mx-auto sm:mx-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setIdOpen(true)}
            >
              <IdCard className="h-4 w-4" /> View School ID
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ── Academic snapshot (ONE compact card, canonical data) ───── */}
      <GlassCard className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-violet-500" /> Academic Snapshot
          </h3>
          <span className="text-[11px] text-muted-foreground">{formatSessionLabel(ACTIVE_SESSION_ID)}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-0 sm:divide-x sm:divide-border">
          <SnapshotStat
            label="Attendance"
            value={attendanceLoading ? '…' : myAttendance.length === 0 ? '—' : `${attendancePct}%`}
            icon={<Activity className="h-4 w-4" />}
            color="text-emerald-600 dark:text-emerald-400"
            bg="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          {latestExam ? (
            <SnapshotStat
              label="Last Exam"
              value={`${latestExam.pct != null ? latestExam.pct : '—'}%`}
              icon={<GraduationCap className="h-4 w-4" />}
              color="text-violet-600 dark:text-violet-400"
              bg="bg-violet-500/10 text-violet-600 dark:text-violet-400"
            />
          ) : (
            <SnapshotStat
              label="Last Exam"
              value={resultsLoading ? '…' : 'Awaited'}
              icon={<GraduationCap className="h-4 w-4" />}
              color="text-muted-foreground"
              bg="bg-muted text-muted-foreground"
            />
          )}
          {latestExam?.rank ? (
            <SnapshotStat
              label="Class Rank"
              value={`#${latestExam.rank.position}`}
              icon={<TrendingUp className="h-4 w-4" />}
              color="text-amber-600 dark:text-amber-400"
              bg="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            />
          ) : (
            <SnapshotStat
              label="Class Rank"
              value="—"
              icon={<TrendingUp className="h-4 w-4" />}
              color="text-muted-foreground"
              bg="bg-muted text-muted-foreground"
            />
          )}
          <SnapshotStat
            label="Fees"
            value={feesLoading ? '…' : feeStatus}
            icon={<IndianRupee className="h-4 w-4" />}
            color={feeStatus === 'Paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
            bg={feeStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}
          />
        </div>
      </GlassCard>

      {/* ── Tabs: Personal · Parents · Records ─────────────────────────── */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto pb-2" role="tablist" aria-label="Profile sections">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                activeTab === tab.key
                  ? 'bg-white dark:bg-white/10 shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {activeTab === 'personal' && <PersonalTab student={s} />}
        {activeTab === 'parents' && <ParentsTab student={s} />}
        {activeTab === 'records' && (
          <RecordsTab
            latestExam={latestExam}
            resultsLoading={resultsLoading}
            hasTransport={hasTransport}
            transportRouteName={transportRoute?.name ?? null}
            onNavigate={onNavigate}
          />
        )}
      </motion.div>

      {/* ── My Responsibility (compact — only while position is ACTIVE) ── */}
      {positions.length > 0 && onNavigate && (
        <GlassCard className="p-4 border-primary/20">
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
              <Crown className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {POSITION_DEFS[positions[0].key]?.title ?? 'Class Monitor'} · {s.classLabel ?? 'My Class'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Since {formatDate(positions[0].assignedOn)} · appointed by {positions[0].assignedByName}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => onNavigate('my-class')}
            >
              Open My Class <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </GlassCard>
      )}

      {/* ── School ID — school-configured institutional card (§27–28) ── */}
      <StudentIdCardDialog open={idOpen} onOpenChange={setIdOpen} student={s} displayName={displayName} active={me?.status !== 'SUSPENDED'} />
    </div>
  )
}

/** Display name comes from the session user (me.name) — the Student row
 *  itself carries no name column. */

// ══════════════════════════════════════════════════════════════════════
// Building blocks
// ══════════════════════════════════════════════════════════════════════

function SnapshotStat({ label, value, icon, color, bg }: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  bg: string
}) {
  return (
    <div className="flex items-center gap-2.5 sm:flex-col sm:items-center sm:text-center sm:gap-1 sm:px-2">
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', bg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn('text-sm font-bold truncate', color)}>{value}</p>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value, accent }: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', accent)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate" title={value}>{value}</p>
      </div>
    </div>
  )
}

/** ── Personal: only the genuinely useful personal information ────────── */
function PersonalTab({ student: s }: { student: ReturnType<typeof useCanonicalStudent>['student'] }) {
  if (!s) return null
  const rows = [
    { label: 'Date of Birth', value: s.dob ? formatDate(s.dob) : '—', icon: <Calendar className="h-4 w-4" />, accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
    { label: 'Gender', value: s.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1).toLowerCase() : '—', icon: <User className="h-4 w-4" />, accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
    { label: 'Blood Group', value: s.bloodGroup ?? '—', icon: <Droplet className="h-4 w-4" />, accent: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
    { label: 'Admission No', value: s.admissionNo ?? '—', icon: <ClipboardList className="h-4 w-4" />, accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  ]
  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {rows.map((r) => (
          <InfoRow key={r.label} icon={r.icon} label={r.label} value={r.value} accent={r.accent} />
        ))}
      </div>
      {s.address && (
        <div className="mt-2.5">
          <InfoRow icon={<Users className="h-4 w-4" />} label="Address" value={s.address} accent="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground mt-3.5 flex items-center gap-1.5">
        <ShieldCheck className="h-3 w-3 shrink-0 text-primary" />
        These details are school-managed — ask the school office for corrections.
      </p>
    </GlassCard>
  )
}

/** ── Parents & Guardian: server guardian particulars only ───────────── */
function ParentsTab({ student: s }: { student: ReturnType<typeof useCanonicalStudent>['student'] }) {
  if (!s) return null
  const guardianName = s.guardianName ?? '—'
  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3">
          <GradientAvatar name={guardianName} size="lg" gradient="from-violet-400 to-purple-500" />
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">Guardian</p>
            <p className="text-sm font-semibold truncate">{guardianName}</p>
          </div>
        </div>
        <InfoRow icon={<Phone className="h-4 w-4" />} label="Guardian Phone" value={s.guardianPhone ?? '—'} accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
      </div>
      <p className="text-[11px] text-muted-foreground mt-3.5 flex items-center gap-1.5">
        <ShieldCheck className="h-3 w-3 shrink-0 text-primary" />
        Contact details are shared with you as permitted by the school.
      </p>
    </GlassCard>
  )
}

/** ── Records: only rows whose data actually exists; each deep-links ──── */
function RecordsTab({ latestExam, resultsLoading, hasTransport, transportRouteName, onNavigate }: {
  latestExam: { examName: string; pct: number | null; rank: { position: number; assessedCount: number } | null } | null
  resultsLoading: boolean
  hasTransport: boolean
  transportRouteName: string | null
  onNavigate?: (key: string) => void
}) {
  const rows: {
    key: string
    icon: React.ReactNode
    iconClass: string
    title: string
    value: string
  }[] = []

  // Latest declared result (the same server source as the Results module)
  if (latestExam) {
    rows.push({
      key: 'results',
      icon: <ClipboardList className="h-4 w-4" />,
      iconClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      title: 'Academic Records',
      value: `${latestExam.pct != null ? `${latestExam.pct}%` : 'Declared'}${latestExam.rank ? ` · Rank #${latestExam.rank.position}` : ''} · ${latestExam.examName}`,
    })
  } else if (!resultsLoading) {
    // no declared results yet — nothing to link (honest absence)
  }

  // Transport — only if the student has a route assignment
  if (hasTransport && transportRouteName) {
    rows.push({
      key: 'bus',
      icon: <Bus className="h-4 w-4" />,
      iconClass: 'bg-lime-500/10 text-lime-700 dark:text-lime-400',
      title: 'Transport',
      value: transportRouteName,
    })
  }

  if (rows.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <Award className="h-8 w-8 mx-auto text-muted-foreground/50" />
        <p className="text-sm font-semibold mt-2">No records yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Results, certificates and transport records will appear here as the school publishes them.
        </p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-2 sm:p-3">
      <div className="divide-y divide-border">
        {rows.map((r, i) => (
          <motion.button
            key={r.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            disabled={!onNavigate}
            onClick={() => onNavigate?.(r.key)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors',
              onNavigate && 'hover:bg-accent/50 cursor-pointer',
            )}
          >
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', r.iconClass)}>
              {r.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{r.title}</p>
              <p className="text-xs text-muted-foreground truncate">{r.value}</p>
            </div>
            {onNavigate && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </motion.button>
        ))}
      </div>
    </GlassCard>
  )
}
