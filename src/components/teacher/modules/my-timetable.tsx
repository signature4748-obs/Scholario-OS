'use client'

/**
 * MyTimetable — the teacher's OWN weekly schedule (Teacher Workspace final
 * sidebar spec: an Overview item alongside My Attendance).
 *
 * Design language: Marks Entry benchmark — white cards, border-border,
 * rounded-xl, HubStatCards recipe, quiet ModuleToolbar context line,
 * emerald accents, text-[10px] uppercase labels, tabular-nums. No
 * gradients, no glass, no giant colored blocks.
 *
 * Data: GET /api/teacher/timetable — server-scoped to the signed-in
 * teacher (teacherName match, same rule as the Dashboard) and enriched
 * with the SCHOOL period ladder (periodTimes, P1–P7 — free periods carry
 * real times), the school's teaching days and a server-side conflict
 * scan (teacher/room/class). Nothing is fabricated; no rows ⇒ honest
 * empty state.
 *
 * Structure:
 *   · 4 summary cards (HubStatCards) — periods/week, classes, subjects,
 *     today's periods;
 *   · conflict banner — only when the API reports conflicts (amber card,
 *     every conflict explained, footer pointing at the timetable admin);
 *   · TODAY card — one row per school period with real times, Free rows
 *     explicit, the current period highlighted ("Now") and the next
 *     upcoming period marked ("Next"), computed from the client clock;
 *   · weekly grid (lg+): period rows × day columns, table-fixed so the
 *     grid never overflows its card, today's column tinted;
 *   · mobile (<lg): day chips + the selected day's full period list
 *     including explicit Free rows — the teacher sees the shape of the
 *     whole day.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Clock,
  MapPin,
  Radio,
  RotateCw,
  School,
  Table2,
} from 'lucide-react'
import { PageTransition } from '@/components/shared/ui'
import { ModuleToolbar } from '../teacher-panel/module-toolbar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  HubEmptyState,
  HubModuleSkeleton,
  HubStatCards,
  HubSectionError,
  type HubStat,
} from './shared/hub-stat-cards'
import { signOut } from '@/lib/signout'
import { useLiveFeedStore } from '@/lib/store/live-feed-store'
import { useCurrentUser } from '@/lib/store/current-user-store'
import { toast } from 'sonner'
import { FileDown, FileType2 } from 'lucide-react'
import {
  downloadTeacherTimetablePdf, downloadTeacherTimetableDocx,
} from './timetable-export'

// ── payload contracts ─────────────────────────────────────────────────

interface TimetableCell {
  day: string
  period: number
  startTime: string | null
  endTime: string | null
  subjectName: string
  classLabel: string
  room: string | null
}

interface PeriodTime {
  period: number
  startTime: string | null
  endTime: string | null
}

interface ConflictEntry {
  subjectName: string
  classLabel: string
  room: string | null
}

/** An invigilation duty assigned to this teacher by the principal
 * (one examination paper — real ExamScheduleItem data). */
interface ExamDuty {
  id: string
  examId: string
  examName: string
  subject: string
  classLabel: string
  /** UTC day key, e.g. "2026-09-21" */
  date: string
  startTime: string
  endTime: string
  room: string | null
}

type TimetableConflict =
  | { kind: 'teacher'; day: string; period: number; entries: ConflictEntry[] }
  | { kind: 'room'; day: string; period: number; label: string; detail: string }
  | { kind: 'class'; day: string; period: number; label: string; detail: string }

interface TimetablePayload {
  cells: TimetableCell[]
  stats: {
    periodsPerWeek: number
    classes: number
    subjects: number
    teachingDays: number
  }
  academicSession: string | null
  periodTimes: PeriodTime[]
  schoolDays: string[]
  conflicts: TimetableConflict[]
  /** Invigilation duties assigned to this teacher (today + upcoming). */
  examDuties: ExamDuty[]
}

