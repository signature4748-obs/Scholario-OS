'use client'

/**
 * student-profile-page — the ONE canonical student detail page (production
 * pass §7–§9). Every role that opens a student lands here:
 *
 *   · Principal  — full store-backed record, all tabs, archive/transfer.
 *   · Teacher    — the SAME page rendered with server-authorized data
 *                  (`detail`) and a role-scoped tab allowlist
 *                  (`visibleTabs`): class teachers see fees + parents for
 *                  their own class; subject teachers see identity,
 *                  academics and attendance only. No destructive actions.
 *
 * Data honesty (§8): metrics and tabs hide what the role did not receive
 * rather than fabricating values.
 */

import { useState } from 'react'
import { ArrowLeft, Bus, Archive, RotateCcw, Home, Droplet, IdCard, Activity, GraduationCap, TrendingUp, IndianRupee } from 'lucide-react'
import { PageTransition, GradientAvatar, StatusBadge } from '@/components/shared/ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StudentRecord } from '@/lib/store/students-store'
import { Metric } from './shared'
import type { StudentProfileRealData } from './profile-real-data'
import {
  OverviewTab, AcademicsTab, AttendanceTab, FeesTab, ApplicationsTab,
  DocumentsTab, MedicalTab, ParentsTab, TransportTab,
  DisciplineTab, TimelineTab,
} from './profile-tabs'
import { StudentIdentityCodes } from './profile/identity-codes'

export const STUDENT_PROFILE_TABS = ['overview', 'academics', 'attendance', 'fees', 'applications', 'documents', 'medical', 'parents', 'transport', 'discipline', 'timeline'] as const
export type TabName = (typeof STUDENT_PROFILE_TABS)[number]

export const TAB_LABELS: Record<TabName, string> = {
  overview: 'Overview',
  academics: 'Academics',
  attendance: 'Attendance',
  fees: 'Fees',
  applications: 'Applications',
  documents: 'Documents',
  medical: 'Medical',
  parents: 'Parents',
  transport: 'Transport',
  discipline: 'Discipline',
  timeline: 'Timeline',
}

interface Props {
  student: StudentRecord
  onBack: () => void
  onArchive?: (s: StudentRecord) => void
  onRestore?: (s: StudentRecord) => void
  onTransfer?: (s: StudentRecord) => void
  backLabel?: string
  /**
   * Role-scoped tab allowlist. Defaults to every tab (Principal). Teachers
   * pass only the tabs their scope permits — the tab bar never renders a
   * tab the role is not authorized to see.
   */
  visibleTabs?: readonly TabName[]
  /** Server-authorized real data (teacher view). Absent ⇒ store mode. */
  detail?: StudentProfileRealData
}

