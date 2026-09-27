'use client'

import { Bus, MapPin, Flag, Clock } from 'lucide-react'
import type { MyTransportRoute } from '../shared/canonical'
import { formatServiceTime } from './format'

/**
 * RouteMap — the stylised route visual for the SCHEDULED service. This is
 * a decorative placeholder (no map tiles, no GPS feed): the vehicle marker
 * is a STATIC illustration on the drawn road, the markers name the
 * route's first and last recorded stops, and the badge states the service
 * window. Nothing animates to imply live tracking.
 */
export function RouteMap({ route }: { route: MyTransportRoute }) {
  const firstStop = route.stops[0] ?? null
  const lastStop = route.stops.length > 0 ? route.stops[route.stops.length - 1] : null

  return (
    <div className="relative h-72 sm:h-80 bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 dark:from-slate-800 dark:via-slate-900 dark:to-emerald-950 overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-grid opacity-40" />

      {/* Decorative roads */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <path d="M 0 180 Q 200 120 400 160 T 800 140" stroke="oklch(0.8 0.01 160)" strokeWidth="14" fill="none" strokeLinecap="round" opacity="0.5" />
        <path d="M 0 180 Q 200 120 400 160 T 800 140" stroke="oklch(0.9 0.01 160)" strokeWidth="2" strokeDasharray="8 8" fill="none" strokeLinecap="round" />
        <path d="M 100 0 Q 120 150 200 300" stroke="oklch(0.8 0.01 160)" strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.4" />
        <path d="M 600 0 L 580 300" stroke="oklch(0.8 0.01 160)" strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.4" />
      </svg>

      {/* Route start marker — the first recorded stop */}
      <div className="absolute top-4 left-4 flex flex-col items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg ring-2 ring-white">
          <MapPin className="h-5 w-5" />
        </div>
        <span className="mt-1 max-w-[14ch] truncate rounded-md bg-white/90 dark:bg-slate-800/90 px-1.5 py-0.5 text-[9px] font-semibold shadow-sm">
          {firstStop ?? 'Route start'}
        </span>
      </div>

      {/* Route end marker — the final recorded stop (school side) */}
      <div className="absolute bottom-8 right-12 flex flex-col items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-lg ring-2 ring-white">
          <Flag className="h-5 w-5" />
        </div>
        <span className="mt-1 max-w-[16ch] truncate rounded-md bg-violet-600 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">
          {lastStop ? `${lastStop} · Route end` : 'Route end'}
        </span>
      </div>

      {/* Vehicle marker — STATIC illustration on the scheduled route (no
          live GPS, so no motion/pulse animation pretending to be real) */}
      <div className="absolute" style={{ left: '46%', top: '44%' }}>
        <div className="flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg ring-2 ring-white">
          <Bus className="h-6 w-6" />
        </div>
      </div>

      {/* Honesty badge — the scheduled window, not a "LIVE" claim */}
      <div className="absolute top-4 right-4 flex max-w-[70%] items-center gap-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur px-3 py-1.5 shadow-md">
        <Clock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-[10px] font-bold text-muted-foreground">SCHEDULED</span>
        <span className="truncate text-[10px] text-muted-foreground">
          · {formatServiceTime(route.startTime)} – {formatServiceTime(route.endTime)}
        </span>
      </div>
    </div>
  )
}
