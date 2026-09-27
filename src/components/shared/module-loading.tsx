'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'

/**
 * Shared loading fallback for lazily-loaded role modules.
 * Keeps navigation feeling instant while a module chunk compiles/loads
 * (and massively reduces dev-server memory pressure by splitting each
 * module into its own chunk instead of one giant per-role bundle).
 *
 * When `label` is provided (lazyModule passes the module's friendly name),
 * a quiet "Loading <module>…" caption tells the user WHAT is compiling —
 * first-visit lazy compiles can take a few seconds on a busy dev box and a
 * nameless skeleton reads as "broken" to users who click twice and give up.
 */
export function ModuleLoading({ label }: { label?: string }) {
  return (
    <div className="space-y-5 p-1" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72 max-w-full" />
        {label && (
          <p className="flex items-center gap-1.5 pt-0.5 text-[11px] font-medium text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Loading {label}…
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  )
}

/** 'StudentsClassesModule' → 'Students Classes' (for the loading caption). */
export function prettifyModuleKey(pick: string): string {
  return pick
    .replace(/Module$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bAnd\b/g, '&')
}
