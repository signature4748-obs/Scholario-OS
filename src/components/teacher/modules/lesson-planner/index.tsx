'use client'

/**
 * lesson-planner/index — the Lesson Planner module.
 *
 *   Teacher → Class + Subject → board syllabus feeds the COMPLETE session
 *   plan automatically (CBSE / UP Board) → timetable-driven day-wise
 *   schedule → Today's topic → completion. Adding anything on top is
 *   deliberately easy: a per-unit quick-add row, one-tap syllabus merges
 *   and an authoring sheet with a new-unit option.
 *
 * Composition (LP-3 UI refinement — SCHOLARIO house language, benchmark:
 * My Timetable): quiet context toolbar (session line + Class + Subject
 * selectors + "Add topic") → 4 compact summary cards (HubStatCards —
 * curriculum progress, topics left, teaching pace, current topic) → the
 * compact Current Topic card → two-column body — left: Curriculum
 * Progress (per-unit) + the Session Plan (inline add/edit/delete); right:
 * the Syllabus Library, Upcoming and the Schedule basis.
 *
 * module-router.tsx imports the named `LessonPlannerModule` and renders it
 * with no props.
 */

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, BookPlus, BookX, CircleAlert, Gauge, ListTodo, Sparkles, Target } from 'lucide-react'
import { GlassCard, PageTransition } from '@/components/shared/ui'
import { ModuleToolbar } from '@/components/teacher/teacher-panel/module-toolbar'
import {
  HubEmptyState,
  HubSectionError,
  HubStatCards,
  HubStatCardSkeleton,
  type HubStat,
} from '@/components/teacher/modules/shared/hub-stat-cards'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  addTopic,
  deleteTopic,
  fetchLessonPlan,
  fetchTeachingAssignments,
  mergeSyllabus,
  setTopicCompletion,
  updateTopic,
  type LessonPlanPayload,
  type ScheduledTopic,
  type SyllabusMissingTopic,
  type TeachingAssignment,
} from './api'
import { AddTopicSheet, type TopicDraft } from './add-topic-sheet'
import { CurriculumMapCard } from './curriculum-map'
import { ProgressPanel } from './progress-panel'
import { ScheduleBasisCard, UpcomingPanel } from './upcoming-panel'
import { SyllabusLibraryCard } from './syllabus-library'
import { CurrentTopicCard } from './today-lesson'
import { applyCompletion, applyTopicRemoval, TOPIC_STATUS } from './shared'

interface Selection {
  classId: string
  subjectId: string
}

interface SheetTarget {
  editing: ScheduledTopic | null
  defaultUnitNo: number | null
  forceNewUnit: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** "2026-04-01" → "2026–27" (Indian academic session Apr–Mar, en dash). */
function sessionLabelFromStart(sessionStart: string): string | null {
  const year = Number(sessionStart.slice(0, 4))
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return null
  return `${year}–${String((year + 1) % 100).padStart(2, '0')}`
}

/** The 4 summary cards (canonical numbers — the module's single primary
 *  progress visualization lives in the first card). My Timetable recipe. */
function summaryStatsFor(plan: LessonPlanPayload): HubStat[] {
  const remaining = Math.max(0, plan.progress.total - plan.progress.completed)
  const currentTopic = plan.today.topic
  return [
    {
      key: 'progress',
      label: 'Curriculum Progress',
      value: `${plan.progress.pct}%`,
      context: `${plan.progress.completed} of ${plan.progress.total} topics`,
      progress: plan.progress.total > 0 ? plan.progress.completed / plan.progress.total : 0,
      icon: Target,
      tone: 'emerald',
    },
    {
      key: 'remaining',
      label: 'Topics Left',
      value: remaining,
      context: remaining === 1 ? 'topic to teach' : 'topics to teach',
      icon: ListTodo,
      tone: 'amber',
    },
    {
      key: 'pace',
      label: 'Teaching Pace',
      value: `${plan.pace.periodsPerWeek} p/w`,
      context: `${plan.pace.periodMinutes} min each · ${plan.pace.teachingDaysPerWeek} d/w`,
      icon: Gauge,
      tone: 'sky',
    },
    {
      key: 'current',
      label: 'Current Topic',
      value: currentTopic ? currentTopic.topicName : null,
      context: currentTopic
        ? TOPIC_STATUS[currentTopic.status].label
        : 'Nothing scheduled today',
      icon: BookOpen,
      tone: 'violet',
      valueClassName: 'font-sans text-lg sm:text-xl font-semibold truncate',
    },
  ]
}

// ─── Layout-matched skeletons (pulse rows, never spinners) ──────────────

function PlanSkeleton() {
  return (
    <div className="space-y-4">
      {/* 4 summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <HubStatCardSkeleton key={i} />
        ))}
      </div>
      {/* current topic */}
      <div className="animate-pulse rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="h-3 w-36 rounded bg-muted" />
        <div className="mt-3 h-5 w-48 rounded bg-muted" />
        <div className="mt-2 h-3 w-64 rounded bg-muted" />
        <div className="mt-4 h-9 w-44 rounded-lg bg-muted" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {/* progress */}
          <div className="animate-pulse rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="h-3 w-36 rounded bg-muted" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-2.5 w-40 rounded bg-muted" />
                  <div className="h-1.5 w-full rounded-full bg-muted" />
                </div>
              ))}
            </div>
          </div>
          {/* map */}
          <div className="h-[420px] animate-pulse rounded-xl border border-border bg-card" />
        </div>
        <div className="hidden min-w-0 space-y-4 lg:block">
          <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
          <div className="h-64 animate-pulse rounded-xl border border-border bg-card" />
          <div className="h-48 animate-pulse rounded-xl border border-border bg-card" />
        </div>
      </div>
    </div>
  )
}

function LessonPlannerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <PlanSkeleton />
    </div>
  )
}

// ─── Quiet retry card ───────────────────────────────────────────────────

function LoadErrorCard({
  message,
  detail,
  onRetry,
}: {
  message: string
  detail?: string | null
  onRetry: () => void
}) {
  return (
    <GlassCard hover={false} className="p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10">
          <CircleAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-foreground">{message}</p>
        {detail && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{detail}</p>}
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </GlassCard>
  )
}

// ─── Module ─────────────────────────────────────────────────────────────

export function LessonPlannerModule() {
  // Teaching assignments (the picker source)
  const [assignments, setAssignments] = useState<TeachingAssignment[] | null>(null)
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null)
  const [assignmentsTick, setAssignmentsTick] = useState(0)

  // The selected (class, subject) pair + its plan
  const [selection, setSelection] = useState<Selection | null>(null)
  const [plan, setPlan] = useState<LessonPlanPayload | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [planTick, setPlanTick] = useState(0)

  // Topic completion in flight (optimistic toggle)
  const [pendingTopicId, setPendingTopicId] = useState<string | null>(null)

  // LP-2 authoring state
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null)
  const [quickAddPending, setQuickAddPending] = useState(false)
  const [pendingMissingName, setPendingMissingName] = useState<string | null>(null)
  const [mergingAll, setMergingAll] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetSubmitting, setSheetSubmitting] = useState(false)
  const [sheetTarget, setSheetTarget] = useState<SheetTarget>({
    editing: null,
    defaultUnitNo: null,
    forceNewUnit: false,
  })

  // ── assignments load (mount + retry) ──
  useEffect(() => {
    let cancelled = false
    setAssignmentsLoading(true)
    setAssignmentsError(null)
    fetchTeachingAssignments()
      .then((list) => {
        if (!cancelled) setAssignments(list)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setAssignmentsError(e instanceof Error ? e.message : 'Lesson Planner could not load.')
      })
      .finally(() => {
        if (!cancelled) setAssignmentsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [assignmentsTick])

  // Default = first assignment; keep the selection only while it still exists.
  useEffect(() => {
    if (!assignments) return
    setSelection((prev) => {
      if (prev && assignments.some((a) => a.classId === prev.classId && a.subjectId === prev.subjectId)) {
        return prev
      }
      const first = assignments[0]
      return first ? { classId: first.classId, subjectId: first.subjectId } : null
    })
  }, [assignments])

  // ── plan load (selection change + quiet refetch after mutations) ──
  useEffect(() => {
    if (!selection) {
      setPlan(null)
      setPlanError(null)
      setPlanLoading(false)
      return
    }
    let cancelled = false
    setPlanLoading(true)
    setPlanError(null)
    fetchLessonPlan(selection.classId, selection.subjectId)
      .then((p) => {
        if (cancelled) return
        setPlan(p)
        if (p.autoProvisioned && p.topics.length > 0) {
          toast.success('Complete session plan loaded from the board syllabus', {
            description: `${p.topics.length} topics auto-scheduled for ${p.subjectName} · ${p.classLabel} (${p.syllabus?.boardLabel ?? p.sourceBoard}).`,
            icon: <Sparkles className="h-4 w-4 text-emerald-500" aria-hidden="true" />,
          })
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        // Keep any existing (optimistically updated) plan on screen — the
        // inline error strip offers a retry; only a truly empty module
        // falls back to the full error card.
        setPlanError(e instanceof Error ? e.message : 'The lesson plan could not load.')
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selection, planTick])

  const retryAssignments = useCallback(() => setAssignmentsTick((t) => t + 1), [])
  const retryPlan = useCallback(() => setPlanTick((t) => t + 1), [])

  // ── selectors ──
  const selectClass = useCallback(
    (classId: string) => {
      const inClass = (assignments ?? []).filter((a) => a.classId === classId)
      const next =
        inClass.find((a) => a.subjectId === selection?.subjectId) ?? inClass[0] ?? null
      if (!next) return
      if (selection && next.classId === selection.classId && next.subjectId === selection.subjectId) {
        return
      }
      setPlan(null)
      setPlanError(null)
      setSelection({ classId: next.classId, subjectId: next.subjectId })
    },
    [assignments, selection],
  )

  const selectSubject = useCallback(
    (subjectId: string) => {
      if (!selection || subjectId === selection.subjectId) return
      const exists = (assignments ?? []).some(
        (a) => a.classId === selection.classId && a.subjectId === subjectId,
      )
      if (!exists) return
      setPlan(null)
      setPlanError(null)
      setSelection({ ...selection, subjectId })
    },
    [assignments, selection],
  )

  // ── optimistic completion toggle (rollback + toast; refetch = truth) ──
  const handleToggleCompletion = useCallback(
    async (topicId: string, completed: boolean) => {
      const snapshot = plan
      if (!snapshot) return
      setPendingTopicId(topicId)
      setPlan(applyCompletion(snapshot, topicId, completed))
      try {
        await setTopicCompletion(topicId, completed)
        toast.success(completed ? 'Topic completed' : 'Completion undone')
        setPlanTick((t) => t + 1)
      } catch (e: unknown) {
        setPlan(snapshot)
        toast.error(
          completed ? 'Could not mark the topic complete' : 'Could not undo the completion',
          { description: e instanceof Error ? e.message : undefined },
        )
      } finally {
        setPendingTopicId(null)
      }
    },
    [plan],
  )

  // ── LP-2: quick-add (per unit + from the syllabus library) ──
  const runAdd = useCallback(
    async (input: {
      unitNo: number | null
      unitName: string | null
      topicName: string
      description: string | null
      periodsNeeded: number
      successMessage?: string
    }) => {
      if (!selection) return
      try {
        await addTopic({
          classId: selection.classId,
          subjectId: selection.subjectId,
          unitNo: input.unitNo,
          unitName: input.unitName,
          topicName: input.topicName,
          description: input.description,
          periodsNeeded: input.periodsNeeded,
        })
        toast.success(input.successMessage ?? `“${input.topicName}” added to the plan`)
        setPlanTick((t) => t + 1)
      } catch (e: unknown) {
        toast.error('Could not add the topic', {
          description: e instanceof Error ? e.message : undefined,
        })
        throw e
      }
    },
    [selection],
  )

  const handleQuickAdd = useCallback(
    (unitNo: number, topicName: string, periodsNeeded: number) => {
      setQuickAddPending(true)
      runAdd({ unitNo, unitName: null, topicName, description: null, periodsNeeded })
        .catch(() => undefined)
        .finally(() => setQuickAddPending(false))
    },
    [runAdd],
  )

  const handleQuickAddMissing = useCallback(
    (topic: SyllabusMissingTopic) => {
      setPendingMissingName(topic.topicName)
      runAdd({
        unitNo: topic.unitNo,
        unitName: null,
        topicName: topic.topicName,
        description: topic.description,
        periodsNeeded: topic.periodsNeeded,
        successMessage: `“${topic.topicName}” copied from the syllabus`,
      })
        .catch(() => undefined)
        .finally(() => setPendingMissingName(null))
    },
    [runAdd],
  )

  const handleMergeAll = useCallback(async () => {
    if (!selection || !plan?.syllabus) return
    setMergingAll(true)
    try {
      const added = await mergeSyllabus(selection.classId, selection.subjectId)
      if (added > 0) {
        toast.success(`${added} syllabus ${added === 1 ? 'topic' : 'topics'} added to the plan`, {
          description: `From the ${plan.syllabus.boardLabel} session syllabus.`,
        })
      } else {
        toast.info('Your plan already covers the full syllabus')
      }
      setPlanTick((t) => t + 1)
    } catch (e: unknown) {
      toast.error('Could not merge the syllabus', {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setMergingAll(false)
    }
  }, [selection, plan?.syllabus])

  // ── LP-2: the authoring sheet (add + edit) ──
  const openAddSheet = useCallback(
    (unitNo: number | null) => {
      setSheetTarget({ editing: null, defaultUnitNo: unitNo, forceNewUnit: false })
      setSheetOpen(true)
    },
    [],
  )

  const openNewUnitSheet = useCallback(() => {
    setSheetTarget({ editing: null, defaultUnitNo: null, forceNewUnit: true })
    setSheetOpen(true)
  }, [])

  const openEditSheet = useCallback((topic: ScheduledTopic) => {
    setSheetTarget({ editing: topic, defaultUnitNo: topic.unitNo, forceNewUnit: false })
    setSheetOpen(true)
  }, [])

  const handleSheetSubmit = useCallback(
    async (draft: TopicDraft) => {
      if (!selection || !plan) return
      setSheetSubmitting(true)
      try {
        if (sheetTarget.editing) {
          await updateTopic({
            topicId: sheetTarget.editing.id,
            topicName: draft.topicName,
            description: draft.description,
            periodsNeeded: draft.periodsNeeded,
            unitNo: draft.unitNo ?? undefined,
          })
          toast.success('Topic updated')
        } else {
          await addTopic({
            classId: selection.classId,
            subjectId: selection.subjectId,
            unitNo: draft.unitNo,
            unitName: draft.unitName,
            topicName: draft.topicName,
            description: draft.description,
            periodsNeeded: draft.periodsNeeded,
          })
          toast.success(
            draft.unitNo == null
              ? `Unit “${draft.unitName}” added with its first topic`
              : `“${draft.topicName}” added to the plan`,
          )
        }
        setSheetOpen(false)
        setPlanTick((t) => t + 1)
      } catch (e: unknown) {
        toast.error(sheetTarget.editing ? 'Could not save the changes' : 'Could not add the topic', {
          description: e instanceof Error ? e.message : undefined,
        })
      } finally {
        setSheetSubmitting(false)
      }
    },
    [selection, plan, sheetTarget.editing],
  )

  // ── LP-2: delete (optimistic removal + rollback) ──
  const handleDeleteTopic = useCallback(
    async (topic: ScheduledTopic) => {
      const snapshot = plan
      if (!snapshot) return
      setDeletingTopicId(topic.id)
      setPlan(applyTopicRemoval(snapshot, topic.id))
      try {
        await deleteTopic(topic.id)
        toast.success(`“${topic.topicName}” removed`)
        setPlanTick((t) => t + 1)
      } catch (e: unknown) {
        setPlan(snapshot)
        toast.error('Could not delete the topic', {
          description: e instanceof Error ? e.message : undefined,
        })
      } finally {
        setDeletingTopicId(null)
      }
    },
    [plan],
  )

  // ── render: full-module states ──

  if (assignmentsLoading && !assignments) {
    return (
      <PageTransition className="space-y-4">
        <LessonPlannerSkeleton />
      </PageTransition>
    )
  }

  if (!assignments) {
    return (
      <PageTransition className="space-y-4">
        <LoadErrorCard
          message="Couldn't load the lesson plan"
          detail={assignmentsError}
          onRetry={retryAssignments}
        />
      </PageTransition>
    )
  }

  if (assignments.length === 0) {
    return (
      <PageTransition className="space-y-4">
        <GlassCard hover={false} className="p-4 sm:p-6">
          <HubEmptyState
            icon={BookOpen}
            title="No teaching assignments yet"
            hint="Classes you teach will appear here."
          />
        </GlassCard>
      </PageTransition>
    )
  }

  // ── render: module with selectors ──

  const classOptions: TeachingAssignment[] = []
  for (const a of assignments) {
    if (!classOptions.some((c) => c.classId === a.classId)) classOptions.push(a)
  }
  const subjectOptions = assignments.filter((a) => a.classId === selection?.classId)
  const selected =
    assignments.find(
      (a) => a.classId === selection?.classId && a.subjectId === selection?.subjectId,
    ) ?? null

  const sessionLabel = plan ? sessionLabelFromStart(plan.sessionStart) : null
  const toolbarContext =
    plan && sessionLabel
      ? `Academic Session ${sessionLabel}`
      : plan
        ? `${plan.classLabel} · ${plan.subjectName}`
        : selected
          ? `${selected.classLabel} · ${selected.subjectName}`
          : undefined

  const toggleCompletion = (topicId: string, completed: boolean) => {
    void handleToggleCompletion(topicId, completed)
  }

  return (
    <PageTransition className="space-y-4">
      {/* quiet context toolbar — the top bar already names the module.
          The schedule is board-fed, and adding on top is one tap away. */}
      <ModuleToolbar
        context={toolbarContext}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selection?.classId ?? ''}
              onValueChange={selectClass}
              disabled={classOptions.length === 0}
            >
              <SelectTrigger
                aria-label="Class"
                className="h-8 w-[150px] text-xs font-medium sm:w-[170px]"
              >
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                {classOptions.map((c) => (
                  <SelectItem key={c.classId} value={c.classId} className="text-xs">
                    {c.classLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selection?.subjectId ?? ''}
              onValueChange={selectSubject}
              disabled={subjectOptions.length === 0}
            >
              <SelectTrigger
                aria-label="Subject"
                className="h-8 w-[150px] text-xs font-medium sm:w-[170px]"
              >
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {subjectOptions.map((s) => (
                  <SelectItem key={s.subjectId} value={s.subjectId} className="text-xs">
                    {s.subjectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              size="sm"
              onClick={() => openAddSheet(plan?.units[0]?.unitNo ?? null)}
              disabled={!plan || plan.topics.length === 0}
              className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <BookPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Add topic
            </Button>
          </div>
        }
      />

      {/* quiet-refetch failure while content is on screen */}
      {plan && planError && <HubSectionError message={planError} onRetry={retryPlan} />}

      {planLoading && !plan ? (
        <PlanSkeleton />
      ) : plan ? (
        plan.topics.length === 0 ? (
          /* honest zero-topic state — no template matched this subject */
          <GlassCard hover={false} className="p-4 sm:p-6">
            <HubEmptyState
              icon={BookX}
              title={`No plan for ${plan.subjectName} in ${plan.classLabel} yet`}
              hint="This subject has no board syllabus template — build the plan yourself in seconds."
            />
            <div className="mt-1 flex justify-center">
              <Button
                type="button"
                onClick={() => openAddSheet(null)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <BookPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Add the first topic
              </Button>
            </div>
          </GlassCard>
        ) : (
          <motion.div
            key={`${plan.classId}|${plan.subjectId}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* 1 — summary cards (My Timetable recipe) */}
            <HubStatCards
              stats={summaryStatsFor(plan)}
              className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
            />

            {/* 2 — the current topic (compact card, emerald accent) */}
            <CurrentTopicCard
              plan={plan}
              pending={plan.today.topic != null && pendingTopicId === plan.today.topic.id}
              onToggleCompletion={toggleCompletion}
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-4">
                {/* 2 — curriculum progress */}
                <ProgressPanel plan={plan} />
                {/* 3 — the session plan (primary experience) */}
                <CurriculumMapCard
                  plan={plan}
                  pendingTopicId={pendingTopicId}
                  deletingTopicId={deletingTopicId}
                  onToggleCompletion={toggleCompletion}
                  onEditTopic={openEditSheet}
                  onDeleteTopic={(t) => void handleDeleteTopic(t)}
                  onQuickAdd={handleQuickAdd}
                  onAddUnit={openNewUnitSheet}
                  quickAddPending={quickAddPending}
                />
              </div>
              <div className="min-w-0 space-y-4">
                {/* 4 — the board syllabus library (auto-feed + merges) */}
                {plan.syllabus && (
                  <SyllabusLibraryCard
                    plan={plan}
                    onQuickAddMissing={handleQuickAddMissing}
                    onMergeAll={() => void handleMergeAll()}
                    pendingTopicName={pendingMissingName}
                    mergingAll={mergingAll}
                  />
                )}
                {/* 5 — upcoming queue */}
                <UpcomingPanel plan={plan} />
                <ScheduleBasisCard plan={plan} />
              </div>
            </div>
          </motion.div>
        )
      ) : planError ? (
        <LoadErrorCard
          message="Couldn't load the lesson plan"
          detail={planError}
          onRetry={retryPlan}
        />
      ) : null}

      {/* the authoring sheet (add + edit) */}
      {plan && (
        <AddTopicSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          plan={plan}
          editing={sheetTarget.editing}
          defaultUnitNo={sheetTarget.defaultUnitNo}
          forceNewUnit={sheetTarget.forceNewUnit}
          submitting={sheetSubmitting}
          onSubmit={(draft) => void handleSheetSubmit(draft)}
        />
      )}
    </PageTransition>
  )
}
