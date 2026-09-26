'use client'

/**
 * marks/scan/review-grid — the Excel-like marks review workspace.
 *
 * A dense data-entry grid, not a card list: sticky header row
 * (ROLL | STUDENT NAME | MARKS | STATUS), compact 34px rows, monospaced
 * tabular numbers, spreadsheet cell inputs (borderless until focus),
 * full keyboard support (Tab / Shift+Tab / Enter / ↑ ↓ / Esc), direct
 * typing, paste-safe numeric filtering, undo/redo, and honest status
 * chips (✓ Confirmed · ⚠ Review · ✕ Invalid · — Not detected) with the
 * REAL OCR confidence of each reading.
 */

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, Check, CircleAlert, Minus, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScanRow } from '@/lib/marks-scan/types'

interface ReviewGridProps {
  rows: ScanRow[]
  maxMarks: number
  activeRow: number | null
  onActiveRow: (idx: number | null) => void
  onCommit: (idx: number, value: string) => void
  onConfirm: (idx: number) => void
  /** Ref callback to register inputs for keyboard navigation. */
  registerInput: (idx: number, el: HTMLInputElement | null) => void
}

const STATUS_CELL: Record<
  ScanRow['status'],
  { label: string; title: string; cls: string }
> = {
  CONFIRMED: {
    label: 'Confirmed',
    title: 'OCR read this cleanly — verify and move on',
    cls: 'text-emerald-600 dark:text-emerald-400',
  },
  REVIEW: {
    label: 'Review',
    title: 'Needs your eye — edit the value or confirm as read',
    cls: 'text-amber-600 dark:text-amber-400',
  },
  INVALID: {
    label: 'Invalid',
    title: 'Rejected value — fix or clear before submitting',
    cls: 'text-rose-600 dark:text-rose-400',
  },
  UNREAD: {
    label: 'Not detected',
    title: 'No mark detected — type one if the sheet has it',
    cls: 'text-muted-foreground',
  },
}

