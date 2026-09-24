'use client'

/**
 * BusTrackingModule — the student's Transport module (stabilization §8/§10).
 *
 * ONE data source: /api/student/transport via useMyServerTransport() —
 * the SAME Route + Vehicle rows the school office configures. The legacy
 * client demo universe (STU-58 · "Route 4 · Sohna Road" · simulated live
 * GPS with ETA/speed/motion) is RETIRED: this module now presents the
 * SCHEDULED service exactly as recorded — route, stops, vehicle, driver,
 * fare and the service window. No fabricated per-stop times, no fake
 * "Your Stop" marker, no live-motion simulation.
 *
 * Honest states: skeleton while the assignment resolves, an error card on
 * failure, and a "No transport assignment" empty state with the
 * school-office hint.
 */
import { Bus, AlertTriangle, Clock } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { useMyServerTransport, type MyTransportRoute } from '../shared/canonical'
import { formatServiceTime } from './format'
import { KpiRow } from './kpi-row'
import { RouteMap } from './route-map'
import { BusDetails } from './bus-details'
import { StopsTimeline } from './stops-timeline'
import { SafetyCard } from './safety-card'

export function BusTrackingModule() {
  const { assigned, route, loading, error } = useMyServerTransport()

  // Resolving — skeleton in the shape the module will render into.
  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading transport assignment">
        <div className="h-5 w-64 animate-pulse rounded-md bg-muted/60" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="h-96 animate-pulse rounded-xl bg-muted/60 lg:col-span-2" />
          <div className="h-96 animate-pulse rounded-xl bg-muted/60" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <GlassCard className="p-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-sm font-semibold">Transport details unavailable</p>
        <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {error} Please try again in a moment.
        </p>
      </GlassCard>
    )
  }

  // Not on a school bus route — the honest empty state (no demo universe).
  if (!assigned || !route) {
    return (
      <GlassCard className="px-6 py-14 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Bus className="h-6 w-6" aria-hidden />
        </div>
        <p className="text-sm font-semibold">No transport assignment</p>
        <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
          You are not on a school bus route. Contact the school office to request
          transport or update your assignment.
        </p>
      </GlassCard>
    )
  }

  return <TransportOverview route={route} />
}

function TransportOverview({ route }: { route: MyTransportRoute }) {
  return (
    <div className="space-y-5">
      {/* Scheduled service window — the honest header. There is no live GPS
          feed, so this module presents the route as the school recorded
          it (compact context line, no giant module title — LR-1). */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {route.name} · Scheduled service {formatServiceTime(route.startTime)} –{' '}
          {formatServiceTime(route.endTime)}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden /> Scheduled · no live GPS
        </span>
      </div>

      <KpiRow route={route} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Route map + vehicle/driver details */}
        <GlassCard className="p-0 overflow-hidden lg:col-span-2">
          <RouteMap route={route} />
          <BusDetails route={route} />
        </GlassCard>

        <StopsTimeline stops={route.stops} />
      </div>

      <SafetyCard route={route} />
    </div>
  )
}
