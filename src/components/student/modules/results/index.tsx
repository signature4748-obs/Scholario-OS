'use client'

/**
 * ResultsModule — Student "My Results".
 *
 * An academic narrative, not a dashboard stack:
 *
 *   My Results · [AY 2026–27] [Grade 9 - A]
 *   ↓ assessment selector (server exams)
 *   ↓ selected result hero (colour zones, distinct metrics)
 *   ↓ subject performance (rows on the page, Timetable colour system)
 *   ↓ performance trend (interactive points)
 *   ↓ academic insights (derived strip — what actually changed)
 *   ↓ teacher's feedback + result history (the timeline)
 *   ↓ official report card
 *
 * THE MARKS UNIVERSE IS THE SERVER'S (20-results stabilization): every
 * number derives from /api/student/results — the SAME Exam + Result
 * rows the Principal declares and the Class Teacher's marks entry
 * writes — via useMyServerResults(). Identity is canonical: the class
 * chips / report card read useCanonicalStudent() + the session display
 * name; there are NO client-side seeded marks and NO hardcoded fallback
 * identities. Sections with insufficient data collapse entirely; one
 * declared exam degrades the trend honestly.
 */

import { useMemo, useState } from 'react'
import { AlertTriangle, Award, CalendarRange, RefreshCw, Users } from 'lucide-react'
import { GlassCard, PageTransition } from '@/components/shared/ui'
import { useMyServerResults, useCanonicalStudent, type MyResultSubject } from '../shared/canonical'
import { useCurrentUser } from '@/lib/store/current-user-store'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import { useAcademicSession } from '@/lib/academic-session'
import { AssessmentSelector } from './assessment-selector'
import { Hero } from './hero'
import { SubjectPerformance } from './subject-performance'
import { Trend } from './trend'
import { Insights, type SubjectMovement } from './insights'
import { Remark } from './remark'
import { History } from './history'
import { ReportCard } from './report-card'
import {
  DEFAULT_GRADE_SCALE,
  gradeForPct,
  pctOfSubject,
  totalsOfExam,
  trendPointsOf,
  type GradeBand,
} from './derive'

/* ── Scope chips — the page's ONE context line ── */

function ScopeChips({ sessionLabel, classLabel }: { sessionLabel: string; classLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Result scope">
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.07] px-2.5 py-1 text-[11px] font-medium text-primary"
        title="Active academic session"
      >
        <CalendarRange className="h-3 w-3 shrink-0" aria-hidden /> {sessionLabel}
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
        title="Your class and section"
      >
        <Users className="h-3 w-3 shrink-0" aria-hidden /> {classLabel}
      </span>
    </div>
  )
}

/* ── Insight derivations — selected exam vs its own previous ──────── */

interface SelectedInsights {
  strongest: { subject: string; pct: number } | null
  needsAttention: { subject: string; pct: number } | null
  mostImproved: { subject: string; delta: number } | null
  movement: SubjectMovement[]
}

/** Strongest / focus / improvement — computed from the server's own rows. */
function insightsOf(subjects: MyResultSubject[], previous: MyResultSubject[] | null): SelectedInsights {
  if (subjects.length === 0) {
    return { strongest: null, needsAttention: null, mostImproved: null, movement: [] }
  }
  const rows = subjects.map((s) => ({ subject: s.subject, pct: pctOfSubject(s) }))
  const sorted = [...rows].sort((a, b) => b.pct - a.pct)
  const strongest = sorted[0] ?? null
  const needsAttention = sorted.length > 1 ? sorted[sorted.length - 1] : null

  let mostImproved: { subject: string; delta: number } | null = null
  let movement: SubjectMovement[] = []
  if (previous) {
    const prevBy = new Map(previous.map((s) => [s.subject, s]))
    movement = subjects
      .filter((s) => prevBy.has(s.subject))
      .map((s) => {
        const p = prevBy.get(s.subject)!
        return { subject: s.subject, from: pctOfSubject(p), to: pctOfSubject(s) }
      })
    for (const m of movement) {
      const delta = m.to - m.from
      if (!mostImproved || delta > mostImproved.delta) mostImproved = { subject: m.subject, delta }
    }
    if (mostImproved && mostImproved.delta <= 0) mostImproved = null
  }

  return { strongest, needsAttention, mostImproved, movement }
}

/* ── Module shell — retry remounts the fetch ───────────────────────── */

export function ResultsModule() {
  const [retryKey, setRetryKey] = useState(0)
  // A key change remounts the content → useMyServerResults refetches.
  return <ResultsContent key={retryKey} onRetry={() => setRetryKey((k) => k + 1)} />
}

