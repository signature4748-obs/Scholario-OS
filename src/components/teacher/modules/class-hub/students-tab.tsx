'use client'

/**
 * class-hub/students-tab — the GRADE-X CLASS DIRECTORY inside My Class
 * (spec §12). This is NOT the global Student Directory: it shows ONLY
 * the students of the class-teacher's class, with the BROADER authorized
 * class view (attendance, growth, academic, fee standing). Clicking a
 * student opens the ONE canonical Student Profile sheet — there is no
 * second profile system (§2).
 */

import { useMemo } from 'react'
import { CheckCircle2, ChevronRight, Search, Users } from 'lucide-react'
import { GradientAvatar } from '@/components/shared/ui'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SectionCard } from '../shared/section-card'
import { HubEmptyState } from '../shared/hub-stat-cards'
import type { HubDirectoryStudent } from './types'

export function StudentsTab({
  label,
  directory,
  search,
  onOpenProfile,
}: {
  label: string
  directory: HubDirectoryStudent[]
  search: string
  onOpenProfile: (studentId: string) => void
}) {
  const q = search.trim().toLowerCase()
  const rows = useMemo(
    () =>
      q
        ? directory.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              (s.rollNo ?? '').toLowerCase().includes(q) ||
              (s.admissionNo ?? '').toLowerCase().includes(q),
          )
        : directory,
    [directory, q],
  )

  return (
    <SectionCard
      icon={Users}
      title={`${label} · Class Directory`}
      subtitle={
        q
          ? `${rows.length} of ${directory.length} students match “${search.trim()}”`
          : `${directory.length} students · full authorized class view`
      }
      contentClassName=""
    >
      {rows.length === 0 ? (
        <HubEmptyState
          icon={Search}
          title={q ? `No students match “${search.trim()}”` : 'No students enrolled'}
          hint={q ? 'Try a different name, roll number or admission number.' : 'Active students enrolled in this class will appear here.'}
          className="py-10"
        />
      ) : (
        <div className="max-h-[calc(100dvh-19rem)] overflow-y-auto">
          {/* table ≥ lg */}
          <table className="hidden w-full text-left lg:table">
            <thead>
              <tr className="sticky top-0 z-[1] border-b border-border bg-muted/95 text-[10px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur">
                <th scope="col" className="px-4 py-2.5">Student</th>
                <th scope="col" className="px-3 py-2.5">Roll</th>
                <th scope="col" className="px-3 py-2.5">Adm. No</th>
                <th scope="col" className="px-3 py-2.5">Attendance</th>
                <th scope="col" className="px-3 py-2.5">Growth</th>
                <th scope="col" className="px-3 py-2.5">Academic</th>
                <th scope="col" className="px-3 py-2.5">Fees</th>
                <th scope="col" className="px-4 py-2.5 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((s) => (
                <DirectoryTableRow key={s.studentId} s={s} onOpenProfile={onOpenProfile} />
              ))}
            </tbody>
          </table>
          {/* stacked rows < lg (mobile / tablet) */}
          <ul className="divide-y divide-border/50 lg:hidden">
            {rows.map((s) => (
              <li key={s.studentId}>
                <button
                  type="button"
                  onClick={() => onOpenProfile(s.studentId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                >
                  <GradientAvatar name={s.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {s.name}
                      <span className="ml-1.5 text-[11px] font-semibold text-muted-foreground">#{s.rollNo ?? '—'}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>Att {s.attendancePct != null ? `${s.attendancePct}%` : '—'}</span>
                      <span aria-hidden>·</span>
                      <span>Growth {s.growthScore != null ? s.growthScore : 'Building'}</span>
                      <span aria-hidden>·</span>
                      <span>Acad {s.academicPct != null ? `${s.academicPct}%` : '—'}</span>
                      {s.feeOutstanding > 0 && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={s.feeOverdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'font-semibold text-amber-600 dark:text-amber-400'}>
                            {formatINR(s.feeOutstanding)} due
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  )
}

function DirectoryTableRow({ s, onOpenProfile }: { s: HubDirectoryStudent; onOpenProfile: (id: string) => void }) {
  return (
    <tr
      className="cursor-pointer transition-colors hover:bg-accent/40"
      onClick={() => onOpenProfile(s.studentId)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenProfile(s.studentId)
      }}
      aria-label={`Open ${s.name}'s profile`}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <GradientAvatar name={s.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{s.name}</p>
            <p className="text-[10px] text-muted-foreground">{s.admissionNo ?? '—'}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs font-semibold tabular-nums text-muted-foreground">{s.rollNo ?? '—'}</td>
      <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground">{s.admissionNo ?? '—'}</td>
      <td className="px-3 py-2.5"><PctChip pct={s.attendancePct} /></td>
      <td className="px-3 py-2.5">
        {s.growthScore != null ? (
          <span className="text-xs font-bold tabular-nums">{s.growthScore}</span>
        ) : (
          <span className="text-xs text-muted-foreground/70">Building</span>
        )}
      </td>
      <td className="px-3 py-2.5"><PctChip pct={s.academicPct} /></td>
      <td className="px-3 py-2.5">
        {s.feeOutstanding > 0 ? (
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
            s.feeOverdue
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
          )}>
            {formatINR(s.feeOutstanding)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Paid
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </td>
    </tr>
  )
}

/** Quiet percentage chip with tone. */
function PctChip({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground/70">—</span>
  const t = pct >= 85 ? 'emerald' : pct >= 75 ? 'amber' : 'rose'
  const cls =
    t === 'emerald'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : t === 'amber'
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', cls)}>
      {pct}%
    </span>
  )
}
