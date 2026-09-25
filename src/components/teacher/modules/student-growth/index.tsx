'use client'

/**
 * Student Growth — module composition (§12/§33).
 *
 * Hierarchy (top → bottom, §32):
 *   toolbar (context + [+ Add Points])
 *   → class selector pills (All + per class)
 *   → summary card (average score ring + improving/steady/attention bands)
 *   → growth trend (8 weeks, light)
 *   → point activity (the ledger with compact filters)
 *
 * The per-student drill-down is the shared TeacherStudentProfileSheet
 * (Growth tab) — the same canonical profile opened from the Directory,
 * My Class and Fees.
 *
 * State contract:
 *   · loading  → HubModuleSkeleton
 *   · error    → quiet inline error card with retry
 *   · zero events → honest empty state with the Add Points action
 *   · everything comes from /api/teacher/growth — the httpOnly
 *     erp_session cookie resolves the teacher, her school and her scope.
 *
 * Command-palette focus deep-links are consumed once on mount: `grw-<id>`
 * opens the owning student's profile sheet once the aggregate has loaded.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { GlassCard, PageTransition } from '@/components/shared/ui'
import { ModuleToolbar } from '@/components/teacher/teacher-panel/module-toolbar'
import {
  HubModuleSkeleton,
  HubSectionError,
} from '@/components/teacher/modules/shared/hub-stat-cards'
import { useFocusStore } from '@/lib/store/focus-store'
import { useCurrentUser } from '@/lib/store/current-user-store'
import { cn } from '@/lib/utils'
import { useGrowth } from './hooks'
import {
  ACTIVITY_FILTERS,
  ActivityList,
  filterEvents,
  type ActivityFilter,
} from './activity-list'
import { AddPointsDialog } from './add-points-dialog'
import {
  GrowthScoreRing,
  GrowthTrendCard,
  MonthDeltaChip,
} from './growth-summary'
import { PRIMARY_ACTION_CLASS, signedDelta } from './shared'
import { TeacherStudentProfileSheet } from '../shared/student-profile-sheet'

export function StudentGrowthModule({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const { data, loading, error, reload } = useGrowth()
  const currentUserId = useCurrentUser((s) => s.me?.id) ?? null

  const [addOpen, setAddOpen] = useState(false)
  const [prefillStudent, setPrefillStudent] = useState<{ id: string; name: string; rollNo: string | null; classLabel: string } | null>(null)
  const [profileStudentId, setProfileStudentId] = useState<string | null>(null)
  const [classFilter, setClassFilter] = useState<string | null>(null) // null = all
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [studentFilter, setStudentFilter] = useState<string>('')

  // ── focus deep-links (consumed exactly once, on mount) ──
  //   · `grw-<eventId>` → open the owning student's profile sheet
  //   · type 'growth-class' → preselect that class (My Class handoff)
  const pendingEventId = useRef<string | null>(null)
  useEffect(() => {
    const focus = useFocusStore.getState().focus
    if (!focus || focus.moduleKey !== 'growth') return
    useFocusStore.getState().clearFocus()
    if (focus.type === 'growth-class' && focus.id) {
      setClassFilter(focus.id)
      setStudentFilter('')
    } else if (focus.id.startsWith('grw-')) {
      pendingEventId.current = focus.id.slice(4)
    }
  }, [])

  const selectedClass = useMemo(
    () => data?.classes.find((c) => c.classId === classFilter) ?? null,
    [data, classFilter],
  )

  // Resolve a pending event deep-link against the loaded aggregate.
  useEffect(() => {
    const eventId = pendingEventId.current
    if (!data || !eventId) return
    pendingEventId.current = null
    const event = data.events.find((e) => e.id === eventId)
    if (event) setProfileStudentId(event.studentId)
  }, [data])

  // students of the selected class (activity filter helper)
  const classStudentIds = useMemo(() => {
    if (!data || !classFilter) return null
    return new Set(data.students.filter((s) => s.classId === classFilter).map((s) => s.id))
  }, [data, classFilter])

  const visibleEvents = useMemo(() => {
    if (!data) return []
    let events = filterEvents(data.events, activityFilter, studentFilter || null)
    if (classStudentIds) events = events.filter((e) => classStudentIds.has(e.studentId))
    return events
  }, [data, activityFilter, studentFilter, classStudentIds])

  const summary = selectedClass ?? data?.summary ?? null
  const summaryMonthPoints =
    selectedClass?.monthPoints ?? data?.summary.monthPoints ?? 0
  const trend = selectedClass?.trend ?? data?.trend ?? []

  const openAdd = (student?: { id: string; name: string; rollNo: string | null; classLabel: string } | null) => {
    setPrefillStudent(student ?? null)
    setAddOpen(true)
  }

  if (loading) {
    return (
      <PageTransition>
        <HubModuleSkeleton />
      </PageTransition>
    )
  }

  return (
    <PageTransition className="space-y-4">
      {error && !data ? (
        <GlassCard className="p-4" hover={false}>
          <HubSectionError message={error} onRetry={reload} />
        </GlassCard>
      ) : data ? (
        <>
          <ModuleToolbar
            context={`${data.scopeLabel} · ${data.summary.studentCount} students · ${signedDelta(data.summary.monthPoints)} points this month`}
            action={
              <button type="button" onClick={() => openAdd()} className={PRIMARY_ACTION_CLASS}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add Points
              </button>
            }
          />

          {/* ── class pills ─────────────────────────────────────────── */}
          {data.classes.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <PillButton
                active={classFilter === null}
                onClick={() => {
                  setClassFilter(null)
                  setStudentFilter('')
                }}
                label="All classes"
                badge={
                  data.summary.average != null
                    ? `${data.summary.average} avg`
                    : `${data.summary.studentCount} students`
                }
              />
              {data.classes.map((c) => (
                <PillButton
                  key={c.classId}
                  active={classFilter === c.classId}
                  onClick={() => {
                    setClassFilter(c.classId)
                    setStudentFilter('')
                  }}
                  label={c.label}
                  badge={c.average != null ? `${c.average} avg` : `${c.studentCount}`}
                  classTeacher={c.isClassTeacher}
                />
              ))}
            </div>
          )}

          {/* ── summary + trend ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <GlassCard hover={false} className="p-4 sm:p-5 lg:col-span-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {selectedClass ? `${selectedClass.label} Growth` : 'Growth Overview'}
                </h3>
                <span className="text-[10px] text-muted-foreground">
                  {selectedClass
                    ? `${selectedClass.studentCount} students`
                    : `${data.classes.length} classes`}
                </span>
              </div>
              <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
                <GrowthScoreRing
                  score={summary?.average ?? null}
                  monthDelta={summaryMonthPoints}
                  size={112}
                  label="Average growth score"
                />
                <div className="w-full min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-center gap-2 sm:justify-start">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Average growth
                    </span>
                    <MonthDeltaChip monthDelta={summaryMonthPoints} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <BandTile label="Improving" value={summary?.improving ?? 0} tone="emerald" glyph="↑" />
                    <BandTile label="Steady" value={summary?.steady ?? 0} tone="sky" glyph="→" />
                    <BandTile
                      label="Need attention"
                      value={summary?.needsAttention ?? 0}
                      tone={(summary?.needsAttention ?? 0) > 0 ? 'amber' : 'muted'}
                      glyph="↓"
                    />
                  </div>
                  {(summary?.building ?? 0) > 0 && (
                    <p className="text-center text-[10px] text-muted-foreground/70 sm:text-left">
                      {summary?.building} still building — not enough records yet
                    </p>
                  )}
                </div>
              </div>
            </GlassCard>

            <div className="lg:col-span-2">
              <GrowthTrendCard trend={trend} title={selectedClass ? `${selectedClass.label} · 8 weeks` : 'All classes · 8 weeks'} />
            </div>
          </div>

          {/* ── point activity ──────────────────────────────────────── */}
          <GlassCard hover={false} className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Point Activity</h3>
              <div className="flex items-center gap-2">
                {data.students.length > 1 && (
                  <select
                    value={studentFilter}
                    onChange={(e) => setStudentFilter(e.target.value)}
                    aria-label="Filter by student"
                    className="h-8 max-w-[10rem] truncate rounded-lg border border-border bg-card px-2 text-[11px] font-medium text-foreground outline-none transition-colors hover:border-primary/30 sm:max-w-[12rem]"
                  >
                    <option value="">All students</option>
                    {(classFilter
                      ? data.students.filter((s) => s.classId === classFilter)
                      : data.students
                    ).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.classLabel}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* compact filters (§12 — a single quiet row) */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Point activity filters">
              {ACTIVITY_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={activityFilter === f.key}
                  onClick={() => setActivityFilter(f.key)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                    activityFilter === f.key
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-card/60 text-muted-foreground hover:border-primary/25 hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
              <span className="ml-auto hidden text-[10px] text-muted-foreground sm:block">
                {visibleEvents.length} event{visibleEvents.length === 1 ? '' : 's'}
              </span>
            </div>

            <ActivityList
              events={visibleEvents}
              currentUserId={currentUserId}
              onOpenStudent={setProfileStudentId}
              onCorrected={reload}
              emptyHint={
                activityFilter === 'all'
                  ? 'Use Add Points to recognise growth — attendance and exam points accrue automatically.'
                  : 'No events match this filter yet.'
              }
            />

            {data.events.length === 0 && activityFilter === 'all' && (
              <button
                type="button"
                onClick={() => openAdd()}
                className="mt-3 inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-dashed border-primary/40 px-3.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Record the first point
              </button>
            )}
          </GlassCard>
        </>
      ) : null}

      <AddPointsDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o)
          if (!o) setPrefillStudent(null)
        }}
        students={data?.students ?? []}
        presets={data?.presets ?? { positive: [], negative: [] }}
        settings={
          data?.settings ?? {
            enabled: true,
            negativeEnabled: true,
            minManualPoints: -5,
            maxManualPoints: 5,
            customReasons: true,
            studentVisibility: true,
            feePunctualityPoints: false,
          }
        }
        prefillStudent={prefillStudent}
        onCreated={reload}
      />

      <TeacherStudentProfileSheet
        studentId={profileStudentId}
        onOpenChange={(o) => {
          if (!o) setProfileStudentId(null)
        }}
        onNavigate={onNavigate}
        onChanged={reload}
        initialTab="growth"
      />
    </PageTransition>
  )
}

