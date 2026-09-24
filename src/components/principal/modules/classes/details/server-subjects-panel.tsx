'use client'

/**
 * ServerSubjectsPanel — the AUTHORITATIVE class-subject configuration.
 *
 * Renders + mutates the server record (ClassSubjectAssignment) for a
 * DB-linked class via /api/principal/academic. This is the Principal's
 * single configuration act: every add / remove / rename here IS the
 * school's configuration — Teacher My Timetable, Lesson Planner, Marks
 * Entry and Exam workflows derive from exactly this data.
 *
 * Nothing is invented: the subject list, teaching load and assigned
 * teachers all come from the server response; mutations re-fetch the
 * server state (server is truth — never local echo).
 */

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, BookOpen, CloudOff, Loader2, Pencil, Plus, Search, Server,
  Sparkles, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  useAcademicConfigStore, type DbClassInfo, type DbSubjectInfo,
} from '@/lib/academic-config/client'
import { ConfirmDialog } from '../../shared/confirm-dialog'

export function ServerSubjectsPanel({ dbClass }: { dbClass: DbClassInfo }) {
  const config = useAcademicConfigStore((s) => s.config)
  const loading = useAcademicConfigStore((s) => s.loading)
  const error = useAcademicConfigStore((s) => s.error)
  const version = useAcademicConfigStore((s) => s.version)
  const fetcher = useAcademicConfigStore((s) => s.fetch)
  const act = useAcademicConfigStore((s) => s.act)

  const [editMode, setEditMode] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<DbSubjectInfo | null>(null)
  const [renameTarget, setRenameTarget] = useState<DbSubjectInfo | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void fetcher() }, [fetcher])

  // Live server view of THIS class (config refreshes after each mutation).
  const live = useMemo(
    () => config?.classes.find((c) => c.id === dbClass.id) ?? dbClass,
    [config, dbClass, version],
  )

  const handleAdd = async (subjectName: string) => {
    setBusy(true)
    try {
      await act({ action: 'subject.add', classId: live.id, subjectName })
      toast.success(`${subjectName} configured for ${live.label}`, {
        description: 'Available to Teacher workflows immediately.',
      })
      setAddOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add subject')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setBusy(true)
    try {
      const res = await act({
        action: 'subject.remove', classId: live.id, subjectId: removeTarget.subjectId,
      })
      const cleared = typeof res.timetableRowsRemoved === 'number' ? res.timetableRowsRemoved : 0
      toast.success(`${removeTarget.name} removed from ${live.label}`, {
        description: cleared > 0
          ? `${cleared} timetable slot${cleared === 1 ? '' : 's'} cleared — Teacher modules updated.`
          : 'Teacher modules updated.',
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove subject')
    } finally {
      setBusy(false)
      setRemoveTarget(null)
    }
  }

  const handleRename = async (newName: string) => {
    if (!renameTarget) return
    setBusy(true)
    try {
      await act({ action: 'subject.rename', subjectId: renameTarget.subjectId, newName })
      toast.success(`Renamed to ${newName}`, {
        description: 'The rename applies school-wide (every class using this subject).',
      })
      setRenameTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not rename subject')
    } finally {
      setBusy(false)
    }
  }

  if (error && !config) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-6 text-center">
        <CloudOff className="h-6 w-6 text-rose-500/60 mx-auto mb-2" />
        <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
          Couldn&apos;t load the school&apos;s academic configuration
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">{error}</p>
        <Button size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={() => void fetcher(true)}>
          <Loader2 className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    )
  }

  if (loading && !config) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-[86px] rounded-lg border border-border/60 bg-card animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sync banner — the architecture made visible */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] px-4 py-3">
        <Server className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Server-authoritative record · {live.label}
          </p>
          <p className="text-[11px] leading-relaxed text-emerald-700/80 dark:text-emerald-400/70 mt-0.5">
            This is the school&apos;s single configuration. Teacher Timetables, Lesson Planner, Marks Entry and
            Exams all derive from it — changes here apply everywhere, instantly.
            {live.classTeacher ? ` Class teacher: ${live.classTeacher.name}.` : ''}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {live.subjects.length} subject{live.subjects.length === 1 ? '' : 's'} configured
        </p>
        <div className="flex items-center gap-1.5">
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setAddOpen(true)} disabled={busy}>
            <Plus className="h-3.5 w-3.5" /> Add Subject
          </Button>
          <Button
            size="sm" variant="outline" className="h-8 text-xs gap-1.5"
            onClick={() => setEditMode((m) => !m)}
          >
            {editMode ? 'Done' : 'Manage'}
          </Button>
        </div>
      </div>

      {/* Subject cards */}
      {live.subjects.length === 0 ? (
        <div className="py-8 text-center rounded-xl border border-dashed border-border/60">
          <BookOpen className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">No subjects configured for this class yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {live.subjects.map((s) => (
            <div
              key={s.subjectId}
              className="group rounded-lg border border-border/60 bg-card p-3.5 hover:border-emerald-500/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {s.code ?? 'SUB'}{s.isCore ? ' · Core' : ' · Optional'}
                  </p>
                </div>
                {editMode && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label={`Rename ${s.name}`}
                      onClick={() => setRenameTarget(s)}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${s.name} from this class`}
                      onClick={() => setRemoveTarget(s)}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <Badge variant="secondary" className={cn('text-[10px]', s.periodsPerWeek > 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground')}>
                  {s.periodsPerWeek > 0 ? `${s.periodsPerWeek} period${s.periodsPerWeek === 1 ? '' : 's'}/wk` : 'Not scheduled'}
                </Badge>
                <p className="text-[10px] text-muted-foreground truncate">
                  {s.teachers.length > 0 ? s.teachers.join(' · ') : 'No teacher assigned'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddServerSubjectDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        dbClass={live}
        catalog={config?.catalog ?? []}
        busy={busy}
        onAdd={handleAdd}
      />

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name}?`}
        description={`${removeTarget?.name} will no longer be configured for ${live.label}. Its timetable slots are cleared and it disappears from Teacher Timetables, Lesson Planner and Marks Entry. Historical exam records are preserved.`}
        tone="destructive"
        icon={AlertTriangle}
        confirmLabel="Remove Subject"
        onConfirm={handleRemove}
      />

      <RenameServerSubjectDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        busy={busy}
        onRename={handleRename}
      />
    </div>
  )
}