export function ReviewGrid({
  rows,
  maxMarks,
  activeRow,
  onActiveRow,
  onCommit,
  onConfirm,
  registerInput,
}: ReviewGridProps) {
  const reduceMotion = useReducedMotion()
  const bodyRef = useRef<HTMLDivElement>(null)

  // Keep the active row visible while keyboard-navigating.
  useEffect(() => {
    if (activeRow == null || !bodyRef.current) return
    const el = bodyRef.current.querySelector<HTMLInputElement>(`input[data-row-idx="${activeRow}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeRow])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm dark:bg-card">
      {/* Column header — sticky */}
      <div className="grid shrink-0 grid-cols-[3.25rem_minmax(0,1fr)_6.5rem_8.5rem] items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>Roll</span>
        <span>Student</span>
        <span className="text-right">Marks</span>
        <span className="pl-1">Status</span>
      </div>

      {/* Rows — the spreadsheet body (scrollable, keyboard-first) */}
      <div
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:transparent"
        role="grid"
        aria-label="Marks review spreadsheet"
      >
        {rows.map((row, idx) => (
          <ReviewRow
            key={`${row.studentId || 'extra'}-${row.rollNo}-${idx}`}
            row={row}
            idx={idx}
            maxMarks={maxMarks}
            active={activeRow === idx}
            reduceMotion={reduceMotion ?? false}
            onActiveRow={onActiveRow}
            onCommit={onCommit}
            onConfirm={onConfirm}
            registerInput={registerInput}
          />
        ))}
      </div>
    </div>
  )
}

interface ReviewRowProps {
  row: ScanRow
  idx: number
  maxMarks: number
  active: boolean
  reduceMotion: boolean
  onActiveRow: (idx: number | null) => void
  onCommit: (idx: number, value: string) => void
  onConfirm: (idx: number) => void
  registerInput: (idx: number, el: HTMLInputElement | null) => void
}

function ReviewRow({
  row,
  idx,
  maxMarks,
  active,
  reduceMotion,
  onActiveRow,
  onCommit,
  onConfirm,
  registerInput,
}: ReviewRowProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const valueOnFocus = useRef('')

  useEffect(() => {
    registerInput(idx, inputRef.current)
    return () => registerInput(idx, null)
  }, [idx, registerInput])

  const status = STATUS_CELL[row.status]
  const isReview = row.status === 'REVIEW'
  const unmatched = row.match === 'UNMATCHED'

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(input)
      focusRow(idx + 1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      commit(input)
      focusRow(idx + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      commit(input)
      focusRow(idx - 1)
    } else if (e.key === 'Escape') {
      input.value = valueOnFocus.current
      input.blur()
    } else if (e.key === 'Tab') {
      // Native Tab/Shift+Tab order = DOM order = next/previous row.
      commit(input)
    }
  }

  const commit = (input: HTMLInputElement) => {
    if (input.value !== valueOnFocus.current) {
      onCommit(idx, input.value)
    }
  }

  const focusRow = (target: number) => {
    const el = document.querySelector<HTMLInputElement>(`input[data-row-idx="${target}"]`)
    if (el) {
      el.focus()
      el.select()
    }
  }

  // Paste safety: strip anything that is not a digit (or an AB marker).
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text/plain').trim().toUpperCase()
    if (!text) return
    e.preventDefault()
    const clean = text === 'AB' ? 'AB' : text.replace(/[^0-9]/g, '').slice(0, 3)
    e.currentTarget.value = clean
    commit(e.currentTarget)
  }

  const handleFocus = () => {
    valueOnFocus.current = row.value
    onActiveRow(idx)
    inputRef.current?.select()
  }

  const handleBlur = () => {
    if (inputRef.current) commit(inputRef.current)
  }

  const invalidCell = row.status === 'INVALID'

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: reduceMotion ? 0 : Math.min(idx * 0.012, 0.25) }}
      className={cn(
        'grid grid-cols-[3.25rem_minmax(0,1fr)_6.5rem_8.5rem] items-center gap-2 border-b border-border/60 px-3 py-0.5 text-sm transition-colors last:border-0',
        active ? 'bg-primary/[0.06] ring-1 ring-inset ring-primary/20' : 'hover:bg-muted/40',
        row.duplicate && 'bg-amber-500/[0.07]',
        unmatched && 'bg-rose-500/[0.05]',
      )}
      role="row"
    >
      {/* Roll */}
      <span
        className={cn(
          'font-mono text-[12px] font-semibold tabular-nums',
          unmatched ? 'text-rose-600' : 'text-muted-foreground',
        )}
        title={unmatched ? 'This roll is not in the official roster' : undefined}
      >
        {row.rollNo || '—'}
      </span>

      {/* Name (roster = source of truth) */}
      <div className="min-w-0">
        <p className={cn('truncate font-medium leading-7', unmatched && 'text-rose-600 dark:text-rose-400')}>
          {unmatched ? `${row.name}` : row.name}
        </p>
        {(row.note || row.detectedName || unmatched) && (
          <p className="truncate text-[10.5px] leading-4 text-muted-foreground" title={row.note}>
            {unmatched ? 'Extra row — not in the official roster' : row.note || (row.detectedName ? `Sheet read: ${row.detectedName}` : '')}
          </p>
        )}
      </div>

      {/* Marks — the spreadsheet cell */}
      <div className="flex justify-end">
        <input
          ref={inputRef}
          data-row-idx={idx}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          defaultValue={row.value}
          key={`${row.studentId}-${row.value}`} // re-seed when OCR/undo changes the value externally
          aria-label={`Marks out of ${maxMarks} for ${row.name}`}
          aria-invalid={invalidCell || undefined}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onChange={(e) => {
            // Live-clean: digits + optional AB only (paste-safe).
            const v = e.currentTarget.value.toUpperCase()
            const clean = v === 'A' || v === 'AB' ? v : v.replace(/[^0-9]/g, '').slice(0, 3)
            if (clean !== v) e.currentTarget.value = clean
          }}
          placeholder="—"
          className={cn(
            'h-8 w-[4.5rem] rounded-md border border-transparent bg-transparent px-2 text-right font-mono text-[13px] font-semibold tabular-nums outline-none transition-colors',
            'hover:border-border focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15',
            isReview && !active && 'border-amber-400/70 bg-amber-400/10',
            invalidCell && 'border-rose-400/70 bg-rose-400/10 text-rose-600',
            row.value === 'AB' && 'text-muted-foreground',
          )}
        />
      </div>

      {/* Status chip + per-row confirm */}
      <div className="flex items-center gap-1 pl-1">
        {unmatched ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-rose-400/60 bg-rose-400/10 px-1.5 py-1 text-[10.5px] font-semibold text-rose-600 dark:text-rose-400"
            title="OCR read a roll that is not in the official class roster — clear the value; students are never created from scans"
          >
            <CircleAlert className="h-3 w-3" aria-hidden="true" />
            Not in roster
          </span>
        ) : isReview ? (
          <button
            type="button"
            onClick={() => onConfirm(idx)}
            title={status.title}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-amber-400/60 bg-amber-400/10 px-1.5 py-1 text-[10.5px] font-semibold transition-colors hover:bg-amber-400/20',
              status.cls,
            )}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {row.value === 'AB' ? 'Absent?' : 'Review'}
            <span
              className="ml-0.5 rounded border border-amber-500/30 px-1 text-[9.5px] font-bold"
              title="Confirm this row as read"
            >
              ✓
            </span>
          </button>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-border/70 px-1.5 py-1 text-[10.5px] font-semibold',
              status.cls,
            )}
            title={
              row.status === 'CONFIRMED' && row.confidence != null && row.confidence >= 0
                ? `${status.title} · OCR confidence ${Math.round(row.confidence)}%`
                : status.title
            }
          >
            {row.status === 'CONFIRMED' ? (
              row.value === 'AB' ? (
                <UserX className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Check className="h-3 w-3" aria-hidden="true" />
              )
            ) : row.status === 'INVALID' ? (
              <CircleAlert className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Minus className="h-3 w-3" aria-hidden="true" />
            )}
            {row.status === 'CONFIRMED' && row.value === 'AB' ? 'Absent' : status.label}
          </span>
        )}
        {!unmatched && row.confidence != null && row.confidence >= 0 && row.value !== '' && row.status !== 'UNREAD' && (
          <span
            className={cn(
              'text-[9.5px] font-medium tabular-nums',
              row.confidence >= 72 ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400',
            )}
            title="Real OCR confidence of this reading"
          >
            {Math.round(row.confidence)}%
          </span>
        )}
      </div>
    </motion.div>
  )
}
