'use client'

/**
 * RoomsManager — the shared, SERVER-BACKED room management surface
 * (IQ3000 Phase 2).
 *
 * ONE component, TWO surfaces: the Classes module's "Rooms" dialog and
 * School Settings → Facilities both render this exact manager (the dialog
 * passes its DialogTitle/DialogDescription nodes; the settings tab renders
 * it inline inside a GlassCard).
 *
 * Data layer — the server is the single source of truth:
 *   · rooms        GET /api/rooms            (@/lib/rooms/client — the
 *                 list refreshes after every mutation)
 *   · occupancy    the academic configuration (GET /api/principal/academic
 *                 classes carry the canonical roomId per class)
 *   · assignment   POST /api/principal/academic { action: 'room.assign' }
 *                 through the academic-config store — which refetches the
 *                 server state after every act
 *   · create/edit  POST /api/rooms · PATCH /api/rooms/[id] — renames
 *                 propagate to every assigned class SERVER-side; archiving
 *                 a held room is blocked server-side with a clear error
 *
 * The legacy localStorage rooms-store is no longer read or written. The
 * students-store is touched ONLY as an optimistic display cache after a
 * successful server write (the roster re-sync stays authoritative).
 *
 * The Principal can: create a room (name / type / building / floor /
 * capacity) · edit a room (rename propagates to every assigned class) ·
 * assign / change / clear which class holds the room (with a conflict
 * warning when the room moves from its current holder) · archive
 * (blocked while a class still holds the room) · reactivate.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { CloudOff, DoorOpen, Loader2, Pencil, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useStudentsStore } from '@/lib/store/students-store'
import { useAcademicConfigStore, type DbClassInfo } from '@/lib/academic-config/client'
import {
  useSchoolRooms, createRoom, updateRoom, ROOM_TYPE_OPTIONS, normalizeRoomType,
  type RoomDto,
} from '@/lib/rooms/client'

const THIN_SCROLLBAR =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar-track]:bg-transparent'

/** Server `active` → the badge vocabulary (Available | Archived). */
type RoomStatusView = 'Available' | 'Archived'

const STATUS_BADGE: Record<RoomStatusView, string> = {
  Available: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  Archived: 'bg-muted text-muted-foreground',
}

/**
 * Optimistically mirror a server room.assign into the local students-store
 * cache. Post roster-sync the store's ClassRecords are grade-groups whose
 * SECTIONS carry the canonical DB class ids — this keeps the class cards /
 * details live until the next roster re-sync (the source of truth).
 */
function mirrorRoomInStore(dbClassId: string, roomName: string | null) {
  const state = useStudentsStore.getState()
  const group = state.classes.find((c) => c.sections.some((s) => s.id === dbClassId))
  if (!group) return
  useStudentsStore.setState({
    classes: state.classes.map((c) =>
      c.id !== group.id
        ? c
        : {
            ...c,
            sections: c.sections.map((s) => (s.id === dbClassId ? { ...s, room: roomName ?? '' } : s)),
            // The grade-group's display room follows its first section.
            room: c.sections[0]?.id === dbClassId ? (roomName ?? '') : c.room,
          },
    ),
  })
}

interface RoomsManagerProps {
  /** Header title node — the dialog passes its DialogTitle (a11y). */
  titleNode?: ReactNode
  /** Header description node — the dialog passes its DialogDescription. */
  descriptionNode?: ReactNode
}

