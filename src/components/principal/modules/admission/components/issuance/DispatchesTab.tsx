'use client'

import { Mail, PhoneCall, MessageSquare } from 'lucide-react'
import { GlassCard } from '@/components/shared/ui'
import type { AdmissionApplication } from '@/lib/store/admission-store'

interface DispatchesTabProps {
  app: AdmissionApplication
}

/**
 * COMMUNICATION — the parent's on-file contact channels for admission
 * notifications. Honest by design: channels are listed with their
 * recipients; nothing claims a message was dispatched from here. Sending
 * happens through Communication → Messaging.
 */
export function DispatchesTab({ app }: DispatchesTabProps) {
  const formData = app.formData

  const channels = [
    { icon: Mail, label: 'Email', value: formData.fatherEmail },
    { icon: PhoneCall, label: 'SMS', value: formData.fatherPhone },
    { icon: MessageSquare, label: 'WhatsApp', value: formData.fatherPhone },
  ]

  return (
    <GlassCard className="p-6 max-w-lg mx-auto space-y-4 border">
      <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-emerald-600" />
        Notification Channels
      </h3>

      <div className="space-y-3 text-xs">
        {channels.map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-3 rounded-lg border flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold block">{label}</span>
                <span className="text-[10px] text-muted-foreground truncate block">{value || '—'}</span>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground border border-border rounded-full px-2 py-0.5 shrink-0">
              On file
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Send messages from <span className="font-medium text-foreground">Communication → Messaging</span>.
      </p>
    </GlassCard>
  )
}
