'use client'

/**
 * OverviewTab — institution-wide KPIs for Students & Classes.
 *
 * SERVER TRUTH (spec §8/§18): every number derives from the school's
 * canonical rows — GET /api/students (real roster) and GET /api/classes?
 * counts=1 (real classes with live enrolment counts). No generated
 * demographics, no fabricated growth deltas, no hardcoded attendance
 * slogans: sections without server data are dropped or honestly labelled.
 */

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, TrendingUp, AlertTriangle, UserX, GraduationCap,
  Lightbulb, Layers, School, PieChart,
} from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SummaryCard, SummaryCardGrid } from '../shared/summary-card'
import { useSchoolStats } from '@/hooks/use-school-stats'
import { GrowthOverviewCard } from './growth-overview-card'

interface ServerStudent {
  id: string
  classId: string | null
  gender: string | null
  rollNo: string | null
  admissionNo: string | null
  user: { name: string | null; status?: string }
}

interface ServerClass {
  id: string
  name: string
  section: string | null
  gradeLevel: string | null
  capacity: number | null
  room: string | null
  _count?: { students: number }
}

function levelOfGrade(gradeLevel: string | null, name: string): string {
  const g = Number((gradeLevel ?? name).replace(/[^0-9]/g, ''))
  if (!Number.isFinite(g) || g === 0) return 'Other'
  if (g <= 5) return 'Primary'
  if (g <= 8) return 'Middle'
  if (g <= 10) return 'Secondary'
  return 'Senior Secondary'
}

