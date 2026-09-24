'use client'

/**
 * StaffAttendanceTab — honest "not yet configured" state.
 *
 * There is NO canonical staff-attendance data source in this school yet
 * (no StaffAttendance table / API). The previous screen rendered a
 * fabricated staff roster + attendance state machine from
 * `@/lib/mock/attendance` — that universe is retired. The tab and its
 * layout shell stay so the module structure is unchanged; the content
 * is an honest empty state explaining what will appear once staff
 * attendance tracking is configured.
 */

import { CalendarClock, Users, FileSpreadsheet, ShieldCheck } from 'lucide-react'
import { PageTransition, GlassCard } from '@/components/shared/ui'
import { ModuleHeader } from '../shared/module-header'

export function StaffAttendanceTab() {
  return (
    <PageTransition className="space-y-4">
      <ModuleHeader meta={['Teachers & Employees', 'Not configured']} />

      <GlassCard className="p-6 sm:p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto py-6 sm:py-10">
          <div className="h-14 w-14 rounded-2xl bg-muted/60 border border-border flex items-center justify-center shrink-0">
            <Users className="h-7 w-7 text-muted-foreground" />
          </div>

          <h3 className="mt-4 text-base font-semibold text-foreground">
            Staff attendance tracking is not yet configured
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            This school has no staff attendance data source yet. Once staff
            attendance tracking is enabled for teachers and employees, daily
            records and summaries will appear here.
          </p>

          <div className="mt-6 w-full grid gap-2 text-left">
            <PendingRow
              icon={<CalendarClock className="h-3.5 w-3.5" />}
              label="Daily staff attendance register"
            />
            <PendingRow
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              label="Present / late / absent / leave summaries"
            />
            <PendingRow
              icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
              label="Monthly staff attendance exports"
            />
          </div>

          <p className="mt-6 text-[11px] text-muted-foreground/80">
            Student attendance is unaffected — see the Overview and History tabs
            for the school&apos;s canonical student records.
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
