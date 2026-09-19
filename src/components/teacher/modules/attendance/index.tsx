'use client'

/**
 * Class Attendance (TWC-FE-2) — the module composition root.
 *
 * Server-backed on the two-layer model:
 *   · CLASS TEACHER → the official daily baseline for her class (the
 *     canonical rows students and parents see). One Save writes the day.
 *   · SUBJECT TEACHER → the class teacher's baseline arrives PREFILLED;
 *     she changes only exceptions and explicitly submits her OWN subject
 *     session (a separate record — viewing never writes anything).
 *
 * Composition: quiet ModuleToolbar (class + subject + date nav + Save)
 * → week strip (marked days, today, quick jumps) → 4 count cards with
 * progress bars → roster/insights card (segmented):
 *   · Roster  — per-student status buttons, 5-day history dots, rate chip,
 *     search, bulk "mark all present".
 *   · Insights — 10-day present-rate trend, attention-needed absentees,
 *     perfect-record students.
 */

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Award,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plane,
  Save,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { GlassCard, GradientAvatar, PageTransition } from '@/components/shared/ui'
import { ModuleToolbar } from '../../teacher-panel/module-toolbar'
import {
  HubEmptyState,
  HubModuleSkeleton,
  HubSectionError,
} from '../shared/hub-stat-cards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAttendanceModule } from './hooks'
import {
  ATTENDANCE_STATUSES,
  HISTORY_DOT,
  STATUS_CONFIG,
  historyStatsFor,
  longDate,
  rateTone,
  recentStatusesFor,
  rosterContextLine,
  shiftDayKey,
  shortDate,
  todayKey,
  weekOf,
  weekdayLetter,
  type AttendanceHistory,
  type AttendanceStatus,
  type AttendanceStudent,
  type SaveCounts,
} from './shared'

// ─── count-card tones (recipe of the previous module) ─────────────────

type StripTone = 'emerald' | 'rose' | 'amber' | 'info'

const STRIP_TONES: Record<StripTone, { chip: string; text: string; bar: string }> = {
  emerald: {
    chip: 'bg-emerald-500/10 text-emerald-600',
    text: 'text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500',
  },
  rose: {
    chip: 'bg-rose-500/10 text-rose-600',
    text: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-rose-500',
  },
  amber: {
    chip: 'bg-amber-500/10 text-amber-600',
    text: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-500',
  },
  info: { chip: 'bg-info/10 text-info', text: 'text-info', bar: 'bg-info' },
}

/** House <input type="date"> — matches the h-9 controls around it. */
const DATE_INPUT_CLASS =
  'h-9 w-[118px] rounded-none border-0 bg-transparent px-2 text-xs font-medium text-foreground shadow-none outline-none [color-scheme:light] focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-input/30 dark:[color-scheme:dark]'

// ─── module ───────────────────────────────────────────────────────────