export function OverviewTab() {
  // ── Server truth ──
  const { data: schoolStats, loading: statsLoading } = useSchoolStats()
  const [students, setStudents] = useState<ServerStudent[] | null>(null)
  const [classes, setClasses] = useState<ServerClass[] | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/students', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/classes?counts=1', { credentials: 'same-origin' }).then((r) => r.json()),
    ])
      .then(([sRes, cRes]: [{ ok?: boolean; data?: ServerStudent[] }, { ok?: boolean; data?: ServerClass[] }]) => {
        if (cancelled) return
        setStudents(Array.isArray(sRes?.data) ? sRes.data : [])
        setClasses(Array.isArray(cRes?.data) ? cRes.data : [])
      })
      .catch(() => {
        if (!cancelled) {
          setStudents([])
          setClasses([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loading = statsLoading || students === null || classes === null

  const totalStudents = students?.length ?? 0
  const activeStudents = students?.filter((s) => (s.user?.status ?? 'ACTIVE') === 'ACTIVE').length ?? 0
  const inactiveStudents = totalStudents - activeStudents
  const totalCapacity = classes?.reduce((a, c) => a + (c.capacity ?? 0), 0) ?? 0
  const occupancyPct = totalCapacity > 0 ? Math.round((totalStudents / totalCapacity) * 100) : 0
  const attendanceRate = schoolStats?.stats.attendanceRate

  const classCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of students ?? []) {
      if (!s.classId) continue
      map.set(s.classId, (map.get(s.classId) ?? 0) + 1)
    }
    return map
  }, [students])

  const overloaded = useMemo(
    () =>
      (classes ?? []).filter((c) => {
        const enrolled = c._count?.students ?? classCounts.get(c.id) ?? 0
        return (c.capacity ?? 0) > 0 && enrolled > (c.capacity ?? 0)
      }),
    [classes, classCounts],
  )

  const insights = useMemo(() => {
    const out: { icon: React.ReactNode; color: string; title: string; desc: string }[] = []
    if (overloaded.length > 0) {
      out.push({
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'rose',
        title: `${overloaded.length} class${overloaded.length > 1 ? 'es' : ''} over capacity`,
        desc: `${overloaded.slice(0, 2).map((c) => c.name).join(', ')} exceed configured capacity.`,
      })
    }
    if (attendanceRate != null) {
      out.push({
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'emerald',
        title: `${attendanceRate}% attendance rate`,
        desc: 'Based on recorded attendance over the last 7 school days.',
      })
    }
    out.push({
      icon: <Lightbulb className="h-4 w-4" />,
      color: 'violet',
      title: `${occupancyPct}% seat utilization`,
      desc: `${formatNumber(totalStudents)} of ${formatNumber(totalCapacity)} seats across ${classes?.length ?? 0} classes.`,
    })
    return out
  }, [overloaded, attendanceRate, occupancyPct, totalStudents, totalCapacity, classes])

  const levelDistribution = useMemo(() => {
    const byLevel = new Map<string, number>()
    for (const c of classes ?? []) {
      const level = levelOfGrade(c.gradeLevel, c.name)
      byLevel.set(level, (byLevel.get(level) ?? 0) + (c._count?.students ?? classCounts.get(c.id) ?? 0))
    }
    return [...byLevel.entries()]
      .map(([name, value]) => ({ name: name === 'Senior Secondary' ? 'Sr Sec' : name, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [classes, classCounts])

  const gender = useMemo(() => {
    let boys = 0
    let girls = 0
    let unrecorded = 0
    for (const s of students ?? []) {
      const g = (s.gender ?? '').toLowerCase()
      if (g === 'male' || g === 'm' || g === 'boy') boys++
      else if (g === 'female' || g === 'f' || g === 'girl') girls++
      else unrecorded++
    }
    return { boys, girls, unrecorded }
  }, [students])

  const enrollmentByClass = useMemo(
    () =>
      (classes ?? [])
        .map((c) => ({
          name: c.section && !c.name.includes(c.section) ? `${c.name} - ${c.section}` : c.name,
          value: c._count?.students ?? classCounts.get(c.id) ?? 0,
          capacity: c.capacity ?? 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [classes, classCounts],
  )

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading school roster">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/50" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Institution-Wide High Level KPIs — premium summary cards */}
      <SummaryCardGrid columns={6}>
        <SummaryCard label="Total Enrolled" value={totalStudents} sub={`${activeStudents} active`} tone="emerald" icon={<Users className="h-4 w-4" />} delay={0} />
        <SummaryCard label="Active Students" value={activeStudents} sub={totalStudents > 0 ? `${Math.round((activeStudents / totalStudents) * 100)}% active` : '—'} tone="cyan" icon={<GraduationCap className="h-4 w-4" />} delay={0.04} />
        <SummaryCard label="Inactive / Leave" value={inactiveStudents} sub={inactiveStudents > 0 ? 'requires follow-up' : 'all active'} tone="rose" icon={<UserX className="h-4 w-4" />} delay={0.08} />
        <SummaryCard label="Total Capacity" value={totalCapacity} sub={`${occupancyPct}% utilized`} tone="violet" icon={<School className="h-4 w-4" />} delay={0.12} />
        <SummaryCard label="Active Classes" value={classes?.length ?? 0} sub="one section each" tone="amber" icon={<Layers className="h-4 w-4" />} delay={0.16} />
        <SummaryCard label="Over Capacity" value={overloaded.length} sub={overloaded.length > 0 ? 'needs attention' : 'within limits'} tone={overloaded.length > 0 ? 'rose' : 'emerald'} icon={<AlertTriangle className="h-4 w-4" />} delay={0.2} />
      </SummaryCardGrid>

      {/* Global Smart Insights */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold text-sm">Global Student Insights</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {insights.map((ins, i) => {
            const colors: Record<string, string> = {
              rose: 'border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-400',
              emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
              violet: 'border-violet-500/20 bg-violet-500/5 text-violet-600 dark:text-violet-400',
            }
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <GlassCard className={cn('p-3.5 border', colors[ins.color])}>
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 mt-0.5">{ins.icon}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-tight">{ins.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{ins.desc}</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Demographics & Distribution Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* School-wide Growth — canonical scores (§30) */}
        <GrowthOverviewCard />
        {/* Students by Academic Level — from real classes */}
        <GlassCard className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
            <span>Students by Level</span>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </h3>
          <div className="space-y-2.5">
            {levelDistribution.length === 0 && (
              <p className="text-xs text-muted-foreground">No classes configured yet.</p>
            )}
            {levelDistribution.map((lvl) => {
              const max = Math.max(...levelDistribution.map((l) => l.value), 1)
              const pct = Math.round((lvl.value / max) * 100)
              return (
                <div key={lvl.name} className="flex items-center gap-2">
                  <span className="text-xs font-medium w-20 shrink-0 truncate">{lvl.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold w-10 text-right">{lvl.value}</span>
                </div>
              )
            })}
          </div>
        </GlassCard>

        {/* Gender Distribution — from real roster records */}
        <GlassCard className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
            <span>Gender Ratio</span>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex h-3.5 rounded-full overflow-hidden bg-muted">
                <div className="h-full bg-sky-500 transition-all" style={{ width: `${(gender.boys / (totalStudents || 1)) * 100}%` }} />
                <div className="h-full bg-rose-400 transition-all" style={{ width: `${(gender.girls / (totalStudents || 1)) * 100}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2.5 text-xs font-medium">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Boys: {gender.boys}{totalStudents > 0 ? ` (${Math.round((gender.boys / totalStudents) * 100)}%)` : ''}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Girls: {gender.girls}{totalStudents > 0 ? ` (${Math.round((gender.girls / totalStudents) * 100)}%)` : ''}</span>
              </div>
            </div>
            <div className="pt-3 border-t border-border/60 text-xs text-muted-foreground leading-relaxed">
              {gender.unrecorded > 0
                ? `${gender.unrecorded} record${gender.unrecorded === 1 ? '' : 's'} without a recorded gender.`
                : 'Recorded from the student register.'}
            </div>
          </div>
        </GlassCard>

        {/* Enrollment by Class — real counts (replaces the fabricated growth trend) */}
        <GlassCard className="p-4 sm:col-span-2 lg:col-span-1">
          <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
            <span>Enrollment by Class</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </h3>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {enrollmentByClass.length === 0 && (
              <p className="text-xs text-muted-foreground">No classes configured yet.</p>
            )}
            {enrollmentByClass.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">{c.name}</span>
                <span className="font-semibold text-foreground shrink-0 ml-2">
                  {c.value}
                  {c.capacity > 0 && <span className="text-muted-foreground font-normal"> / {c.capacity}</span>}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
