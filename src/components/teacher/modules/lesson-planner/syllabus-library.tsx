'use client'

/**
 * lesson-planner/syllabus-library — the board-syllabus panel (LP-2). Shows
 * which board template backs this class+subject (CBSE / UP Board), how much
 * of it the teacher's plan already covers, and offers one-tap feeding:
 * a “+” on every missing syllabus topic, or "Add all missing" in one go.
 * Full coverage renders a celebratory state. Also surfaces any custom
 * topics the teacher has added on top of the syllabus.
 */

import { AnimatePresence, motion } from 'framer-motion'
import {
  BadgeCheck,
  BookMarked,
  Check,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/shared/ui'
import { cn } from '@/lib/utils'
import type { LessonPlanPayload, SyllabusMissingTopic } from './api'
import { AnimatedBar, LIST_ITEM, LIST_STAGGER, THIN_SCROLLBAR, unitAccent } from './shared'

const BOARD_BADGE: Record<string, { label: string; chip: string }> = {
  CBSE: {
    label: 'CBSE',
    chip: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30',
  },
  UP_BOARD: {
    label: 'UP BOARD',
    chip: 'bg-orange-600 text-white shadow-sm shadow-orange-600/30',
  },
}

interface SyllabusLibraryCardProps {
  plan: LessonPlanPayload
  /** Quick-add one missing syllabus topic. */
  onQuickAddMissing: (topic: SyllabusMissingTopic) => void
  /** Add every missing topic at once. */
  onMergeAll: () => void
  pendingTopicName: string | null
  mergingAll: boolean
}

export function SyllabusLibraryCard({
  plan,
  onQuickAddMissing,
  onMergeAll,
  pendingTopicName,
  mergingAll,
}: SyllabusLibraryCardProps) {
  const syllabus = plan.syllabus
  if (!syllabus) return null

  const pct = syllabus.totalTopics > 0
    ? Math.round((syllabus.coveredTopics / syllabus.totalTopics) * 100)
    : 0
  const badge = BOARD_BADGE[syllabus.board] ?? BOARD_BADGE.CBSE
  const extras = Math.max(0, plan.topics.length - syllabus.coveredTopics)
  const missing = syllabus.missingTopics

  return (
    <GlassCard hover={false} className="overflow-hidden p-0">
      {/* header */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-muted/60 to-muted/20 px-4 py-3.5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl"
        />
        <div className="relative flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10">
            <BookMarked className="h-4.5 w-4.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                Syllabus Library
              </p>
              <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider', badge.chip)}>
                {badge.label}
              </span>
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground" title={syllabus.bookLabel}>
              {syllabus.bookLabel}
            </p>
          </div>
        </div>

        {/* coverage */}
        <div className="relative mt-3">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              {syllabus.coveredTopics} of {syllabus.totalTopics} syllabus topics in your plan
            </p>
            <p className="text-[11px] font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{pct}%</p>
          </div>
          <AnimatedBar pct={pct} className="h-1.5" ariaLabel="Syllabus coverage" />
        </div>

        {/* unit coverage chips */}
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {syllabus.units.map((u) => {
            const complete = u.coveredCount >= u.topicCount
            const accent = unitAccent(u.unitNo)
            return (
              <span
                key={u.unitNo}
                title={`Unit ${u.unitNo} · ${u.unitName} — ${u.coveredCount}/${u.topicCount} in plan`}
                className={cn(
                  'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                  complete
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-border bg-background/70 text-muted-foreground',
                )}
              >
                {complete ? (
                  <Check className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                ) : (
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', accent.dot)} aria-hidden="true" />
                )}
                <span className="truncate">
                  {u.unitName} {u.coveredCount}/{u.topicCount}
                </span>
              </span>
            )
          })}
        </div>
      </div>

      {/* missing topics / complete state */}
      {missing.length > 0 ? (
        <div>
          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Not in your plan yet
            </p>
            <Button
              type="button"
              size="sm"
              onClick={onMergeAll}
              disabled={mergingAll}
              className="h-7 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {mergingAll ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-3 w-3" aria-hidden="true" />
              )}
              Add all {missing.length}
            </Button>
          </div>
          <div className={cn('max-h-60 overflow-y-auto border-t border-border/60', THIN_SCROLLBAR)}>
            <motion.div variants={LIST_STAGGER} initial="hidden" animate="show">
              <AnimatePresence initial={false}>
                {missing.map((t) => {
                  const pending = pendingTopicName === t.topicName
                  return (
                    <motion.button
                      key={`${t.unitNo}-${t.topicName}`}
                      type="button"
                      variants={LIST_ITEM}
                      layout
                      exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
                      onClick={() => onQuickAddMissing(t)}
                      disabled={pending || mergingAll}
                      className="group flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
                      title={`Add “${t.topicName}” to your plan`}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-emerald-700 transition-all group-hover:bg-emerald-500 group-hover:text-white dark:text-emerald-400',
                          pending ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10',
                        )}
                      >
                        {pending ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <Plus className="h-3 w-3" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{t.topicName}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          Unit {t.unitNo} · {t.unitName} · {t.periodsNeeded}p
                        </span>
                      </span>
                    </motion.button>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="flex items-center gap-2.5 px-4 py-4"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
            <BadgeCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Full syllabus covered
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Your plan contains the complete {badge.label} session syllabus for this subject.
            </p>
          </div>
        </motion.div>
      )}

      {extras > 0 && (
        <p className="border-t border-border/60 bg-muted/20 px-4 py-2 text-[10px] font-medium text-muted-foreground">
          +{extras} custom {extras === 1 ? 'topic' : 'topics'} added on top of the syllabus
        </p>
      )}
    </GlassCard>
  )
}
