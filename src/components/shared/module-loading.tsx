'use client'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shared loading fallback for lazily-loaded role modules.
 * Keeps navigation feeling instant while a module chunk compiles/loads
 * (and massively reduces dev-server memory pressure by splitting each
 * module into its own chunk instead of one giant per-role bundle).
 */
export function ModuleLoading() {
  return (
    <div className="space-y-5 p-1" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-72 max-w-full" />
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
