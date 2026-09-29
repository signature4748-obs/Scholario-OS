'use client'

// Facilities tab — the school's room registry (server-backed). Renders the
// SAME RoomsManager the Classes module's "Rooms" dialog uses, inline (no
// dialog): create / edit / archive rooms and assign them to classes. All
// data comes from /api/rooms + /api/principal/academic (see rooms-manager).

import { GlassCard } from '@/components/shared/ui'
import { RoomsManager } from '../classes/rooms-manager'

export function FacilitiesTab() {
  return (
    <GlassCard className="overflow-hidden" hover={false}>
      <RoomsManager
        descriptionNode={
          <p className="text-xs mt-0.5 text-muted-foreground">
            Create, edit and archive the school&apos;s rooms — assignments follow the class that holds each room.
          </p>
        }
      />
    </GlassCard>
  )
}
