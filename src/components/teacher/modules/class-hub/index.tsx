'use client'

/**
 * class-hub/index — the Class Teacher Hub module entry point. The module
 * router imports the named `ClassHubModule` export and renders it with
 * the panel's onNavigate.
 *
 * This is "the something extra" an appointed class teacher gets: one
 * control room for THEIR class — identity hero with quick actions,
 * today's attendance, the fee collection picture with defaulters, the
 * overall results-submission matrix (every subject, not just theirs) and
 * the class wellbeing summary. Everything is fed by ONE call to
 * GET /api/teacher/class-hub, which only exists for classes the signed-in
 * teacher is actually appointed class teacher of.
 *
 * A teacher without an appointment never reaches this module (the sidebar
 * group does not exist for them); a direct deep-link lands on the honest
 * empty state below.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CalendarCheck,
  DoorOpen,
  FileText,
  GraduationCap,
  RefreshCw,
  School,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react'
import { GlassCard, PageTransition } from '@/components/shared/ui'
import { Button } from '@/components/ui/button'
import { HubEmptyState, HubModuleSkeleton } from '../shared/hub-stat-cards'
import { useClassHub } from './hooks'
import { AttendanceCard } from './attendance-card'
import { FeesCard } from './fees-card'
import { ResultsCard } from './results-card'
import { WellbeingCard } from './wellbeing-card'

const QUICK_ACTIONS = [
  { key: 'attendance', label: 'Mark Attendance', icon: CalendarCheck },
  { key: 'marks', label: 'Enter Marks', icon: FileText },
  { key: 'students', label: 'Student Directory', icon: Users },
  { key: 'behavior', label: 'Behavior', icon: Shield },
] as const

export function ClassHubModule({ onNavigate }: { onNavigate: (key: string) => void }) {
  const { data, error, reload } = useClassHub()
  const [classId, setClassId] = useState<string | null>(null)

  // ── module-level states (the hook above always runs) ─────────────────

  if (error) {
    return (
      <PageTransition>
        <GlassCard hover={false}>
          <HubEmptyState
            icon={AlertTriangle}
            title="Couldn't load your class hub"
            hint={error}
            action={
              <Button size="sm" onClick={reload}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
              </Button>
            }
          />
        </GlassCard>
      </PageTransition>
    )
  }

  if (!data) {
    return (
      <PageTransition aria-busy="true">
        <HubModuleSkeleton />
      </PageTransition>
    )
  }

  if (data.classes.length === 0) {
    return (
      <PageTransition>
        <GlassCard hover={false}>
          <HubEmptyState
            icon={School}
            title="You are not a class teacher right now"
            hint="The Class Teacher Hub appears automatically when the principal appoints you class teacher of a class."
          />
        </GlassCard>
      </PageTransition>
    )
  }

  const active = data.classes.find((c) => c.classId === classId) ?? data.classes[0]

  return (
    <PageTransition className="space-y-4 sm:space-y-5">
      {/* ── hero: the class identity + quick actions ──────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-teal-700 p-5 text-white sm:p-6"
      >
        {/* blur atmosphere */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="relative">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-100">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
            Class Teacher Hub
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">{active.label}</h2>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-emerald-50">
            <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <Users className="h-3 w-3" aria-hidden="true" /> {active.studentCount} students
            </span>
            {active.room && (
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                <DoorOpen className="h-3 w-3" aria-hidden="true" /> Room {active.room}
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
              <Sparkles className="h-3 w-3" aria-hidden="true" /> Your class, end to end
            </span>
          </div>

          {/* quick actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => onNavigate(a.key)}
                  className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
      </motion.section>

      {/* class pills (only when the teacher runs more than one class) */}
      {data.classes.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Select one of your classes">
          {data.classes.map((c) => {
            const isActive = active.classId === c.classId
            return (
              <button
                key={c.classId}
                type="button"
                aria-pressed={isActive}
                onClick={() => setClassId(c.classId)}
                className={
                  isActive
                    ? 'min-h-[38px] rounded-xl bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow-xs'
                    : 'min-h-[38px] rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-muted-foreground/30 hover:text-foreground'
                }
              >
                {c.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── the control room ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        <AttendanceCard cls={active} onNavigate={onNavigate} />
        <WellbeingCard cls={active} onNavigate={onNavigate} />
        <FeesCard cls={active} onNavigate={onNavigate} />
        <div className="lg:col-span-2">
          <ResultsCard cls={active} onNavigate={onNavigate} />
        </div>
      </div>
    </PageTransition>
  )
}
