'use client'

/**
 * students/students-grid — the roster: class selection + search + status
 * filters + the student cards, all derived from the real class roster
 * payload.
 *
 * CLASS DROPDOWN (Task W3-a) — the roster's toolbar carries the class
 * selection as a compact h-9 Select ("All Classes" + every authorized
 * class with its student count; classes the teacher is class teacher of
 * carry a tiny emerald dot). It replaced the big chip row that used to
 * live above the summary cards — one filter surface, no duplicated
 * chrome.
 *
 * SEARCH  name · roll number · admission number (case-insensitive).
 * FILTERS All / At Risk / Top Attendance — the At Risk and Top Attendance
 *         rules are defined and documented in ./shared (attendance
 *         < 75% or latest exam average < 40% · attendance ≥ 95%); the
 *         chips carry live counts so the labels are never arbitrary.
 *
 * RESPONSIVE ARCHITECTURE (redesign):
 *   · The card grid is CONTENT-AWARE, not viewport-aware:
 *       repeat(auto-fill, minmax(min(100%, 300px), 1fr))
 *     The card — not the device — defines the breakpoint. 300px is the
 *     minimum width at which the 3-column metric band keeps every label
 *     readable, so the grid picks as many whole columns as genuinely
 *     fit (1 on phones · 2-3 on laptops — even with the sidebar
 *     expanded · 3-5 on large monitors) and can never squeeze a card
 *     below its usable width or overflow the page horizontally
 *     (min(100%, …) collapses to a single full-width column first).
 *   · The toolbar wraps: roster line + class dropdown + search stack on
 *     phones, share a row from sm. The search and the class dropdown are
 *     full-width on phones (never squeezed) and the filter chips keep
 *     38px touch targets below sm.
 *   · The roster itself scrolls in its own contained area (never the
 *     page) once it exceeds ~720px.
 */

import { useMemo, useState } from 'react'
import { Search, Users } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { HubEmptyState } from '../shared/hub-stat-cards'
import { StudentCard } from './student-card'
import {
  DIRECTORY_FILTERS,
  matchesFilter,
  matchesSearch,
  type DirectoryFilter,
} from './shared'
import type { DirectoryClass, DirectoryStudent } from './types'

const THIN_SCROLLBAR =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent'

export function StudentsGrid({
  students,
  classes,
  classId,
  onClassChange,
  onSelect,
}: {
  students: DirectoryStudent[]
  /** the real authorized class list (dropdown options) */
  classes: DirectoryClass[]
  /** selected class id — null = All Classes */
  classId: string | null
  onClassChange: (id: string | null) => void
  onSelect: (s: DirectoryStudent) => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DirectoryFilter>('all')

  const activeClass = useMemo(
    () => classes.find((c) => c.id === classId) ?? null,
    [classes, classId],
  )
  // Fee records exist only for the teacher's class-teacher classes —
  // drives the roster subtitle in both single-class and All-Classes views.
  const isClassTeacher = activeClass?.isClassTeacher ?? false
  const rosterLabel = activeClass?.label ?? 'All Classes'

  const counts = useMemo(
    () => ({
      all: students.length,
      'at-risk': students.filter((s) => matchesFilter(s, 'at-risk')).length,
      'top-attendance': students.filter((s) => matchesFilter(s, 'top-attendance')).length,
    }),
    [students],
  )

  const filtered = useMemo(
    () => students.filter((s) => matchesSearch(s, search) && matchesFilter(s, filter)),
    [students, search, filter],
  )

  const searching = search.trim() !== '' || filter !== 'all'

  return (
    <GlassCard hover={false} className="p-3 sm:p-4 lg:p-5">
      {/* toolbar: roster line + class dropdown + search — stacks on
          phones, one row from sm */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">
            {rosterLabel} · {students.length} student{students.length === 1 ? '' : 's'}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {activeClass ? (
              isClassTeacher ? (
                <>Class-teacher view — fee &amp; payment records included</>
              ) : (
                <>Sorted by roll number · fee records belong to the class teacher</>
              )
            ) : (
              <>Fee records shown only for your class-teacher classes</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          {/* class selection — "All Classes" + the authorized classes,
              each with its real student count; an emerald dot marks the
              classes this teacher is class teacher of */}
          <Select
            value={classId ?? 'all'}
            onValueChange={(v) => onClassChange(v === 'all' ? null : v)}
          >
            <SelectTrigger
              aria-label="Filter roster by class"
              className="h-9 w-full text-xs font-medium sm:w-[170px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="truncate">
                      {c.label} · {c.studentCount}
                    </span>
                    {c.isClassTeacher && (
                      <>
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                          aria-hidden="true"
                        />
                        <span className="sr-only">Class teacher</span>
                      </>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-60 lg:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, roll or admission no…"
              aria-label="Search students by name, roll or admission number"
              className="h-9 w-full pl-9 text-xs sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* filter chips — live counts, thresholds documented in ./shared.
          38px touch targets below sm; the row wraps instead of scrolling
          so the page never scrolls horizontally. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div
          className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/50 p-1"
          role="group"
          aria-label="Status filter"
        >
          {DIRECTORY_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                'min-h-[38px] rounded-md px-3 text-xs font-medium transition-colors sm:min-h-[32px]',
                filter === f.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
              <span className="ml-1 tabular-nums text-[10px] text-muted-foreground">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        {searching && filtered.length !== students.length && (
          <p className="text-[11px] text-muted-foreground">
            Showing {filtered.length} of {students.length}
          </p>
        )}
      </div>

      {/* the roster itself — scrolls in its own contained area */}
      {students.length === 0 ? (
        <HubEmptyState
          icon={Users}
          title={activeClass ? 'No students in this class' : 'No students in your classes'}
          hint="Active students enrolled in your authorized classes will appear here."
          className="mt-2 py-8"
        />
      ) : filtered.length === 0 ? (
        <HubEmptyState
          icon={Search}
          title={
            search.trim() !== ''
              ? `No students match “${search.trim()}”`
              : filter === 'at-risk'
                ? 'No students are at risk in this selection'
                : 'No students at 95% attendance or above yet'
          }
          hint={
            search.trim() !== ''
              ? 'Try a different name, roll or admission number.'
              : filter === 'at-risk'
                ? 'Students appear here when attendance drops below 75% or the latest exam average is under 40%.'
                : 'Students appear here once their attendance reaches 95%.'
          }
          className="mt-2 py-8"
        />
      ) : (
        <div
          className={cn(
            'mt-4 max-h-[720px] overflow-y-auto pr-1 -mr-1',
            THIN_SCROLLBAR,
          )}
          aria-label={`${rosterLabel} student cards`}
        >
          {/* content-aware columns: as many whole 300px cards as fit,
              single full-width column when none do — see file header */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3 sm:gap-4">
            {filtered.map((s, i) => (
              <StudentCard key={s.id} student={s} index={i} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  )
}
