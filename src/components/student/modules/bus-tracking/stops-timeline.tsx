'use client'

import { motion } from 'framer-motion'
import { Navigation, Flag } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { cn } from '@/lib/utils'

/**
 * StopsTimeline — the route's stops exactly as recorded (Route.stops), in
 * service order. There is no per-student stop in the school's records and
 * no live bus position, so this is the SCHEDULED sequence: the first stop
 * is the route start and the final stop is the destination end (school
 * side). No fabricated "Your Stop" highlight, no fake per-stop times or
 * onboard counts.
 */
export function StopsTimeline({ stops }: { stops: string[] }) {
  return (
    <GlassCard className="p-3 sm:p-4 lg:p-5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Navigation className="h-4 w-4 text-primary" aria-hidden /> Stops Timeline
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        {stops.length > 0
          ? `${stops.length} stops · scheduled route`
          : 'Scheduled route'}
      </p>

      {stops.length === 0 ? (
        <p className="text-xs text-muted-foreground">No stops recorded for this route.</p>
      ) : (
        <div className="relative space-y-3">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" />

          {stops.map((name, i) => {
            const isFirst = i === 0
            const isLast = i === stops.length - 1
            return (
              <motion.div
                key={`${i}-${name}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className={cn(
                  'relative flex items-start gap-3',
                  isLast && '-mx-2 rounded-lg bg-emerald-500/5 px-2 py-1.5',
                )}
              >
                <div
                  className={cn(
                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-4 ring-card',
                    isLast
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {isLast ? <Flag className="h-4 w-4" aria-hidden /> : i + 1}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        isLast && 'font-semibold text-emerald-700 dark:text-emerald-400',
                      )}
                    >
                      {name}
                    </p>
                    {isFirst && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                        Route start
                      </span>
                    )}
                    {isLast && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                        School · route end
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </GlassCard>
  )
}
