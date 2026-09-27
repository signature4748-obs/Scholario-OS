'use client'

import { FileText, Wallet, KeyRound, Sparkles, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

export type IssuanceTabKey = 'letter' | 'receipt' | 'credentials' | 'welcome' | 'dispatches'

interface IssuanceTabsProps {
  activeTab: IssuanceTabKey
  onTabChange: (tab: IssuanceTabKey) => void
}

/** Compact labels — full labels live in the header Documents menu. */
const TABS: { key: IssuanceTabKey; label: string; icon: React.ElementType }[] = [
  { key: 'letter', label: 'Letter', icon: FileText },
  { key: 'receipt', label: 'Receipt', icon: Wallet },
  { key: 'credentials', label: 'Credentials', icon: KeyRound },
  { key: 'welcome', label: 'Welcome', icon: Sparkles },
  { key: 'dispatches', label: 'Dispatches', icon: MessageSquare },
]

export function IssuanceTabs({ activeTab, onTabChange }: IssuanceTabsProps) {
  return (
    <div className="flex items-center gap-1.5 border-b pb-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="Issuance documents">
      {TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={activeTab === key}
          onClick={() => onTabChange(key)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0',
            activeTab === key
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}
