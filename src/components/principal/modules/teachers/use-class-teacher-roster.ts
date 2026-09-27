'use client'

/**
 * useClassTeacherRoster — the server truth for Class Teacher appointments.
 *
 * GET /api/classes/class-teachers returns every real class of the school
 * with its appointed class teacher (the same data that gates the teacher
 * portal's Class Teacher Hub). The Teacher profile derives its
 * Class Teacher assignment from HERE — not from the teacher's
 * designation, and not from duplicated local state — so appointing or
 * releasing a class teacher anywhere in the ERP (Classes module)
 * immediately reflects on the profile (Wave 2.3 §3/§13).
 */

import { useEffect, useState } from 'react'

export interface RosterClassTeacher {
  userId: string
  name: string
  email: string
  department: string | null
  employeeId: string | null
}

export interface RosterClass {
  id: string
  label: string
  room: string | null
  studentCount: number
  classTeacher: RosterClassTeacher | null
}

export interface ClassTeacherRoster {
  classes: RosterClass[]
  teachers: RosterClassTeacher[]
}

export type RosterState =
  | { status: 'loading' }
  | { status: 'ready'; roster: ClassTeacherRoster }
  | { status: 'error'; error: string }

export function useClassTeacherRoster(): RosterState {
  const [state, setState] = useState<RosterState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/classes/class-teachers')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        const json = await res.json()
        if (cancelled) return
        // Standard API envelope: { ok, data: { classes, teachers } }
        const roster = json?.data ?? json
        if (!roster || !Array.isArray(roster.classes)) {
          throw new Error('Unexpected roster payload')
        }
        setState({ status: 'ready', roster: roster as ClassTeacherRoster })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to load class-teacher roster',
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

/** Classes where the given email is the appointed class teacher. */
export function classesOfTeacher(
  roster: ClassTeacherRoster | null,
  email: string | null | undefined
): RosterClass[] {
  if (!roster || !email) return []
  const target = email.toLowerCase().trim()
  return roster.classes.filter(
    (c) => c.classTeacher && c.classTeacher.email.toLowerCase().trim() === target
  )
}