export function RoomsManager({ titleNode, descriptionNode }: RoomsManagerProps) {
  const { rooms, loading, error, refresh } = useSchoolRooms()
  const config = useAcademicConfigStore((s) => s.config)
  const fetchAcademic = useAcademicConfigStore((s) => s.fetch)
  const [editing, setEditing] = useState<RoomDto | 'new' | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)

  useEffect(() => { void fetchAcademic() }, [fetchAcademic])

  // Occupancy is derived live from the canonical classes — the manager
  // never keeps its own copy of who-sits-where.
  const classes = config?.classes ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 text-center sm:text-left px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between gap-2 pr-8">
          <div className="min-w-0">
            {titleNode ?? (
              <p className="text-sm font-semibold leading-none flex items-center gap-2">
                <DoorOpen className="h-4 w-4 text-primary" aria-hidden="true" />
                School Rooms
              </p>
            )}
            {descriptionNode ?? (
              <p className="text-xs mt-0.5 text-muted-foreground">
                The room registry — assignments follow the class that holds each room.
              </p>
            )}
          </div>
          <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => setEditing('new')}>
            <Plus className="h-3.5 w-3.5" /> Add Room
          </Button>
        </div>
      </div>

      <div className={cn('flex-1 min-h-0 overflow-y-auto', THIN_SCROLLBAR)}>
        {editing ? (
          <RoomForm
            room={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => setEditing(null)}
            refresh={refresh}
            fetchAcademic={fetchAcademic}
          />
        ) : error && rooms.length === 0 ? (
          <div className="p-5">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-6 text-center">
              <CloudOff className="h-6 w-6 text-rose-500/60 mx-auto mb-2" />
              <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
                Couldn&apos;t load the school rooms
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">{error}</p>
              <Button size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={() => void refresh()}>
                <Loader2 className="h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          </div>
        ) : loading && rooms.length === 0 ? (
          <div className="px-5 py-3 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-72" />
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No rooms registered yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {rooms.map((room) => {
              const occupants = classes.filter((c) => c.roomId === room.id)
              const status: RoomStatusView = room.active ? 'Available' : 'Archived'
              const isAssigning = assigning === room.id
              return (
                <div key={room.id} className="px-5 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground font-mono">{room.name}</p>
                        <Badge className={cn('text-[10px] border-0', STATUS_BADGE[status])}>{status}</Badge>
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
                          : status === 'Archived' ? '—' : 'Unassigned'}
                      </span>
                      {status !== 'Archived' && (
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

                  {/* — inline assignment panel (Assign / Change) — */}
                  {isAssigning && (
                    <AssignPanel
                      room={room}
                      occupants={occupants}
                      onClose={() => setAssigning(null)}
                      onChanged={refresh}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Add / Edit room form ─────────────────────────────────────────────────

interface RoomFormState {
  name: string
  type: string
  building: string
  floor: string
  capacity?: number
  status: RoomStatusView
}

function RoomForm({
  room, onCancel, onSaved, refresh, fetchAcademic,
}: {
  room: RoomDto | null
  onCancel: () => void
  onSaved: () => void
  refresh: () => Promise<void>
  fetchAcademic: (force?: boolean) => Promise<void>
}) {
  const [form, setForm] = useState<RoomFormState>({
    name: room?.name ?? '',
    type: room ? normalizeRoomType(room.type) : 'Classroom',
    building: room?.building ?? '',
    floor: room?.floor ?? '',
    capacity: room?.capacity ?? undefined,
    status: room ? (room.active ? 'Available' : 'Archived') : 'Available',
  })
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (room) {
        // Edit — the server propagates the rename to every assigned class
        // and enforces the archive guard (clear errors surface verbatim).
        const res = await updateRoom(room.id, {
          name: form.name.trim(),
          building: form.building.trim(),
          floor: form.floor.trim(),
          capacity: form.capacity,
          type: form.type,
          active: form.status === 'Available',
        })
        if (!res.ok) {
          toast.error('Could not save room', { description: res.error })
          return
        }
        const newName = form.name.trim()
        if (newName !== room.name) {
          // The server already re-projected Class.room for every holder —
          // mirror the rename into the local caches (store + config view).
          useStudentsStore.getState().renameRoomEverywhere(room.name, newName)
          await fetchAcademic(true)
        }
        toast.success('Room updated', { description: newName })
        await refresh()
        onSaved()
      } else {
        const res = await createRoom({
          name: form.name.trim(),
          type: form.type,
          building: form.building.trim(),
          floor: form.floor.trim(),
          capacity: form.capacity,
        })
        if (!res.ok) {
          toast.error('Could not save room', { description: res.error })
          return
        }
        toast.success('Room added', { description: form.name.trim() })
        await refresh()
        onSaved()
      }
    } finally {
      setBusy(false)
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
          <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
            <SelectTrigger className="w-full h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROOM_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Floor <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            value={form.floor}
            onChange={(e) => setForm((p) => ({ ...p, floor: e.target.value }))}
            placeholder="e.g. 2"
            className="h-9 text-sm mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Building / block <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            value={form.building}
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
        {/* Status only applies to an existing room — a new room always
            starts Available (the server creates it active). */}
        {room && (
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as RoomStatusView }))}>
              <SelectTrigger className="w-full h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Renaming a room updates every class and section currently assigned to it.
      </p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button size="sm" disabled={!form.name.trim() || busy} onClick={submit}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {room ? 'Save Changes' : 'Add Room'}
        </Button>
      </div>
    </div>
  )
}

// ─── Assignment panel (Assign / Change / Clear + conflict warning) ────────

const ASSIGN_NONE = '__none__'

/** room.assign error codes → honest, human messages. */
const ASSIGN_ERRORS: Record<string, string> = {
  CLASS_NOT_FOUND: 'That class no longer exists on the server.',
  ROOM_NOT_FOUND: 'This room no longer exists on the server.',
  ROOM_ARCHIVED: 'Archived rooms cannot be assigned — reactivate the room first.',
  MISSING_FIELDS: 'Missing assignment details.',
  FORBIDDEN: 'Only the Principal can change room assignments.',
}

function assignErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : ''
  const code = raw.split('—')[0].trim()
  return ASSIGN_ERRORS[code] ?? (raw || 'Could not update the room assignment.')
}

function AssignPanel({
  room, occupants, onClose, onChanged,
}: {
  room: RoomDto
  occupants: DbClassInfo[]
  onClose: () => void
  onChanged: () => Promise<void> | void
}) {
  const classes = useAcademicConfigStore((s) => s.config?.classes ?? [])
  const act = useAcademicConfigStore((s) => s.act)
  const [target, setTarget] = useState<string>(occupants[0]?.id ?? ASSIGN_NONE)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)

  const isClearing = target === ASSIGN_NONE
  // Which classes currently hold THIS room (other than the chosen target)?
  const conflicting = occupants.filter((o) => o.id !== target)
  const warn = conflicting.length > 0 && !confirmed

  const run = async () => {
    if (busy) return
    setBusy(true)
    try {
      // One room = one homeroom: release every other holder first — the
      // server allows shared rooms, the registry keeps them unambiguous.
      for (const other of conflicting) {
        await act({ action: 'room.assign', classId: other.id, roomId: null })
        mirrorRoomInStore(other.id, null)
      }
      if (isClearing) {
        toast.success('Room unassigned', { description: `${room.name} is no longer held by a class.` })
      } else {
        const label = classes.find((c) => c.id === target)?.label ?? ''
        await act({ action: 'room.assign', classId: target, roomId: room.id })
        mirrorRoomInStore(target, room.name)
        toast.success('Room assigned', { description: `${room.name} → ${label}` })
      }
      await onChanged()
      onClose()
    } catch (e) {
      toast.error(assignErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">Assign to class</Label>
          <Select value={target} onValueChange={(v) => { setTarget(v); setConfirmed(false) }}>
            <SelectTrigger className="w-full h-9 text-sm mt-1"><SelectValue placeholder="Choose a class…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ASSIGN_NONE}>Unassigned</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9" onClick={onClose} aria-label="Cancel assignment" disabled={busy}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" className="h-9" onClick={run} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isClearing ? 'Clear' : 'Assign'}
          </Button>
        </div>
      </div>
      {warn && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[11px] font-medium text-amber-800 dark:text-amber-300">
          <span aria-hidden="true">⚠</span>
          <span>
            {conflicting.map((o) => o.label).join(' · ')}{' '}
            {conflicting.length === 1
              ? isClearing ? 'currently holds' : 'is currently assigned to'
              : isClearing ? 'currently hold' : 'are currently assigned to'}
            {' '}{room.name}.{' '}
            {isClearing
              ? 'Clearing leaves the class without a room until reassigned.'
              : 'Saving moves the room — the previous class keeps operating without a room until reassigned.'}
          </span>
        </p>
      )}
      {warn && (
        <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setConfirmed(true)} disabled={busy}>
          {isClearing ? 'Clear anyway' : 'Assign anyway'}
        </Button>
      )}
    </div>
  )
}
