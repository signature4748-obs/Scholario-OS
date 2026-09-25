'use client'

/**
 * class-hub/index — the CLASS TEACHER'S COMMAND CENTER (spec §5–§29).
 *
 * This is not "another dashboard" — it is the orchestration layer over
 * the canonical systems (attendance, marks, fees, growth, documents) for
 * the classes the signed-in teacher is actually appointed class teacher
 * of (Class.classTeacherId — the same server truth that gates the
 * sidebar group). Composition:
 *
 *   · hub header — identity + appointment + room + student search +
 *     the compact class selector (multi-class teachers) + quick actions;
 *   · CLASS OVERVIEW — the 7 KPI tiles (§7);
 *   · nine management sections in the §29 order — attendance, class
 *     performance, directory, ranking, fees, results, marksheets &
 *     certificates, growth, attendance report — each a hairline
 *     table/list inside one SectionCard (§30), each with a deep link
 *     that opens the canonical module with THIS class preselected;
 *   · four detail drawers — performance, ranking, attendance report and
 *     the printable marksheet.
 *
 * A teacher without an appointment never reaches this module (the
 * sidebar group does not exist for them); a direct deep-link lands on
 * the honest empty state below. Every section re-checks its own
 * authorization server-side anyway.
 */

import { useMemo, useState } from 'react'
import {
  AlertTriangle, BarChart3, CalendarCheck, DoorOpen, FileText,
  GraduationCap, IndianRupee, RefreshCw, School, Search, TrendingUp,
  Users, Wallet, BadgeCheck,
} from 'lucide-react'
import { PageTransition } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFocusStore } from '@/lib/store/focus-store'
import { GlassCard } from '@/components/shared/ui'
import { formatINR } from '@/lib/format'
import { HubEmptyState, HubModuleSkeleton, HubStatCards, type HubStat } from '../shared/hub-stat-cards'
import { ClassSelect } from '../shared/class-select'
import { TeacherStudentProfileSheet } from '../shared/student-profile-sheet'
import { useClassHub, useClassHubDetail } from './hooks'
import type { ClassHubClass } from './types'
import {
  AttendanceSection,
  DirectorySection,
  DocumentsSection,
  FeesSection,
  GrowthSection,
  PerformanceSection,
  RankingSection,
  ReportSection,
  ResultsSection,
} from './sections'
import {
  MarksheetDrawer, PerformanceDrawer,
  RankingDrawer, ReportDrawer,
} from './detail-drawers'