// ── helpers ───────────────────────────────────────────────────────────

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "Friday, 18 September" — client-local, en-IN day-first style. */
const TODAY_DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** "2026-2027" / "2026-27" → "2026–27" (en dash, short end). */
function sessionLabel(session: string | null): string | null {
  if (!session) return null
  const m = session.match(/^(\d{4})[-–/](\d{2,4})$/)
  if (!m) return session
  const end = m[2].length === 2 ? m[2] : m[2].slice(-2)
  return `${m[1]}–${end}`
}

/** "08:30" → "8:30 AM" (12h, no leading zero — matches the house style). */
function prettyTime(t: string | null): string | null {
  if (!t) return null
  const [hRaw, m] = t.split(':')
  const h = Number(hRaw)
  if (Number.isNaN(h)) return t
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m} ${ampm}`
}

/** "8:30 – 9:15 AM" from a period's start/end (either missing → the other). */
function prettyRange(start: string | null, end: string | null): string {
  const s = prettyTime(start)
  const e = prettyTime(end)
  if (s && e) return `${s} – ${e}`
  return s ?? e ?? ''
}

/** "08:30" → minutes since midnight (null when unparseable). */
function minutesOf(t: string | null): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

/** One line per conflict — the banner's body text. */
function conflictLine(c: TimetableConflict): string {
  const slot = `${c.day} · Period ${c.period}`
  if (c.kind === 'teacher') {
    const entries = c.entries.map((e) => `${e.subjectName} · ${e.classLabel}`).join(' / ')
    return `${slot} — ${entries} (two classes share this slot)`
  }
  return `${slot} — ${c.label} (${c.detail})`
}

// ── data hook (house fetch discipline) ────────────────────────────────

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

async function fetchTimetable(): Promise<TimetablePayload> {
  const res = await fetch('/api/teacher/timetable', {
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
    /* non-JSON body — generic message below */
  }
  const envelope = json as { ok?: unknown; error?: unknown; data?: TimetablePayload } | null
  if (!res.ok || !envelope || envelope.ok !== true) {
    const message =
      envelope && typeof envelope.error === 'string' && envelope.error
        ? envelope.error
        : `Request failed (${res.status})`
    throw new Error(message)
  }
  return envelope.data as TimetablePayload
}

// ── shared row renderer (TODAY card + mobile day list) ────────────────

interface LiveSlot {
  currentPeriod: number | null
  nextPeriod: number | null
}

/**
 * One row per school period (P1–P7 ladder): time range | P-chip |
 * assignment (subject / class / room) or an explicit muted "Free".
 * `live` (today only) highlights the current period and marks the next.
 */
function DayPeriodList({
  day,
  periodTimes,
  cellsAt,
  live,
  reduce,
}: {
  day: string
  periodTimes: PeriodTime[]
  cellsAt: (day: string, period: number) => TimetableCell[]
  live: LiveSlot | null
  reduce: boolean | null
}) {
  return (
    <ol className="divide-y divide-border/40">
      {periodTimes.map((pt, i) => {
        const entries = cellsAt(day, pt.period)
        const isNow = live?.currentPeriod === pt.period
        const isNext = live?.nextPeriod === pt.period
        return (
          <motion.li
            key={pt.period}
            initial={reduce ? false : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.25), duration: 0.2 }}
            className={cn(
              'border-l-2 border-l-transparent px-4 py-2.5 sm:py-3',
              isNow && 'border-l-emerald-500 bg-emerald-500/[0.04]',
            )}
          >
            <div className="flex items-center gap-3">
              <p className="w-[88px] shrink-0 text-[11px] leading-tight text-muted-foreground tabular-nums sm:w-[96px]">
                {prettyRange(pt.startTime, pt.endTime) || '—'}
              </p>
              <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-muted/60 font-display text-[11px] font-bold tabular-nums text-foreground">
                P{pt.period}
              </span>
              <div className="min-w-0 flex-1">
                {entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground/70">Free</p>
                ) : (
                  <div className="space-y-1.5">
                    {entries.map((e, idx) => (
                      <div key={`${day}-${pt.period}-${idx}`} className="min-w-0">
                        <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                          <span className="truncate">{e.subjectName}</span>
                          {entries.length > 1 && (
                            <AlertTriangle
                              className="h-3 w-3 shrink-0 text-amber-500"
                              aria-hidden="true"
                            />
                          )}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{e.classLabel}</p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {e.room ?? 'Room not assigned'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {isNow && (
                <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  Now
                </span>
              )}
              {!isNow && isNext && (
                <span className="shrink-0 rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Next
                </span>
              )}
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}

// ── examination duties (invigilation, assigned by the principal) ─────

/** The "today" key in the SAME convention the server uses for duty dates
 *  (UTC day keys — exam papers are stored at UTC midnights). A local-time
 *  key disagreed with the server between 00:00 and 05:30 IST. */
function localDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Date-tile pieces for a duty (UTC day key → weekday / day / month). */
const TILE_FMT = {
  weekday: new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }),
  day: new Intl.DateTimeFormat('en-IN', { day: 'numeric', timeZone: 'UTC' }),
  month: new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }),
}

function dutyTile(dateKey: string): { weekday: string; day: string; month: string } {
  const d = new Date(`${dateKey}T00:00:00Z`)
  return {
    weekday: TILE_FMT.weekday.format(d),
    day: TILE_FMT.day.format(d),
    month: TILE_FMT.month.format(d),
  }
}

/** Days between the local today and a duty's day key (0 = today, 1 = tomorrow). */
function daysUntil(dateKey: string, todayKeyLocal: string): number {
  const a = Date.parse(`${dateKey}T00:00:00Z`)
  const b = Date.parse(`${todayKeyLocal}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.round((a - b) / 86_400_000)
}

