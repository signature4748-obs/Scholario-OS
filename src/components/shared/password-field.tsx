'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Shared password input for account-security surfaces (all three role
 * Settings → Login & Security sections).
 *
 * Details: show/hide eye toggle (aria-labelled, keyboard accessible),
 * live character-count hint on new-password fields ("n/6+ chars"),
 * autocomplete hints so password managers behave, unified focus ring.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  /** New-password fields show the live character count + minimum hint. */
  hint = false,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  hint?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
        {hint && (
          <span className="text-[10px] text-muted-foreground" aria-hidden>
            {value.length}/6+ chars
          </span>
        )}
      </div>
      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 transition-colors"
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}
