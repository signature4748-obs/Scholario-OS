'use client'

/**
 * lesson-planner/curriculum-map — the PRIMARY experience (LP-2 redesign):
 * the complete unit → topic session plan for the selected class + subject.
 *
 * Each unit is a section with an accent number badge, per-unit animated
 * progress bar and sticky header. Topic rows carry a status dot (pop
 * animation when completed), the global number + name, the scheduled
 * window, a periods chip and hover actions: complete/undo, edit (opens the
 * authoring sheet), delete (confirm dialog; completed topics protected).
 * Every unit ends with an inline quick-add row; the card ends with
 * "New unit". Entrance is staggered; rows animate in as they're added.
 */

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Loader2, Pencil, PlusCircle, Trash2, Undo2, X } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlassCard } from '@/components/shared/ui'
import { cn } from '@/lib/utils'
import type { LessonPlanPayload, ScheduledTopic } from './api'
import {
  formatDayRange,
  groupByUnit,
  LIST_STAGGER,
  LIST_ITEM,
  THIN_SCROLLBAR,
  TOPIC_STATUS,
  unitAccent,
} from './shared'

// ─── Topic row ───────────────────────────────────────────────────────────

interface TopicRowProps {
  topic: ScheduledTopic
  pending: boolean
  deleting: boolean
  onToggleCompletion: (topicId: string, completed: boolean) => void
  onEditTopic: (topic: ScheduledTopic) => void
  onDeleteTopic: (topic: ScheduledTopic) => void
}

function StatusGlyph({ topic }: { topic: ScheduledTopic }) {
  if (topic.status === 'completed') {
    return (
      <motion.span
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 17 }}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15"
      >
        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      </motion.span>
    )
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
      <span className={cn('h-2 w-2 rounded-full', TOPIC_STATUS[topic.status].dot)} />
      {topic.status === 'today' && (
        <span className="absolute h-5 w-5 animate-ping rounded-full bg-amber-500/25" aria-hidden="true" />
      )}
    </span>
  )
}

function TopicRow({
  topic,
  pending,
  deleting,
  onToggleCompletion,
  onEditTopic,
  onDeleteTopic,
}: TopicRowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const done = topic.status === 'completed'
  const status = TOPIC_STATUS[topic.status]

  return (
    <motion.div
      layout="position"
      variants={LIST_ITEM}
      className="group relative flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-3 py-2.5 transition-colors hover:bg-muted/40 sm:px-4"
    >
      <StatusGlyph topic={topic} />

      <p
        className={cn(
          'min-w-0 flex-1 text-sm font-medium',
          done && 'text-muted-foreground',
        )}
        title={`${topic.topicNo}. ${topic.topicName}`}
      >
        <span className="mr-1.5 tabular-nums text-muted-foreground/70">{topic.topicNo}.</span>
        {topic.topicName}
      </p>

      <span
        className={cn(
          'shrink-0 text-[11px] font-medium tabular-nums',
          status.text,
        )}
      >
        {formatDayRange(topic.startDate, topic.endDate)}
      </span>

      <span
        className="shrink-0 rounded-full border border-border bg-muted/50 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground"
        title={`${topic.periodsNeeded} periods needed`}
      >
        {topic.periodsNeeded}p
      </span>

      {/* hover / focus actions */}
      <div className="flex shrink-0 items-center gap-0.5 sm:absolute sm:right-2 sm:rounded-lg sm:border sm:border-border sm:bg-background/95 sm:p-0.5 sm:opacity-0 sm:shadow-sm sm:backdrop-blur-sm sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" aria-hidden="true" />
        ) : (
          <>
            <button
              type="button"
              onClick={() => onToggleCompletion(topic.id, !done)}
              disabled={pending}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50',
                done
                  ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  : 'text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400',
              )}
              title={done ? 'Undo completion' : 'Mark complete'}
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : done ? (
                <Undo2 className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Check className="h-3 w-3" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{done ? 'Undo' : 'Done'}</span>
            </button>
            <button
              type="button"
              onClick={() => onEditTopic(topic)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Edit topic"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={done}
              onClick={() => setConfirmOpen(true)}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                done
                  ? 'cursor-not-allowed text-muted-foreground/40'
                  : 'text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400',
              )}
              title={done ? 'Completed topics cannot be deleted' : 'Delete topic'}
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left">Delete this topic?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              “{topic.topicName}” will be removed from the {topic.unitName} plan. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDeleteTopic(topic)}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Delete topic
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

// ─── Inline quick-add row ────────────────────────────────────────────────

