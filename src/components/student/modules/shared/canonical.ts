'use client'

/**
 * CANONICAL STUDENT IDENTITY + SERVER-DATA HOOKS (stabilization §8/§10)
 *
 * The authenticated student's identity comes from ONE place: the server
 * session (/api/auth/me → me.student, resolved from the DB Student row).
 * The legacy client-side demo roster (STU-58 · Class 2-A · DSO2024058)
 * is RETIRED as an identity source — surfaces render '—'/skeleton while
 * the session resolves and NEVER fall back to fabricated values.
 */

import { useCallback, useEffect, useState } from 'react'
import { useCurrentUser } from '@/lib/store/current-user-store'

/** The canonical identity every student surface must display. */
export interface CanonicalStudent {
  studentId: string
  classId: string | null
  className: string | null
  section: string | null
  classLabel: string | null
  rollNo: string | null
  admissionNo: string | null
  dob: string | null
  gender: string | null
  bloodGroup: string | null
  guardianName: string | null
  guardianPhone: string | null
  address: string | null
}

/**
 * useCanonicalStudent — server session truth for WHO the student is.
 * `resolving` is true until /api/auth/me answers; a student-role account
 * with no linked Student record resolves to null (surfaces show their
 * honest unavailable state).
 */
export function useCanonicalStudent(): { student: CanonicalStudent | null; resolving: boolean } {
  const me = useCurrentUser((s) => s.me)
  const loading = useCurrentUser((s) => s.loading)
  const srv = me?.student
  const resolving = loading || me == null || (me.role === 'STUDENT' && srv === undefined)

  if (!srv || !srv.studentId) return { student: null, resolving }
  return {
    resolving,
    student: {
      studentId: srv.studentId,
      classId: srv.classId ?? null,
      className: srv.className ?? null,
      section: srv.section ?? null,
      classLabel: srv.classLabel ?? null,
      rollNo: srv.rollNo ?? null,
      admissionNo: srv.admissionNo ?? null,
      dob: srv.dob ?? null,
      gender: srv.gender ?? null,
      bloodGroup: srv.bloodGroup ?? null,
      guardianName: srv.guardianName ?? null,
      guardianPhone: srv.guardianPhone ?? null,
      address: srv.address ?? null,
    },
  }
}

/* ------------------------------------------------------------------ */
/* Server fee ledger — /api/student/fees (the ONE canonical ledger)    */
/* ------------------------------------------------------------------ */

export interface MyFeeItem {
  id: string
  title: string
  amount: number
  paid: number
  outstanding: number
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE'
  dueDate: string | null
}

export interface MyFeeTxn {
  receiptNo: string | null
  amount: number
  status: string
  method: string | null
  collectedByName: string | null
  verifiedByName: string | null
  collectedAt: string
  note: string | null
}

export interface MyFeeLedger {
  totals: {
    billed: number
    paid: number
    pendingVerification: number
    outstanding: number
    overdue: number
  }
  fees: MyFeeItem[]
  transactions: MyFeeTxn[]
}

/** useMyServerFees — the student's own canonical fee ledger. */
export function useMyServerFees() {
  const [ledger, setLedger] = useState<MyFeeLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const r = await fetch('/api/student/fees', { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setLedger(j?.data ?? null)
    } catch {
      setError('Unable to load fee records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  return { ledger, loading, error, refresh }
}

/* ------------------------------------------------------------------ */
/* Server exam history — /api/student/results (the ONE marks universe) */
/* ------------------------------------------------------------------ */

export interface MyResultSubject {
  subject: string
  marks: number
  totalMarks: number
  grade: string
  remarks: string | null
}

export interface MyResultExam {
  examId: string
  examName: string
  type: string
  declaredAt: string
  subjects: MyResultSubject[]
  pct: number | null
  rank: { position: number; assessedCount: number } | null
}

/** useMyServerResults — the student's own declared exam history. */
export function useMyServerResults() {
  const [data, setData] = useState<{ exams: MyResultExam[]; upcoming: { examName: string; startsAt: string; endsAt: string | null } | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/results', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        if (!cancelled) setData(j?.data ?? { exams: [], upcoming: null })
      })
      .catch(() => { if (!cancelled) setError('Unable to load results.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const exams = data?.exams ?? []
  return { exams, upcoming: data?.upcoming ?? null, loading, error, latest: exams.length > 0 ? exams[0] : null }
}

/* ------------------------------------------------------------------ */
/* Server transport — /api/student/transport (the ONE route source)    */
/* ------------------------------------------------------------------ */

export interface MyTransportRoute {
  id: string
  name: string
  stops: string[]
  fare: number | null
  startTime: string | null
  endTime: string | null
  vehicleNo: string | null
  driverName: string | null
  driverPhone: string | null
}

/** useMyServerTransport — the student's own transport assignment. */
export function useMyServerTransport() {
  const [data, setData] = useState<{ assigned: boolean; route: MyTransportRoute | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/student/transport', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = await r.json()
        if (!cancelled) setData(j?.data ?? { assigned: false, route: null })
      })
      .catch(() => { if (!cancelled) setError('Unable to load transport assignment.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { assigned: data?.assigned ?? false, route: data?.route ?? null, loading, error }
}
