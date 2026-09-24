'use client'

import { IndianRupee, Clock, Flag, MapPin } from 'lucide-react'
import { KpiCard } from '@/components/shared/kpi-card'
import { formatINR } from '@/lib/format'
import type { MyTransportRoute } from '../shared/canonical'
import { formatServiceTime } from './format'

/**
 * KpiRow — the route's recorded facts only (fare, service window, stop
 * count). The old ETA / live-speed / on-time-rate tiles were simulation
 * artifacts with no GPS feed behind them and are gone.
 */
export function KpiRow({ route }: { route: MyTransportRoute }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      <KpiCard
        label="Route Fare"
        value={route.fare != null ? formatINR(route.fare) : '—'}
        icon={<IndianRupee className="h-5 w-5" />}
        accent="amber"
        trendLabel="set by the school"
        delay={0}
      />
      <KpiCard
        label="Service Starts"
        value={formatServiceTime(route.startTime)}
        icon={<Clock className="h-5 w-5" />}
        accent="emerald"
        trendLabel="scheduled"
        delay={0.05}
      />
      <KpiCard
        label="Service Ends"
        value={formatServiceTime(route.endTime)}
        icon={<Flag className="h-5 w-5" />}
        accent="cyan"
        trendLabel="scheduled"
        delay={0.1}
      />
      <KpiCard
        label="Stops on Route"
        value={route.stops.length}
        icon={<MapPin className="h-5 w-5" />}
        accent="violet"
        trendLabel="in service order"
        delay={0.15}
      />
    </div>
  )
}
