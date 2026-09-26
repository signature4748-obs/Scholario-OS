'use client'

/**
 * marks/scan/processing — the compact, professional processing state.
 * Stages tick as the pipeline GENUINELY advances; the active stage shows
 * an indeterminate shimmer (no fake percentages).
 */

import { motion, useReducedMotion } from 'framer-motion'
import { Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScanStageState } from '@/lib/marks-scan/types'
import { STAGE_LABELS } from './use-scan'

export function ProcessingView({ stages }: { stages: ScanStageState[] }) {
  const reduceMotion = useReducedMotion()
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">Reading sheet…</p>
      </div>
      <ol className="space-y-2.5" aria-busy="true">
        {stages.map((s) => (
          <li key={s.stage} className="flex items-center gap-2.5 text-[13px]">
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                s.state === 'done' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                s.state === 'active' && 'border-primary/40 bg-primary/10 text-primary',
                s.state === 'error' && 'border-rose-500/40 bg-rose-500/10 text-rose-600',
                !s.state && 'border-border text-muted-foreground/50',
              )}
              aria-hidden="true"
            >
              {s.state === 'done' ? (
                <Check className="h-3 w-3" />
              ) : s.state === 'active' ? (
                reduceMotion ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
              ) : s.state === 'error' ? (
                <X className="h-3 w-3" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-border" />
              )}
            </span>
            <span
              className={cn(
                'font-medium',
                s.state === 'active' ? 'text-foreground' : s.state === 'done' ? 'text-foreground/80' : 'text-muted-foreground/60',
              )}
            >
              {STAGE_LABELS[s.stage]}
            </span>
            {s.detail && (
              <motion.span
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ml-auto text-[11px] tabular-nums text-muted-foreground"
              >
                {s.detail}
              </motion.span>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-border pt-3 text-center text-[10.5px] text-muted-foreground">
        The sheet never leaves this device — recognition runs in your browser.
      </p>
    </div>
  )
}
