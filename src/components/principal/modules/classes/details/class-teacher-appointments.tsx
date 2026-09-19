'use client'

/**
 * ClassTeacherAppointments — the OFFICIAL class-teacher appointment
 * record, a 100% real-DB island inside the (mock-store) Classes module —
 * the same pattern as the Exams module's Invigilation tab.
 *
 * Every real class of the school in one list with its appointed class
 * teacher; a Select appoints / releases (PATCH /api/classes/[id]/
 * class-teacher). Appointing a teacher:
 *   · stores Class.classTeacherId — the exact server truth that gates
 *     the teacher's Class Teacher Hub (sidebar group, My Class module,
 *     fee records in the Student Directory);
 *   · pushes a notification to the teacher (release notifies too).
 * Optimistic rows with revert-on-error, toasts, emerald flash on change.
 */

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  BadgeCheck,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type ApiError } from '@/lib/exams/api-client'
import { cn } from '@/lib/utils'

interface AppointmentTeacher {
  userId: string
  name: string
  email: string
  department: string | null
  employeeId: string | null
}

interface AppointmentClass {
  id: string
  label: string
  room: string | null
  studentCount: number
  classTeacher: AppointmentTeacher | null
}

interface AppointmentsPayload {
  classes: AppointmentClass[]
  teachers: AppointmentTeacher[]
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function ClassTeacherAppointments() {
  const [data, setData] = useState<AppointmentsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingClassId, setPendingClassId] = useState<string | null>(null)
  const [flashClassId, setFlashClassId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const payload = await api<AppointmentsPayload>('/api/classes/class-teachers', {
        cache: 'no-store',
      })
      setData(payload)
    } catch (e) {
      setError(e instanceof Error || typeof e === 'object' && e && 'message' in e ? (e as ApiError).message : 'Failed to load appointments')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const appoint = async (cls: AppointmentClass, teacherUserId: string | null) => {
    if (!data) return
    const prev = cls.classTeacher
    if ((prev?.userId ?? null) === teacherUserId) return // no-op
    const teacher = teacherUserId
      ? data.teachers.find((t) => t.userId === teacherUserId) ?? null
      : null

    // optimistic row update
    setData({
      ...data,
      classes: data.classes.map((c) =>
        c.id === cls.id ? { ...c, classTeacher: teacher } : c,
      ),
    })
    setPendingClassId(cls.id)
    try {
      await api(`/api/classes/${cls.id}/class-teacher`, {
        method: 'PATCH',
        json: { teacherUserId },
      })
      setFlashClassId(cls.id)
      window.setTimeout(() => setFlashClassId((f) => (f === cls.id ? null : f)), 1200)
      if (teacher) {
        toast.success(`${teacher.name} appointed`, {
          description: `Class Teacher of ${cls.label} — the Class Teacher Hub is now in their panel (notification sent).`,
        })
      } else {
        toast.success(`Class teacher released`, {
          description: `${prev?.name ?? 'The teacher'} is no longer class teacher of ${cls.label} (notification sent).`,
        })
      }
    } catch (e) {
      // revert
      setData((d) =>
        d
          ? {
              ...d,
              classes: d.classes.map((c) => (c.id === cls.id ? { ...c, classTeacher: prev } : c)),
            }
          : d,
      )
      const message =
        e instanceof Error || (typeof e === 'object' && e && 'message' in e)
          ? (e as ApiError).message
          : 'The appointment could not be saved.'
      toast.error('Appointment failed', { description: message })
    } finally {
      setPendingClassId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          Class Teacher Appointments
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Official record
          </span>
        </h3>
        <span className="text-[10px] text-muted-foreground">drives each teacher&rsquo;s panel access · notifies on change</span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Appointing a class teacher unlocks the <span className="font-medium text-foreground">Class Teacher Hub</span> in
        their panel — class overview, fee records and overall results submission for their class.
      </p>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.05] px-3 py-2.5 text-xs text-rose-700 dark:text-rose-400">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {error}
          </span>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => void load()}>
            <RefreshCw className="h-3 w-3" aria-hidden="true" /> Retry
          </Button>
        </div>
      ) : !data ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[62px] rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {data.classes.map((cls, i) => {
            const assigned = cls.classTeacher
            const pending = pendingClassId === cls.id
            return (
              <motion.li
                key={cls.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.25), duration: 0.3 }}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                  flashClassId === cls.id
                    ? 'border-emerald-500/60 bg-emerald-500/[0.06]'
                    : 'border-border bg-card/60',
                )}
              >
                <div className="min-w-0 flex-1 basis-[220px]">
                  <p className="truncate text-sm font-semibold">{cls.label}</p>
                  <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Users className="h-2.5 w-2.5" aria-hidden="true" /> {cls.studentCount} students
                    {cls.room && <span aria-hidden>· Room {cls.room}</span>}
                  </p>
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-2 basis-[200px]">
                  <AnimatePresence mode="wait" initial={false}>
                    {assigned ? (
                      <motion.span
                        key={assigned.userId}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.18 }}
                        className="flex min-w-0 items-center gap-2"
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-700 dark:text-emerald-400"
                        >
                          {initialsOf(assigned.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 truncate text-xs font-semibold">
                            {assigned.name}
                            <BadgeCheck className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden="true" />
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {assigned.department ?? 'Faculty'} · {assigned.employeeId ?? '—'}
                          </span>
                        </span>
                      </motion.span>
                    ) : (
                      <motion.span
                        key="vacant"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                      >
                        No class teacher appointed
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                <div className="shrink-0">
                  <Select
                    value={assigned?.userId ?? ''}
                    onValueChange={(v) => void appoint(cls, v === '__none__' ? null : v)}
                    disabled={pending}
                  >
                    <SelectTrigger
                      size="sm"
                      className={cn(
                        'h-9 w-[190px] text-xs font-medium',
                        !assigned && 'border-amber-500/40 bg-amber-500/[0.05] text-amber-700 dark:text-amber-400',
                      )}
                      aria-label={`Class teacher of ${cls.label}`}
                    >
                      <SelectValue placeholder="Appoint class teacher…" />
                    </SelectTrigger>
                    <SelectContent>
                      {assigned && (
                        <SelectItem value="__none__" className="text-rose-600 focus:text-rose-600">
                          <span className="flex items-center gap-1.5">
                            <UserMinus className="h-3 w-3" aria-hidden="true" /> Release appointment
                          </span>
                        </SelectItem>
                      )}
                      {data.teachers.map((t) => (
                        <SelectItem key={t.userId} value={t.userId}>
                          <span className="flex items-center justify-between gap-3">
                            <span className="truncate">{t.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {t.department ?? 'Faculty'}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </motion.li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
