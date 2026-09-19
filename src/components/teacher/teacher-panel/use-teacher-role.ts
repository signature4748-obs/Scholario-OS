'use client'

/**
 * useTeacherRole — the panel-level hook for the signed-in teacher's REAL
 * appointment context (GET /api/teacher/role).
 *
 * The server alone decides whether this teacher is a class teacher
 * (Class.classTeacherId = User.id). Until the fetch resolves the answer is
 * "no" — the Class Teacher Hub group stays hidden; it appears the moment
 * the appointment is confirmed. A teacher who is not appointed simply
 * never sees the group (or any of its modules).
 */

import { useEffect, useState } from 'react'
import { signOut } from '@/lib/signout'

export interface TeacherRoleClass {
  id: string
  label: string
  room: string | null
  studentCount: number
}

export interface TeacherRole {
  teacher: { name: string; employeeId: string | null }
  isClassTeacher: boolean
  classTeacherOf: TeacherRoleClass[]
}

let sessionExpiredInFlight = false

export function useTeacherRole() {
  const [role, setRole] = useState<TeacherRole | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/teacher/role', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (res) => {
        if (res.status === 401) {
          if (!sessionExpiredInFlight) {
            sessionExpiredInFlight = true
            void signOut().finally(() => {
              window.setTimeout(() => {
                sessionExpiredInFlight = false
              }, 2000)
            })
          }
          return
        }
        const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: TeacherRole } | null
        if (!cancelled && json && json.ok === true && json.data) setRole(json.data)
      })
      .catch(() => {
        // A failed role fetch keeps the hub hidden — every hub module
        // re-checks its own authorization server-side anyway.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return role
}
