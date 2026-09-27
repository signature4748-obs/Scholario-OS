'use client'

/**
 * Admission Module — Shared presentational primitives used across wizard steps.
 *
 * Extracted from the original admission.tsx monolith (Task ID: 21).
 * Behaviour preserved byte-for-byte.
 */
import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

/** Standard step header — icon + title (+ optional useful meta) with a bottom divider. */
export function StepHeader({
  title, subtitle, icon, right,
}: {
  title: string
  /** Optional. Only for genuinely useful actionable info (e.g. the active
   *  academic session) — NEVER a description of what the step means. */
  subtitle?: string
  icon: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 mb-5 pb-3 border-b border-border">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-display text-base font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

/** Standard labelled field wrapper. */
export function Field({ label, children, full, hint }: { label: string; children: ReactNode; full?: boolean; hint?: string }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <Label className="text-xs font-semibold text-foreground mb-1.5 block">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}
