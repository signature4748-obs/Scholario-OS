'use client'

/**
 * PersonalAttendance — honest "not yet configured" state.
 *
 * STABILIZATION — this module previously rendered the teacher's OWN
 * attendance from a fabricated client-side universe: `STAFF_DEFS`
 * roster ids (T-001…T-056), deterministic pseudo-records from
 * `@/lib/mock/attendance`, and a localStorage session history seeded
 * by `ensureSessionData`. None of that represented real data — this
 * school has NO staff-attendance backend (the canonical `Attendance`
 * table is student-scoped; no staff table/API exists).
 *
 * Invented attendance numbers must never be shown, so the module now
 * states the truth: staff attendance tracking is not configured. The
 * nav entry + lazy registration stay so the module structure is
 * unchanged; once a staff-attendance source is configured, this
 * module gets real content again.
 *
 * (The principal's Attendance → Staff tab shows the same honest state
 * for the same reason — one consistent story across roles.)
 */

import { CalendarClock, CalendarOff, ClipboardCheck, UserCheck } from 'lucide-react'
import { PageTransition, GlassCard } from '@/components/shared/ui'

export function PersonalAttendance() {
  return (
    <PageTransition className="space-y-4">
      <GlassCard className="p-6 sm:p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto py-6 sm:py-10">
          <div className="h-14 w-14 rounded-2xl bg-muted/60 border border-border flex items-center justify-center shrink-0">
            <UserCheck className="h-7 w-7 text-muted-foreground" />
          </div>

          <h3 className="mt-4 text-base font-semibold text-foreground">
            Staff attendance tracking is not yet configured
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            This school has no staff attendance records yet. Once staff
            attendance tracking is enabled, your daily presence record,
            monthly summary and leave history will appear here.
          </p>

          <div className="mt-6 w-full grid gap-2 text-left">
            <PendingRow
              icon={<CalendarClock className="h-3.5 w-3.5" />}
              label="Daily check-in / check-out record"
            />
            <PendingRow
              icon={<ClipboardCheck className="h-3.5 w-3.5" />}
              label="Monthly presence summary & session history"
            />
            <PendingRow
              icon={<CalendarOff className="h-3.5 w-3.5" />}
              label="Leave records & working-day calendar"
            />
          </div>

          <p className="mt-6 text-[11px] text-muted-foreground/80">
            Class attendance (marking your students) is unaffected — see the
            Class Attendance module for the school&apos;s canonical records.
          </p>
        </div>
      </GlassCard>
    </PageTransition>
  )
}

function PendingRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 shrink-0">
        Pending
      </span>
    </div>
  )
}
