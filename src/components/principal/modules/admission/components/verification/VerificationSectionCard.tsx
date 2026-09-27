'use client'

import React, { useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, Flag, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { AdmissionApplication, SectionKey } from '@/lib/store/admission-store'
import type { AdmissionDocumentPolicy } from '@/lib/store/school-settings-store'
import { SectionDataContent } from './SectionDataContent'
import { getSectionSummary, resolveSectionStatus } from './section-status'

interface VerificationSectionCardProps {
  app: AdmissionApplication
  sectionKey: SectionKey
  title: string
  icon: React.ElementType
  documentPolicy?: AdmissionDocumentPolicy
  onFlag: (key: SectionKey, status: 'Needs Review' | 'Incomplete', issue: string) => void
  onClearFlag: (key: SectionKey) => void
}

function StatusPill({ status }: { status: 'Verified' | 'Needs Review' | 'Incomplete' }) {
  if (status === 'Verified') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
        <CheckCircle2 className="h-4 w-4" /> Verified
      </span>
    )
  }
  if (status === 'Needs Review') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
        <AlertTriangle className="h-4 w-4" /> Needs Review
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 shrink-0">
      <XCircle className="h-4 w-4" /> Incomplete
    </span>
  )
}

/**
 * Compact verification row (spec §14–§17): ONE status per section, a real
 * one-line data summary, and a View toggle. Full details + the flag-issue
 * control only appear when the officer expands the section.
 */
export function VerificationSectionCard({
  app,
  sectionKey,
  title,
  icon: Icon,
  documentPolicy,
  onFlag,
  onClearFlag,
}: VerificationSectionCardProps) {
  const [open, setOpen] = useState(false)
  const [issueDraft, setIssueDraft] = useState('')

  const status = resolveSectionStatus(sectionKey, app, documentPolicy)
  const summary = getSectionSummary(sectionKey, app, documentPolicy)

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-colors',
        status.status === 'Incomplete'
          ? 'border-rose-500/30'
          : status.status === 'Needs Review'
            ? 'border-amber-500/40'
            : 'border-border'
      )}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground min-w-0">{title}</span>
          <span className="text-xs text-muted-foreground flex-1 min-w-[10rem] truncate hidden md:block">
            {summary}
          </span>
          <StatusPill status={status.status} />
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground shrink-0"
            >
              {open ? 'Hide' : 'View'}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* Concrete issue line — only when the section is not verified */}
        {status.status !== 'Verified' && status.issue && (
          <p
            className={cn(
              'px-4 pb-3 pt-0 pl-11 text-xs font-medium',
              status.status === 'Incomplete'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-amber-600 dark:text-amber-400'
            )}
          >
            {status.issue}
          </p>
        )}

        {/* Mobile summary (hidden on md+) */}
        <p className="px-4 pb-3 md:hidden text-xs text-muted-foreground">{summary}</p>

        <CollapsibleContent>
          <div className="border-t border-border/60 px-4 py-3.5 bg-muted/15 space-y-3">
            <SectionDataContent sectionKey={sectionKey} app={app} documentPolicy={documentPolicy} />

            {/* Officer flag control — only inside the expanded view */}
            <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center gap-2">
              {status.flaggedByOfficer ? (
                <>
                  <span className="text-[11px] text-muted-foreground flex-1">
                    Flagged by you{status.issue ? `: ${status.issue}` : ''}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onClearFlag(sectionKey)}
                    className="h-7 text-[11px] gap-1.5"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Clear flag
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    value={issueDraft}
                    onChange={(e) => setIssueDraft(e.target.value)}
                    placeholder="Issue note (optional) — e.g. TC copy is unreadable"
                    className="h-8 text-xs flex-1 bg-card"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onFlag(sectionKey, 'Needs Review', issueDraft)
                        setIssueDraft('')
                      }}
                      className="h-7 text-[11px] gap-1.5 border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-50"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      Flag for correction
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