export function StudentProfilePage({ student, onBack, onArchive, onRestore, onTransfer, backLabel = 'Students & Classes', visibleTabs, detail }: Props) {
  const tabs = visibleTabs ?? STUDENT_PROFILE_TABS
  const [activeTab, setActiveTab] = useState<TabName>(tabs[0] ?? 'overview')
  // Safety: the active tab must always be part of the (possibly
  // role-scoped) allowlist — e.g. if the scope shrinks between renders.
  const currentTab: TabName = tabs.includes(activeTab) ? activeTab : (tabs[0] ?? 'overview')
  const isArchived = student.status === 'Archived'
  const real = detail
  // Destructive actions exist only where a handler was provided (Principal).
  const showActions = !!(onArchive || onRestore || onTransfer)

  // ── Role-aware quick metrics — only what this role actually knows ──────
  const attPct = real?.attendance?.pct ?? (real ? null : student.attendance)
  const avgPct = real?.latestExam?.averagePct ?? (real ? null : student.academics.overallPercent)
  const feeKnown = real ? !!real.fees && real.fees.status !== 'NONE' : true
  const feeValue = real?.fees
    ? (real.fees.status === 'PAID' ? 'Paid' : real.fees.status === 'PARTIAL' ? 'Partial' : real.fees.outstanding > 0 ? 'Due' : 'Paid')
    : student.feeStatus
  const metrics = [
    attPct != null && { icon: <Activity className="h-3.5 w-3.5" />, label: 'Attendance', value: `${attPct}%`, color: 'text-emerald-600 dark:text-emerald-400' },
    avgPct != null && { icon: <GraduationCap className="h-3.5 w-3.5" />, label: 'Average', value: `${avgPct}%`, color: 'text-violet-600 dark:text-violet-400' },
    !real && { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Rank', value: `#${student.academics.rankInClass}`, color: 'text-amber-600 dark:text-amber-400' },
    feeKnown && { icon: <IndianRupee className="h-3.5 w-3.5" />, label: 'Fee', value: feeValue, color: feeValue === 'Paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string; color: string }[]
  const metricsGrid = metrics.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : metrics.length === 3 ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <PageTransition>
      {/* Back navigation */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">{backLabel}</span>
      </div>

      {/* Profile header */}
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card mb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/3 to-transparent" />
        <div className="relative p-5">
          <div className="flex items-start gap-4">
            <GradientAvatar name={student.name} initials={student.avatar} size="xl" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-xl font-bold truncate">{student.name}</h1>
                {isArchived ? <StatusBadge status="Archived" variant="neutral" dot /> : <StatusBadge status="Active" variant="success" dot />}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                <span className="font-mono">{student.admissionNo}</span><span>·</span>
                <span>Roll {student.rollNo}</span><span>·</span>
                <span>{student.section ? `${student.className} · Sec ${student.section}` : student.className}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {student.houseName && <Badge variant="secondary" className="text-[10px] gap-1"><Home className="h-2.5 w-2.5" /> {student.houseName}</Badge>}
                {student.bloodGroup && student.bloodGroup !== '—' && <Badge variant="secondary" className="text-[10px] gap-1"><Droplet className="h-2.5 w-2.5" /> {student.bloodGroup}</Badge>}
                {student.category && student.category !== '—' && <Badge variant="secondary" className="text-[10px] gap-1"><IdCard className="h-2.5 w-2.5" /> {student.category}</Badge>}
              </div>
            </div>
          </div>
          {showActions && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {!isArchived ? (
                <>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onTransfer?.(student)}><Bus className="h-3.5 w-3.5" /> Transfer</Button>
                  <Button size="sm" variant="destructive" className="h-8 text-xs ml-auto" onClick={() => onArchive?.(student)}><Archive className="h-3.5 w-3.5" /> Archive</Button>
                </>
              ) : (
                <Button size="sm" variant="default" className="h-8 text-xs ml-auto" onClick={() => onRestore?.(student)}><RotateCcw className="h-3.5 w-3.5" /> Restore</Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick metrics — role-aware, hidden when unknown */}
      {metrics.length > 0 && (
        <div className={cn('grid gap-2 mb-4', metricsGrid)}>
          {metrics.map((m) => (
            <Metric key={m.label} icon={m.icon} label={m.label} value={m.value} color={m.color} />
          ))}
        </div>
      )}

      {/* Tab navigation — only the role-permitted tabs */}
      <div className="border-b border-border mb-4">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn('rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                currentTab === tab ? 'bg-white dark:bg-white/10 shadow-sm text-foreground rounded-full' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40')}>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-4xl">
        {currentTab === 'overview' && (
          <div className="space-y-4">
            <OverviewTab student={student} real={real} />
            {!real && <StudentIdentityCodes student={student} />}
          </div>
        )}
        {currentTab === 'academics' && <AcademicsTab student={student} real={real} />}
        {currentTab === 'attendance' && <AttendanceTab student={student} real={real} />}
        {currentTab === 'fees' && <FeesTab student={student} real={real} />}
        {currentTab === 'applications' && <ApplicationsTab student={student} />}
        {currentTab === 'documents' && <DocumentsTab student={student} />}
        {currentTab === 'medical' && <MedicalTab student={student} />}
        {currentTab === 'parents' && <ParentsTab student={student} real={real} />}
        {currentTab === 'transport' && <TransportTab student={student} />}
        {currentTab === 'discipline' && <DisciplineTab student={student} />}
        {currentTab === 'timeline' && <TimelineTab student={student} />}
      </div>
    </PageTransition>
  )
}
