'use client'

/**
 * AttendanceHistoryTab — canonical day-level attendance records.
 *
 * A date picker (the module's shared date) + the shared class filter +
 * a status filter + search narrow the REAL `sections` rosters for the
 * selected day: one row per student with an attendance record that day,
 * each carrying their canonical status. Row click → the student's
 * canonical history drill (?studentId=).
 *
 * Exports:
 *   - CSV  — exactly the rows the table renders
 *   - PDF  — Excel-style attendance register (rosters + statuses for the
 *            day, scoped to All Classes or one class)
 *
 * The legacy `attendanceHistory` mock (December 2025 classes) is gone.
 * Staff attendance export is gone too — no canonical staff attendance
 * data exists (see the Staff tab's honest empty state).
 */

import { useMemo, useState } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { Search, Download, Eye, FileText, ChevronDown, CheckCircle2, Loader2, CalendarOff, AlertCircle, RotateCw } from 'lucide-react'
import { PageTransition, GlassCard } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadCSVFile, safeFileName } from '@/lib/download-file'
import { toCsv } from '@/lib/csv'
import { toast } from 'sonner'
import {
  formatDateLabel,
  type AttendanceSnapshot,
} from './data'
import { StatusBadge, STATUS_ORDER } from './attendance-status'
import { StudentDrillDialog } from './shared'
import { generateAttendanceRegisterPDF } from './monthly-report-pdf'

interface HistoryRow {
  classId: string
  classLabel: string
  studentId: string
  rollNo: string
  name: string
  status: 'present' | 'late' | 'absent' | 'leave'
}

interface AttendanceHistoryTabProps {
  snapshot: AttendanceSnapshot | null
  loading: boolean
  error: string | null
  reload: () => void
  /** null = follows the server "today" */
  selectedDate: string | null
  onDateChange: (date: string) => void
  classFilter: string
  setClassFilter: (v: string) => void
}

type ExportKind = 'pdf' | null

