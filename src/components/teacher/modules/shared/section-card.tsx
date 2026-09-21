'use client'

/**
 * SectionCard — the Teacher Portal's ONE section anatomy, extracted
 * verbatim from "My Timetable" (the documented design benchmark):
 *
 *   root    overflow-hidden rounded-xl border border-border bg-card
 *   header  border-b border-border bg-muted/20 px-4 py-3 — icon +
 *           `text-sm font-semibold` title (+ optional quiet subtitle)
 *           left, controls or uppercase meta right
 *   content the module's own information architecture
 *
 * Rules inherited from the benchmark:
 *   · no shadows, no gradients, no glassmorphism
 *   · rows inside are hairlines (`divide-y`), never boxed cards
 *   · no hardcoded light surfaces — theme tokens only
 */

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  /** small emerald icon left of the title */
  icon?: LucideIcon
  /** section title — `text-sm font-semibold` */
  title: React.ReactNode
  /** quiet supporting line under the title */
  subtitle?: React.ReactNode
  /** quiet uppercase right meta (ignored when `actions` is present) */
  meta?: React.ReactNode
  /** controls in the header's right slot (search, tabs, buttons…) */
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  'aria-label'?: string
}

export function SectionCard({
  icon: Icon,
  title,
  subtitle,
  meta,
  actions,
  children,
  className,
  headerClassName,
  contentClassName,
  'aria-label': ariaLabel,
}: SectionCardProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}
    >
      <header
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 border-b border-border bg-muted/20 px-4 py-3',
          headerClassName,
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          {Icon && (
            <Icon
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {actions != null ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : meta != null ? (
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {meta}
          </p>
        ) : null}
      </header>
      <div className={contentClassName}>{children}</div>
    </section>
  )
}
