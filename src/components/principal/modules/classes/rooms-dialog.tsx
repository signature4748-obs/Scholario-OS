'use client'

/**
 * RoomsDialog — the centralized room management surface (Students &
 * Classes production pass §5).
 *
 * One registry, surfaced from the Classes tab toolbar. The Principal can:
 *   · create a room        (name / type / building / floor / capacity)
 *   · edit a room          (rename propagates to every assigned section)
 *   · assign / change      (which class · section holds the room)
 *   · mark unavailable     (kept in the registry, excluded from pickers)
 *   · archive              (blocked while a live section still uses it)
 *
 * Occupancy is derived live from the canonical classes — the dialog never
 * keeps its own copy of who-sits-where.
 */

import { useMemo, useState, useEffect } from 'react'
import { DoorOpen, Pencil, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useStudentsStore } from '@/lib/store/students-store'
import {
  useRoomsStore, ROOM_TYPES, buildOccupancyIndex,
  type RoomRecord, type RoomStatus, type RoomType, type RoomInput,
} from '@/lib/store/rooms-store'

const THIN_SCROLLBAR =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent'

const STATUS_BADGE: Record<RoomStatus, string> = {
  Available: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  Unavailable: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  Archived: 'bg-muted text-muted-foreground',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RoomsDialog({ open, onOpenChange }: Props) {
  const rooms = useRoomsStore((s) => s.rooms)
  const ensureSeeded = useRoomsStore((s) => s.ensureSeeded)
  const classes = useStudentsStore((s) => s.classes)
  const [editing, setEditing] = useState<RoomRecord | 'new' | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)

  useEffect(() => { if (open) ensureSeeded() }, [open, ensureSeeded])

  const occupancy = useMemo(
    () => buildOccupancyIndex(classes.filter((c) => c.status === 'Active')),
    [classes],
  )
  const visibleRooms = useMemo(
    () => [...rooms].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [rooms],
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setEditing(null); setAssigning(null) } onOpenChange(o) }}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between gap-2 pr-8">
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                <DoorOpen className="h-4 w-4 text-primary" aria-hidden="true" />
                School Rooms
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                The room registry — assignments follow the class · section that holds each room.
              </DialogDescription>
            </div>
            <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => setEditing('new')}>
              <Plus className="h-3.5 w-3.5" /> Add Room
            </Button>
          </div>
        </DialogHeader>

        <div className={cn('flex-1 overflow-y-auto', THIN_SCROLLBAR)}>
          {editing ? (
            <RoomForm
              room={editing === 'new' ? null : editing}
              onCancel={() => setEditing(null)}
              onSaved={() => setEditing(null)}
            />
          ) : visibleRooms.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No rooms registered yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {visibleRooms.map((room) => {
                const occupants = occupancy.get(room.name.trim().toLowerCase()) ?? []
                const isAssigning = assigning === room.id
                return (
                  <div key={room.id} className="px-5 py-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground font-mono">{room.name}</p>
                          <Badge className={cn('text-[10px] border-0', STATUS_BADGE[room.status])}>{room.status}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {room.type}
                          {room.floor ? ` · Floor ${room.floor}` : ''}
                          {room.building ? ` · ${room.building}` : ''}
                          {room.capacity ? ` · Seats ${room.capacity}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end flex-wrap">
                        <span className={cn('text-[11px]', occupants.length > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                          {occupants.length > 0
                            ? occupants.map((o) => o.label).join(' · ')
                            : room.status === 'Archived' ? '—' : 'Unassigned'}
                        </span>
                        {room.status !== 'Archived' && (
                          <Button
                            variant="outline" size="sm" className="h-7 text-[11px] px-2.5"
                            onClick={() => setAssigning(isAssigning ? null : room.id)}
                          >
                            {occupants.length > 0 ? 'Change' : 'Assign'}
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label={`Edit room ${room.name}`}
                          onClick={() => setEditing(room)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* — inline assignment panel (§5 Assign / Change) — */}
                    {isAssigning && (
                      <AssignPanel
                        room={room}
                        occupants={occupants}
                        onClose={() => setAssigning(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add / Edit room form ─────────────────────────────────────────────────

function RoomForm({ room, onCancel, onSaved }: { room: RoomRecord | null; onCancel: () => void; onSaved: () => void }) {
  const addRoom = useRoomsStore((s) => s.addRoom)
  const updateRoom = useRoomsStore((s) => s.updateRoom)
  const [form, setForm] = useState<RoomInput>({
    name: room?.name ?? '',
    type: room?.type ?? 'Classroom',
    building: room?.building ?? '',
    floor: room?.floor ?? '',
    capacity: room?.capacity,
    status: room?.status ?? 'Available',
  })

  const submit = () => {
    const result = room
      ? updateRoom(room.id, form)
      : addRoom(form)
    if (result.ok) {
      toast.success(room ? 'Room updated' : 'Room added', { description: form.name.trim() })
      onSaved()
    } else {
      toast.error('Could not save room', { description: result.error })
    }
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-foreground">
        {room ? 'Edit Room' : 'New Room'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Room name / number</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. F2-09"
            className="h-9 text-sm mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Room type</Label>
          <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as RoomType }))}>
            <SelectTrigger className="w-full h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROOM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Floor <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            value={form.floor ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, floor: e.target.value }))}
            placeholder="e.g. 2"
            className="h-9 text-sm mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Building / block <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            value={form.building ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, building: e.target.value }))}
            placeholder="e.g. Main"
            className="h-9 text-sm mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Capacity <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            type="number" min={1}
            value={form.capacity ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value ? Number(e.target.value) : undefined }))}
            placeholder="e.g. 40"
            className="h-9 text-sm mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as RoomStatus }))}>
            <SelectTrigger className="w-full h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Available">Available</SelectItem>
              <SelectItem value="Unavailable">Unavailable</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Renaming a room updates every class and section currently assigned to it.
      </p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!form.name.trim()} onClick={submit}>
          {room ? 'Save Changes' : 'Add Room'}
        </Button>
      </div>
    </div>
  )
}

// ─── Assignment panel (§5 Assign / Change + conflict warning) ─────────────

const ASSIGN_NONE = '__none__'

function AssignPanel({
  room, occupants, onClose,
}: {
  room: RoomRecord
  occupants: { classId: string; className: string; sectionId: string; sectionName: string; label: string }[]
  onClose: () => void
}) {
  const classes = useStudentsStore((s) => s.classes)
  const updateSectionRoom = useStudentsStore((s) => s.updateSectionRoom)
  const activeClasses = useMemo(() => classes.filter((c) => c.status === 'Active'), [classes])
  const [target, setTarget] = useState<string>(
    occupants.length > 0 ? `${occupants[0].classId}:${occupants[0].sectionId}` : ASSIGN_NONE,
  )
  const [confirmed, setConfirmed] = useState(false)

  // Which sections currently hold THIS room (other than the chosen target)?
  const conflicting = occupants.filter((o) => `${o.classId}:${o.sectionId}` !== target)
  const warn = conflicting.length > 0 && !confirmed

  const assign = () => {
    if (!target) {
      // Clear the assignment from every current occupant.
      occupants.forEach((o) => updateSectionRoom(o.classId, o.sectionId, null))
      toast.success('Room unassigned', { description: `${room.name} is no longer held by a section.` })
      onClose()
      return
    }
    const [classId, sectionId] = target.split(':')
    // Move the room: clear it from any other occupant first (one room = one
    // homeroom section), then hand it to the chosen section.
    occupants.forEach((o) => {
      if (`${o.classId}:${o.sectionId}` !== target) updateSectionRoom(o.classId, o.sectionId, null)
    })
    updateSectionRoom(classId, sectionId, room.name)
    const cls = activeClasses.find((c) => c.id === classId)
    const sec = cls?.sections.find((s) => s.id === sectionId)
    toast.success('Room assigned', { description: `${room.name} → ${cls?.name ?? ''} · ${sec?.name ?? ''}` })
    onClose()
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">Assign to class · section</Label>
          <Select value={target} onValueChange={(v) => { setTarget(v); setConfirmed(false) }}>
            <SelectTrigger className="w-full h-9 text-sm mt-1"><SelectValue placeholder="Choose a section…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ASSIGN_NONE}>Unassigned</SelectItem>
              {activeClasses.map((c) => (
                c.sections.map((s) => (
                  <SelectItem key={s.id} value={`${c.id}:${s.id}`}>
                    {c.name} · {s.name}
                  </SelectItem>
                ))
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9" onClick={onClose} aria-label="Cancel assignment">
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" className="h-9" onClick={assign}>
            {target ? 'Assign' : 'Clear'}
          </Button>
        </div>
      </div>
      {warn && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[11px] font-medium text-amber-800 dark:text-amber-300">
          <span aria-hidden="true">⚠</span>
          <span>
            {conflicting.map((o) => o.label).join(' · ')} {conflicting.length === 1 ? 'is' : 'are'} currently assigned to
            {' '}{room.name}. Saving moves the room — the old section keeps operating without a room until reassigned.
          </span>
        </p>
      )}
      {warn && (
        <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setConfirmed(true)}>
          Assign anyway
        </Button>
      )}
    </div>
  )
}
