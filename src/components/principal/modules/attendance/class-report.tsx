'use client'

/**
 * ClassReport — class-wise attendance table (canonical).
 *
 * Rows are the snapshot's `byClass` for the selected date: real enrolled
 * student counts, real recorded/present/absent/late/leave counts, real
 * rates. Classes without attendance rows for the date show an honest
 * '—' rate (never a fabricated number).
 *
 * Structure (Class / Students / Present / Absent / Late / Leave / Rate /
 * Status) preserved from the previous design.
 */

import { motion, useReducedMotion } from 'framer-motion'
import { FileSpreadsheet } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import type { ClassBreakdown } from './data'
import { formatDateLabel } from './data'

export function ClassReport({ byClass, classFilter = 'all', date }: {
  byClass: ClassBreakdown[]
  classFilter?: string
  date: string
}) {
  // Narrow to the selected class; sort by real rate (recorded classes
  // first, highest rate first), unrecorded classes keep school order.
  const rows = [...byClass]
    .filter((r) => classFilter === 'all' || r.classId === classFilter)
    .sort((a, b) => {
      const ra = a.rate ?? -1
      const rb = b.rate ?? -1
      if (rb !== ra) return rb - ra
      return a.classLabel.localeCompare(b.classLabel)
    })

  return (
    <GlassCard className="p-3 sm:p-4 lg:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
            Class-wise Attendance Report
          </h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            {formatDateLabel(date)} · attendance by class · sorted by rate
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_0_hsl(var(--border))]">
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5">Class</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5 text-right">Students</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5 text-right">Recorded</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5 text-right">Present</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5 text-right">Absent</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5 text-right">Late</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5 text-right">Leave</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5 w-32">Rate</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <ClassRowItem key={row.classId} idx={i} row={row} />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-6">
                  No classes found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </GlassCard>
  )
}

const ATTENDANCE_COLORS = {
  excellent: 'oklch(0.65 0.16 162)',
  good: 'oklch(0.55 0.13 220)',
  average: 'oklch(0.75 0.15 75)',
  atRisk: 'oklch(0.62 0.2 25)',
}

function ClassRowItem({ row, idx }: { row: ClassBreakdown; idx: number }) {
  const reduce = useReducedMotion()
  const recorded = row.recorded > 0
  const pct = row.rate ?? 0
  const status = !recorded
    ? '—'
    : pct >= 95 ? 'Excellent' : pct >= 90 ? 'Good' : pct >= 85 ? 'Average' : 'Needs Attention'
  const statusColor = !recorded
    ? 'bg-muted/50 text-muted-foreground border-border'
    : pct >= 95
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
    : pct >= 90
    ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20'
    : pct >= 85
    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
    : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
  const barColor = !recorded
    ? 'var(--muted-foreground)'
    : pct >= 95
    ? ATTENDANCE_COLORS.excellent
    : pct >= 90
    ? ATTENDANCE_COLORS.good
    : pct >= 85
    ? ATTENDANCE_COLORS.average
    : ATTENDANCE_COLORS.atRisk
  return (
    <TableRow className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors text-xs">
      <TableCell className="font-medium text-foreground py-2.5">{row.classLabel}</TableCell>
      <TableCell className="font-mono tabular-nums text-muted-foreground py-2.5 text-right">{row.students}</TableCell>
      <TableCell className="font-mono tabular-nums text-muted-foreground py-2.5 text-right">{row.recorded}</TableCell>
      <TableCell className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 py-2.5 text-right">{row.present}</TableCell>
      <TableCell className="font-mono tabular-nums text-rose-600 dark:text-rose-400 py-2.5 text-right">{row.absent}</TableCell>
      <TableCell className="font-mono tabular-nums text-amber-600 dark:text-amber-400 py-2.5 text-right">{row.late}</TableCell>
      <TableCell className="font-mono tabular-nums text-sky-600 dark:text-sky-400 py-2.5 text-right">{row.leave}</TableCell>
      <TableCell className="py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-muted/60 overflow-hidden">
            <motion.div
              initial={reduce ? false : { width: 0 }}
              animate={{ width: recorded ? `${pct}%` : '0%' }}
              transition={{ duration: 0.6, delay: Math.min(idx * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full"
              style={{ background: barColor }}
            />
          </div>
          <span className="text-[10px] font-semibold tabular-nums w-9 text-right">
            {recorded ? `${pct}%` : '—'}
          </span>
        </div>
      </TableCell>
      <TableCell className="py-2.5">
        <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${statusColor}`}>
          {status}
        </span>
      </TableCell>
    </TableRow>
  )
}
