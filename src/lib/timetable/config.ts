/**
 * timetable/config — THE canonical school timetable structure.
 *
 * Single source of truth for the master timetable's STRUCTURE, shared by
 * EVERY role (Principal edits it; Teacher + Student read it):
 *
 *   - TimetableSlot type
 *   - DAYS / PERIODS (day + period structure incl. breaks & lunch)
 *
 * SLOTS ARE NEVER SEEDED HERE (spec §C/§D — REAL RECORDS ONLY): every slot
 * the Principal edits, and every slot Teachers/Students see, is a server
 * Timetable row hydrated at module mount. A school with no rows yet sees an
 * honest empty state — never a demo schedule. (The legacy INITIAL_SLOTS /
 * CLASSES / ROOMS mock universe was removed with the server-rows work.)
 *
 * Moved here from `components/principal/modules/timetable/data.tsx` (which
 * now re-exports this module) so the Student/Teacher roles consume the SAME
 * configuration without importing Principal UI code (live-sync requirement:
 * Principal publishes → every role reflects the change; never a second
 * timetable dataset).
 *
 * Pure constants + types — deliberately NO 'use client' directive so BOTH
 * client components and server route handlers (the publish sync) import
 * the one ladder/period model. Client components import shared modules
 * fine; this keeps the ladder canonical across the wire boundary.
 */

export interface TimetableSlot {
  id: string
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'
  period: number // 1 to 9 (see PERIODS)
  time: string
  className: string
  subject: string
  teacherId: string
  teacherName: string
  room: string
  type: 'Lecture' | 'Lab' | 'Break' | 'Assembly' | 'Sports'
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export type DayType = (typeof DAYS)[number]

/** Canonical period structure (breaks carry a typed breakType). */
export interface PeriodDef {
  number: number
  name: string
  time: string
  isBreak?: boolean
  breakType?: 'short' | 'lunch'
  durationMin: number
}

export const PERIODS: PeriodDef[] = [
  { number: 1, name: 'Period 1', time: '08:30 AM - 09:15 AM', durationMin: 45 },
  { number: 2, name: 'Period 2', time: '09:15 AM - 10:00 AM', durationMin: 45 },
  { number: 3, name: 'Period 3', time: '10:00 AM - 10:45 AM', durationMin: 45 },
  { number: 4, name: 'Short Break', time: '10:45 AM - 11:00 AM', isBreak: true, breakType: 'short', durationMin: 15 },
  { number: 5, name: 'Period 4', time: '11:00 AM - 11:45 AM', durationMin: 45 },
  { number: 6, name: 'Period 5', time: '11:45 AM - 12:30 PM', durationMin: 45 },
  { number: 7, name: 'Lunch Break', time: '12:30 PM - 01:15 PM', isBreak: true, breakType: 'lunch', durationMin: 45 },
  { number: 8, name: 'Period 6', time: '01:15 PM - 02:00 PM', durationMin: 45 },
  { number: 9, name: 'Period 7', time: '02:00 PM - 02:45 PM', durationMin: 45 },
]

/** Structural row for grid/list rendering (periods + breaks in order). */
export interface TimetableRow {
  number: number
  name: string
  time: string
  isBreak: boolean
  breakType: 'short' | 'lunch' | undefined
  durationMin: number
}

/** Build initial TimetableRow[] from PERIODS — used everywhere draftRows is initialized. */
export function buildInitialRows() {
  return PERIODS.map((p) => ({
    number: p.number,
    name: p.name,
    time: p.time,
    isBreak: p.isBreak || false,
    breakType: p.breakType,
    durationMin: p.durationMin,
  }))
}

/** Form state shape for the Add/Edit slot modal. */
export interface TimetableFormState {
  day: DayType
  period: number
  className: string
  subject: string
  teacherId: string
  room: string
  type: 'Lecture' | 'Lab' | 'Sports'
}

/** Result of the teacher/room/class conflict check performed while editing the form. */
export interface TimetableConflictInfo {
  teacherConflict: TimetableSlot | undefined
  roomConflict: TimetableSlot | undefined
  classConflict: TimetableSlot | undefined
  hasConflict: boolean
}
