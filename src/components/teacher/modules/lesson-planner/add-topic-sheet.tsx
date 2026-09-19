'use client'

/**
 * lesson-planner/add-topic-sheet — the authoring surface (LP-2). ONE sheet
 * for adding and editing topics, deliberately friction-free:
 *
 *   · a big autofocus topic-name field (Enter submits),
 *   · a unit picker with an inline "New unit" option,
 *   · a −/+ periods stepper,
 *   · an optional description.
 *
 * Adding to an existing unit slots the topic at the end of that unit; a new
 * unit appends at the end of the plan. The schedule recalculates on the
 * server — the teacher never thinks about dates.
 */

import { useEffect, useMemo, useState } from 'react'
import { BookPlus, Loader2, Minus, PencilLine, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { LessonPlanPayload, ScheduledTopic } from './api'
import { unitAccent } from './shared'

const NEW_UNIT = '__new_unit__'

export interface TopicDraft {
  topicName: string
  /** null → create a new unit named `unitName`. */
  unitNo: number | null
  unitName: string | null
  periodsNeeded: number
  description: string | null
}

interface AddTopicSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: LessonPlanPayload
  /** Present in edit mode. */
  editing: ScheduledTopic | null
  /** Preferred unit when opening from a quick-add context. */
  defaultUnitNo: number | null
  /** True when opened via the "New unit" button. */
  forceNewUnit: boolean
  submitting: boolean
  onSubmit: (draft: TopicDraft) => void
}

export function AddTopicSheet({
  open,
  onOpenChange,
  plan,
  editing,
  defaultUnitNo,
  forceNewUnit,
  submitting,
  onSubmit,
}: AddTopicSheetProps) {
  const isEdit = editing != null

  const [topicName, setTopicName] = useState('')
  const [unitChoice, setUnitChoice] = useState<string>(String(defaultUnitNo ?? plan.units[0]?.unitNo ?? 1))
  const [newUnitName, setNewUnitName] = useState('')
  const [periods, setPeriods] = useState(4)
  const [description, setDescription] = useState('')

  // (Re)initialise the form whenever the sheet opens or its target changes.
  useEffect(() => {
    if (!open) return
    if (editing) {
      setTopicName(editing.topicName)
      setUnitChoice(String(editing.unitNo))
      setPeriods(editing.periodsNeeded)
      setDescription(editing.description ?? '')
      setNewUnitName('')
    } else if (forceNewUnit) {
      setTopicName('')
      setUnitChoice(NEW_UNIT)
      setPeriods(4)
      setDescription('')
      setNewUnitName('')
    } else {
      setTopicName('')
      setUnitChoice(String(defaultUnitNo ?? plan.units[0]?.unitNo ?? 1))
      setPeriods(4)
      setDescription('')
      setNewUnitName('')
    }
  }, [open, editing, forceNewUnit, defaultUnitNo, plan.units])

  const unitOptions = useMemo(
    () => [...plan.units].sort((a, b) => a.unitNo - b.unitNo),
    [plan.units],
  )

  const isNewUnit = unitChoice === NEW_UNIT
  const canSubmit =
    topicName.trim().length > 0 &&
    (!isNewUnit || newUnitName.trim().length > 0) &&
    !submitting

  const submit = () => {
    if (!canSubmit) return
    onSubmit({
      topicName: topicName.trim(),
      unitNo: isNewUnit ? null : Number(unitChoice),
      unitName: isNewUnit ? newUnitName.trim() : null,
      periodsNeeded: periods,
      description: description.trim() ? description.trim() : null,
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border bg-gradient-to-br from-emerald-50 to-teal-50/60 px-5 py-4 dark:from-emerald-950/40 dark:to-teal-950/30 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10">
              {isEdit ? (
                <PencilLine className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              ) : (
                <BookPlus className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <SheetTitle className="text-left text-base font-bold tracking-tight">
                {isEdit ? 'Edit topic' : 'Add a topic'}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-left text-xs">
                {plan.subjectName} · {plan.classLabel}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col gap-5 px-5 py-5 sm:px-6"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {/* topic name */}
          <div className="space-y-1.5">
            <Label htmlFor="topic-name" className="text-xs font-semibold">
              Topic name
            </Label>
            <Input
              id="topic-name"
              autoFocus
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              placeholder="e.g. Surface Areas — Practice and Numericals"
              className="h-10 rounded-xl text-sm font-medium"
              maxLength={160}
            />
          </div>

          {/* unit */}
          <div className="space-y-1.5">
            <Label htmlFor="topic-unit" className="text-xs font-semibold">
              Unit
            </Label>
            <Select value={unitChoice} onValueChange={setUnitChoice}>
              <SelectTrigger id="topic-unit" className="h-10 rounded-xl text-sm">
                <SelectValue placeholder="Choose a unit" />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((u) => (
                  <SelectItem key={u.unitNo} value={String(u.unitNo)} className="text-sm">
                    <span
                      className={cn(
                        'mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold tabular-nums',
                        unitAccent(u.unitNo).chip,
                      )}
                      aria-hidden="true"
                    >
                      {u.unitNo}
                    </span>
                    <span className="truncate">{u.unitName}</span>
                  </SelectItem>
                ))}
                {!isEdit && (
                  <SelectItem value={NEW_UNIT} className="text-sm">
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">+ New unit</span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-[11px] text-muted-foreground">
                Pick another unit to move this topic there.
              </p>
            )}
          </div>

          {/* new unit name */}
          {isNewUnit && (
            <div className="space-y-1.5">
              <Label htmlFor="unit-name" className="text-xs font-semibold">
                New unit name
              </Label>
              <Input
                id="unit-name"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="e.g. My Practice Worksheets"
                className="h-10 rounded-xl text-sm"
                maxLength={80}
              />
            </div>
          )}

          {/* periods stepper */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Periods needed</Label>
            <div className="flex items-center gap-2" role="group" aria-label="Periods needed">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => setPeriods((p) => Math.max(1, p - 1))}
                disabled={periods <= 1}
                aria-label="Fewer periods"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="flex h-9 w-16 items-center justify-center rounded-xl border border-border bg-muted/40 text-sm font-bold tabular-nums">
                {periods}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => setPeriods((p) => Math.min(60, p + 1))}
                disabled={periods >= 60}
                aria-label="More periods"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="text-[11px] text-muted-foreground">
                ≈ {Math.max(1, Math.ceil(periods / Math.max(plan.pace.periodsPerDay || 1, 0.25)))} teaching day
                {Math.max(1, Math.ceil(periods / Math.max(plan.pace.periodsPerDay || 1, 0.25))) > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* description */}
          <div className="space-y-1.5">
            <Label htmlFor="topic-description" className="text-xs font-semibold">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="topic-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should this lesson cover?"
              className="min-h-[72px] rounded-xl text-sm"
              maxLength={400}
            />
          </div>

          <p className="mt-auto rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
            The topic joins the end of its unit and the day-wise schedule recalculates on its own —
            holidays and your timetable are already accounted for.
          </p>
        </form>

        <SheetFooter className="flex-row items-center gap-2 border-t border-border bg-muted/30 px-5 py-3 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            className="rounded-xl text-xs font-semibold"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className={cn(
              'ml-auto flex-1 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 sm:flex-none sm:px-6',
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {isEdit ? 'Saving…' : 'Adding…'}
              </>
            ) : isEdit ? (
              'Save changes'
            ) : (
              'Add topic'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
