'use client'

/**
 * Class Attendance — the module's single data hook.
 *
 * Two GETs feed everything: the class list (once — skipped when the board
 * is EMBEDDED with a fixed class, e.g. inside My Class → Attendance) and
 * the board (on every class / date / reload change). Both go through the
 * envelope client with { cache: 'no-store', credentials: 'same-origin' }
 * — the httpOnly erp_session cookie is the ONLY auth source, the server
 * resolves teacher / school / scope, and 401 → shared signOut() once.
 *
 * OWNERSHIP (spec §7–§11): only the CLASS TEACHER saves — the explicit
 * Save POSTs the baseline endpoint. A SUBJECT TEACHER is view-only: no
 * save, no draft, no session. Viewing the board NEVER writes anything;
 * the class teacher's local edits persist as a server-side DRAFT
 * (debounced PUT, §11 autosave) and finalize only by an explicit save or
 * the school's end-of-day boundary — never silently.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { signOut } from '@/lib/signout'
import { useFocusStore } from '@/lib/store/focus-store'
import {
  buildDraft,
  countsParts,
  draftCounts,
  isViewOnly,
  pastBoundary,
  todayKey,
  type AttendanceBoard,
  type AttendanceClassInfo,
  type AttendanceDraft,
  type AttendanceStatus,
  type PrefillSource,
  type SaveBaselineResult,
  type SaveCounts,
} from './shared'

// ─── envelope client ({ ok, data } / { ok: false, error }) ───────────

interface Envelope {
  ok?: unknown
  data?: unknown
  error?: unknown
}

async function attendanceFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (res.status === 401) {
    // A dead server session cannot be retried — one graceful re-auth.
    void signOut()
    throw new Error('Your session has expired. Please sign in again.')
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = (await res.json()) as Envelope
      if (body && typeof body.error === 'string') message = body.error
    } catch {
      /* non-JSON error body — keep the concise fallback */
    }
    throw new Error(message)
  }
  const body = (await res.json().catch(() => null)) as Envelope | null
  if (!body || typeof body !== 'object' || body.ok !== true || !('data' in body)) {
    throw new Error(
      body && typeof body.error === 'string' ? body.error : 'Unexpected response from the server.',
    )
  }
  return body.data as T
}

// ─── the hook ─────────────────────────────────────────────────────────

export interface UseAttendanceModuleOptions {
  /**
   * EMBEDDED mode (My Class → Attendance): the board is pinned to this
   * class — no class list is fetched and no class selector is rendered.
   * The class teacher's authority still comes from the server board.
   */
  fixedClassId?: string | null
}

export interface AttendanceModuleState {
  /** classes the teacher can open (null in embedded mode) */
  classes: AttendanceClassInfo[] | null
  classesError: string | null
  reloadClasses: () => void
  classId: string | null
  selectClass: (classId: string) => void
  /** viewed date, "YYYY-MM-DD" (never the future) */
  date: string
  selectDate: (date: string) => void
  board: AttendanceBoard | null
  boardLoading: boolean
  boardError: string | null
  reloadBoard: () => void
  draft: AttendanceDraft
  /** what the draft was prefilled from */
  source: PrefillSource
  /** any local edit not yet persisted (as draft or canonical) */
  dirty: boolean
  /** the draft was restored from the server (§11 resume) */
  resumedFromDraft: boolean
  /** ISO of the last successful server draft autosave */
  draftSavedAt: string | null
  setStatus: (studentId: string, status: AttendanceStatus) => void
  markAllPresent: () => void
  counts: SaveCounts
  saving: boolean
  justSaved: boolean
  save: () => void
  /** subject-teacher board — view-only (§7–§10), no edit controls */
  readOnly: boolean
  /** true when the embedded/fixed class is active (no class list needed) */
  embedded: boolean
}

