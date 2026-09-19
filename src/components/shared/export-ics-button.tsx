'use client'

/**
 * ExportIcsButton — shared "Add to calendar" affordance for timetable
 * surfaces (Student My-Class view, Teacher My-Timetable).
 *
 * One click builds a valid RFC 5545 .ics (weekly recurring events, IST
 * timezone) from the data the host module already holds and downloads
 * it — Google Calendar, Apple Calendar and Outlook all import it.
 * Success is confirmed with a toast; empty schedules disable the button
 * (nothing to export — never a broken file).
 *
 * Two visual variants so each workspace keeps its own design language:
 *   · 'glass'   — the student workspace pill (border-border bg-card,
 *     primary hover);
 *   · 'toolbar' — the teacher workspace button (Marks-Entry language,
 *     emerald hover accents).
 */

import { useCallback } from 'react'
import { CalendarPlus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buildIcs, downloadIcs, type IcsEventInput } from '@/lib/ics/builder'

export interface ExportIcsButtonProps {
  /** Events to export (weekly recurrences). Empty ⇒ disabled. */
  events: IcsEventInput[]
  calendarName: string
  calendarDescription?: string
  /** File name without extension. */
  filename: string
  variant?: 'glass' | 'toolbar'
  /** Override the visible label (defaults to "Add to Calendar"). */
  label?: string
  className?: string
}

export function ExportIcsButton({
  events,
  calendarName,
  calendarDescription,
  filename,
  variant = 'glass',
  label = 'Add to Calendar',
  className,
}: ExportIcsButtonProps) {
  const hasEvents = events.length > 0

  const onExport = useCallback(() => {
    if (!hasEvents) return
    try {
      const ics = buildIcs({ calendarName, calendarDescription, events })
      downloadIcs(filename, ics)
      toast.success('Timetable exported', {
        description: `${events.length} weekly classes — import the .ics into Google Calendar, Apple Calendar or Outlook.`,
        icon: <Check className="h-4 w-4" aria-hidden />,
      })
    } catch {
      toast.error('Could not build the calendar file', {
        description: 'Please try again — nothing was downloaded.',
      })
    }
  }, [hasEvents, calendarName, calendarDescription, events, filename])

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={!hasEvents}
      title="Recurring weekly events — works with Google Calendar, Apple Calendar & Outlook"
      aria-label={`Export ${calendarName} as a calendar file`}
      className={cn(
        'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
        variant === 'glass'
          ? 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground active:scale-[0.98]'
          : 'border-border bg-card text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] hover:text-emerald-700 dark:hover:text-emerald-400 active:scale-[0.98]',
        className,
      )}
    >
      <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )
}
