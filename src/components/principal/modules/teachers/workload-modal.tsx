'use client'

/**
 * Class & Subject Allocation modal (Wave 2.3C §10–§15).
 *
 * A calm allocation picker:
 *  · Classes — searchable, grouped by level (Primary / Middle / …), from the
 *    school's real class configuration (/api/principal/academic).
 *  · Subjects — only subjects the school actually offers; when classes are
 *    selected, only the subjects configured for THOSE classes (CSA). With no
 *    class selected the school's subject catalog is offered (teacher-level
 *    subject assignment is preserved).
 *  · Current values that live outside the school configuration (legacy demo
 *    data) are shown honestly and can be removed — never silently dropped.
 *  · Conflicts (another active teacher already holding the class+subject)
 *    appear only when they exist, as compact rows with a Replace action.
 *  · Footer carries the selection summary and a changes summary; Save is
 *    disabled until something actually changed.
 *
 * Class-teacher appointments are NOT part of this modal — they are a
 * canonical assignment managed in Students & Classes → Classes and surface
 * on the Teacher Profile's Class Teacher row (which carries its own Manage
 * link). No explanation is shown here: the picker stays purely about
 * classes and subjects.
 */

import { useMemo, useState } from 'react'
import { BookOpen, Check, Search, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { TeacherRecord } from '@/lib/store/teachers-store'
import { useAcademicConfig, groupClasses } from './use-academic-allocation'

interface Props {
  open: boolean
  onClose: () => void
  selectedTeacher: TeacherRecord | null
  teachers: TeacherRecord[]
  selectedClasses: string[]
  setSelectedClasses: React.Dispatch<React.SetStateAction<string[]>>
  selectedSubjects: string[]
  setSelectedSubjects: React.Dispatch<React.SetStateAction<string[]>>
  onReplaceConflictTeacher: (conflictTeacherId: string, newSubjects: string[], newClasses: string[]) => void
  onSave: () => void
}

const count = (n: number, one: string, many: string = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function WorkloadAllocationModal({
  open, onClose, selectedTeacher, teachers,
  selectedClasses, setSelectedClasses,
  selectedSubjects, setSelectedSubjects,
  onReplaceConflictTeacher, onSave,
}: Props) {
  const [search, setSearch] = useState('')
  const configState = useAcademicConfig(open)

  const config = configState.status === 'ready' ? configState.config : null

  // Class rows — the school's real classes, grouped by level, search-filtered.
  const groupedClasses = useMemo(() => {
    if (!config) return []
    const q = search.trim().toLowerCase()
    const filtered = q
      ? config.classes.filter((c) => c.label.toLowerCase().includes(q))
      : config.classes
    return groupClasses(filtered)
  }, [config, search])

  // Subjects selectable right now: the union of the selected classes' CSA
  // subjects — or, with no (server) class selected, the school's subject catalog.
  const selectedServerClasses = useMemo(
    () => (config ? config.classes.filter((c) => selectedClasses.includes(c.label)) : []),
    [config, selectedClasses],
  )
  const applicableSubjects = useMemo(() => {
    if (!config) return []
    if (selectedServerClasses.length === 0) return [...config.catalog]
    const set = new Set<string>()
    selectedServerClasses.forEach((c) => c.subjects.forEach((s) => set.add(s)))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [config, selectedServerClasses])

  // Current values that are not part of the school configuration (or not
  // offered for the selected classes) — visible + removable, never hidden.
  const legacyClasses = useMemo(
    () => (config ? selectedClasses.filter((c) => !config.classes.some((k) => k.label === c)) : []),
    [config, selectedClasses],
  )
  const unofferedSubjects = useMemo(
    () => selectedSubjects.filter((s) => !applicableSubjects.includes(s)),
    [selectedSubjects, applicableSubjects],
  )

  // Conflicts — another active teacher already holding the same class+subject.
  const conflicts = useMemo(() => {
    if (!selectedTeacher) return []
    const list: { cls: string; subject: string; teacher: TeacherRecord }[] = []
    for (const cls of selectedClasses) {
      for (const subject of selectedSubjects) {
        const other = teachers.find(
          (t) => t.id !== selectedTeacher.id && t.status === 'Active'
            && t.classes.includes(cls) && t.subjects.includes(subject),
        )
        if (other) list.push({ cls, subject, teacher: other })
      }
    }
    return list
  }, [selectedClasses, selectedSubjects, teachers, selectedTeacher])

  // Changes vs the teacher's current allocation.
  const changes = useMemo(() => {
    if (!selectedTeacher) return null
    const addCls = selectedClasses.filter((c) => !selectedTeacher.classes.includes(c))
    const remCls = selectedTeacher.classes.filter((c) => !selectedClasses.includes(c))
    const addSub = selectedSubjects.filter((s) => !selectedTeacher.subjects.includes(s))
    const remSub = selectedTeacher.subjects.filter((s) => !selectedSubjects.includes(s))
    return {
      addCls, remCls, addSub, remSub,
      hasChanges: addCls.length + remCls.length + addSub.length + remSub.length > 0,
    }
  }, [selectedClasses, selectedSubjects, selectedTeacher])

  const loading = configState.status === 'loading'
  const errored = configState.status === 'error'

  const currentSummary = selectedTeacher
    ? [
        selectedTeacher.subjects.length > 0 ? selectedTeacher.subjects.join(', ') : 'No subjects',
        selectedTeacher.classes.length > 0 ? selectedTeacher.classes.join(', ') : 'No classes',
      ].join(' · ')
    : ''

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <BookOpen className="h-4 w-4 text-primary" /> Class &amp; Subject Allocation
          </DialogTitle>
          {selectedTeacher && (
            <DialogDescription className="text-xs">
              {selectedTeacher.name} · Current: {currentSummary}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
          {errored ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-xs font-medium text-foreground">School configuration could not be loaded</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {configState.error}. Classes and subjects come from the school&rsquo;s academic settings — close and reopen to retry.
              </p>
            </div>
          ) : (
            <>
              {/* ---------- CLASSES ---------- */}
              <section aria-label="Classes">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Classes</p>
                  <span className="text-[10px] text-muted-foreground">{count(selectedClasses.length, 'class', 'classes')} selected</span>
                </div>
                <div className="rounded-lg border border-border">
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search classes"
                        className="h-8 pl-8 text-xs bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        aria-label="Search classes"
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto p-1.5 space-y-1.5">
                    {loading && (
                      <div className="space-y-1.5" aria-live="polite">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-8 rounded-md bg-muted/60 animate-pulse" />
                        ))}
                      </div>
                    )}
                    {!loading && groupedClasses.map(({ group, classes }) => (
                      <div key={group}>
                        <p className="text-[9px] uppercase font-semibold tracking-widest text-muted-foreground/80 px-2 pt-1.5 pb-0.5">{group}</p>
                        {classes.map((c) => {
                          const checked = selectedClasses.includes(c.label)
                          return (
                            <button
                              key={c.id}
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              aria-label={`Assign ${c.label}`}
                              onClick={() => setSelectedClasses((prev) =>
                                checked ? prev.filter((x) => x !== c.label) : [...prev, c.label],
                              )}
                              className="w-full flex items-center gap-2.5 rounded-md px-2 h-8 text-left hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span
                                className={cn(
                                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                                  checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                                )}
                              >
                                {checked && <Check className="h-3 w-3" />}
                              </span>
                              <span className="text-xs font-medium text-foreground truncate">{c.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                    {!loading && groupedClasses.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-3">No classes match &ldquo;{search}&rdquo;.</p>
                    )}
                  </div>
                </div>
                {legacyClasses.length > 0 && (
                  <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] px-3 py-2">
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-amber-700 dark:text-amber-400 mb-1.5">
                      Current — not in school configuration
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {legacyClasses.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSelectedClasses((prev) => prev.filter((x) => x !== c))}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-amber-500/10"
                          aria-label={`Remove ${c}`}
                        >
                          {c} <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* ---------- SUBJECTS ---------- */}
              <section aria-label="Subjects">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Subjects</p>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedServerClasses.length > 0 ? 'Offered for the selected classes' : 'From the school subject catalog'}
                  </span>
                </div>
                {loading ? (
                  <div className="flex flex-wrap gap-1.5" aria-live="polite">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-7 w-20 rounded-md bg-muted/60 animate-pulse" />
                    ))}
                  </div>
                ) : applicableSubjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedServerClasses.length > 0
                      ? 'No subjects are configured for the selected classes.'
                      : 'No subjects are configured for this school yet.'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {applicableSubjects.map((s) => {
                      const on = selectedSubjects.includes(s)
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setSelectedSubjects((prev) =>
                            on ? prev.filter((x) => x !== s) : [...prev, s],
                          )}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            on
                              ? 'border-primary/40 bg-primary/5 text-foreground font-medium'
                              : 'border-border bg-card text-muted-foreground font-normal hover:bg-accent hover:text-foreground',
                          )}
                        >
                          {on && <Check className="h-3 w-3 text-primary" />} {s}
                        </button>
                      )
                    })}
                  </div>
                )}
                {unofferedSubjects.length > 0 && (
                  <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] px-3 py-2">
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-amber-700 dark:text-amber-400 mb-1.5">
                      Current — not offered for this selection
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {unofferedSubjects.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedSubjects((prev) => prev.filter((x) => x !== s))}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-amber-500/10"
                          aria-label={`Remove ${s}`}
                        >
                          {s} <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* ---------- CONFLICTS (only when they exist) ---------- */}
              {conflicts.length > 0 && (
                <section aria-label="Allocation conflicts">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-amber-700 dark:text-amber-400 mb-2">
                    Already assigned to another teacher
                  </p>
                  <div className="space-y-1.5">
                    {conflicts.map(({ cls, subject, teacher: other }) => (
                      <div
                        key={`${cls}-${subject}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] px-3 py-2"
                      >
                        <p className="text-xs text-foreground min-w-0">
                          <span className="font-medium">{cls}</span>
                          <span className="text-muted-foreground"> · </span>
                          {subject}
                          <span className="text-muted-foreground"> — {other.name}</span>
                        </p>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 px-2.5 text-[11px] border-amber-500/40 text-amber-800 hover:bg-amber-500/10 hover:text-amber-900 shrink-0"
                          onClick={() => {
                            onReplaceConflictTeacher(
                              other.id,
                              other.subjects.filter((s) => s !== subject),
                              other.classes,
                            )
                            toast.success(`Replaced ${other.name}`, {
                              description: `${subject} in ${cls} is now allocated to ${selectedTeacher?.name}.`,
                            })
                          }}
                        >
                          Replace
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* ---------- footer: selection + changes + actions ---------- */}
        <div className="border-t border-border px-5 py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                Selected: {count(selectedSubjects.length, 'subject')} · {count(selectedClasses.length, 'class', 'classes')}
              </p>
              {changes && changes.hasChanges ? (
                <p className="text-[11px] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-muted-foreground">Changes:</span>
                  {changes.addCls.length > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{count(changes.addCls.length, 'class')}</span>}
                  {changes.remCls.length > 0 && <span className="text-destructive/80">−{count(changes.remCls.length, 'class')}</span>}
                  {changes.addSub.length > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{count(changes.addSub.length, 'subject')}</span>}
                  {changes.remSub.length > 0 && <span className="text-destructive/80">−{count(changes.remSub.length, 'subject')}</span>}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">No changes</p>
              )}
            </div>
            <div className="flex items-center gap-2 justify-end w-full sm:w-auto shrink-0">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8">Cancel</Button>
              <Button
                size="sm"
                onClick={onSave}
                disabled={!changes?.hasChanges || loading || errored}
                className="text-xs h-8 bg-primary text-primary-foreground"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
