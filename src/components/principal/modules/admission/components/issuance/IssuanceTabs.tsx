'use client'

import { FileText, Wallet, KeyRound, Sparkles, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

export type IssuanceTabKey = 'letter' | 'receipt' | 'credentials' | 'welcome' | 'dispatches'

interface IssuanceTabsProps {
  activeTab: IssuanceTabKey
  onTabChange: (tab: IssuanceTabKey) => void
}

/**
 * Issuance artifact tabs, grouped by workflow so the official admission
 * document is never conflated with financial records, account
 * onboarding, or communication:
 *
 *   OFFICIAL DOCUMENT  → Admission Letter
 *   FINANCIAL RECORD   → Fee Receipt
 *   ACCOUNT / ONBOARD  → Student Portal
 *   COMMUNICATION      → Welcome Letter · Notifications
 */
const TAB_GROUPS: {
  group: string
  tabs: { key: IssuanceTabKey; label: string; icon: React.ElementType }[]
}[] = [
  {
    group: 'Official Document',
    tabs: [{ key: 'letter', label: 'Admission Letter', icon: FileText }],
  },
  {
    group: 'Financial Record',
    tabs: [{ key: 'receipt', label: 'Fee Receipt', icon: Wallet }],
  },
  {
    group: 'Account',
    tabs: [{ key: 'credentials', label: 'Student Portal', icon: KeyRound }],
  },
  {
    group: 'Communication',
    tabs: [
      { key: 'welcome', label: 'Welcome Letter', icon: Sparkles },
      { key: 'dispatches', label: 'Notifications', icon: MessageSquare },
    ],
  },
]

export function IssuanceTabs({ activeTab, onTabChange }: IssuanceTabsProps) {
  return (
    <div className="flex flex-wrap items-end gap-x-1 gap-y-2 border-b pb-2 overflow-x-auto">
      {TAB_GROUPS.map(({ group, tabs }, gi) => (
        <div key={group} className="flex items-end gap-1">
          {gi > 0 && <div className="mx-1.5 mb-1 h-6 w-px bg-border shrink-0" aria-hidden />}
          {tabs.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTabChange(key)}
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-lg px-3 py-1.5 text-left transition-colors',
                  active ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <span className={cn(
                  'text-[8.5px] font-bold uppercase tracking-[0.08em] leading-none',
                  active ? 'text-emerald-100' : 'text-muted-foreground/70'
                )}>
                  {group}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold leading-tight">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