function ResultsContent({ onRetry }: { onRetry: () => void }) {
  // ── Canonical marks — the server's declared exams ──
  const { exams, upcoming, loading, error } = useMyServerResults()

  // ── Canonical identity — session display name + enrollment ──
  const { student, resolving } = useCanonicalStudent()
  const sessionName = useCurrentUser((s) => s.me?.name) ?? null
  const session = useAcademicSession()

  // ── School-configured grade scale + report-card composition ──
  const resultsConfig = useSchoolSettingsStore((s) => s.results)
  const gradeScale: GradeBand[] =
    resultsConfig?.gradeScale?.length ? resultsConfig.gradeScale : DEFAULT_GRADE_SCALE
  const reportCardConfig = resultsConfig?.reportCard ?? {
    includeAttendance: true,
    includePrincipalRemark: true,
    includeSealNote: true,
  }
  const gradeFor = useMemo(() => (pct: number) => gradeForPct(pct, gradeScale), [gradeScale])

  // Selection — the LATEST declared exam opens by default; the selector
  // / history deep-switch without any page round-trip.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const effectiveId = selectedId ?? exams[0]?.examId ?? null

  const selectedIdx = useMemo(
    () => exams.findIndex((e) => e.examId === effectiveId),
    [exams, effectiveId],
  )
  const selected = selectedIdx >= 0 ? exams[selectedIdx] : null
  // exams arrive latest-declared-first → the previous declared exam of
  // exams[i] is exams[i + 1].
  const previous = selectedIdx >= 0 && selectedIdx + 1 < exams.length ? exams[selectedIdx + 1] : null

  const totals = selected ? totalsOfExam(selected) : null
  const grade = totals ? gradeFor(totals.pct) : null

  // Overall movement — selected vs its own previous declared exam.
  const overallDelta =
    selected && previous && totals
      ? totals.pct - totalsOfExam(previous).pct
      : null

  // Snapshot-style insights about the SELECTED exam (coherent scope).
  const insights = useMemo(
    () => insightsOf(selected?.subjects ?? [], previous?.subjects ?? null),
    [selected, previous],
  )

  // Trend — one point per declared exam, chronological.
  const trendPoints = useMemo(() => trendPointsOf(exams, gradeScale), [exams, gradeScale])

  // Real subject remarks only (never fabricated feedback).
  const subjectRemarks = useMemo(
    () =>
      (selected?.subjects ?? [])
        .filter((s) => s.remarks)
        .map((s) => ({ subject: s.subject, text: s.remarks! })),
    [selected],
  )

  // Canonical identity — '…' while the session resolves, '—' when the
  // school has not recorded the particular. NO fabricated fallbacks.
  const identity = {
    name: sessionName ?? (resolving ? '…' : '—'),
    admissionNo: student?.admissionNo ?? (resolving ? '…' : '—'),
    classSection: student?.classLabel ?? (resolving ? '…' : '—'),
    rollNo: student?.rollNo ?? (resolving ? '…' : '—'),
  }
  const classLabel = identity.classSection

  /* ── ERROR STATE — honest, retryable ── */
  if (error) {
    return (
      <PageTransition>
        <GlassCard hover={false} className="on-card px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </div>
          <p className="text-sm font-semibold">Results unavailable</p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
          </button>
        </GlassCard>
      </PageTransition>
    )
  }

  /* ── LOADING STATE — first fetch, no data yet ── */
  if (loading) {
    return (
      <PageTransition>
        <div className="space-y-6" aria-busy="true" aria-label="Loading results">
          <div className="h-7 w-64 animate-pulse rounded-full bg-muted/50" />
          <div className="h-10 animate-pulse rounded-xl bg-muted/40" />
          <div className="h-44 animate-pulse rounded-2xl bg-muted/50" style={{ animationDelay: '90ms' }} />
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/30" style={{ animationDelay: `${120 + i * 60}ms` }} />
            ))}
          </div>
          <div className="h-56 animate-pulse rounded-2xl bg-muted/40" style={{ animationDelay: '380ms' }} />
        </div>
      </PageTransition>
    )
  }

  /* ── EMPTY STATE — nothing declared for this student yet ── */
  if (!selected || !totals || grade == null) {
    return (
      <PageTransition>
        <div className="space-y-6 sm:space-y-7">
          <ScopeChips sessionLabel={session.label} classLabel={classLabel} />
          <GlassCard hover={false} className="on-card px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Award className="h-6 w-6" aria-hidden />
            </div>
            <p className="text-sm font-semibold">No results declared yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {upcoming
                ? `${upcoming.examName} is next — your results appear here automatically once the school declares them.`
                : 'Your results appear here automatically once the school declares them.'}
            </p>
          </GlassCard>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-6 sm:space-y-7">
        {/* No module title: the sidebar + top bar already say "Results".
            The session + class chips below are the page's one scope line. */}
        <ScopeChips sessionLabel={session.label} classLabel={classLabel} />

        {/* The one prominent control — which result am I reading? */}
        <AssessmentSelector
          exams={exams}
          upcoming={upcoming}
          selectedId={selected.examId}
          onSelect={setSelectedId}
        />

        {/* 1 — the selected result at a glance */}
        <Hero
          exam={selected}
          totals={totals}
          grade={grade}
          isLatest={selected.examId === exams[0]?.examId}
          delta={overallDelta}
          previousName={previous?.examName ?? null}
        />

        {/* 2 — the core: subject-wise performance (remounts per exam so
            an expanded subject never carries over between results) */}
        <SubjectPerformance key={selected.examId} subjects={selected.subjects} />

        {/* 3 — the real trend, interactive point by point (one declared
            exam ⇒ the section explains itself, no invented history) */}
        <Trend points={trendPoints} />

        {/* 4 — what actually changed (derived, respectful) */}
        <Insights
          snapshot={{
            strongest: insights.strongest,
            needsAttention: insights.needsAttention,
            mostImproved: insights.mostImproved,
          }}
          overallDelta={overallDelta}
          previousName={previous?.examName ?? null}
          classPosition={
            selected.rank != null
              ? { rank: selected.rank.position, classSize: selected.rank.assessedCount }
              : null
          }
          movement={insights.movement}
        />

        {/* 5 — the human voice + the academic timeline */}
        <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Remark remarks={subjectRemarks} />
          </div>
          <div className="lg:col-span-2">
            <History
              exams={exams}
              upcoming={upcoming}
              gradeFor={gradeFor}
              selectedId={selected.examId}
              onSelect={setSelectedId}
            />
          </div>
        </div>

        {/* 6 — the official document (canonical identity + server marks) */}
        <ReportCard
          exam={selected}
          totals={totals}
          grade={grade}
          reportCardConfig={reportCardConfig}
          identity={identity}
        />
      </div>
    </PageTransition>
  )
}
