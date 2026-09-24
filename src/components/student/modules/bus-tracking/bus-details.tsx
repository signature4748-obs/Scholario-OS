'use client'

import { Route as RouteIcon, PhoneCall } from 'lucide-react'
import { StatusBadge, GradientAvatar } from '@/components/shared/ui'
import { toast } from 'sonner'
import type { MyTransportRoute } from '../shared/canonical'
import { formatServiceTime } from './format'

/**
 * BusDetails — the route, vehicle and driver exactly as the school
 * recorded them (/api/student/transport). The old onboard-count /
 * distance / fuel / cabin-temperature metrics and the attendant card were
 * fabricated with no data source and are gone.
 */
export function BusDetails({ route }: { route: MyTransportRoute }) {
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <RouteIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{route.name}</span>
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Vehicle {route.vehicleNo ?? '—'} · {formatServiceTime(route.startTime)} –{' '}
            {formatServiceTime(route.endTime)}
          </p>
        </div>
        <StatusBadge status="Scheduled" variant="neutral" />
      </div>

      {/* Driver — the school's assigned driver for this route */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3">
        <GradientAvatar name={route.driverName ?? 'Not assigned'} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Driver</p>
          <p className="truncate text-sm font-semibold">
            {route.driverName ?? 'Not assigned'}
          </p>
          {route.driverPhone && (
            <p className="text-[11px] text-muted-foreground">{route.driverPhone}</p>
          )}
        </div>
        {route.driverPhone && (
          <button
            onClick={() => toast.info('Calling driver')}
            aria-label="Call driver"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20"
          >
            <PhoneCall className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}
