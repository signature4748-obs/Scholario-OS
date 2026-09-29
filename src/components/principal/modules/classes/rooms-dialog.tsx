'use client'

/**
 * RoomsDialog — the Classes module's "Rooms" surface.
 *
 * A thin shell: ALL room management lives in the shared, server-backed
 * RoomsManager (also rendered inline by School Settings → Facilities).
 * Radix unmounts dialog content on close, so the manager's edit /
 * assignment state — and its data — reset on every open (fresh server
 * truth each time).
 *
 * Data layer (IQ3000 Phase 2): rooms come from GET /api/rooms, class
 * assignment goes through POST /api/principal/academic (action
 * 'room.assign') — see rooms-manager.tsx for the full contract.
 */

import { DoorOpen } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from '@/components/ui/dialog'
import { RoomsManager } from './rooms-manager'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RoomsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        <RoomsManager
          titleNode={
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-primary" aria-hidden="true" />
              School Rooms
            </DialogTitle>
          }
          descriptionNode={
            <DialogDescription className="text-xs mt-0.5">
              The room registry — assignments follow the class that holds each room.
            </DialogDescription>
          }
        />
      </DialogContent>
    </Dialog>
  )
}