/** Live state of a TODAY paper from the client clock. */
function todayDutyState(
  start: string,
  end: string,
  nowMin: number,
): { label: string; tone: 'now' | 'soon' | 'done' } {
  const s = minutesOf(start) ?? 0
  const e = minutesOf(end) ?? 0
  if (nowMin < s) return { label: `Starts ${prettyTime(start) ?? start}`, tone: 'soon' }
  if (nowMin < e) return { label: 'In progress', tone: 'now' }
  return { label: 'Concluded', tone: 'done' }
}

/**
 * Examination Duties — the invigilation papers assigned to this teacher by
 * the principal. Today's papers carry a live state chip (Starts / In
 * progress / Concluded); upcoming ones count down ("Tomorrow", "In 3 days").
 */
function ExamDutiesSection({
  duties,
  clock,
  reduce,
}: {
  duties: ExamDuty[]
  clock: Date
  reduce: boolean | null
}) {
  const todayKey = localDateKey(clock)
  const nowMin = clock.getHours() * 60 + clock.getMinutes()
  const todays = duties.filter((d) => d.date === todayKey)
  const upcoming = duties.filter((d) => d.date > todayKey)

  return (
    <motion.section
      id="exam-duties"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      aria-label="Examination duties"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck
            className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold text-foreground">Examination Duties</h2>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {duties.length > 0
            ? `${todays.length} today · ${upcoming.length} upcoming`
            : 'Invigilation'}
        </p>
      </header>

      {duties.length === 0 ? (
        <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          No invigilation duties assigned. When the principal assigns you to supervise an
          examination paper, it appears here with a notification.
        </p>
      ) : (
        <ol className="divide-y divide-border/40">
          {[...todays, ...upcoming].map((duty, i) => {
            const isToday = duty.date === todayKey
            const tile = dutyTile(duty.date)
            const state = isToday ? todayDutyState(duty.startTime, duty.endTime, nowMin) : null
            const until = isToday ? 0 : daysUntil(duty.date, todayKey)
            return (
              <motion.li
                key={duty.id}
                initial={reduce ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.25 }}
                className={cn(
                  'border-l-2 border-l-transparent px-4 py-3',
                  isToday && 'border-l-emerald-500 bg-emerald-500/[0.04]',
                )}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div
                    className={cn(
                      'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border',
                      isToday
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-border bg-muted/40',
                    )}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                      {isToday ? 'Today' : tile.weekday}
                    </span>
                    <span className="font-display text-base font-bold leading-none tabular-nums text-foreground">
                      {tile.day}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{tile.month}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {duty.subject}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        · {duty.classLabel}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {duty.examName}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {prettyRange(duty.startTime, duty.endTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {duty.room ?? 'Room to be assigned'}
                      </span>
                    </p>
                  </div>
                  {state ? (
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums',
                        state.tone === 'now' &&
                          'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                        state.tone === 'soon' &&
                          'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                        state.tone === 'done' &&
                          'border-border bg-muted/40 text-muted-foreground',
                      )}
                    >
                      {state.tone === 'now' && (
                        <span
                          aria-hidden="true"
                          className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 align-middle"
                        />
                      )}
                      {state.label}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {until === 1 ? 'Tomorrow' : `In ${until} days`}
                    </span>
                  )}
                </div>
              </motion.li>
            )
          })}
        </ol>
      )}
    </motion.section>
  )
}

