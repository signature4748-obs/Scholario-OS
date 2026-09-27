'use client'

import { useState } from 'react'
import { History, ChevronRight } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { AdmissionApplication } from '@/lib/store/admission-store'

/**
 * Officer Notes — the ONE overall decision-notes field (spec §18).
 * Section-level remarks were removed; per-section issues are short flags
 * attached from the expanded section rows instead.
 */
export function OfficerNotes({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 sm:px-5 py-4 space-y-2.5">
      <label htmlFor="officer-notes" className="text-sm font-semibold text-foreground">
        Officer Notes
      </label>
      <Textarea
        id="officer-notes"
        placeholder="e.g. TC pending · Parent contact verified · Fee concession approved"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs min-h-[72px] resize-y"
      />
    </div>
  )
}

/**
 * Audit History — collapsed by default so the review screen prioritizes
 * the current verification decision (spec §19). Timestamp + actor per
 * entry, compact rows.
 */
export function AuditHistory({ app }: { app: AdmissionApplication }) {
  const [open, setOpen] = useState(false)
  const entries = app.auditTrail || []

  return (
    <div className="rounded-xl border border-border bg-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left"
          >
            <History className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground flex-1">Audit History</span>
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
            <ChevronRight
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform shrink-0',
                open && 'rotate-90'
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 sm:px-5 pb-4 space-y-1.5 max-h-72 overflow-y-auto">
            {entries.length === 0 && (
              <p className="text-xs text-muted-foreground py-1">No audit entries recorded.</p>
            )}
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-muted/40 px-3 py-2"
              >
                <span className="text-xs font-semibold text-foreground">{entry.action}</span>
                <span className="text-[11px] text-muted-foreground">{entry.timestamp}</span>
                <span className="text-[11px] text-muted-foreground/80 ml-auto">by {entry.actor}</span>
                {entry.notes && (
                  <p className="w-full text-[11px] text-muted-foreground truncate">{entry.notes}</p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
