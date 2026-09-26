'use client'

/**
 * WelcomeBanner v2 — the dashboard's "today at a glance" command center.
 * A calm GlassCard with a whisper of the house emerald: the teacher's REAL
 * identity (avatar initials, time-of-day greeting, IST date, class-teacher
 * or subject-teacher line), the NextUp focus rail (what's happening /
 * what's next — real timetable only), and one quiet chip per real teaching
 * assignment. The two former "Fact" tiles are gone — those numbers live in
 * the KPI row directly below; the hero answers "who am I / what's next".
 */

import { motion } from 'framer-motion'
import { useFocusStore } from '@/lib/store/focus-store'
import { GlassCard } from '@/components/shared/ui'
import { greeting } from './hooks/use-teacher-dashboard'
import { NextUp } from './next-up'
import type { TeacherDashboardData } from './types'

interface WelcomeBannerProps {
  data: TeacherDashboardData
  now: Date
  onNavigate: (key: string) => void
}

export function WelcomeBanner({ data, now, onNavigate }: WelcomeBannerProps) {
  // First name for the greeting — "Ms. Priya Iyer" greets as "Priya"
  // (seeded names carry honorifics; strip the common ones).
  const HONORIFICS = /^(mr|ms|mrs|miss|dr|prof|smt|shri)\.?\s+/i
  const firstName =
    (data.teacher.name || '').replace(HONORIFICS, '').trim().split(' ').slice(0, 1).join('') || 'Teacher'
  const initials = (data.teacher.name || 'T')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const dateLabel = new Date(`${data.today.date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Role line: appointed class teacher → the classes; otherwise the honest
  // subject-teacher identity derived from the real assignments.
  const ctLine = data.classTeacherOf.map((c) => c.classLabel).join(' · ')
  const subjectLine = [...new Set(data.assignments.map((a) => a.subjectName))].join(' · ')
  const roleLine = ctLine
    ? `Class Teacher · ${ctLine}`
    : subjectLine
      ? `Subject Teacher · ${subjectLine}`
      : 'Teacher'

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Welcome"
    >
      <GlassCard hover={false} className="relative overflow-hidden rounded-2xl">
        {/* Subtle institutional tint — one whisper of emerald, nothing louder */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-500/[0.06] via-transparent to-transparent" />
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-500/[0.05] blur-3xl" />

        <div className="relative flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-stretch lg:gap-5">
          {/* Left — identity */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <div
                aria-hidden
                className="flex h-12 w-12 shrink-0 select-none items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 font-display text-sm font-bold text-emerald-700 shadow-sm ring-4 ring-emerald-500/[0.04] dark:text-emerald-400"
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {greeting(now)} · {dateLabel}
                </p>
                <h1 className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">
                  {firstName}
                </h1>
                <p className="truncate text-xs text-muted-foreground" title={roleLine}>
                  {roleLine}
                </p>
              </div>
            </div>

            {/* Real teaching assignments — one quiet chip each */}
            {data.assignments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.assignments.map((a) => (
                  <span
                    key={`${a.classId}-${a.subjectId}`}
                    title={`${a.classLabel} · ${a.subjectName} — ${a.periodsPerWeek} periods per week`}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/80 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/[0.06] hover:text-foreground"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70" aria-hidden />
                    <span className="truncate">
                      {a.classLabel} · {a.subjectName}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground/70">
                      {a.periodsPerWeek}/wk
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right — the "what's next" focus rail (stacks below on mobile) */}
          <div className="min-w-0 lg:max-w-[300px] lg:flex-none xl:max-w-[320px]">
            <NextUp data={data} now={now} onNavigate={onNavigate} />
          </div>
        </div>
      </GlassCard>
    </motion.section>
  )
}

// Re-exported for the composition: the deep-link helper used by every
// dashboard card that targets a specific class (attendance prompt, pending
// rows) — one canonical pattern.
export function focusClass(
  classId: string,
  classLabel: string,
  moduleKey: string,
  onNavigate: (key: string) => void,
) {
  useFocusStore.getState().setFocus({
    type: 'class',
    id: classId,
    title: classLabel,
    moduleKey,
  })
  onNavigate(moduleKey === 'attendance' ? 'attendance' : moduleKey)
}
