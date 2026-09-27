'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { AlertTriangle, Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useSchoolSettingsStore } from '@/lib/store/school-settings-store'
import { useDirtyState } from '@/components/principal/modules/shared/use-settings-dirty'

/**
 * SeatCapacityTab — class capacity ledger (spec §15).
 *
 * Capacity is editable (school policy). ENROLLED is maintained
 * automatically: it increases by one whenever an admission is issued for
 * the class, so the numbers are a real ledger — not a manual fake counter.
 */
export function SeatCapacityTab() {
  const store = useSchoolSettingsStore()
  const seatCapacity = store.admissionSettings.seatCapacity

  // Draft state — capacity edits only (enrolled is auto-maintained).
  const seatCapacityKey = JSON.stringify(seatCapacity)
  const initial = useMemo(
    () => seatCapacity.map((c) => ({ ...c })),
    [seatCapacityKey]
  )
  const [draft, setDraft] = useState(initial)
  useEffect(() => { setDraft(initial) }, [initial])

  const dirty = useMemo(
    () => draft.some((c) => {
      const orig = initial.find((r) => r.className === c.className)
      return orig && orig.capacity !== c.capacity
    }),
    [draft, initial]
  )

  const save = useCallback(async () => {
    draft.forEach((row) => {
      const orig = initial.find((r) => r.className === row.className)
      if (orig && orig.capacity !== row.capacity) {
        store.updateSeatCapacity(row.className, { capacity: row.capacity })
      }
    })
  }, [draft, initial, store])

  const discard = useCallback(() => {
    setDraft(initial)
  }, [initial])

  useDirtyState('admission-seats', dirty, save, discard)

  const handleChange = (className: string, value: number) => {
    setDraft((prev) => prev.map((c) =>
      c.className === className ? { ...c, capacity: Math.max(0, value) } : c
    ))
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-2.5 bg-muted/40 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Class</div>
          <div className="col-span-2 text-center">Capacity</div>
          <div className="col-span-2 text-center">Enrolled</div>
          <div className="col-span-2 text-center">Available</div>
          <div className="col-span-2 text-center">Fill</div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto divide-y divide-border/40">
          {draft.map((c) => {
            const available = Math.max(0, c.capacity - c.enrolled)
            const fillRate = c.capacity > 0 ? (c.enrolled / c.capacity) * 100 : 0
            const tight = fillRate >= (c.waitlistThreshold || 0.9) * 100
            const full = available === 0
            return (
              <div key={c.className} className="grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-2 px-5 py-3 items-center text-xs hover:bg-muted/20">
                <div className="font-medium text-foreground col-span-2 sm:col-span-4 flex items-center justify-between">
                  <span>{c.className}</span>
                  {full && (
                    <span className="sm:hidden text-[10px] font-bold text-rose-600">FULL</span>
                  )}
                </div>
                <div className="flex sm:justify-center items-center col-span-1 sm:col-span-2">
                  <span className="sm:hidden text-[10px] text-muted-foreground mr-2 w-16">Capacity</span>
                  <Input type="number" min={0} value={c.capacity}
                    onChange={(e) => handleChange(c.className, parseInt(e.target.value) || 0)}
                    className="w-16 text-center h-7 text-xs" aria-label={`${c.className} capacity`} />
                </div>
                <div className="flex sm:justify-center items-center col-span-1 sm:col-span-2">
                  <span className="sm:hidden text-[10px] text-muted-foreground mr-2 w-16">Enrolled</span>
                  <span className="font-semibold tabular-nums text-foreground inline-flex items-center gap-1" title="Auto-updated when admissions are issued">
                    {c.enrolled}
                    <Lock className="h-3 w-3 text-muted-foreground/60" />
                  </span>
                </div>
                <div className="flex sm:justify-center items-center col-span-1 sm:col-span-2">
                  <span className="sm:hidden text-[10px] text-muted-foreground mr-2 w-16">Available</span>
                  <span className={cn('font-semibold tabular-nums',
                    full ? 'text-rose-600' : tight ? 'text-amber-600' : 'text-emerald-600')}>
                    {available}
                  </span>
                </div>
                <div className="flex sm:justify-center items-center col-span-1 sm:col-span-2">
                  <div className="inline-flex items-center gap-1.5">
                    <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full transition-all',
                        full ? 'bg-rose-500' : tight ? 'bg-amber-500' : 'bg-emerald-500')}
                        style={{ width: `${Math.min(100, fillRate)}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
                      {Math.round(fillRate)}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-start sm:items-center gap-1.5 px-1">
        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
        Enrolled counts update automatically when admissions are issued. Classes at the waitlist threshold trigger waitlisting during admission.
      </p>
    </div>
  )
}
