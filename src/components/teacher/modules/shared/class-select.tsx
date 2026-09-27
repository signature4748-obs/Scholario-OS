'use client'

/**
 * shared/class-select — THE compact class selector (refinement §13–§16).
 *
 * One design language everywhere a class context is needed — Student
 * Growth, Student Directory, My Class, Fees & Payments:
 *
 *   · DESKTOP  → a compact select-style trigger + anchored dropdown list
 *   · MOBILE   → the same trigger opens a proper bottom sheet with large
 *                touch rows, internal scrolling and iOS safe-area padding
 *
 * The component is purely presentational: it renders exactly the classes
 * it is given — each module's API already resolves the authorized,
 * role-aware class list (assignment-driven scope, never the whole school).
 *
 * UX rules (§13/§14/§28):
 *   · no giant pill rows, no horizontal scrolling, no clipped labels
 *   · the trigger shows the tiny "Class" caption + current label + a
 *     quiet meta badge (average / student count depending on the module)
 *   · the class-teacher mark stays as a small BadgeCheck glyph
 */

import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Check, ChevronDown } from 'lucide-react'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

export interface ClassSelectOption {
  id: string
  label: string
  /** right-aligned context in the list row (e.g. "86 avg" / "11") */
  meta?: string | null
  /** the teacher is the appointed class teacher of this class */
  isClassTeacher?: boolean
}

interface ClassSelectProps {
  classes: ClassSelectOption[]
  /** selected class id — `null` means the "All classes" pseudo entry */
  value: string | null
  onChange: (id: string | null) => void
  /** when provided, an "All classes" entry is offered and `null` is valid */
  allLabel?: string
  /** meta badge for the "All classes" entry (e.g. scope average) */
  allMeta?: string | null
  /** aria label of the trigger, defaults to "Select class" */
  ariaLabel?: string
}

export function ClassSelect({
  classes,
  value,
  onChange,
  allLabel,
  allMeta,
  ariaLabel = 'Select class',
}: ClassSelectProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const hasAll = typeof allLabel === 'string'

  const selected =
    classes.find((c) => c.id === value) ??
    (hasAll ? { id: '', label: allLabel!, meta: allMeta ?? null, isClassTeacher: false } : null)

  // keep the selected entry valid if the class list changes underneath
  useEffect(() => {
    if (!hasAll && value != null && !classes.some((c) => c.id === value) && classes.length > 0) {
      onChange(classes[0].id)
    }
  }, [classes, value, hasAll, onChange])

  const pick = (id: string | null) => {
    onChange(id)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const rows: ClassSelectOption[] = hasAll
    ? [{ id: '', label: allLabel!, meta: allMeta ?? null, isClassTeacher: false }, ...classes]
    : classes

  const isSelected = (row: ClassSelectOption) =>
    hasAll && row.id === '' ? value == null : row.id === value

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={ariaLabel}
      onClick={() => setOpen((o) => !o)}
      className={cn(
        'group inline-flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-left shadow-xs transition-colors hover:border-primary/35 sm:w-auto',
        open && 'border-primary/45 ring-2 ring-primary/15',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Class
        </span>
        <span className="truncate text-xs font-semibold text-foreground sm:max-w-[12rem]">
          {selected?.label ?? 'Select…'}
        </span>
        {selected?.meta && (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-bold tabular-nums text-primary">
            {selected.meta}
          </span>
        )}
      </span>
      <ChevronDown
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground data-[open=true]:rotate-180"
        data-open={open}
        aria-hidden="true"
      />
    </button>
  )

  const list = (rowProps: { onPick: (r: ClassSelectOption) => void; mobile?: boolean }) => (
    <div
      role="listbox"
      aria-label={ariaLabel}
      className={cn(
        'flex flex-col',
        rowProps.mobile ? 'gap-1 overflow-y-auto px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'gap-0.5 p-1',
      )}
    >
      {rows.map((r) => {
        const active = isSelected(r)
        return (
          <button
            key={r.id || '__all__'}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => rowProps.onPick(r)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 text-left transition-colors',
              rowProps.mobile ? 'min-h-[44px] bg-card/60 py-2' : 'py-2',
              active
                ? 'border-primary/25 bg-primary/[0.07]'
                : rowProps.mobile
                  ? 'hover:bg-accent/60'
                  : 'hover:bg-accent/50',
            )}
          >
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block truncate text-[13px] leading-tight',
                  active ? 'font-semibold text-primary' : 'font-medium text-foreground',
                )}
              >
                {r.label}
              </span>
              {r.isClassTeacher && (
                <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                  Class Teacher
                </span>
              )}
            </span>
            {r.meta && (
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
                  active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {r.meta}
              </span>
            )}
            {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
          <DrawerContent className="max-h-[70dvh] rounded-t-2xl px-2 pt-2">
            <DrawerTitle className="px-3 pb-1.5 text-sm font-semibold">Select Class</DrawerTitle>
            <DrawerDescription className="sr-only">
              Choose one of your classes to focus the view on.
            </DrawerDescription>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {list({ onPick: (r) => pick(r.id || null), mobile: true })}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 rounded-xl border border-border bg-popover p-0 shadow-lg">
        {list({ onPick: (r) => pick(r.id || null) })}
      </PopoverContent>
    </Popover>
  )
}
