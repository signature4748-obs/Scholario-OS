'use client'

/**
 * RoomSelect — one registry-backed room picker (§5).
 *
 * Used wherever a room is assigned to a class/section (Add Class page, and
 * any future section editor). Only AVAILABLE registry rooms are offered
 * (Unavailable/Archived are deliberately excluded). When the chosen room is
 * already held by another live section, a clear amber warning names the
 * occupant — a conflict is surfaced, never silently created.
 */

import { useEffect, useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useStudentsStore } from '@/lib/store/students-store'
import { useRoomsStore, buildOccupancyIndex } from '@/lib/store/rooms-store'

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
  const rooms = useRoomsStore((s) => s.rooms)
  const ensureSeeded = useRoomsStore((s) => s.ensureSeeded)
  const classes = useStudentsStore((s) => s.classes)

  useEffect(() => { ensureSeeded() }, [ensureSeeded])

  const available = useMemo(
    () => rooms.filter((r) => r.status === 'Available').sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [rooms],
  )
  const occupancy = useMemo(
    () => buildOccupancyIndex(classes.filter((c) => c.status === 'Active')),
    [classes],
  )
  const occupant = value ? (occupancy.get(value.trim().toLowerCase()) ?? []) : []
  const conflict = occupant.length > 0

  return (
    <div>
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)} disabled={disabled}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={NONE}>No room</SelectItem>
          {available.map((r) => (
            <SelectItem key={r.id} value={r.name}>
              {r.name}{r.type !== 'Classroom' ? ` · ${r.type}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {conflict && (
        <p className="mt-1 flex items-start gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Currently used by {occupant.map((o) => o.label).join(' · ')}</span>
        </p>
      )}
    </div>
  )
}