function QuickAddRow({
  unitNo,
  busy,
  onAdd,
  onClose,
}: {
  unitNo: number
  busy: boolean
  onAdd: (topicName: string, periodsNeeded: number) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [periods, setPeriods] = useState(4)

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className="flex flex-wrap items-center gap-2 overflow-hidden border-t border-dashed border-border/70 bg-muted/20 px-3 py-2 sm:px-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim() || busy) return
        onAdd(name.trim(), periods)
        setName('')
      }}
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New topic name…"
        aria-label={`Add topic to unit ${unitNo}`}
        className="h-8 min-w-0 flex-1 rounded-lg text-xs"
        maxLength={160}
      />
      <div className="flex items-center gap-1" title="Periods needed">
        <Input
          type="number"
          min={1}
          max={60}
          value={periods}
          onChange={(e) => setPeriods(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
          aria-label="Periods needed"
          className="h-8 w-16 rounded-lg text-center text-xs tabular-nums"
        />
        <span className="text-[10px] font-medium text-muted-foreground">p</span>
      </div>
      <Button type="submit" size="sm" disabled={!name.trim() || busy}
        className="h-8 rounded-lg bg-emerald-600 px-3 text-[11px] font-semibold text-white hover:bg-emerald-700">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : 'Add'}
      </Button>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Cancel"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </motion.form>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────

interface CurriculumMapCardProps {
  plan: LessonPlanPayload
  pendingTopicId: string | null
  deletingTopicId: string | null
  onToggleCompletion: (topicId: string, completed: boolean) => void
  onEditTopic: (topic: ScheduledTopic) => void
  onDeleteTopic: (topic: ScheduledTopic) => void
  onQuickAdd: (unitNo: number, topicName: string, periodsNeeded: number) => void
  onAddUnit: () => void
  quickAddPending: boolean
}

export function CurriculumMapCard({
  plan,
  pendingTopicId,
  deletingTopicId,
  onToggleCompletion,
  onEditTopic,
  onDeleteTopic,
  onQuickAdd,
  onAddUnit,
  quickAddPending,
}: CurriculumMapCardProps) {
  const sections = groupByUnit(plan.topics)
  const [quickAddUnit, setQuickAddUnit] = useState<number | null>(null)

  return (
    <GlassCard hover={false} className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border bg-muted/30 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Session Plan
        </p>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {sections.length} {sections.length === 1 ? 'unit' : 'units'} · {plan.progress.total} topics
        </p>
      </div>

      <div className={cn('max-h-[620px] overflow-y-auto', THIN_SCROLLBAR)}>
        <AnimatePresence initial={false}>
          {sections.map((section, si) => {
            const done = section.topics.filter((t) => t.status === 'completed').length
            const accent = unitAccent(section.unitNo)
            return (
              <motion.section
                key={section.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(si * 0.06, 0.35), duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-3 py-2 backdrop-blur-sm sm:px-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums',
                        accent.chip,
                      )}
                    >
                      {section.unitNo}
                    </span>
                    <p
                      className="min-w-0 flex-1 truncate text-xs font-semibold"
                      title={`Unit ${section.unitNo} · ${section.unitName}`}
                    >
                      {section.unitName}
                    </p>
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                      {done}/{section.topics.length}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-border/60">
                  <motion.div variants={LIST_STAGGER} initial="hidden" animate="show">
                    {section.topics.map((topic) => (
                      <TopicRow
                        key={topic.id}
                        topic={topic}
                        pending={pendingTopicId === topic.id}
                        deleting={deletingTopicId === topic.id}
                        onToggleCompletion={onToggleCompletion}
                        onEditTopic={onEditTopic}
                        onDeleteTopic={onDeleteTopic}
                      />
                    ))}
                  </motion.div>

                  <AnimatePresence initial={false}>
                    {quickAddUnit === section.unitNo ? (
                      <QuickAddRow
                        key={`qa-${section.unitNo}`}
                        unitNo={section.unitNo}
                        busy={quickAddPending}
                        onAdd={(topicName, periodsNeeded) =>
                          onQuickAdd(section.unitNo, topicName, periodsNeeded)
                        }
                        onClose={() => setQuickAddUnit(null)}
                      />
                    ) : (
                      <motion.button
                        key={`qab-${section.unitNo}`}
                        type="button"
                        variants={LIST_ITEM}
                        onClick={() => setQuickAddUnit(section.unitNo)}
                        className="group flex w-full items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-muted-foreground/80 transition-colors hover:bg-muted/40 hover:text-foreground sm:px-4"
                      >
                        <PlusCircle
                          className="h-3.5 w-3.5 transition-transform group-hover:scale-110"
                          aria-hidden="true"
                        />
                        Add topic to Unit {section.unitNo}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.section>
            )
          })}
        </AnimatePresence>

        {/* new unit — opens the authoring sheet in new-unit mode */}
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.2 } }}
          onClick={onAddUnit}
          className="group flex w-full items-center justify-center gap-1.5 border-t border-dashed border-border/70 px-3 py-3 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          <PlusCircle className="h-3.5 w-3.5 transition-transform group-hover:rotate-90" aria-hidden="true" />
          New unit
        </motion.button>
      </div>
    </GlassCard>
  )
}