type DrawerKind = 'performance' | 'ranking' | 'report' | null
export function ClassHubModule({ onNavigate }: { onNavigate: (key: string) => void }) {
  const { data, error, reload } = useClassHub()
  const [classId, setClassId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<DrawerKind>(null)
  const [marksheetExam, setMarksheetExam] = useState<{ examId: string; examName: string } | null>(null)

  // ── module-level states (the hooks above always run) ─────────────────

  if (error) {
    return (
      <PageTransition>
        <GlassCard hover={false}>
          <HubEmptyState
            icon={AlertTriangle}
            title="Couldn't load your class hub"
            hint={error}
            action={
              <Button size="sm" onClick={reload}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
              </Button>
            }
          />
        </GlassCard>
      </PageTransition>
    )
  }

  if (!data) {
    return (
      <PageTransition aria-busy="true">
        <HubModuleSkeleton />
      </PageTransition>
    )
  }

  if (data.classes.length === 0) {
    return (
      <PageTransition>
        <GlassCard hover={false}>
          <HubEmptyState
            icon={School}
            title="You are not a class teacher right now"
            hint="The Class Teacher Hub appears automatically when the principal appoints you class teacher of a class."
          />
        </GlassCard>
      </PageTransition>
    )
  }

  return (
    <ClassHubLoaded
      classes={data.classes}
      reload={reload}
      classId={classId}
      setClassId={setClassId}
      search={search}
      setSearch={setSearch}
      profileStudentId={profileStudentId}
      setProfileStudentId={setProfileStudentId}
      drawer={drawer}
      setDrawer={setDrawer}
      marksheetExam={marksheetExam}
      setMarksheetExam={setMarksheetExam}
      onNavigate={onNavigate}
    />
  )
}

function ClassHubLoaded({
  classes, reload, classId, setClassId, search, setSearch,
  profileStudentId, setProfileStudentId, drawer, setDrawer,
  marksheetExam, setMarksheetExam, onNavigate,
}: {
  classes: ClassHubClass[]
  reload: () => void
  classId: string | null
  setClassId: (id: string | null) => void
  search: string
  setSearch: (s: string) => void
  profileStudentId: string | null
  setProfileStudentId: (id: string | null) => void
  drawer: DrawerKind
  setDrawer: (d: DrawerKind) => void
  marksheetExam: { examId: string; examName: string } | null
  setMarksheetExam: (m: { examId: string; examName: string } | null) => void
  onNavigate: (key: string) => void
}) {
  const active = classes.find((c) => c.classId === classId) ?? classes[0]
  const detail = useClassHubDetail(active.classId, 0)

  /** Deep-link helper: open a canonical module with THIS class focused.
   *  (The Student Growth module consumes its own 'growth-class' focus type;
   *  every other module consumes the generic 'class' type.) */
  const openModuleForClass = (moduleKey: string) => {
    useFocusStore.getState().setFocus({
      type: moduleKey === 'growth' ? 'growth-class' : 'class',
      id: active.classId,
      title: active.label,
      subtitle: 'Opened from My Class',
      moduleKey,
    })
    onNavigate(moduleKey)
  }

  const rosterIds = useMemo(() => detail.data?.directory.map((d) => d.studentId) ?? [], [detail.data])

  // ── the 7 KPI tiles (§7) — one compact information-dense row ────────
  const fees = active.fees
  const collectionPct = fees.totalBilled > 0 ? Math.round((fees.totalCollected / fees.totalBilled) * 100) : null
  const kpis: HubStat[] = [
    {
      key: 'students',
      label: 'Students',
      value: active.studentCount,
      icon: Users,
      tone: 'slate',
    },
    {
      key: 'attendance',
      label: 'Attendance',
      value: detail.data?.attendanceReport.overall.ratePct != null ? `${detail.data.attendanceReport.overall.ratePct}%` : null,
      icon: CalendarCheck,
      tone: 'emerald',
      context: detail.data ? `last 30 days · ${detail.data.attendanceReport.overall.markedDays} days` : undefined,
    },
    {
      key: 'growth',
      label: 'Growth',
      value: active.growth.average,
      icon: TrendingUp,
      tone: 'emerald',
      context:
        active.growth.scoredCount < active.studentCount
          ? `${active.growth.scoredCount} of ${active.studentCount} scored`
          : `all ${active.studentCount} scored`,
    },
    {
      key: 'average',
      label: 'Class Average',
      value: detail.data?.performance.overallAvgPct != null ? `${detail.data.performance.overallAvgPct}%` : null,
      icon: BarChart3,
      tone: 'sky',
      context: detail.data?.performance.latestExam?.examName,
    },
    {
      key: 'fees',
      label: 'Fee Collection',
      value: collectionPct != null ? `${collectionPct}%` : null,
      icon: Wallet,
      tone: 'amber',
      progress: collectionPct != null ? collectionPct / 100 : undefined,
    },
    {
      key: 'outstanding',
      label: 'Outstanding',
      value: formatINR(fees.outstanding),
      valueClassName: 'text-xl sm:text-2xl',
      icon: IndianRupee,
      tone: fees.outstanding > 0 ? 'rose' : 'emerald',
      context: fees.overdueStudents > 0 ? `${fees.overdueStudents} overdue` : 'none overdue',
    },
    {
      key: 'concerns',
      label: 'Open Concerns',
      value: active.growth.needsAttention,
      icon: AlertTriangle,
      tone: active.growth.needsAttention > 0 ? 'rose' : 'slate',
      context: 'growth needs attention',
    },
  ]

  return (
    <PageTransition className="space-y-4 sm:space-y-5">
      {/* ── hub header (§6): identity + search + selector + quick actions */}
      <section
        aria-label={`${active.label} class header`}
        className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5"
      >
        <div className="flex flex-col gap-3.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">My Class</p>
              <h2 className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">{active.label}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {active.studentCount} student{active.studentCount === 1 ? '' : 's'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Class Teacher
                </span>
                {active.room && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      {active.room}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* student search — filters the directory section below */}
            <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student…"
                aria-label="Search students in this class"
                className="h-9 w-full pl-8 text-xs"
              />
            </div>
            {classes.length > 1 && (
              <ClassSelect
                classes={classes.map((c) => ({
                  id: c.classId,
                  label: c.label,
                  meta: String(c.studentCount),
                  isClassTeacher: true,
                }))}
                value={active.classId}
                onChange={(id) => setClassId(id ?? classes[0].classId ?? null)}
                ariaLabel="Select class"
              />
            )}
          </div>
        </div>

        {/* quick actions (§8) — deep links into the canonical modules */}
        <div className="mt-3.5 flex flex-wrap gap-2 border-t border-border pt-3.5">
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openModuleForClass('attendance')}>
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" /> Attendance
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openModuleForClass('students')}>
            <Users className="h-3.5 w-3.5" aria-hidden="true" /> Directory
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onNavigate('marks')}>
            <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Marks & Results
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openModuleForClass('fee-collection')}>
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" /> Fee Collection
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openModuleForClass('growth')}>
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> Growth
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setDrawer('report')}>
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> Reports
          </Button>
        </div>
      </section>

      {/* ── CLASS OVERVIEW (§7) — 7 compact KPI tiles */}
      <HubStatCards
        stats={kpis}
        loading={false}
        className="grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-7"
      />

      {/* ── the management sections (§29 order) */}
      <div className="space-y-4 sm:space-y-5">
        <AttendanceSection
          cls={active}
          report={detail.data?.attendanceReport ?? null}
          onOpenAttendance={() => openModuleForClass('attendance')}
        />
        <PerformanceSection
          detail={detail.data}
          onOpenPerformance={() => setDrawer('performance')}
        />
        <DirectorySection
          directory={detail.data?.directory ?? []}
          search={search}
          studentCount={active.studentCount}
          onOpenProfile={setProfileStudentId}
          onOpenDirectory={() => openModuleForClass('students')}
        />
        <RankingSection detail={detail.data} onOpenRanking={() => setDrawer('ranking')} />
        <FeesSection
          cls={active}
          onOpenFees={() => openModuleForClass('fee-collection')}
          onOpenProfile={setProfileStudentId}
        />
        <ResultsSection
          cls={active}
          taughtSubjects={detail.data?.taughtSubjects ?? []}
          onOpenMarks={() => onNavigate('marks')}
        />
        <DocumentsSection
          detail={detail.data}
          rosterIds={rosterIds}
          onOpenMarksheet={(examId) => {
            const m = detail.data?.marksheets.find((x) => x.examId === examId)
            setMarksheetExam({ examId, examName: m?.examName ?? 'Marksheet' })
          }}
        />
        <GrowthSection cls={active} onOpenGrowth={() => openModuleForClass('growth')} />
        <ReportSection
          report={detail.data?.attendanceReport ?? null}
          onOpenReport={() => setDrawer('report')}
        />
      </div>

      {/* ── the ONE shared student profile (§9 — no second profile system) */}
      <TeacherStudentProfileSheet
        studentId={profileStudentId}
        onOpenChange={(o) => {
          if (!o) setProfileStudentId(null)
        }}
        onNavigate={onNavigate}
        onChanged={reload}
      />

      {/* ── detail drawers */}
      <PerformanceDrawer
        open={drawer === 'performance'}
        onOpenChange={(o) => !o && setDrawer(null)}
        detail={detail.data}
      />
      <RankingDrawer
        open={drawer === 'ranking'}
        onOpenChange={(o) => !o && setDrawer(null)}
        detail={detail.data}
      />
      <ReportDrawer
        open={drawer === 'report'}
        onOpenChange={(o) => !o && setDrawer(null)}
        detail={detail.data}
      />
      <MarksheetDrawer
        open={marksheetExam != null}
        onOpenChange={(o) => !o && setMarksheetExam(null)}
        classId={active.classId}
        examId={marksheetExam?.examId ?? null}
        examName={marksheetExam?.examName ?? null}
      />
    </PageTransition>
  )
}
