'use client'

/**
 * useServerDirectory — the PRINCIPAL's student directory on SERVER TRUTH.
 *
 * Fetches the school's canonical rows (all principal-gated endpoints):
 *   · GET /api/students        — the real roster
 *   · GET /api/classes?counts=1 — real classes
 *   · GET /api/fees            — the fee ledger (per-student totals)
 *   · GET /api/attendance      — recorded attendance (per-student %)
 *   · GET /api/results         — declared exam results (academics + rank)
 *
 * and maps them onto the existing StudentRecord/ClassRecord shapes the
 * Students & Classes UI renders — real identity, real fee/attendance/
 * academics numbers, and honest placeholders for surfaces the server
 * doesn't model yet (medical note, documents, timeline). Mapped records
 * carry `serverRecord: true` so store-only actions (archive/transfer)
 * hide themselves instead of pretending to work (spec §8: one school,
 * one reality; §18: no fake numbers).
 */
import { useEffect, useMemo, useState } from 'react'
import type { StudentRecord, ClassRecord } from '@/lib/store/students-store'

export interface ServerStudentRecord extends StudentRecord {
  serverRecord: true
}

interface ApiStudent {
  id: string
  classId: string | null
  rollNo: string | null
  admissionNo: string | null
  guardianName: string | null
  guardianPhone: string | null
  dob: string | null
  gender: string | null
  bloodGroup: string | null
  address: string | null
  routeId: string | null
  class: { id: string; name: string; section: string | null } | null
  user: { name: string | null; email?: string; phone?: string; status?: string }
}

interface ApiClass {
  id: string
  name: string
  section: string | null
  capacity: number | null
  room: string | null
  _count?: { students: number }
}

interface ApiFee {
  studentId: string
  title: string
  amount: number
  paid: number
  status: string
  dueDate: string | null
}

interface ApiAttendance {
  studentId: string
  date: string
  status: string
}

interface ApiResult {
  studentId: string
  subjectId: string
  marks: number
  totalMarks: number
  grade: string | null
  subject: { name: string } | null
  exam: { name: string; createdAt: string } | null
}

