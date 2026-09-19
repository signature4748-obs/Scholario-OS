'use client'

/**
 * class-hub/attendance-card — today's attendance snapshot for the class.
 * "Not marked yet" is a call to action (the class teacher is the one
 * responsible), a marked day shows the honest per-status counts.
 */

import { motion } from 'framer-motion'
import { CalendarCheck, CheckCircle2, Clock } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { cn } from '@/lib/utils'
import type { ClassHubClass } from './types'

function StatusTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 px-2 py-2 text-center">
      <p className={cn('font-display text-lg font-bold tabular-nums', tone)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

export function AttendanceCard({
  cls,
  onNavigate,
}: {
  cls: ClassHubClass
  onNavigate: (key: string) => void
}) {
  const att = cls.attendanceToday
  return (
    <GlassCard hover={false} className="p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          Attendance Today
        </h3>
        {att.marked ? (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Marked
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            <Clock className="h-3 w-3" aria-hidden="true" /> Pending
          </span>
        )}
      </div>

      {att.marked ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatusTile label="Present" value={att.present} tone="text-emerald-600 dark:text-emerald-400" />
            <StatusTile label="Absent" value={att.absent} tone="text-rose-600 dark:text-rose-400" />
            <StatusTile label="Late" value={att.late} tone="text-amber-600 dark:text-amber-400" />
            <StatusTile label="On Leave" value={att.leave} tone="text-sky-600 dark:text-sky-400" />
          </div>
          <p className="mt-2.5 text-[11px] text-muted-foreground">
            {att.present + att.late} of {cls.studentCount} students attended today
          </p>
        </>
      ) : (
        <>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/[0.04] px-3 py-3 text-xs text-muted-foreground"
          >
            Today&rsquo;s attendance has not been marked yet — as class teacher, this is your morning duty.
          </motion.p>
          <button
            type="button"
            onClick={() => onNavigate('attendance')}
            className="mt-2.5 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mark attendance now
          </button>
        </>
      )}
    </GlassCard>
  )
}
