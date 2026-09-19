'use client'

/**
 * Student Timetable — server-row mapping shim.
 *
 * The canonical DB ⇄ TimetableSlot mapping now lives in
 * `@/lib/timetable/server-mapping` (shared with the Principal publish
 * sync so both directions use ONE algorithm). This shim keeps the
 * student module's import surface stable and re-exports the types the
 * module's API payload contract uses.
 */

export { serverRowsToSlots, type ServerSlot } from '@/lib/timetable/server-mapping'