export function useAttendanceModule(
  options: UseAttendanceModuleOptions = {},
): AttendanceModuleState {
  const fixedClassId = options.fixedClassId ?? null
  const embedded = fixedClassId != null

  const [classes, setClasses] = useState<AttendanceClassInfo[] | null>(null)
  const [classesError, setClassesError] = useState<string | null>(null)
  const [classId, setClassId] = useState<string | null>(fixedClassId)
  const [date, setDate] = useState<string>(todayKey)
  const [board, setBoard] = useState<AttendanceBoard | null>(null)
  const [boardLoading, setBoardLoading] = useState(false)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [draft, setDraft] = useState<AttendanceDraft>({})
  const [source, setSource] = useState<PrefillSource>('present')
  const [dirty, setDirty] = useState(false)
  const [resumedFromDraft, setResumedFromDraft] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [classesTick, setClassesTick] = useState(0)
  const [boardTick, setBoardTick] = useState(0)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftRef = useRef<AttendanceDraft>({})
  const dirtyRef = useRef(false)
  const finalizedRef = useRef<string | null>(null)

  // Reflect the live draft into refs for the debounced autosave writer +
  // boundary watcher (stable callbacks, no stale closures).
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  // Keep the embedded board pinned to its class even if the caller swaps
  // the fixed class (e.g. My Class class selector switches Grade 9-A → 10-B).
  useEffect(() => {
    if (fixedClassId != null) setClassId(fixedClassId)
  }, [fixedClassId])

  // ── classes: where can this teacher open attendance? (skipped when
  //    embedded — the hub already resolved the authorized class) ──────
  useEffect(() => {
    if (embedded) return
    let cancelled = false
    setClassesError(null)
    // TS-SETTINGS — the teacher's saved default class (if any) wins over
    // the first assigned class. Both calls are cheap; prefs failure must
    // never block the module (fall back silently).
    Promise.all([
      attendanceFetch<{ classes: AttendanceClassInfo[] }>('/api/teacher/class-attendance'),
      fetch('/api/teacher/settings', { cache: 'no-store', credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([payload, settings]) => {
        if (cancelled) return
        setClasses(payload.classes)
        // Cross-module deep link (Dashboard → Mark Attendance): the focus
        // store carries the exact class to open, consumed once on mount.
        const focus = useFocusStore.getState().focus
        if (focus && focus.type === 'class' && focus.moduleKey === 'attendance') {
          const focused = payload.classes.find((c) => c.classId === focus.id)
          if (focused) setClassId(focused.classId)
          useFocusStore.getState().clearFocus()
        }
        const preferred = settings?.data?.workspace?.defaultClassId as string | null | undefined
        const validPreferred =
          preferred && payload.classes.some((c) => c.classId === preferred) ? preferred : null
        // Saved default class → else first assigned class; a retry keeps her pick.
        setClassId((cur) => cur ?? validPreferred ?? payload.classes[0]?.classId ?? null)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setClassesError(e instanceof Error ? e.message : 'Classes could not load.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [classesTick, embedded])

  // ── board: roster + the canonical record for classId/date ──────────
  useEffect(() => {
    if (!classId) return
    let cancelled = false
    setBoardLoading(true)
    setBoardError(null)
    attendanceFetch<AttendanceBoard>(
      `/api/teacher/class-attendance/board?classId=${encodeURIComponent(classId)}&date=${date}`,
    )
      .then((payload) => {
        if (cancelled) return
        setBoard(payload)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setBoard(null)
        setBoardError(e instanceof Error ? e.message : 'The attendance board could not load.')
      })
      .finally(() => {
        if (!cancelled) setBoardLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [classId, date, boardTick])

  // ── draft: always rebuilt from server truth on board change ────────
  useEffect(() => {
    if (!board) {
      setDraft({})
      setSource('present')
      setResumedFromDraft(false)
    } else {
      const built = buildDraft(board)
      setDraft(built.draft)
      setSource(built.source)
      setResumedFromDraft(built.source === 'draft' && !isViewOnly(board))
      if (built.source === 'draft' && board.draft.updatedAt) {
        setDraftSavedAt(board.draft.updatedAt)
      } else {
        setDraftSavedAt(null)
      }
    }
    setDirty(false)
  }, [board])

  // Clear the "Saved" pill timer on unmount.
  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
      if (draftTimer.current) clearTimeout(draftTimer.current)
    }
  }, [])

  // ── draft autosave (§11): debounced server persistence of the CLASS
  //    TEACHER'S open sheet. Never the canonical record — a draft is a
  //    draft; the explicit Save button (or the end-of-day boundary) makes
  //    it official. Subject teachers never reach this path (view-only).
  useEffect(() => {
    if (!dirty || !board || !classId || board.students.length === 0) return
    if (isViewOnly(board)) return
    if (draftTimer.current) clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      const entries = (board.students ?? []).map((s) => ({
        studentId: s.id,
        status: draftRef.current[s.id] ?? 'PRESENT',
      }))
      attendanceFetch<{ saved: number }>(
        '/api/teacher/class-attendance/draft',
        {
          method: 'PUT',
          body: JSON.stringify({ classId, date, entries }),
        },
      )
        .then(() => {
          setDraftSavedAt(new Date().toISOString())
        })
        .catch(() => {
          /* a failed draft save is honest — the explicit Save is the
             authoritative path and its errors surface as toasts */
        })
    }, 2000)
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current)
    }

  }, [draft, dirty, classId, date, board])

  // ── end-of-day autosave finalize (§11): once the school's boundary has
  // passed, the class teacher's open draft for this class-day becomes the
  // canonical record (policy permitting). Runs once per class+date while
  // the sheet is open, and also catches up a past day's forgotten sheet.
  useEffect(() => {
    if (!board || !classId || isViewOnly(board)) return
    const key = `${classId}:${board.date}`
    if (finalizedRef.current === key) return
    if (!board.autosave?.autosaveFinalize) return
    if (!pastBoundary(board.date, board.autosave)) return
    if (board.baseline.exists) return // already official
    // Only an open sheet (local edits or a server draft) is finalized.
    if (!dirtyRef.current && !board.draft.exists) return
    finalizedRef.current = key
    attendanceFetch<{ finalized: boolean; saved?: number; reason: string }>(
      `/api/teacher/class-attendance/draft?classId=${encodeURIComponent(classId)}&date=${board.date}`,
      { method: 'POST' },
    )
      .then((res) => {
        if (res.finalized) {
          toast.success('Attendance autosaved after school hours', {
            description: `The open sheet was made official for ${board.label}.`,
          })
          setBoardTick((t) => t + 1)
        }
      })
      .catch(() => {
        finalizedRef.current = null // retry on the next tick
      })

  }, [board, classId])

  const reloadClasses = useCallback(() => setClassesTick((t) => t + 1), [])
  const reloadBoard = useCallback(() => setBoardTick((t) => t + 1), [])

  /** Flush the open sheet to the server draft RIGHT NOW (§11 — switching
   *  class/date mid-marking never loses entered attendance). */
  const flushDraft = useCallback(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current)
    const currentBoard = board
    const currentClassId = classId
    if (!currentBoard || !currentClassId || currentBoard.students.length === 0) return
    if (isViewOnly(currentBoard)) return
    const entries = currentBoard.students.map((s) => ({
      studentId: s.id,
      status: draftRef.current[s.id] ?? 'PRESENT',
    }))
    void attendanceFetch('/api/teacher/class-attendance/draft', {
      method: 'PUT',
      body: JSON.stringify({
        classId: currentClassId,
        date,
        entries,
      }),
    }).catch(() => {
      /* the explicit Save path remains the authoritative one */
    })
  }, [board, classId, date])

  const selectClass = useCallback(
    (id: string) => {
      if (classId === id || embedded) return
      // The old roster must never linger under a newly selected class.
      if (dirty) {
        flushDraft()
        toast.info('Kept as a draft', {
          description: 'Your unsaved attendance for this class was preserved as a draft.',
        })
      }
      setBoard(null)
      setBoardError(null)
      setClassId(id)
    },
    [classId, dirty, flushDraft, embedded],
  )

  const selectDate = useCallback(
    (value: string) => {
      if (!value || value === date) return
      if (value > todayKey()) return // the future is not markable (server enforces too)
      if (dirty) {
        flushDraft()
        toast.info('Kept as a draft', {
          description: 'Your unsaved attendance for this day was preserved as a draft.',
        })
      }
      setBoard(null)
      setBoardError(null)
      setDate(value)
    },
    [date, dirty, flushDraft],
  )

  const setStatus = useCallback((studentId: string, status: AttendanceStatus) => {
    setDraft((prev) => (prev[studentId] === status ? prev : { ...prev, [studentId]: status }))
    setDirty(true)
  }, [])
  const markAllPresent = useCallback(() => {
    if (!board || board.students.length === 0) return
    // No-op guard: when everyone is already PRESENT there is nothing to
    // save — no spurious dirty flag, no "Unsaved" badge, no draft write.
    if (board.students.every((s) => draft[s.id] === 'PRESENT')) {
      toast.info('Everyone is already marked present')
      return
    }
    setDraft((prev) => {
      const next = { ...prev }
      for (const s of board.students) {
        next[s.id] = 'PRESENT'
      }
      return next
    })
    setDirty(true)
    toast.success('All students marked present', {
      description: 'Review and save the attendance.',
    })
  }, [board, draft])

  const counts: SaveCounts = useMemo(
    () => draftCounts(board?.students ?? [], draft),
    [board, draft],
  )

  const save = useCallback(async (): Promise<void> => {
    if (!board || !classId || saving || boardLoading) return
    if (board.students.length === 0) return
    if (isViewOnly(board)) return // subject teacher — view-only (§7–§10)
    const entries = board.students.map((s) => ({
      studentId: s.id,
      status: draft[s.id] ?? 'PRESENT',
    }))
    setSaving(true)
    try {
      // Class teacher → the official daily record for the whole class.
      const res = await attendanceFetch<SaveBaselineResult>(
        '/api/teacher/class-attendance/baseline',
        { method: 'POST', body: JSON.stringify({ classId, date, entries }) },
      )
      toast.success('Attendance saved', {
        description: [board.label, ...countsParts(res.counts)].filter(Boolean).join(' · '),
      })
      // Refetch so the draft reflects server truth (markedBy, savedAt).
      setDirty(false)
      setDraftSavedAt(null)
      setBoardTick((t) => t + 1)
      setJustSaved(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setJustSaved(false), 2000)
    } catch (e: unknown) {
      toast.error('Attendance could not be saved', {
        description: e instanceof Error ? e.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }, [board, classId, date, draft, saving, boardLoading])

  return {
    classes,
    classesError,
    reloadClasses,
    classId,
    selectClass,
    date,
    selectDate,
    board,
    boardLoading,
    boardError,
    reloadBoard,
    draft,
    source,
    dirty,
    resumedFromDraft,
    draftSavedAt,
    setStatus,
    markAllPresent,
    counts,
    saving,
    justSaved,
    save,
    readOnly: isViewOnly(board),
    embedded,
  }
}
