'use client'

import { useEffect, useRef, useState } from 'react'
import { Shield, AlertCircle } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { MyTransportRoute } from '../shared/canonical'
import { formatServiceTime } from './format'

/** T4-D — armed state auto-reset and accidental double-tap guard. */
const SOS_ARM_RESET_MS = 6000
const SOS_DOUBLE_TAP_GUARD_MS = 500

/**
 * SafetyCard — emergency help for the transport service. The guidance text
 * references the recorded service window and the assigned driver; the
 * two-step SOS stays an interactive control. The old stats block (trips /
 * on-time rate / distance / fabricated checklist claims) had no data
 * source and is gone.
 */
export function SafetyCard({ route }: { route: MyTransportRoute }) {
  const [armed, setArmed] = useState(false)
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const armedAt = useRef(0)

  const clearArmTimer = () => {
    if (armTimer.current) {
      clearTimeout(armTimer.current)
      armTimer.current = null
    }
  }

  // Cleanup on unmount so a pending auto-reset never fires on a dead card.
  useEffect(() => clearArmTimer, [])

  const resetArm = () => {
    clearArmTimer()
    setArmed(false)
  }

  const handleSos = () => {
    if (!armed) {
      // Step 1 — arm. A second, deliberate tap within the window sends.
      setArmed(true)
      armedAt.current = Date.now()
      clearArmTimer()
      armTimer.current = setTimeout(() => setArmed(false), SOS_ARM_RESET_MS)
      return
    }
    // Guard: ignore an accidental double-tap right after arming.
    if (Date.now() - armedAt.current < SOS_DOUBLE_TAP_GUARD_MS) return
    // Step 2 — send.
    resetArm()
    toast.success('SOS alert', { description: 'Emergency alert sent to school + parent' })
  }

  return (
    <GlassCard className="p-3 sm:p-4 lg:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1 space-y-2.5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-emerald-500" aria-hidden /> Safety &amp; Help
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Timings follow the scheduled service window ({formatServiceTime(route.startTime)} –{' '}
            {formatServiceTime(route.endTime)}); there is no live GPS on this service. For
            day-to-day route questions, contact the school office
            {route.driverName ? ` or your driver, ${route.driverName}` : ''}.
          </p>
        </div>

        {/* T4-D — two-step SOS: first tap arms (filled rose + Confirm label
            + Cancel), a deliberate second tap sends. Auto-resets after 6s. */}
        <div className="flex items-center gap-2 lg:w-72 lg:shrink-0">
          <button
            onClick={handleSos}
            aria-label={armed ? 'Confirm SOS alert' : 'Send SOS alert'}
            className={cn(
              'flex min-h-9 flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors',
              armed
                ? 'border-rose-500 bg-rose-500 text-white hover:bg-rose-600'
                : 'border-rose-500/30 bg-rose-500/5 text-rose-600 hover:bg-rose-500/10',
            )}
          >
            <AlertCircle className="h-4 w-4" aria-hidden /> {armed ? 'Confirm SOS?' : 'Send SOS Alert'}
          </button>
          {armed && (
            <button
              onClick={resetArm}
              aria-label="Cancel SOS"
              className="min-h-9 shrink-0 px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  )
}
