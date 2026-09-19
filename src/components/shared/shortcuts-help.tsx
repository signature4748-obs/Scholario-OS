'use client'

/**
 * KB-1 — Keyboard shortcuts help overlay.
 *
 * Discoverability surface for the app's keyboard affordances. Opens with
 * "?" (Shift+/) from anywhere outside a text field; closes with Esc.
 * Every entry documents behaviour that genuinely exists — no aspirational
 * rows. The overlay is purely presentational (no data fetching).
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Command, Search, Moon, X, Keyboard, ArrowUp, ArrowDown, CornerDownLeft, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDismissOnEscape } from '@/hooks/use-dismiss-on-escape'

/** One shortcut row: key combo + what it does. */
function ShortcutRow({ keys, label, hint }: { keys: React.ReactNode[]; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground/80 mt-0.5 leading-snug">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-[10px] text-muted-foreground/60 font-semibold">then</span>}
            {k}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Physical keycap chip. */
function Kbd({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-border bg-muted/60 px-1.5',
        'font-mono text-[11px] font-semibold text-foreground/90 shadow-[inset_0_-1.5px_0_0_rgba(0,0,0,0.08)]',
        'dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[inset_0_-1.5px_0_0_rgba(0,0,0,0.45)]',
        wide ? 'w-auto' : 'w-7 px-0'
      )}
    >
      {children}
    </kbd>
  )
}

const SECTION_CLASS = 'text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 px-1 pt-1'

export function ShortcutsHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  useDismissOnEscape(() => onOpenChange(false), open)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="relative shrink-0 overflow-hidden border-b border-border bg-gradient-to-br from-primary/[0.08] via-transparent to-transparent px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Keyboard className="h-4.5 w-4.5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base font-bold tracking-tight text-foreground">Keyboard shortcuts</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Work faster — hands stay on the keyboard.</p>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  aria-label="Close shortcuts"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 divide-y divide-border/60 overflow-y-auto px-5 py-3 custom-scrollbar">
              <section aria-label="Global shortcuts">
                <p className={SECTION_CLASS}>Anywhere</p>
                <ShortcutRow
                  label="Command palette"
                  hint="Jump to any module, student, notice or setting"
                  keys={[<Kbd key="c">⌘</Kbd>, <Kbd key="k">K</Kbd>]}
                />
                <ShortcutRow
                  label="Toggle dark / light mode"
                  keys={[<Kbd key="t" wide>Shift</Kbd>, <Kbd key="t2">T</Kbd>]}
                />
                <ShortcutRow
                  label="This shortcuts panel"
                  keys={[<Kbd key="q" wide>Shift</Kbd>, <Kbd key="q2">?</Kbd>]}
                />
              </section>

              <section aria-label="Palette shortcuts" className="pt-1">
                <p className={SECTION_CLASS}>Inside the command palette</p>
                <ShortcutRow
                  label="Move through results"
                  keys={[
                    <span key="arrows" className="flex items-center gap-1">
                      <Kbd><ArrowUp className="h-3 w-3" aria-hidden /></Kbd>
                      <Kbd><ArrowDown className="h-3 w-3" aria-hidden /></Kbd>
                    </span>,
                  ]}
                />
                <ShortcutRow
                  label="Open the highlighted result"
                  keys={[<Kbd key="enter"><CornerDownLeft className="h-3 w-3" aria-hidden /></Kbd>]}
                />
              </section>

              <section aria-label="Dialogs" className="pt-1">
                <p className={SECTION_CLASS}>Dialogs &amp; panels</p>
                <ShortcutRow
                  label="Close any dialog or panel"
                  keys={[<Kbd key="esc" wide>Esc</Kbd>]}
                />
              </section>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-border bg-muted/30 px-5 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Info className="h-3 w-3 shrink-0 text-primary/70" aria-hidden />
                Shortcuts pause automatically while you are typing in a field.
                <span className="ml-auto hidden items-center gap-1 sm:flex">
                  <Search className="h-3 w-3" aria-hidden />
                  <Command className="h-3 w-3" aria-hidden />
                  <Moon className="h-3 w-3" aria-hidden />
                </span>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
