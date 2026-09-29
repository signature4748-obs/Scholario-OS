'use client'

import { Activity, AlertTriangle, Calendar, CalendarCheck, Clock3 } from 'lucide-react'
import type { StudentRecord } from '@/lib/store/students-store'
import type { StudentProfileRealData } from './profile-real-data'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Metric, Section } from './shared'

type Props = { student: StudentRecord; real?: StudentProfileRealData }

/** Tone class for one attendance record status. */
function attRecordClass(status: string): string {
  switch (status) {
    case 'PRESENT': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'LATE': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    case 'LEAVE': return 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
    default: return 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
  }
}

function attStatusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

/** Small bordered count tile. */
function CountTile({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 px-2 py-2 text-center">
      <p className={cn('font-display text-lg font-bold tabular-nums', className)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

export function AttendanceTab({ student, real }: Props) {
  // ── Teacher / server-authorized view: REAL canonical Attendance rows ──
  if (real?.attendance) {
    const att = real.attendance
    if (att.records === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Metric icon={<Activity className="h-3.5 w-3.5" />} label="Attendance" value={att.pct != null ? `${att.pct}%` : '—'} color={att.pct != null && att.pct < 75 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'} />
          <Metric icon={<Calendar className="h-3.5 w-3.5" />} label="Days Recorded" value={`${att.records}`} color="text-violet-600 dark:text-violet-400" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <CountTile label="Present" value={att.present} className="text-emerald-600 dark:text-emerald-400" />
          <CountTile label="Absent" value={att.absent} className="text-rose-600 dark:text-rose-400" />
          <CountTile label="Late" value={att.late} className="text-amber-600 dark:text-amber-400" />
          <CountTile label="On Leave" value={att.leave} className="text-sky-600 dark:text-sky-400" />
        </div>
        {att.recent.length > 0 && (
          <Section title="Recent Records">
            <div className="space-y-1.5 rounded-lg border border-border bg-card/40 p-3">
              {att.recent.map((r, i) => (
                <div key={`${r.date}-${i}`} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{formatDate(r.date)}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', attRecordClass(r.status))}>
                    {attStatusLabel(r.status)}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    )
  }

  // ── Principal store view — honest statistics derived from the stored
  // monthly trend (no fabricated day counts). A student with no records
  // at all (fresh admission) shows ONLY the empty state — no fabricated
  // "0%" average metric. ────────────────────────────────────────────────
  const trend = student.attendanceTrend
  const hasRecords = trend.length > 0 || student.attendance > 0
  const best = trend.length > 0 ? Math.max(...trend.map((m) => m.percent)) : null
  const belowMin = trend.filter((m) => m.percent < 75).length
  if (!hasRecords) {
    return (
      <div className="py-8 text-center">
        <Clock3 className="mx-auto h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted-foreground">No attendance records on file.</p>
        <p className="mt-1 text-xs text-muted-foreground">Records appear once the class attendance is marked.</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Metric icon={<Activity className="h-3.5 w-3.5" />} label="Avg" value={`${student.attendance}%`} color="text-emerald-600 dark:text-emerald-400" />
        <Metric icon={<CalendarCheck className="h-3.5 w-3.5" />} label="Best Month" value={best != null ? `${best}%` : '—'} color="text-violet-600 dark:text-violet-400" />
        <Metric icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Months < 75%" value={`${belowMin}`} color={belowMin > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'} />
      </div>
      {trend.length > 0 ? (
        <Section title="Monthly Attendance">
          <div className="space-y-2">
            {trend.map((m) => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="text-xs font-medium w-10">{m.month}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${m.percent}%`, background: m.percent >= 90 ? 'oklch(0.6 0.18 150)' : m.percent >= 75 ? 'oklch(0.7 0.15 75)' : 'oklch(0.6 0.2 25)' }} />
                </div>
                <span className="text-xs font-semibold w-10 text-right">{m.percent}%</span>
              </div>
            ))}
          </div>
        </Section>
      ) : (
        <div className="py-8 text-center">
          <Clock3 className="mx-auto h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
          <p className="mt-2 text-sm text-muted-foreground">No attendance records on file.</p>
        </div>
      )}
    </div>
  )
}