/* ── Add subject (from the school's server catalog, or brand-new) ───── */

function AddServerSubjectDialog({
  open, onOpenChange, dbClass, catalog, busy, onAdd,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  dbClass: DbClassInfo
  catalog: { id: string; name: string; code: string | null; status: string }[]
  busy: boolean
  onAdd: (subjectName: string) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [customName, setCustomName] = useState('')

  const configured = new Set(dbClass.subjects.map((s) => s.name.toLowerCase()))
  const available = useMemo(
    () =>
      catalog
        .filter((s) => s.status === 'Active' && !configured.has(s.name.toLowerCase()))
        .filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase())),
    [catalog, configured, search],
  )
  const trimmed = customName.trim()
  const canCreate = trimmed.length > 0 && !configured.has(trimmed.toLowerCase())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Add Subject</DialogTitle>
          <DialogDescription className="text-xs">
            Configure a subject for {dbClass.label}. It becomes available to Teacher workflows the moment it is
            scheduled on the timetable.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the school's subject catalog…"
              className="pl-8 h-8 text-xs"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/30">
            {available.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                {search ? 'No matching subjects.' : 'Every catalog subject is already configured.'}
              </p>
            ) : (
              available.map((s) => (
                <button
                  key={s.id}
                  disabled={busy}
                  onClick={() => { void onAdd(s.name) }}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition-colors text-left disabled:opacity-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.code ?? 'SUB'} · school catalog</p>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
          <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Configure a brand-new subject
            </div>
            <div className="flex gap-1.5">
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Computer Applications"
                className="h-8 text-xs flex-1"
              />
              <Button
                size="sm" className="h-8 text-xs" disabled={!canCreate || busy}
                onClick={() => { void onAdd(trimmed); setCustomName('') }}
              >
                Configure
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Rename (school-wide catalog rename) ────────────────────────────── */

function RenameServerSubjectDialog({
  target, onClose, busy, onRename,
}: {
  target: DbSubjectInfo | null
  onClose: () => void
  busy: boolean
  onRename: (newName: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  useEffect(() => { setName(target?.name ?? '') }, [target])
  const trimmed = name.trim()
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Rename subject</DialogTitle>
          <DialogDescription className="text-xs">
            Renames the catalog subject school-wide — every class, timetable and Teacher module that uses
            &ldquo;{target?.name}&rdquo; follows automatically.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 text-sm"
          placeholder="New subject name"
        />
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm" disabled={!trimmed || trimmed === target?.name || busy}
            onClick={() => { void onRename(trimmed) }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
