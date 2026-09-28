'use client'

/**
 * useTeacherExamDuties — the canonical server truth for ONE teacher's
 * examination duties (invigilation assignments).
 *
 * GET /api/exams/duties returns the school's full duty roster — the same
 * data that powers the Examinations module's Invigilation tab, where
 * duties are assigned (Examinations → exam → Duties/Invigilation →
 * Assign Teacher). This hook filters that canonical roster to the
 * profiled teacher (matched on the assigned invigilator name, the same
 * matching the Invigilation tab itself uses).
 *
 * The Teacher Profile displays the result READ-ONLY — examination
 * duties are never edited from the Teachers module, and they are never
 * mixed into generic Responsibilities (they are specific event
 * assignments, not ongoing roles).
 */

import { useEffect, useState } from 'react'

export interface TeacherExamDuty {
  id: string
  examId: string
  examName: string
  /** Pretty exam status ('Draft' | 'Scheduled' | 'Ongoing' | 'Completed' | 'Cancelled'). */
  examStatus: string
  subjectName: string
  className: string
  /** UTC day key — yyyy-mm-dd. */
  date: string
  startTime: string
  endTime: string
  room: string | null
}

export type TeacherExamDutyStatus = 'Upcoming' | 'In Progress' | 'Completed' | 'Cancelled'

export type TeacherExamDutiesState =
  | { status: 'loading' }
  | { status: 'ready'; duties: TeacherExamDuty[] }
  | { status: 'error'; error: string }

interface DutyPaperDTO {
  id: string
  examId: string
  date: string
  startTime: string
  endTime: string
  room: string | null
  className: string
  subjectName: string
  invigilatorId: string | null
  invigilatorName: string | null
}

interface DutyExamDTO {
  id: string
  name: string
  status: string
  papers: DutyPaperDTO[]
}

interface DutyRosterDTO {
  todayKey: string
  exams: DutyExamDTO[]
}

/**
 * Derive a duty's status with the same rule the Teacher Proctoring
 * module uses (lib/exam-duty.ts): cancelled exam → Cancelled; past
 * paper → Completed; future paper → Upcoming; same-day → In Progress.
 */
export function examDutyStatus(
  duty: { date: string; startTime: string; examStatus: string },
  now: Date,
): TeacherExamDutyStatus {
  if (/^cancel/i.test(duty.examStatus)) return 'Cancelled'
  const todayKey = now.toISOString().slice(0, 10)
  if (duty.date < todayKey) return 'Completed'
  if (duty.date > todayKey) return 'Upcoming'
  const [h, m] = duty.startTime.split(':').map((x) => Number.parseInt(x, 10))
  const startMinutes = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  return nowMinutes < startMinutes ? 'Upcoming' : 'In Progress'
}

/** Display order: live/next duties first, then history (newest first). */
const STATUS_RANK: Record<TeacherExamDutyStatus, number> = {
  'In Progress': 0,
  'Upcoming': 1,
  'Completed': 2,
  'Cancelled': 3,
}

export function useTeacherExamDuties(teacherName: string | null | undefined): TeacherExamDutiesState {
  const [state, setState] = useState<TeacherExamDutiesState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/exams/duties')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        const json = await res.json()
        if (cancelled) return
        const roster = json?.data ?? json
        if (!roster || !Array.isArray(roster.exams)) {
          throw new Error('Unexpected duty-roster payload')
        }
        const target = (teacherName ?? '').trim().toLowerCase()
        const duties: TeacherExamDuty[] = target
          ? (roster as DutyRosterDTO).exams.flatMap((exam) =>
              exam.papers
                .filter(
                  (p) =>
                    p.invigilatorName != null &&
                    p.invigilatorName.trim().toLowerCase() === target,
                )
                .map((p) => ({
                  id: p.id,
                  examId: exam.id,
                  examName: exam.name,
                  examStatus: exam.status,
                  subjectName: p.subjectName,
                  className: p.className,
                  date: p.date,
                  startTime: p.startTime,
                  endTime: p.endTime,
                  room: p.room,
                })),
            )
          : []
        setState({ status: 'ready', duties })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to load examination duties',
        })
      })
    return () => {
      cancelled = true
    }
  }, [teacherName])

  return state
}

/** Duties sorted for the profile summary: live first, upcoming next, history last. */
export function sortExamDutiesForDisplay(
  duties: TeacherExamDuty[],
  now: Date,
): Array<TeacherExamDuty & { status: TeacherExamDutyStatus }> {
  return duties
    .map((d) => ({ ...d, status: examDutyStatus(d, now) }))
    .sort((a, b) => {
      const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status]
      if (rank !== 0) return rank
      // Live/upcoming: soonest first. History: newest first.
      const dir = a.status === 'Completed' || a.status === 'Cancelled' ? -1 : 1
      return a.date === b.date ? a.startTime.localeCompare(b.startTime) * dir : a.date.localeCompare(b.date) * dir
    })
}
