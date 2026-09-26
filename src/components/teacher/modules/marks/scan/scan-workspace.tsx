'use client'

/**
 * marks/scan/scan-workspace — the dedicated scan/import experience that
 * opens from [Scan Marks Sheet] on the Marks Entry page.
 *
 * Layout: locked context header (exam · class · subject · max marks —
 * the scan can never silently change the selection) → phase body
 * (input / processing / review). Review = summary strip + Excel-like
 * grid beside the sheet preview (split on desktop, [Scan][Data] tabs on
 * mobile) + action bar ([Re-scan] [Import another page] | [Save Draft]
 * [Submit]). Submission runs the pre-submit validation summary and then
 * the SAME canonical marks-entry save + submit services.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  FilePlus2,
  Keyboard,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  ScanLine,
  Send,
  Undo2,
  Redo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { GridSelection, MarksGrid } from '../types'
import { InputStep } from './input-step'
import { ProcessingView } from './processing'
import { ReviewGrid } from './review-grid'
import { ScanPreview } from './scan-preview'
import { useScan } from './use-scan'
import type { ScanRow } from '@/lib/marks-scan/types'

interface ScanWorkspaceProps {
  selection: GridSelection
  grid: MarksGrid
  onSubmitted: () => void
  onEnterManually: () => void
}

export function ScanWorkspace({ selection, grid, onSubmitted, onEnterManually }: ScanWorkspaceProps) {
  const scan = useScan({ selection, grid, onSubmitted })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [validationOpen, setValidationOpen] = useState(false)
  const [pendingRescan, setPendingRescan] = useState<{ dataUrl: string; name: string } | null>(null)
  const [mobileTab, setMobileTab] = useState<'scan' | 'data'>('data')
  const rescanFileRef = useRef<HTMLInputElement>(null)
  const addPageFileRef = useRef<HTMLInputElement>(null)

  // Register inputs for keyboard navigation (rowIdx → element).
  const inputsRef = useRef(new Map<number, HTMLInputElement>())
  const registerInput = useCallback((idx: number, el: HTMLInputElement | null) => {
    if (el) inputsRef.current.set(idx, el)
    else inputsRef.current.delete(idx)
  }, [])

  // A saved draft for exactly this grid is offered for resume (part 16).
  useEffect(() => {
    void scan.loadDraft()
  }, [])

  const activeRow: ScanRow | null =
    scan.activeRow != null ? (scan.rows[scan.activeRow] ?? null) : null

  const summary = useMemo(() => {
    const v = scan.validation
    return v
  }, [scan.validation])

  const startRescan = (dataUrl: string, name: string) => {
    if (scan.hasEdits) {
      setPendingRescan({ dataUrl, name })
      setConfirmOpen(true)
      return
    }
    void scan.rescan(dataUrl, name)
  }

  const statusLine = useMemo(() => {
    const v = scan.validation
    const bits: string[] = []
    bits.push(`✓ ${v.ready + v.absent} ready`)
    if (v.review > 0) bits.push(`⚠ ${v.review} need${v.review > 1 ? '' : 's'} review`)
    if (v.invalid > 0) bits.push(`✕ ${v.invalid} invalid`)
    if (v.unread > 0) bits.push(`— ${v.unread} not detected`)
    return bits.join('   ·   ')
  }, [scan.validation])

  return (
    <div className="space-y-4">
      {/* ── Header: locked context ─────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
              <ScanLine className="h-4 w-4 text-primary" aria-hidden="true" />
              Scan marks sheet
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Upload a completed marks sheet and review the detected marks before submission.
            </p>
          </div>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={onEnterManually}>
            <Keyboard className="h-3.5 w-3.5" aria-hidden="true" /> Enter manually
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 p-2 text-[11px]">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            {grid.label}
          </span>
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          <span className="font-medium">{grid.subjectName}</span>
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          <span className="font-medium">{grid.exam.name}</span>
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          <span className="font-medium">Maximum: {grid.maxMarks}</span>
          <span className="ml-auto text-muted-foreground">Locked for this scan</span>
        </div>
      </div>

      {/* ── Phase body ─────────────────────────────────────────────── */}
      {scan.phase === 'input' && (
        <InputStep
          busy={false}
          error={scan.error}
          savedDraftAt={scan.savedDraft?.savedAt ?? null}
          onUpload={(dataUrl, name) => void scan.runScan(dataUrl, name)}
          onResumeDraft={scan.resumeDraft}
          onDiscardDraft={() => void scan.discardDraft()}
          onEnterManually={onEnterManually}
        />
      )}

      {scan.phase === 'processing' && <ProcessingView stages={scan.stages} />}

      {scan.phase === 'review' && (
        <div className="space-y-3">
          {/* Status strip */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
            <p className="font-mono text-[11.5px] font-semibold tracking-tight text-foreground/85">
              {statusLine}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs text-muted-foreground disabled:opacity-40"
                onClick={scan.undo}
                disabled={scan.historyMeta.undo === 0}
                title="Undo (last cell edit)"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs text-muted-foreground disabled:opacity-40"
                onClick={scan.redo}
                disabled={scan.historyMeta.redo === 0}
                title="Redo"
              >
                <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Mobile tabs: Scan | Data */}
          <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1 lg:hidden" role="tablist">
            {(['data', 'scan'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={mobileTab === t}
                onClick={() => setMobileTab(t)}
                className={cn(
                  'flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors',
                  mobileTab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                {t === 'data' ? 'Marks grid' : 'Sheet preview'}
              </button>
            ))}
          </div>

          {/* Split view: preview (left) + grid (right) */}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className={cn('min-h-[22rem] lg:min-h-0 lg:max-h-[calc(100vh-19rem)]', mobileTab !== 'scan' && 'hidden lg:flex')}>
              <ScanPreview
                pages={scan.pages}
                activePage={scan.activePage}
                onPageChange={scan.setActivePage}
                highlightRow={activeRow}
                className="w-full"
              />
            </div>
            <div
              className={cn(
                'flex min-h-[24rem] flex-col lg:max-h-[calc(100vh-19rem)]',
                mobileTab !== 'data' && 'hidden lg:flex',
              )}
            >
              <ReviewGrid
                rows={scan.rows}
                maxMarks={grid.maxMarks}
                activeRow={scan.activeRow}
                onActiveRow={(idx) => {
                  scan.setActiveRow(idx)
                  const r = idx != null ? scan.rows[idx] : null
                  if (r?.pageId) {
                    const pi = scan.pages.findIndex((p) => p.id === r.pageId)
                    if (pi >= 0) scan.setActivePage(pi)
                  }
                }}
                onCommit={scan.commitEdit}
                onConfirm={scan.confirmRow}
                registerInput={registerInput}
              />
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => rescanFileRef.current?.click()}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Re-scan
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={scan.scanningPage}
                onClick={() => addPageFileRef.current?.click()}
              >
                {scan.scanningPage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Import another page
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden text-[10.5px] text-muted-foreground sm:block">
                {scan.draftDirty ? 'Unsaved changes' : scan.draftSavedAt ? 'Draft saved' : ''}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => void scan.saveDraft()}
                disabled={!scan.draftDirty}
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" /> Save draft
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => setValidationOpen(true)}>
                <Send className="h-3.5 w-3.5" aria-hidden="true" /> Submit
              </Button>
            </div>
          </div>

          {/* hidden file inputs for re-scan / add-page */}
          <input
            ref={rescanFileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const reader = new FileReader()
                reader.onload = () => startRescan(String(reader.result), file.name)
                reader.readAsDataURL(file)
              }
              e.target.value = ''
            }}
          />
          <input
            ref={addPageFileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const reader = new FileReader()
                reader.onload = () => void scan.addPage(String(reader.result), file.name)
                reader.readAsDataURL(file)
              }
              e.target.value = ''
            }}
          />
        </div>
      )}

      {/* ── Re-scan guard ──────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Re-scan will replace manual corrections</DialogTitle>
            <DialogDescription className="text-xs">
              You have manually corrected some values. Re-scanning may replace them with fresh
              OCR readings for every row.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs"
              onClick={() => {
                setConfirmOpen(false)
                if (pendingRescan) void scan.rescan(pendingRescan.dataUrl, pendingRescan.name)
                setPendingRescan(null)
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Re-scan and replace
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Validation summary + submit ────────────────────────────── */}
      <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              Submit marks
            </DialogTitle>
            <DialogDescription className="text-xs">
              {grid.label} · {grid.subjectName} · {grid.exam.name} — via scan review
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <motion.ul
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-1.5 text-[13px]"
            >
              <ValidationLine ok icon={<Check className="h-3.5 w-3.5" />} text={`${summary.ready} marks ready`} />
              {summary.absent > 0 && (
                <ValidationLine ok icon={<Check className="h-3.5 w-3.5" />} text={`${summary.absent} marked absent`} />
              )}
              {summary.edited > 0 && (
                <ValidationLine ok icon={<Check className="h-3.5 w-3.5" />} text={`${summary.edited} manually corrected by you`} />
              )}
              {summary.review > 0 && (
                <ValidationLine warn text={`${summary.review} value${summary.review > 1 ? 's' : ''} still need${summary.review > 1 ? '' : 's'} review`} />
              )}
              {summary.invalid > 0 && <ValidationLine warn text={`${summary.invalid} invalid value${summary.invalid > 1 ? 's' : ''}`} />}
              {summary.duplicates > 0 && <ValidationLine warn text={`${summary.duplicates} duplicate roll row${summary.duplicates > 1 ? 's' : ''}`} />}
              {summary.unmatched > 0 && (
                <ValidationLine warn text={`${summary.unmatched} row${summary.unmatched > 1 ? 's are' : ' is'} not in the official roster`} />
              )}
              {summary.unread > 0 && (
                <ValidationLine ok muted text={`${summary.unread} student${summary.unread > 1 ? 's have' : ' has'} no detected mark — stays blank, exactly like manual entry`} />
              )}
            </motion.ul>
            {summary.blockers.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.07] p-2.5 text-[11.5px] text-amber-700 dark:text-amber-400">
                <p className="mb-1 flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Resolve before submitting
                </p>
                <ul className="list-inside list-disc space-y-0.5">
                  {summary.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[10.5px] text-muted-foreground">
              Submission writes through the same official marks service as manual entry — grades,
              class averages and Student Growth update automatically.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setValidationOpen(false)}>
              Return to review
            </Button>
            <Button
              size="sm"
              className="text-xs"
              disabled={!summary.canSubmit || scan.submitting}
              onClick={() => void scan.submit().then((ok) => ok && setValidationOpen(false))}
            >
              {scan.submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Submit marks
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ValidationLine({
  ok,
  warn,
  muted,
  text,
  icon,
}: {
  ok?: boolean
  warn?: boolean
  muted?: boolean
  text: string
  icon?: React.ReactNode
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-2',
        ok && 'text-emerald-700 dark:text-emerald-400',
        warn && 'font-medium text-amber-700 dark:text-amber-400',
        muted && 'text-muted-foreground',
        !ok && !warn && !muted && 'text-foreground',
      )}
    >
      {icon ?? (warn ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />)}
      {text}
    </li>
  )
}
