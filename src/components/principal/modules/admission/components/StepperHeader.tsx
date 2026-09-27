'use client'

/**
 * Stepper Header — wizard step navigation.
 *
 * Desktop (≥sm): the full horizontal stepper with completed/current/future
 * states, auto-scrolled to keep the current step centered.
 * Mobile (<sm): a compact "Step 3 of 9 · Class" indicator with chevrons
 * (spec §18 — never a cramped horizontal stepper on small screens).
 */
import { RefObject } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import { cn } from '@/lib/utils'

export interface WizardStep {
  id: number
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export function StepperHeader({
  visibleSteps,
  step,
  currentVisibleIndex,
  stepperScrollRef,
  onSelect,
}: {
  visibleSteps: WizardStep[]
  step: number
  currentVisibleIndex: number
  stepperScrollRef: RefObject<HTMLDivElement | null>
  onSelect: (id: number) => void
}) {
  const currentStep = visibleSteps[currentVisibleIndex] ?? visibleSteps[0]
  const goPrev = () => {
    if (currentVisibleIndex > 0) onSelect(visibleSteps[currentVisibleIndex - 1].id)
  }
  const goNext = () => {
    if (currentVisibleIndex < visibleSteps.length - 1) onSelect(visibleSteps[currentVisibleIndex + 1].id)
  }

  return (
    <GlassCard className="overflow-visible shadow-lg border-border/80">
      {/* ── Mobile: compact step indicator (spec §18) ── */}
      <div className="sm:hidden flex items-center justify-between gap-2 p-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentVisibleIndex === 0}
          aria-label="Previous step"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground disabled:opacity-40 hover:bg-muted/50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Step {currentVisibleIndex + 1} of {visibleSteps.length}
          </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={currentStep?.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-semibold text-foreground truncate"
            >
              {currentStep?.label}
            </motion.span>
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={currentVisibleIndex >= visibleSteps.length - 1}
          aria-label="Next step"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground disabled:opacity-40 hover:bg-muted/50 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Desktop: full horizontal stepper ── */}
      <div
        ref={stepperScrollRef}
        className="hidden sm:flex items-center overflow-x-auto pt-5 pb-3 px-6 gap-2 sm:gap-3 no-scrollbar overflow-y-visible scroll-smooth"
      >
        {visibleSteps.map((s, i) => {
          const StepIcon = s.icon
          const isCompleted = currentVisibleIndex > i
          const isCurrent = step === s.id
          const isFuture = currentVisibleIndex < i
          return (
            <div key={s.id} className="flex items-center shrink-0">
              <motion.button
                type="button"
                data-step-idx={i}
                onClick={() => onSelect(s.id)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="relative flex flex-col items-center gap-1.5 px-2 sm:px-3 py-1 cursor-pointer"
              >
                <motion.div
                  animate={isCurrent ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={isCurrent ? { duration: 1.5, repeat: Infinity } : {}}
                  className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border-2 transition-all ${
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/30'
                      : isCurrent
                      ? 'bg-primary/10 border-primary text-primary shadow-md shadow-primary/20'
                      : isFuture
                      ? 'bg-muted/30 border-border text-muted-foreground/60'
                      : 'bg-muted/50 border-border text-muted-foreground'
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {isCompleted ? (
                      <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </motion.div>
                    ) : (
                      <motion.div key="icon" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <StepIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                <span
                  className={cn(
                    'text-[10px] sm:text-xs font-medium whitespace-nowrap transition-colors',
                    isCurrent ? 'text-primary font-bold' : isCompleted ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {s.label}
                </span>
                {isCurrent && (
                  <motion.span
                    layoutId="step-underline"
                    className="absolute -bottom-1 h-1 w-8 rounded-full bg-primary"
                  />
                )}
              </motion.button>
              {i < visibleSteps.length - 1 && (
                <div className={`w-2 sm:w-4 h-px mx-0.5 mb-5 transition-colors ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}