export function AttendanceHistoryTab({
  snapshot, loading, error, reload, selectedDate, onDateChange, classFilter, setClassFilter,
}: AttendanceHistoryTabProps) {
  const reduce = useReducedMotion()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [viewStudent, setViewStudent] = useState<HistoryRow | null>(null)
  const [exporting, setExporting] = useState<ExportKind>(null)
  const [exported, setExported] = useState<{ label: string } | null>(null)

  const effectiveDate = selectedDate ?? snapshot?.date ?? null
  const classOptions = snapshot?.byClass ?? []

  // Real rows: students WITH an attendance record on the selected day.
  const rows = useMemo<HistoryRow[]>(() => {
    if (!snapshot) return []
    const out: HistoryRow[] = []
    for (const section of snapshot.sections) {
      if (classFilter !== 'all' && section.classId !== classFilter) continue
      for (const s of section.roster) {
        if (s.status !== 'PRESENT' && s.status !== 'LATE' && s.status !== 'ABSENT' && s.status !== 'LEAVE') continue
        const status = s.status === 'PRESENT' ? 'present'
          : s.status === 'LATE' ? 'late'
          : s.status === 'ABSENT' ? 'absent'
          : 'leave'
        out.push({
          classId: section.classId,
          classLabel: section.classLabel,
          studentId: s.studentId,
          rollNo: s.rollNo,
          name: s.name,
          status,
        })
      }
    }
    return out.sort((a, b) =>
      a.classLabel.localeCompare(b.classLabel)
      || a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }),
    )
  }, [snapshot, classFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (q) {
        const hay = `${r.name} ${r.rollNo} ${r.classLabel}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, statusFilter, search])

  // Real day summary (class-filtered)
  const daySummary = useMemo(() => {
    if (!snapshot) return null
    const scoped = snapshot.byClass.filter((c) => classFilter === 'all' || c.classId === classFilter)
    const present = scoped.reduce((s, c) => s + c.present, 0)
    const absent = scoped.reduce((s, c) => s + c.absent, 0)
    const late = scoped.reduce((s, c) => s + c.late, 0)
    const leave = scoped.reduce((s, c) => s + c.leave, 0)
    const recorded = scoped.reduce((s, c) => s + c.recorded, 0)
    const rate = recorded > 0 ? Math.round(((present + late) / recorded) * 1000) / 10 : 0
    return { present, absent, late, leave, recorded, rate }
  }, [snapshot, classFilter])

  const latestRecorded = snapshot && snapshot.weekTrend.length > 0
    ? snapshot.weekTrend[snapshot.weekTrend.length - 1]
    : null

  // ── CSV export: exactly the rendered rows ──
  const handleExportCsv = () => {
    if (!effectiveDate) return
    const csvRows = filtered.map((r) => [
      effectiveDate,
      r.classLabel,
      r.rollNo,
      r.name,
      r.status.charAt(0).toUpperCase() + r.status.slice(1),
    ])
    const filename = safeFileName(
      `attendance-history-${effectiveDate}${classFilter === 'all' ? '' : `-${classFilter.slice(-6)}`}`,
      'csv',
    )
    downloadCSVFile(
      toCsv(['Date', 'Class', 'Roll No', 'Student', 'Status'], csvRows),
      filename,
    )
    toast.success('Attendance history exported', {
      description: `${filename} · ${csvRows.length} record${csvRows.length === 1 ? '' : 's'} · ${formatDateLabel(effectiveDate)}`,
    })
  }

  // ── PDF export: Excel-style attendance register (real rosters) ──
  const handleExportPdf = async (classId: string = 'all') => {
    if (exporting || !snapshot || !effectiveDate) return
    setExporting('pdf')
    setExported(null)
    try {
      const { filename } = await generateAttendanceRegisterPDF({
        date: effectiveDate,
        classId,
        sections: snapshot.sections,
        byClass: snapshot.byClass,
        monthTrend: snapshot.monthTrend,
      })
      const cls = snapshot.byClass.find((c) => c.classId === classId)
      const label = cls
        ? `Attendance Register · ${formatDateLabel(effectiveDate)} · ${cls.classLabel}`
        : `Attendance Register · ${formatDateLabel(effectiveDate)} · All Classes`
      setExported({ label })
      toast.success('Attendance register generated', {
        description: `${filename} · ${label}`,
      })
    } catch {
      toast.error('Unable to generate report', {
        description: 'Please try again.',
      })
    } finally {
      setExporting(null)
    }
  }

  if (loading && !snapshot) {
    return (
      <PageTransition className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </PageTransition>
    )
  }

  if (error && !snapshot) {
    return (
      <PageTransition className="space-y-4">
        <GlassCard className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Unable to load attendance history</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 mt-3 rounded-lg" onClick={reload}>
                <RotateCw className="h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          </div>
        </GlassCard>
      </PageTransition>
    )
  }

  if (!snapshot || !effectiveDate) return null

  const scopeLabel = classFilter === 'all'
    ? 'All Classes'
    : classOptions.find((c) => c.classId === classFilter)?.classLabel ?? ''

  return (
    <PageTransition className="space-y-4">
      {/* Filters row — date + class + status + search (same h-8 rhythm) */}
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker
          value={effectiveDate}
          onChange={onDateChange}
          maxDate={snapshot.date}
          compact
        />

        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger size="sm" className="w-[160px] text-xs rounded-lg">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classOptions.map((c) => (
              <SelectItem key={c.classId} value={c.classId}>{c.classLabel}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-[130px] text-xs rounded-lg">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student…"
            className="h-8 pl-8 pr-3 text-xs w-[160px] rounded-lg"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 rounded-lg"
            onClick={handleExportCsv}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 rounded-lg"
                disabled={exporting !== null}
              >
                {exporting === 'pdf' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                {exporting === 'pdf' ? 'Generating...' : 'Export PDF'}
                <ChevronDown className="h-3 w-3 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Attendance Register · {formatDateLabel(effectiveDate)}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExportPdf('all')} className="text-xs gap-2">
                <FileText className="h-3.5 w-3.5" /> All Classes
              </DropdownMenuItem>
              {classOptions.map((c) => (
                <DropdownMenuItem key={c.classId} onClick={() => handleExportPdf(c.classId)} className="text-xs gap-2">
                  <FileText className="h-3.5 w-3.5" /> {c.classLabel}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Export success feedback */}
      <AnimatePresence mode="wait">
        {exported && (
          <motion.div
            key={exported.label}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold">Report ready</span>
            <span className="text-emerald-600/70 dark:text-emerald-400/70">·</span>
            <span className="text-emerald-700/80 dark:text-emerald-300/80">{exported.label}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real day summary strip */}
      {daySummary && daySummary.recorded > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{formatDateLabel(effectiveDate)}</span>
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          {scopeLabel}
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          <span className="font-semibold tabular-nums text-foreground">{daySummary.recorded}</span> recorded
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{daySummary.present}</span> present
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{daySummary.late}</span> late
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">{daySummary.absent}</span> absent
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          <span className="font-semibold text-sky-600 dark:text-sky-400 tabular-nums">{daySummary.leave}</span> leave
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          <span className="font-semibold tabular-nums text-foreground">{daySummary.rate}%</span> rate
        </p>
      )}

      {/* Records table — real rows for the selected day */}
      {rows.length === 0 ? (
        <GlassCard className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0">
              <CalendarOff className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                No attendance recorded for {formatDateLabel(effectiveDate)}
                {classFilter !== 'all' ? ` — ${scopeLabel}` : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Try another date{latestRecorded ? ` — the most recent recorded day is ${formatDateLabel(latestRecorded.date)}` : ''}.
              </p>
            </div>
            {latestRecorded && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs rounded-lg shrink-0"
                onClick={() => onDateChange(latestRecorded.date)}
              >
                Go to {formatDateLabel(latestRecorded.date)}
              </Button>
            )}
          </div>
        </GlassCard>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_0_hsl(var(--border))]">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5">Class</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5 w-16">Roll</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5">Student</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5 w-28">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground py-2.5 text-right w-16">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {filtered.map((r, i) => (
                  <motion.tr
                    key={`${r.classId}-${r.studentId}`}
                    layout
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: Math.min(i * 0.01, 0.2), duration: 0.25 }}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors text-xs cursor-pointer"
                    onClick={() => setViewStudent(r)}
                  >
                    <TableCell className="py-2.5 font-medium text-foreground">{r.classLabel}</TableCell>
                    <TableCell className="py-2.5 font-mono tabular-nums text-muted-foreground">{r.rollNo}</TableCell>
                    <TableCell className="py-2.5 font-medium text-foreground">{r.name}</TableCell>
                    <TableCell className="py-2.5">
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setViewStudent(r) }}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                        title="View student history"
                        aria-label={`View ${r.name} attendance history`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                    No records match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {filtered.length > 100 && (
        <p className="text-[10px] text-muted-foreground text-center">
          Showing first 100 of {filtered.length} records · refine filters to narrow
        </p>
      )}

      {/* Per-student canonical history drill */}
      <StudentDrillDialog
        student={viewStudent ? {
          studentId: viewStudent.studentId,
          name: viewStudent.name,
          rollNo: viewStudent.rollNo,
          classLabel: viewStudent.classLabel,
        } : null}
        date={effectiveDate}
        onClose={() => setViewStudent(null)}
      />
    </PageTransition>
  )
}
