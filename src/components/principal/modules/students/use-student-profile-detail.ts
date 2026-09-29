'use client'

/**
 * use-student-profile-detail — the principal-side real-data feed for the
 * ONE canonical Student Profile (principal-profile-real).
 *
 * The principal renders the profile from the students store
 * (StudentRecord — DB-hydrated, canonical ids). That record carries inline
 * summaries, but the richer server records — attendance counts + recent
 * days, the latest exam with entered marks, the full fee ledger +
 * canonical payments — come from GET /api/students/[id]
 * (principal-authorized) and are mapped onto the SAME
 * StudentProfileRealData contract the teacher view feeds through
 * profile-adapter's `real` block. The profile tabs then render their
 * real-mode views (attendance / academics / fees / overview / parents).
 *
 * Contract:
 *   · `detail` is undefined while the fetch is in flight → the profile
 *     renders the store record exactly as before (no blocking, no
 *     spinners over the page);
 *   · on success `detail` is set and the real-aware tabs upgrade;
 *   · on failure the fetch is swallowed (console.warn) — the profile
 *     stays on store-mode data;
 *   · a student switch never shows the previous student's detail: state
 *     is keyed by id and guarded at render time.
 */

import { useEffect, useState } from 'react'
import type { AttendanceSummaryDto, StudentFeesDto } from '@/lib/teacher/student-ledger'
import type { RealLatestExam, StudentProfileRealData } from './profile-real-data'

/**
 * GET /api/students/[id] payload — the subset the profile consumes. The
 * full response also carries exam-wise states, growth and behavior
 * records; those are not part of the profile's real-data contract yet
 * (the store record continues to feed those tabs).
 */
interface StudentDetailPayload {
  student: {
    email: string | null
    dob: string | null
    gender: string | null
    bloodGroup: string | null
    address: string | null
    guardianPhone: string | null
  }
  attendance: AttendanceSummaryDto
  academics: { latestExam: RealLatestExam | null }
  fees: StudentFeesDto
}

/**
 * Map the principal payload onto the profile's real-data contract — the
 * same mapping shape as the teacher's profile-adapter: identity fields
 * from `student`, plus the attendance summary, the latest exam with
 * entered marks and the canonical fee ledger, verbatim (the DTOs match
 * RealAttendance / RealLatestExam / RealStudentFees exactly).
 */
export function studentDetailToReal(payload: StudentDetailPayload): StudentProfileRealData {
  return {
    email: payload.student.email,
    dob: payload.student.dob,
    gender: payload.student.gender,
    bloodGroup: payload.student.bloodGroup,
    address: payload.student.address,
    guardianPhone: payload.student.guardianPhone,
    attendance: payload.attendance,
    latestExam: payload.academics.latestExam,
    fees: payload.fees,
  }
}

interface DetailState {
  /** the student the stored detail belongs to (render-time guard key) */
  id: string | null
  detail?: StudentProfileRealData
  /** true once the fetch for `id` settled (success OR silent failure) */
  ready: boolean
}

/**
 * Fetch the principal-authorized real profile data for one student.
 * `studentId` null ⇒ no fetch (no profile open). Re-fetches on every id
 * change, so a re-opened profile shows fresh attendance / fee records.
 */
export function useStudentProfileDetail(studentId: string | null): {
  detail: StudentProfileRealData | undefined
  ready: boolean
} {
  const [state, setState] = useState<DetailState>({ id: null, ready: false })

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    fetch(`/api/students/${encodeURIComponent(studentId)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (res) => {
        let json: unknown = null
        try {
          json = await res.json()
        } catch {
          /* non-JSON error body — handled by the ok check below */
        }
        const envelope = json as { ok?: unknown; data?: StudentDetailPayload } | null
        if (!res.ok || !envelope || envelope.ok !== true || !envelope.data) {
          throw new Error(`HTTP ${res.status}`)
        }
        return envelope.data
      })
      .then((payload) => {
        if (cancelled) return
        setState({ id: studentId, detail: studentDetailToReal(payload), ready: true })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        // Silent failure — the profile keeps rendering store data.
        console.warn('[student-profile] real detail unavailable, staying on store data:', e)
        setState({ id: studentId, ready: true })
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  // Render-time guard: a detail stored for another student id must never
  // leak into the current profile — also covers the paint between an id
  // change and the fetch settling.
  if (state.id !== studentId) return { detail: undefined, ready: false }
  return { detail: state.detail, ready: state.ready }
}