// ── small pieces ─────────────────────────────────────────────────────────

function PillButton({
  active,
  onClick,
  label,
  badge,
  classTeacher,
}: {
  active: boolean
  onClick: () => void
  label: string
  badge?: string
  classTeacher?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border bg-card/60 text-muted-foreground hover:border-primary/25 hover:text-foreground',
      )}
    >
      <span className="max-w-[9rem] truncate">{label}</span>
      {classTeacher && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
          title="You are the class teacher"
          aria-label="Class teacher"
        />
      )}
      {badge && (
        <span
          className={cn(
            'rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums',
            active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function BandTile({
  label,
  value,
  tone,
  glyph,
}: {
  label: string
  value: number
  tone: 'emerald' | 'sky' | 'amber' | 'muted'
  glyph: string
}) {
  const tones = {
    emerald: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300',
    sky: 'border-sky-500/20 bg-sky-500/[0.06] text-sky-700 dark:text-sky-300',
    amber: 'border-amber-500/25 bg-amber-500/[0.07] text-amber-700 dark:text-amber-300',
    muted: 'border-border bg-muted/40 text-muted-foreground',
  } as const
  return (
    <div className={cn('rounded-xl border px-2 py-2.5 text-center', tones[tone])}>
      <p className="font-display text-lg font-bold leading-none tabular-nums">
        <span aria-hidden="true" className="mr-0.5 text-xs">{glyph}</span>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-medium leading-tight opacity-80">{label}</p>
    </div>
  )
}