// ── module ────────────────────────────────────────────────────────────

export function MyTimetableModule() {
  // Server identity — the teacher's own name for document exports.
  const teacherName = useCurrentUser((s) => s.me?.name) ?? 'Teacher'
  const reduce = useReducedMotion()
  const [data, setData] = useState<TimetablePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string>('')
  // Client clock — set after mount (the module is fetch-gated, so the
  // date-derived UI never renders on the server; no hydration mismatch).
  // Refreshed every minute so "Now"/"Next" stay honest on an open tab.
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  // Broadcast version this view last loaded at (null until the first load
  // completes) — only publishes landing AFTER that trigger a live refresh.
  const loadedVersionRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      setData(await fetchTimetable())
      // Baseline the broadcast version AT LOAD TIME — only publishes that
      // land AFTER this view loaded trigger a live refresh.
      loadedVersionRef.current = useLiveFeedStore.getState().timetableVersion
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /* ── LIVE timetable broadcasts (event-stream :3003) ──
   * The AppShell's socket pushes TIMETABLE_PUBLISHED frames into the
   * live-feed store (each bumps timetableVersion). When one lands after
   * this view loaded, quietly reload — the skeleton only renders before
   * the FIRST load, so an open tab never flashes; the emerald chip in the
   * toolbar confirms the update. */
  const timetableVersion = useLiveFeedStore((s) => s.timetableVersion)
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number | null>(null)
  useEffect(() => {
    if (loadedVersionRef.current === null) return // initial load not done yet
    if (timetableVersion === loadedVersionRef.current) return
    loadedVersionRef.current = timetableVersion
    let alive = true
    fetchTimetable()
      .then((data) => {
        if (!alive) return
        setData(data)
        setError(null)
        setLiveUpdatedAt(Date.now())
      })
      .catch(() => {
        /* keep showing the loaded schedule — the retry affordance stays */
      })
    return () => {
      alive = false
    }
  }, [timetableVersion])

  // ── ALL derivations before any early return (hooks discipline) ────
  const cells = useMemo(() => data?.cells ?? [], [data])
  const periodTimes = useMemo(() => data?.periodTimes ?? [], [data])
  const schoolDays = useMemo(() => data?.schoolDays ?? [], [data])
  const conflicts = useMemo(() => data?.conflicts ?? [], [data])
  const examDuties = useMemo(() => data?.examDuties ?? [], [data])
  const stats = data?.stats ?? { periodsPerWeek: 0, classes: 0, subjects: 0, teachingDays: 0 }
  const session = sessionLabel(data?.academicSession ?? null)

  const clock = now ?? new Date()
  const today = WEEKDAY_NAMES[clock.getDay()]
  const todayDateLabel = TODAY_DATE_FMT.format(clock)
  const isTeachingDay = schoolDays.includes(today)

  // Cells grouped per (day, period) — a slot may hold MORE than one class
  // (a conflict the API reports; the UI never hides the second entry).
  const bySlot = useMemo(() => {
    const m = new Map<string, TimetableCell[]>()
    for (const c of cells) {
      const k = `${c.day}|${c.period}`
      const arr = m.get(k) ?? []
      arr.push(c)
      m.set(k, arr)
    }
    return m
  }, [cells])
  const cellsAt = useCallback(
    (day: string, period: number): TimetableCell[] => bySlot.get(`${day}|${period}`) ?? [],
    [bySlot],
  )

  const todayCells = useMemo(
    () =>
      cells
        .filter((c) => c.day === today)
        .sort((a, b) => a.period - b.period),
    [cells, today],
  )

  // Live "Now"/"Next" — from the real client clock and the school ladder.
  const live = useMemo<LiveSlot | null>(() => {
    if (!isTeachingDay) return null
    const nowMin = clock.getHours() * 60 + clock.getMinutes()
    let currentPeriod: number | null = null
    for (const pt of periodTimes) {
      const s = minutesOf(pt.startTime)
      const e = minutesOf(pt.endTime)
      if (s != null && e != null && nowMin >= s && nowMin < e) {
        currentPeriod = pt.period
        break
      }
    }
    let nextPeriod: number | null = null
    if (currentPeriod == null) {
      const nowMinAgain = nowMin
      for (const pt of periodTimes) {
        const s = minutesOf(pt.startTime)
        if (s != null && nowMinAgain < s) {
          nextPeriod = pt.period
          break
        }
      }
    }
    return { currentPeriod, nextPeriod }
  }, [clock, isTeachingDay, periodTimes])

  if (loading && !data) return <HubModuleSkeleton />

  if (error && !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <HubEmptyState
          icon={AlertTriangle}
          title="Couldn't load your timetable"
          hint={error}
          action={
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
            </Button>
          }
        />
      </div>
    )
  }

  const summaryStats: HubStat[] = [
    {
      key: 'periods',
      label: 'Periods / Week',
      value: stats.periodsPerWeek,
      context: `across ${stats.teachingDays} teaching day${stats.teachingDays === 1 ? '' : 's'}`,
      icon: Table2,
      tone: 'emerald',
    },
    {
      key: 'classes',
      label: 'Classes',
      value: stats.classes,
      context: 'classes you teach',
      icon: School,
      tone: 'sky',
    },
    {
      key: 'subjects',
      label: 'Subjects',
      value: stats.subjects,
      context: 'subjects assigned',
      icon: BookOpen,
      tone: 'violet',
    },
    {
      key: 'today',
      label: "Today's Periods",
      value: todayCells.length,
      context:
        todayCells.length > 0
          ? `${today} · starts ${prettyTime(todayCells[0].startTime) ?? `${todayCells.length} periods`}`
          : `${today} · no teaching duty`,
      icon: Clock,
      tone: todayCells.length > 0 ? 'amber' : 'slate',
    },
  ]

  if (cells.length === 0) {
    return (
      <PageTransition className="space-y-4">
        <ModuleToolbar
          context={session ? `Academic Session ${session}` : 'Your weekly teaching schedule'}
        />
        <div className="rounded-xl border border-border bg-card p-6">
          <HubEmptyState
            icon={CalendarDays}
            title="No timetable slots assigned yet"
            hint="Your weekly teaching schedule will appear here once the school timetable includes you."
          />
        </div>
      </PageTransition>
    )
  }

  // Mobile day chips: default to today when it is a teaching day.
  const defaultDay = isTeachingDay ? today : (schoolDays[0] ?? today)
  const activeDay = schoolDays.includes(selectedDay) ? selectedDay : defaultDay

  const periodRangeLabel =
    periodTimes.length > 0
      ? `P${periodTimes[0].period}–P${periodTimes[periodTimes.length - 1].period}`
      : ''
  const dayRangeLabel =
    schoolDays.length > 0
      ? `${schoolDays[0].slice(0, 3)}–${schoolDays[schoolDays.length - 1].slice(0, 3)}`
      : ''

  return (
    <PageTransition className="space-y-4 sm:space-y-5">
      <ModuleToolbar
        context={`Your weekly teaching schedule${session ? ` · Academic Session ${session}` : ''}`}
        action={
          <div className="flex items-center gap-2">
            {liveUpdatedAt && (
              <span
                role="status"
                aria-live="polite"
                title="The principal published a new timetable — this view refreshed automatically"
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
              >
                <Radio className="h-3 w-3 animate-pulse text-emerald-500" aria-hidden />
                Updated · live
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                try {
                  downloadTeacherTimetablePdf({
                    teacherName: teacherName,
                    session,
                    days: schoolDays,
                    periodTimes,
                    cells,
                  })
                  toast.success('Timetable PDF downloaded', {
                    description: 'A4 landscape · print-ready weekly grid.',
                  })
                } catch {
                  toast.error('Could not generate the PDF')
                }
              }}
            >
              <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
              Export PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                void downloadTeacherTimetableDocx({
                  teacherName: teacherName,
                  session,
                  days: schoolDays,
                  periodTimes,
                  cells,
                })
                  .then(() => {
                    toast.success('Timetable Word document downloaded', {
                      description: 'Editable .docx table — open in Word / Docs.',
                    })
                  })
                  .catch(() => toast.error('Could not generate the Word document'))
              }}
            >
              <FileType2 className="h-3.5 w-3.5" aria-hidden="true" />
              Export Word
            </Button>
          </div>
        }
      />

      <HubStatCards stats={summaryStats} />

      {/* Stale-notice when a refresh failed but earlier data exists */}
      {error && <HubSectionError message={error} onRetry={() => void load()} />}

      {/* ── Conflict banner (only when the API reports conflicts) ────── */}
      {conflicts.length > 0 && (
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          aria-label="Timetable conflicts"
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <AlertTriangle
                className="h-4 w-4 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Timetable conflict detected
              </h2>
              <ul className="mt-1.5 space-y-1.5">
                {conflicts.map((c, i) => (
                  <li
                    key={`${c.kind}-${c.day}-${c.period}-${i}`}
                    className="text-xs leading-relaxed text-amber-800/90 dark:text-amber-200/90"
                  >
                    {conflictLine(c)}
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 border-t border-amber-500/20 pt-2 text-[10px] text-amber-700/80 dark:text-amber-300/70">
                This needs to be resolved in the timetable management layer. Contact the school
                timetable administrator.
              </p>
            </div>
          </div>
        </motion.section>
      )}

      {/* ── TODAY card — the quick view that answers "what now?" ─────── */}
      <section
        aria-label="Today's schedule"
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border bg-muted/20 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDays
              className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <h2 className="min-w-0 text-sm font-semibold text-foreground">
              Today · {todayDateLabel}
              {!isTeachingDay && (
                <span className="font-normal text-muted-foreground">
                  {' '}
                  — no classes scheduled (non-teaching day)
                </span>
              )}
            </h2>
          </div>
          {isTeachingDay && (
            <p className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {todayCells.length} teaching period{todayCells.length === 1 ? '' : 's'}
            </p>
          )}
        </header>
        {isTeachingDay && (
          <>
            {todayCells.length === 0 && (
              <p className="border-b border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
                No teaching periods today
              </p>
            )}
            <DayPeriodList
              day={today}
              periodTimes={periodTimes}
              cellsAt={cellsAt}
              live={live}
              reduce={reduce}
            />
          </>
        )}
      </section>

      {/* ── Examination duties (invigilation assigned by the principal) ── */}
      <ExamDutiesSection duties={examDuties} clock={clock} reduce={reduce} />

      {/* ── Desktop weekly grid (period rows × day columns) ─────────── */}
      <section
        aria-label="Weekly timetable"
        className="hidden overflow-hidden rounded-xl border border-border bg-card lg:block"
      >
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Table2
              className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              This Week
            </h2>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {[periodRangeLabel, dayRangeLabel].filter(Boolean).join(' · ')}
          </p>
        </header>
        <div className="overflow-x-auto">
          {/* table-fixed: columns share the card width equally and content
              truncates — the weekly grid NEVER forces the page (or its
              card) to overflow, even on narrow iPad widths. */}
          <table className="w-full table-fixed border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-24 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Period
                </th>
                {schoolDays.map((d) => (
                  <th
                    key={d}
                    className={cn(
                      'px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wider',
                      d === today
                        ? 'bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                        : 'text-muted-foreground',
                    )}
                  >
                    {d.slice(0, 3)}
                    {d === today && (
                      <span className="ml-1.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Today
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodTimes.map((pt) => (
                <tr key={pt.period} className="border-b border-border/40 last:border-b-0">
                  <td className="px-3 py-2.5 align-top">
                    <p className="font-display text-[11px] font-bold tabular-nums text-foreground">
                      P{pt.period}
                    </p>
                    <p className="mt-0.5 text-[9px] leading-tight text-muted-foreground/80 tabular-nums">
                      {prettyRange(pt.startTime, pt.endTime)}
                    </p>
                  </td>
                  {schoolDays.map((d) => {
                    const entries = cellsAt(d, pt.period)
                    const isTodayCol = d === today
                    if (entries.length === 0) {
                      return (
                        <td
                          key={d}
                          className={cn('px-2.5 py-2.5 align-top', isTodayCol && 'bg-emerald-500/[0.04]')}
                        >
                          <span className="text-muted-foreground/50">Free</span>
                        </td>
                      )
                    }
                    return (
                      <td
                        key={d}
                        className={cn('px-2.5 py-2.5 align-top', isTodayCol && 'bg-emerald-500/[0.04]')}
                      >
                        <div className="min-w-0 space-y-1.5">
                          {entries.map((e, i) => (
                            <div key={`${d}-${pt.period}-${i}`} className="min-w-0">
                              <p className="flex items-center gap-1 text-xs font-medium text-foreground">
                                <span className="truncate">{e.subjectName}</span>
                                {entries.length > 1 && (
                                  <AlertTriangle
                                    className="h-3 w-3 shrink-0 text-amber-500"
                                    aria-hidden="true"
                                  />
                                )}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                {e.classLabel}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-muted-foreground/80">
                                {e.room ?? 'Room not assigned'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Mobile / tablet: day chips + that day's period list ────── */}
      <section
        aria-label="Timetable by day"
        className="overflow-hidden rounded-xl border border-border bg-card lg:hidden"
      >
        <div
          role="tablist"
          aria-label="Choose a weekday"
          className="flex gap-1.5 overflow-x-auto border-b border-border bg-muted/20 px-3 py-2.5"
        >
          {schoolDays.map((d) => {
            const isActive = d === activeDay
            return (
              <button
                key={d}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedDay(d)}
                className={cn(
                  'min-h-[40px] shrink-0 rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50',
                )}
              >
                {d.slice(0, 3)}
                {d === today && <span className="sr-only"> (today)</span>}
                {d === today && (
                  <span
                    aria-hidden="true"
                    className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle"
                  />
                )}
              </button>
            )
          })}
        </div>

        {cells.filter((c) => c.day === activeDay).length === 0 && (
          <p className="border-b border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
            No teaching periods on {activeDay}
          </p>
        )}
        <DayPeriodList
          day={activeDay}
          periodTimes={periodTimes}
          cellsAt={cellsAt}
          live={activeDay === today ? live : null}
          reduce={reduce}
        />
      </section>

      <p className="text-center text-[10px] text-muted-foreground">
        Your personal schedule, read from the school timetable. Rooms and period times are set by the
        school timetable administrator.
      </p>
    </PageTransition>
  )
}
