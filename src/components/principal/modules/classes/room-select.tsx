'use client'

/**
 * RoomSelect — one registry-backed room picker (§5 · IQ3000 Phase 2).
 *
 * Used wherever a room is assigned to a class/section (Add Class page).
 * Options come from the canonical SERVER registry (GET /api/rooms?active=1
 * — archived rooms are deliberately excluded). When the chosen room is
 * already held by another class, a clear amber warning names the holder —
 * a conflict is surfaced, never silently created.
 */

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useSchoolRooms } from '@/lib/rooms/client'
import { useAcademicConfigStore } from '@/lib/academic-config/client'

const NONE = '__none__'

export function RoomSelect({
  value,
  onChange,
  placeholder = 'No room',
  disabled,
}: {
  value: string
  onChange: (room: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const { rooms, loading, error, refresh } = useSchoolRooms(true)
  const classes = useAcademicConfigStore((s) => s.config?.classes ?? [])
  const fetchAcademic = useAcademicConfigStore((s) => s.fetch)
  useEffect(() => { void fetchAcademic() }, [fetchAcademic])

  // Who currently holds the chosen room? Match the canonical roomId when
  // the value resolves to a registry room; legacy values fall back to the
  // class's room display name.
  const selectedRoom = rooms.find((r) => r.name === value)
  const occupants = value
    ? classes.filter((c) => (selectedRoom ? c.roomId === selectedRoom.id : c.room === value))
    : []
  const conflict = occupants.length > 0

  return (
    <div>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)} disabled={disabled || loading}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={loading ? 'Loading rooms…' : placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={NONE}>No room</SelectItem>
          {rooms.map((r) => (
            <SelectItem key={r.id} value={r.name}>
              {r.name}{r.type !== 'Classroom' ? ` · ${r.type}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Couldn&apos;t load rooms —</span>
          <button type="button" className="underline underline-offset-2" onClick={() => void refresh()}>
            retry
          </button>
        </p>
      ) : conflict ? (
        <p className="mt-1 flex items-start gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Currently used by {occupants.map((o) => o.label).join(' · ')}</span>
        </p>
      ) : null}
    </div>
  )
}