function gradeOf(pct: number): string {
  if (pct >= 91) return 'A1'
  if (pct >= 81) return 'A2'
  if (pct >= 71) return 'B1'
  if (pct >= 61) return 'B2'
  if (pct >= 51) return 'C1'
  if (pct >= 41) return 'C2'
  if (pct >= 33) return 'D'
  return 'E'
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export interface ServerDirectoryState {
  students: ServerStudentRecord[]
  classes: Pick<ClassRecord, 'id' | 'name'>[]
  loading: boolean
  error: string | null
}

export function useServerDirectory(): ServerDirectoryState {
  const [raw, setRaw] = useState<{
    students: ApiStudent[]
    classes: ApiClass[]
    fees: ApiFee[]
    attendance: ApiAttendance[]
    results: ApiResult[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const get = async (path: string) => {
      const res = await fetch(path, { credentials: 'same-origin' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || path)
      return json.data
    }
    Promise.all([
      get('/api/students'),
      get('/api/classes?counts=1'),
      get('/api/fees'),
      get('/api/attendance'),
      get('/api/results'),
    ])
      .then(([students, classes, fees, attendance, results]) => {
        if (cancelled) return
        setRaw({ students, classes, fees, attendance, results })
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load directory')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const students = useMemo<ServerStudentRecord[]>(() => {
    if (!raw) return []

    // ── per-student fee ledger ──
    const feeByStudent = new Map<string, { total: number; paid: number }>()
    for (const f of raw.fees) {
      const agg = feeByStudent.get(f.studentId) ?? { total: 0, paid: 0 }
      agg.total += f.amount
      agg.paid += f.paid
      feeByStudent.set(f.studentId, agg)
    }

    // ── per-student attendance stats + monthly trend ──
    const attByStudent = new Map<string, { present: number; total: number; byMonth: Map<string, { attended: number; total: number }> }>()
    for (const a of raw.attendance) {
      const agg =
        attByStudent.get(a.studentId) ??
        { present: 0, total: 0, byMonth: new Map<string, { attended: number; total: number }>() }
      agg.total++
      if (a.status === 'PRESENT' || a.status === 'LATE') agg.present++
      const monthKey = a.date.slice(0, 7)
      const m = agg.byMonth.get(monthKey) ?? { attended: 0, total: 0 }
      m.total++
      if (a.status === 'PRESENT' || a.status === 'LATE') m.attended++
      agg.byMonth.set(monthKey, m)
      attByStudent.set(a.studentId, agg)
    }

    // ── per-student academics (latest exam session) + real class rank ──
    // Latest exam per student = the exam of their most recent Result row.
    const resultsByStudent = new Map<string, ApiResult[]>()
    for (const r of raw.results) {
      const arr = resultsByStudent.get(r.studentId) ?? []
      arr.push(r)
      resultsByStudent.set(r.studentId, arr)
    }
    const academicsByStudent = new Map<
      string,
      { overallGrade: string; overallPercent: number; rankInClass: number; subjects: { name: string; grade: string; percent: number; teacher: string }[] }
    >()
    // class averages for ranking: avg% of each student's latest-exam subjects
    const classAvgByStudent = new Map<string, { classId: string | null; avgPct: number }>()
    for (const [sid, rows] of resultsByStudent) {
      const sorted = [...rows].sort((a, b) => (a.exam?.createdAt ?? '').localeCompare(b.exam?.createdAt ?? ''))
      const latestExamId = sorted[sorted.length - 1]?.exam?.name ?? null
      const latest = latestExamId ? rows.filter((r) => r.exam?.name === latestExamId) : rows
      const subjects = latest.map((r) => {
        const pct = r.totalMarks > 0 ? Math.round((r.marks / r.totalMarks) * 100) : 0
        return { name: r.subject?.name ?? 'Subject', grade: r.grade ?? gradeOf(pct), percent: pct, teacher: '—' }
      })
      const overallPercent = subjects.length > 0 ? Math.round(subjects.reduce((a, s) => a + s.percent, 0) / subjects.length) : 0
      const stu = raw.students.find((s) => s.id === sid)
      classAvgByStudent.set(sid, { classId: stu?.classId ?? null, avgPct: overallPercent })
      academicsByStudent.set(sid, {
        overallGrade: gradeOf(overallPercent),
        overallPercent,
        rankInClass: 0, // filled below
        subjects,
      })
    }
    // rank within class (1 = highest avg)
    const byClass = new Map<string | null, { sid: string; avgPct: number }[]>()
    for (const [sid, { classId, avgPct }] of classAvgByStudent) {
      const arr = byClass.get(classId) ?? []
      arr.push({ sid, avgPct })
      byClass.set(classId, arr)
    }
    for (const [, arr] of byClass) {
      arr.sort((a, b) => b.avgPct - a.avgPct)
      arr.forEach((entry, i) => {
        const ac = academicsByStudent.get(entry.sid)
        if (ac) ac.rankInClass = i + 1
      })
    }

    // ── map roster rows ──
    return raw.students.map((s): ServerStudentRecord => {
      const fee = feeByStudent.get(s.id) ?? { total: 0, paid: 0 }
      const feeStatus: 'Paid' | 'Partial' | 'Pending' =
        fee.paid >= fee.total && fee.total > 0 ? 'Paid' : fee.paid > 0 ? 'Partial' : 'Pending'
      const att = attByStudent.get(s.id)
      const attendancePct = att && att.total > 0 ? Math.round((att.present / att.total) * 100) : 0
      const attendanceTrend = att
        ? [...att.byMonth.entries()]
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .slice(-6)
            .map(([month, m]) => ({
              month: new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' }),
              percent: m.total > 0 ? Math.round((m.attended / m.total) * 100) : 0,
            }))
        : []
      const academics =
        academicsByStudent.get(s.id) ?? { overallGrade: '—', overallPercent: 0, rankInClass: 0, subjects: [] }
      const gender: 'Male' | 'Female' =
        (s.gender ?? '').toLowerCase().startsWith('m') ? 'Male' : (s.gender ?? '').toLowerCase().startsWith('f') ? 'Female' : 'Male'
      const className = s.class?.name ?? 'Unassigned'
      const section = s.class?.section ?? '—'
      return {
        serverRecord: true,
        id: s.id,
        admissionNo: s.admissionNo ?? '—',
        rollNo: s.rollNo ?? '—',
        name: s.user?.name ?? 'Unnamed student',
        avatar: initialsOf(s.user?.name ?? '?'),
        gender,
        classId: s.classId ?? '',
        className,
        section,
        dob: s.dob ?? '',
        bloodGroup: s.bloodGroup ?? '—',
        category: '—',
        fatherName: s.guardianName ?? '—',
        motherName: '—',
        guardianName: s.guardianName ?? '—',
        guardianPhone: s.guardianPhone ?? '—',
        guardianEmail: s.user?.email ?? '—',
        city: '—',
        state: '—',
        hostel: false,
        disciplinePoints: 0,
        address: s.address ?? '—',
        admissionDate: '',
        previousSchool: '—',
        status: (s.user?.status ?? 'ACTIVE') === 'ACTIVE' ? 'Active' : 'Archived',
        attendance: attendancePct,
        feeStatus,
        feePaid: fee.paid,
        feeTotal: fee.total,
        transport: Boolean(s.routeId),
        scholarship: 0,
        medical: 'No medical record on file.',
        academics,
        attendanceTrend,
        achievements: [],
        disciplineRecords: [],
        documents: [],
        transportRoute: s.routeId ?? undefined,
        timeline: [],
      }
    })
  }, [raw])

  const classes = useMemo(() => {
    if (!raw) return []
    return raw.classes.map((c) => ({
      id: c.id,
      name: c.section && !c.name.includes(c.section) ? `${c.name} - ${c.section}` : c.name,
    }))
  }, [raw])

  return { students, classes, loading: raw === null && error === null, error }
}