export function AttendanceModule() {
  const {
    classes,
    classesError,
    reloadClasses,
    classId,
    selectClass,
    subjectId,
    selectSubject,
    date,
    selectDate,
    board,
    boardLoading,
    boardError,
    reloadBoard,
    draft,
    source,
    dirty,
    setStatus,
    markAllPresent,
    counts,
    saving,
    justSaved,
    save,
  } = useAttendanceModule()
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'roster' | 'insights'>('roster')

  const classOptions = classes ?? []
  const total = board?.students.length ?? 0
  const isSubjectMode = board != null && !board.isClassTeacher
  const canSave =
    board != null && total > 0 && !saving && !boardLoading && (board.isClassTeacher || subjectId != null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = board?.students ?? []
    if (!q) return list
    return list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.rollNo.includes(q),
    )
  }, [board, search])

  const markedDays = useMemo(
    () => new Set((board?.history?.days ?? []).map((d) => d.date)),
    [board],
  )

  const goPrevDay = () => selectDate(shiftDayKey(date, -1))
  const goNextDay = () => {
    const next = shiftDayKey(date, 1)
    if (next <= todayKey()) selectDate(next)
  }
  const goToday = () => selectDate(todayKey())

  // ── module-level states (all hooks above run unconditionally) ──────

  if (classes == null) {
    return (
      <PageTransition className="space-y-4">
        {classesError != null ? (
          <HubSectionError message={classesError} onRetry={reloadClasses} />
        ) : (
          <HubModuleSkeleton />
        )}
      </PageTransition>
    )
  }

  if (classes.length === 0) {
    return (
      <PageTransition className="space-y-4">
        <GlassCard hover={false}>
          <HubEmptyState
            icon={Users}
            title="No classes assigned yet"
            hint="Classes appear here once you are a class teacher or teach a subject in them."
          />
        </GlassCard>
      </PageTransition>
    )
  }

  return (
    <PageTransition className="space-y-4">
      {/* quiet toolbar: scope line + class / subject / date nav + Save */}
      <ModuleToolbar
        context={`Mark attendance · ${longDate(date)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={classId ?? undefined} onValueChange={selectClass}>
              <SelectTrigger className="h-9 w-[120px] sm:w-[132px]" aria-label="Class">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                {classOptions.map((c) => (
                  <SelectItem key={c.classId} value={c.classId}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isSubjectMode && (
              <Select value={subjectId ?? undefined} onValueChange={selectSubject}>
                <SelectTrigger className="h-9 w-[120px] sm:w-[136px]" aria-label="Subject">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  {(board?.subjects ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* date: prev / picker / next + Today */}
            <div className="flex h-9 items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
              <button
                type="button"
                onClick={goPrevDay}
                aria-label="Previous day"
                title="Previous day"
                className="flex h-full w-7 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="h-5 w-px bg-border" aria-hidden="true" />
              <input
                type="date"
                value={date}
                max={todayKey()}
                onChange={(e) => selectDate(e.target.value)}
                aria-label="Attendance date"
                className={DATE_INPUT_CLASS}
              />
              <span className="h-5 w-px bg-border" aria-hidden="true" />
              <button
                type="button"
                onClick={goNextDay}
                disabled={date >= todayKey()}
                aria-label="Next day"
                title="Next day"
                className="flex h-full w-7 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToday}
              disabled={date === todayKey()}
              className="h-9 px-2.5 text-xs"
            >
              Today
            </Button>

            <Button onClick={save} disabled={!canSave} className="h-9">
              <AnimatePresence mode="wait" initial={false}>
                {saving ? (
                  <motion.span
                    key="saving"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                  </motion.span>
                ) : justSaved ? (
                  <motion.span
                    key="saved"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Saved
                  </motion.span>
                ) : (
                  <motion.span
                    key="save"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {isSubjectMode ? 'Save session' : 'Save attendance'}
                    {dirty && (
                      <span
                        className="ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"
                        aria-label="Unsaved changes"
                      />
                    )}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        }
      />

      {boardError != null ? (
        <HubSectionError message={boardError} onRetry={reloadBoard} />
      ) : board == null ? (
        <BoardSkeleton />
      ) : board.students.length === 0 ? (
        <GlassCard hover={false}>
          <HubEmptyState
            icon={Users}
            title="No students in this class"
            hint="Active students enrolled in this class will appear here."
          />
        </GlassCard>
      ) : (
        <>
          {/* week strip: Mon–Sun, marked days dotted, today ringed */}
          <WeekStrip
            week={weekOf(date)}
            selected={date}
            markedDays={markedDays}
            onSelect={selectDate}
          />

          {/* live count cards */}
          <CountsStrip counts={counts} total={total} />

          {/* roster + insights */}
          <GlassCard
            className={cn(
              'p-3 sm:p-4 lg:p-5 transition-opacity',
              boardLoading && 'opacity-60',
            )}
          >
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{board.label} · Student roster</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {rosterContextLine(board, subjectId, source)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {view === 'roster' ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search student…"
                        aria-label="Search students"
                        className="h-9 w-36 pl-8 sm:w-44"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={markAllPresent}
                      disabled={saving}
                      className="h-9"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Mark all present
                    </Button>
                  </>
                ) : null}
                <div
                  role="tablist"
                  aria-label="Attendance views"
                  className="flex h-9 items-center rounded-md border border-input bg-muted/40 p-0.5"
                >
                  {(
                    [
                      { key: 'roster', label: 'Roster', icon: Users },
                      { key: 'insights', label: 'Insights', icon: BarChart3 },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      role="tab"
                      type="button"
                      aria-selected={view === t.key}
                      onClick={() => setView(t.key)}
                      className={cn(
                        'flex h-8 items-center gap-1.5 rounded-[6px] px-2.5 text-xs font-medium transition-all',
                        view === t.key
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <t.icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {view === 'insights' ? (
              <InsightsView
                students={board.students}
                history={board.history}
              />
            ) : (
              <>
                <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1 -mr-1">
                  {filtered.length === 0 ? (
                    <HubEmptyState
                      icon={Search}
                      title={`No students match “${search.trim()}”`}
                      hint="Try a different name or roll number."
                      className="py-8"
                    />
                  ) : (
                    filtered.map((student, i) => (
                      <RosterRow
                        key={student.id}
                        student={student}
                        index={i}
                        current={draft[student.id] ?? 'PRESENT'}
                        disabled={saving}
                        onSetStatus={setStatus}
                        history={board.history}
                      />
                    ))
                  )}
                </div>

                {/* footer summary + history legend */}
                <div className="mt-4 flex flex-col items-start justify-between gap-2.5 border-t border-border pt-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2 text-xs">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Total:{' '}
                      <span className="font-semibold text-foreground">
                        {total} student{total === 1 ? '' : 's'}
                      </span>
                      <span className="mx-1.5">·</span>
                      Attendance rate:{' '}
                      <span className="font-semibold text-foreground">
                        {total > 0 ? ((counts.present / total) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <HistoryLegend />
                    <p className="text-[11px] text-muted-foreground">
                      {dirty ? (
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          Unsaved changes — remember to save
                        </span>
                      ) : source === 'present' ? (
                        'Nothing saved for this date yet'
                      ) : (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          In sync with the saved record
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </>
            )}
          </GlassCard>
        </>
      )}
    </PageTransition>
  )
}

// ─── local pieces ─────────────────────────────────────────────────────

/** Mon–Sun of the viewed week: quick jumps, marked dots, today ring. */
function WeekStrip({
  week,
  selected,
  markedDays,
  onSelect,
}: {
  week: string[]
  selected: string
  markedDays: Set<string>
  onSelect: (key: string) => void
}) {
  const today = todayKey()
  return (
    <div
      className="flex items-center justify-between gap-1 overflow-x-auto rounded-xl border border-border bg-card/60 px-2 py-2"
      role="group"
      aria-label="This week"
    >
      {week.map((key) => {
        const dayNumber = Number(key.slice(8, 10))
        const isFuture = key > today
        const isSelected = key === selected
        const isToday = key === today
        const isMarked = markedDays.has(key)
        return (
          <button
            key={key}
            type="button"
            disabled={isFuture}
            onClick={() => onSelect(key)}
            aria-label={`${longDate(key)}${isMarked ? ' — attendance marked' : ''}${isFuture ? ' (future)' : ''}`}
            aria-pressed={isSelected}
            title={isMarked ? `${shortDate(key)} — attendance marked` : longDate(key)}
            className={cn(
              'flex min-w-[38px] flex-1 flex-col items-center gap-1 rounded-lg px-1.5 py-1.5 transition-colors',
              isFuture
                ? 'cursor-not-allowed opacity-35'
                : 'hover:bg-muted',
              isSelected && !isFuture && 'bg-primary/10 ring-1 ring-primary/30',
            )}
          >
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wide',
                isSelected ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {weekdayLetter(key)}
            </span>
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                isToday && !isSelected && 'text-primary',
                isSelected ? 'text-primary' : 'text-foreground',
              )}
            >
              {dayNumber}
            </span>
            <span className="flex h-1.5 items-center justify-center">
              {isMarked ? (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Attendance marked" />
              ) : isToday ? (
                <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** The 4 live count cards (Present / Absent / Late / On Leave out of total). */
function CountsStrip({ counts, total }: { counts: SaveCounts; total: number }) {
  const cards: { key: AttendanceStatus; label: string; value: number; icon: LucideIcon; tone: StripTone }[] = [
    { key: 'PRESENT', label: 'Present', value: counts.present, icon: Check, tone: 'emerald' },
    { key: 'ABSENT', label: 'Absent', value: counts.absent, icon: X, tone: 'rose' },
    { key: 'LATE', label: 'Late', value: counts.late, icon: Clock, tone: 'amber' },
    { key: 'LEAVE', label: 'On Leave', value: counts.leave, icon: Plane, tone: 'info' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c, i) => {
        const tone = STRIP_TONES[c.tone]
        const Icon = c.icon
        const pct = total > 0 ? (c.value / total) * 100 : 0
        return (
          <motion.div
            key={c.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <GlassCard className="p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tone.chip)}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className={cn('font-display text-2xl font-bold', tone.text)}>
                <motion.span
                  key={`${c.key}-${c.value}`}
                  initial={{ scale: 1.25 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                >
                  {c.value}
                </motion.span>
                <span className="text-base font-normal text-muted-foreground">/{total}</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <motion.div
                  className={cn('h-full rounded-full', tone.bar)}
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                />
              </div>
            </GlassCard>
          </motion.div>
        )
      })}
    </div>
  )
}

/** P A L L mini-legend for the roster history dots. */
function HistoryLegend() {
  const items: { status: AttendanceStatus; label: string }[] = [
    { status: 'PRESENT', label: 'Present' },
    { status: 'ABSENT', label: 'Absent' },
    { status: 'LATE', label: 'Late' },
    { status: 'LEAVE', label: 'Leave' },
  ]
  return (
    <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground" aria-hidden="true">
      <span className="hidden sm:inline">Last days:</span>
      {items.map((it) => (
        <span key={it.status} className="flex items-center gap-1">
          <span className={cn('h-1.5 w-1.5 rounded-full', HISTORY_DOT[it.status])} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

/** One roster row: roll tile + avatar + name + history dots + rate + status buttons. */
function RosterRow({
  student,
  index,
  current,
  disabled,
  onSetStatus,
  history,
}: {
  student: AttendanceStudent
  index: number
  current: AttendanceStatus
  disabled: boolean
  onSetStatus: (studentId: string, status: AttendanceStatus) => void
  history: AttendanceHistory | undefined
}) {
  const recent = recentStatusesFor(student.id, history, 5)
  const stat = historyStatsFor(student.id, history)
  const rate = Math.round(stat.rate * 100)
  const tone = rateTone(stat.rate)
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.025, duration: 0.25 }}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 transition-colors',
        STATUS_CONFIG[current].row,
      )}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground"
        aria-hidden="true"
      >
        {student.rollNo}
      </div>
      <GradientAvatar name={student.name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{student.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span>Roll #{student.rollNo}</span>
          {recent.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1" title="Last 5 marked days (oldest → newest)">
                {recent.map((r) => (
                  <span
                    key={r.date}
                    className={cn('h-1.5 w-1.5 rounded-full', HISTORY_DOT[r.status])}
                    title={`${shortDate(r.date)} — ${STATUS_CONFIG[r.status].label}`}
                  />
                ))}
              </span>
            </>
          )}
          {stat.marked > 0 && (
            <span
              className={cn(
                'rounded-full px-1.5 py-px text-[10px] font-semibold',
                tone.chip,
              )}
              title={`${stat.present}/${stat.marked} present across the last ${history?.days.length ?? 0} marked days`}
            >
              {rate}%
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {ATTENDANCE_STATUSES.map((status) => {
          const cfg = STATUS_CONFIG[status]
          const isActive = current === status
          const Icon = cfg.icon
          return (
            <motion.button
              key={status}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => onSetStatus(student.id, status)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-all',
                isActive ? cfg.active : cn('bg-transparent', cfg.inactive),
              )}
              title={cfg.label}
              aria-label={`Mark ${student.name} as ${cfg.label}`}
              aria-pressed={isActive}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{cfg.label}</span>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

/** Insights: trend / attention / perfect record — all from the history slice. */
function InsightsView({
  students,
  history,
}: {
  students: AttendanceStudent[]
  history: AttendanceHistory | undefined
}) {
  const days = history?.days ?? []
  const perStudent = useMemo(
    () => students.map((s) => ({ student: s, stat: historyStatsFor(s.id, history) })),
    [students, history],
  )
  const attention = useMemo(
    () =>
      perStudent
        .filter((p) => p.stat.absent > 0)
        .sort((a, b) => b.stat.absent - a.stat.absent || a.stat.rate - b.stat.rate)
        .slice(0, 5),
    [perStudent],
  )
  const perfect = useMemo(
    () => perStudent.filter((p) => p.stat.marked > 0 && p.stat.present === p.stat.marked),
    [perStudent],
  )
  const avgRate =
    days.length > 0 ? days.reduce((acc, d) => acc + d.rate, 0) / days.length : 0
  const avgTone = rateTone(avgRate)

  if (days.length === 0) {
    return (
      <HubEmptyState
        icon={BarChart3}
        title="No marked days yet"
        hint="Insights appear once attendance has been saved for a few days."
        className="py-10"
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* headline stat */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <TrendingUp className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Average present rate{' '}
            <span className={avgTone.text}>{(avgRate * 100).toFixed(0)}%</span>{' '}
            <span className="font-normal text-muted-foreground">
              across the last {days.length} marked day{days.length === 1 ? '' : 's'}
            </span>
          </p>
          <div className="mt-1.5 h-1.5 max-w-md overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', avgTone.bar)}
              style={{ width: `${Math.round(avgRate * 100)}%` }}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {days.length < 10
            ? `Recent window: ${shortDate(days[0].date)} – ${shortDate(days[days.length - 1].date)}`
            : `Last 10 marked days · latest ${shortDate(days[days.length - 1].date)}`}
        </p>
      </div>

      {/* trend bars */}
      <div>
        <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Daily present rate
        </h4>
        <div className="flex items-end gap-1.5 sm:gap-2.5 rounded-xl border border-border bg-card/40 p-3 sm:p-4">
          {days.map((d) => {
            const pct = Math.round(d.rate * 100)
            const tone = rateTone(d.rate)
            return (
              <div
                key={d.date}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                title={`${longDate(d.date)} — ${pct}% present · ${d.counts.present} present, ${d.counts.absent} absent, ${d.counts.late} late, ${d.counts.leave} on leave`}
              >
                <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {pct}%
                </span>
                <div className="flex h-24 w-full items-end justify-center">
                  <motion.div
                    initial={{ height: 4 }}
                    animate={{ height: `${Math.max(pct, 4)}%` }}
                    transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                    className={cn('w-full max-w-7 rounded-t-md', tone.bar)}
                    style={{ transformOrigin: 'bottom' }}
                  />
                </div>
                <span className="truncate text-[10px] font-medium text-muted-foreground">
                  {d.date.slice(8, 10)}/{d.date.slice(5, 7)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* attention needed */}
        <div className="rounded-xl border border-border bg-card/40 p-3 sm:p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Attention needed
            </h4>
          </div>
          {attention.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No absences in the recent window — full class! 🎉
            </p>
          ) : (
            <ul className="space-y-1.5">
              {attention.map(({ student, stat }) => {
                const tone = rateTone(stat.rate)
                return (
                  <li
                    key={student.id}
                    className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/60 px-2.5 py-2"
                  >
                    <GradientAvatar name={student.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{student.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {stat.absent} absence{stat.absent === 1 ? '' : 's'}
                        {stat.late > 0 ? ` · ${stat.late} late` : ''}
                        {stat.leave > 0 ? ` · ${stat.leave} on leave` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                        tone.chip,
                      )}
                      title={`${stat.present}/${stat.marked} present`}
                    >
                      {Math.round(stat.rate * 100)}%
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* perfect record */}
        <div className="rounded-xl border border-border bg-card/40 p-3 sm:p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Award className="h-4 w-4" />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Perfect record
            </h4>
          </div>
          {perfect.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No student has a spotless record in the recent window yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {perfect.slice(0, 8).map(({ student, stat }) => (
                <li
                  key={student.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/60 px-2.5 py-2"
                >
                  <GradientAvatar name={student.name} size="sm" />
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold">{student.name}</p>
                  <span
                    className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-600"
                    title={`${stat.present}/${stat.marked} present`}
                  >
                    {stat.present}/{stat.marked} ✓
                  </span>
                </li>
              ))}
              {perfect.length > 8 && (
                <li className="pt-0.5 text-center text-[11px] text-muted-foreground">
                  + {perfect.length - 8} more with perfect attendance
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/** Skeleton for a board load: week strip + 4 count cards + roster rows. */
function BoardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-1 rounded-xl border border-border bg-card/60 px-2 py-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex min-w-[38px] flex-1 flex-col items-center gap-1.5 py-1">
            <div className="h-2.5 w-3 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-5 animate-pulse rounded bg-muted" />
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i} hover={false} className="animate-pulse p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="h-7 w-7 rounded-lg bg-muted" />
            </div>
            <div className="h-7 w-12 rounded bg-muted" />
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted" />
          </GlassCard>
        ))}
      </div>
      <GlassCard hover={false} className="p-3 sm:p-4 lg:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="h-3.5 w-44 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-56 animate-pulse rounded bg-muted" />
          </div>
          <div className="hidden h-9 w-64 animate-pulse rounded-md bg-muted sm:block" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3"
            >
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted" />
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-28 animate-pulse rounded bg-muted" />
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-6 w-8 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
