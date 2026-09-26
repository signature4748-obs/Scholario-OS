'use client'

/**
 * communication/new-message-dialog — the hub's single composer. The
 * audience selector is permission-aware BY CONSTRUCTION (every option is
 * derived from the server payload):
 *
 *   · Parents        — guardians of the teacher's authorized students.
 *                      Multi-select covers BOTH "individual parent" and
 *                      "selected parents from my class"; each message
 *                      lands in (or opens) that guardian's real thread.
 *   · Students       — in-scope students with an ACTIVE account (the
 *                      school's account policy is the gate). Direct
 *                      Message rows the student's Messages module shows.
 *   · My Class       — ONLY the classes the teacher is appointed class
 *                      teacher of (server-derived teacher.classes): the
 *                      Parents / Students / Everyone groups. Real rows
 *                      via /message-class (never another teacher's class,
 *                      never a school-wide blast).
 *   · Staff          — same-school staff (leadership + colleagues).
 *
 * Nothing is simulated: every send hits a canonical endpoint that
 * re-validates scope server-side.
 */

import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Send, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type {
  ConversationCategory,
  MessageTemplateItem,
  ParentLinkableStudent,
} from '@/lib/teacher-hub-types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  sendClassGroupMessage,
  sendDirectMessage,
  sendMessageToParent,
} from './hooks'
import { applyTemplateBody, CATEGORY_OPTIONS, roleLabel } from './shared'
import type { StaffDirectoryEntry } from './types'

type AudienceType = 'parent' | 'student' | 'class' | 'staff'
type ClassGroupAudience = 'parents' | 'students' | 'everyone'

interface NewMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  students: ParentLinkableStudent[]
  templates: MessageTemplateItem[]
  staffDirectory: StaffDirectoryEntry[]
  teacherName: string
  /** the teacher's appointed classes (id + label) — My Class groups */
  classes: { id: string; label: string }[]
  /** a parent conversation was created (or reused) — open its thread */
  onOpenedParent: (conversationId: string) => void
  /** a staff/student direct message was sent — open the direct thread */
  onOpenedDirect: (counterpartId: string) => void
  onSent: () => void
}

/** Staff grouped by role, leadership first — mirrors how a school thinks. */
const ROLE_ORDER = ['PRINCIPAL', 'MANAGEMENT', 'COORDINATOR', 'TEACHER']

const CLASS_GROUP_OPTIONS: { value: ClassGroupAudience; label: string; hint: string }[] = [
  { value: 'parents', label: 'Parents', hint: 'Every guardian thread of the class' },
  { value: 'students', label: 'Students', hint: 'Students with an active account' },
  { value: 'everyone', label: 'Everyone', hint: 'Parents and students together' },
]

export function NewMessageDialog({
  open,
  onOpenChange,
  students,
  templates,
  staffDirectory,
  teacherName,
  classes,
  onOpenedParent,
  onOpenedDirect,
  onSent,
}: NewMessageDialogProps) {
  const [type, setType] = useState<AudienceType>('parent')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [category, setCategory] = useState<ConversationCategory>('general')
  const [templateId, setTemplateId] = useState<string>('none')
  const [staffId, setStaffId] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [classId, setClassId] = useState('')
  const [classAudience, setClassAudience] = useState<ClassGroupAudience>('parents')
  const [query, setQuery] = useState('')

  const parentable = useMemo(
    () => students.filter((s) => s.parentUserId != null),
    [students],
  )
  const directable = useMemo(
    () => students.filter((s) => s.studentUserId != null),
    [students],
  )
  const selectedClass = classes.find((c) => c.id === classId) ?? classes[0] ?? null

  // Fresh form on every open.
  useEffect(() => {
    if (open) {
      setType('parent')
      setSelectedIds(new Set())
      setCategory('general')
      setTemplateId('none')
      setStaffId('')
      setSubject('')
      setMessage('')
      setSending(false)
      setClassId(classes[0]?.id ?? '')
      setClassAudience('parents')
      setQuery('')
    }
  }, [open])

  const activeList = type === 'parent' ? parentable : directable
  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return activeList
    return activeList.filter(
      (s) =>
        s.student.name.toLowerCase().includes(q) ||
        s.student.classLabel.toLowerCase().includes(q),
    )
  }, [activeList, query])

  // Recipient estimates for the My Class group (derived from the real
  // in-scope roster the payload already carries).
  const classEstimate = useMemo(() => {
    if (!selectedClass) return { parents: 0, students: 0 }
    const roster = students.filter((s) => s.student.classId === selectedClass.id)
    return {
      parents: roster.filter((s) => s.parentUserId != null).length,
      students: roster.filter((s) => s.studentUserId != null).length,
    }
  }, [selectedClass, students])

  const selectedStaff = staffDirectory.find((s) => s.id === staffId) ?? null
  const staffByRole = ROLE_ORDER.map((role) => ({
    role,
    label: roleLabel(role),
    members: staffDirectory.filter((s) => s.role === role),
  })).filter((g) => g.members.length > 0)

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canSend =
    type === 'parent'
      ? selectedIds.size > 0 && message.trim().length > 0
      : type === 'student'
        ? selectedIds.size > 0 && subject.trim().length > 0 && message.trim().length > 0
        : type === 'class'
          ? selectedClass != null && message.trim().length > 0
          : selectedStaff != null && subject.trim().length > 0 && message.trim().length > 0

  const handleTemplate = (id: string) => {
    setTemplateId(id)
    const t = templates.find((x) => x.id === id)
    if (t) {
      const first = [...selectedIds][0]
      const target = students.find((s) => s.student.id === first)
      setMessage(applyTemplateBody(t.body, target ? target.student.name.split(' ')[0] : '', teacherName))
    }
  }

  const handleSubmit = async () => {
    if (sending || !canSend) return
    setSending(true)
    try {
      if (type === 'parent') {
        const targets = parentable.filter((s) => selectedIds.has(s.student.id))
        let lastConversationId: string | null = null
        for (const t of targets) {
          const result = await sendMessageToParent({
            studentId: t.student.id,
            category,
            message: message.trim(),
          })
          lastConversationId = result.conversationId
        }
        toast.success('Message sent', {
          description: `${targets.length} guardian thread${targets.length === 1 ? '' : 's'}${
            lastConversationId ? ' — opening the latest' : ''
          }.`,
        })
        onSent()
        if (lastConversationId) onOpenedParent(lastConversationId)
      } else if (type === 'student') {
        const targets = directable.filter((s) => selectedIds.has(s.student.id))
        let lastId: string | null = null
        for (const t of targets) {
          await sendDirectMessage(t.studentUserId!, {
            subject: subject.trim(),
            body: message.trim(),
          })
          lastId = t.studentUserId
        }
        toast.success('Message sent', {
          description: `Delivered to ${targets.length} student account${targets.length === 1 ? '' : 's'}.`,
        })
        onSent()
        if (lastId) onOpenedDirect(lastId)
      } else if (type === 'class') {
        if (!selectedClass) return
        const result = await sendClassGroupMessage({
          classId: selectedClass.id,
          audience: classAudience,
          message: message.trim(),
          category,
        })
        toast.success(`Sent to ${selectedClass.label}`, {
          description:
            `${result.parentsReached} parent thread${result.parentsReached === 1 ? '' : 's'}` +
            `${classAudience !== 'parents' ? ` · ${result.studentsReached} student account${result.studentsReached === 1 ? '' : 's'}` : ''}` +
            ` · ${result.totalStudents} students in the class.`,
        })
        onSent()
        onOpenedParent(result.parentConversationIds[0] ?? '')
        if (!result.parentConversationIds.length) onOpenChange(false)
      } else {
        if (!selectedStaff) return
        await sendDirectMessage(selectedStaff.id, {
          subject: subject.trim(),
          body: message.trim(),
        })
        toast.success('Message sent', { description: `To ${selectedStaff.name}` })
        onSent()
        onOpenedDirect(selectedStaff.id)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Message could not be sent')
    } finally {
      setSending(false)
    }
  }

  const audienceTabs: { id: AudienceType; label: string; available: boolean }[] = [
    { id: 'parent', label: 'Parents', available: parentable.length > 0 },
    { id: 'student', label: 'Students', available: directable.length > 0 },
    { id: 'class', label: 'My Class', available: classes.length > 0 },
    { id: 'staff', label: 'Staff', available: staffDirectory.length > 0 },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">New message</DialogTitle>
          <DialogDescription className="text-xs">
            Message guardians, students, your class group or a colleague — every option is
            scope-checked by the school&apos;s records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Audience type — only the audiences the teacher may reach */}
          <div className="space-y-1.5">
            <Label>To</Label>
            <div
              className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/30 p-1 sm:grid-cols-4"
              role="group"
              aria-label="Audience type"
            >
              {audienceTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setType(t.id)
                    setSelectedIds(new Set())
                  }}
                  aria-pressed={type === t.id}
                  disabled={!t.available}
                  title={
                    t.available
                      ? undefined
                      : t.id === 'class'
                        ? 'Only class teachers can message a class group'
                        : 'No reachable recipients'
                  }
                  className={cn(
                    'rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
                    type === t.id
                      ? 'bg-card font-semibold text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {type === 'parent' || type === 'student' ? (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="nm-search">
                    {type === 'parent' ? 'Select guardians' : 'Select students'}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                </div>
                <Input
                  id="nm-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or class…"
                  className="h-8 text-xs"
                />
                <div
                  className="max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-border bg-card/60 p-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 [&::-webkit-scrollbar]:w-1.5"
                  role="listbox"
                  aria-multiselectable
                >
                  {filteredList.length === 0 ? (
                    <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">
                      {activeList.length === 0
                        ? type === 'parent'
                          ? 'No students in your scope have a linked guardian account.'
                          : 'No students in your scope have an active student account.'
                        : 'No match.'}
                    </p>
                  ) : (
                    filteredList.map((s) => {
                      const checked = selectedIds.has(s.student.id)
                      return (
                        <button
                          key={s.student.id}
                          type="button"
                          role="option"
                          aria-selected={checked}
                          onClick={() => toggleStudent(s.student.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                            checked ? 'bg-primary/10' : 'hover:bg-muted/60',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                              checked
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-card',
                            )}
                            aria-hidden="true"
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">
                              {s.student.name}{' '}
                              <span className="font-normal text-muted-foreground">
                                · {s.student.classLabel}
                                {s.student.rollNo ? ` · Roll ${s.student.rollNo}` : ''}
                              </span>
                            </span>
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {type === 'parent'
                                ? s.existingConversationId
                                  ? `Guardian: ${s.guardianName ?? 'Guardian'} — continues the open thread`
                                  : `Guardian: ${s.guardianName ?? 'Guardian'}`
                                : 'Student account · appears in their Messages'}
                            </span>
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
                {type === 'parent' && selectedIds.size > 1 && (
                  <p className="text-[11px] text-muted-foreground">
                    Each guardian receives the message in their own thread with you — replies stay
                    individual.
                  </p>
                )}
              </div>

              {type === 'parent' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as ConversationCategory)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Template</Label>
                    <Select value={templateId} onValueChange={handleTemplate}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No template</SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate">{t.label}</span>
                              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {t.category}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {type === 'student' && (
                <div className="space-y-1.5">
                  <Label htmlFor="nm-subject-student">
                    Subject <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nm-subject-student"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What is this about?"
                    maxLength={200}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="nm-multi-message">
                  Message <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="nm-multi-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    type === 'parent' ? 'Write to the guardian(s)…' : 'Write to the student(s)…'
                  }
                  className="min-h-24 text-sm"
                />
              </div>
            </>
          ) : type === 'class' ? (
            <>
              {classes.length > 1 && (
                <div className="space-y-1.5">
                  <Label>Class</Label>
                  <Select value={selectedClass?.id ?? ''} onValueChange={setClassId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          My Class · {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>
                  Group <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/30 p-1" role="group" aria-label="Class group">
                  {CLASS_GROUP_OPTIONS.map((o) => {
                    const estimate =
                      o.value === 'parents'
                        ? classEstimate.parents
                        : o.value === 'students'
                          ? classEstimate.students
                          : classEstimate.parents + classEstimate.students
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setClassAudience(o.value)}
                        aria-pressed={classAudience === o.value}
                        title={o.hint}
                        className={cn(
                          'rounded-md px-2 py-1.5 text-xs transition-colors',
                          classAudience === o.value
                            ? 'bg-card font-semibold text-foreground shadow-sm'
                            : 'font-medium text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {o.label}
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          ~{estimate}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {classAudience === 'parents'
                    ? 'Every guardian receives it in their own thread with you — replies stay individual.'
                    : classAudience === 'students'
                      ? 'Only students with an active account receive it in their Messages.'
                      : 'Parents in their threads and students in their Messages.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as ConversationCategory)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Template</Label>
                  <Select value={templateId} onValueChange={handleTemplate}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No template</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{t.label}</span>
                            <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {t.category}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nm-class-message">
                  Message <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="nm-class-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Write to ${selectedClass ? selectedClass.label : 'your class'}…`}
                  className="min-h-24 text-sm"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="nm-staff">Recipient</Label>
                <Select value={staffId} onValueChange={setStaffId}>
                  <SelectTrigger id="nm-staff" className="w-full">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffByRole.map((g) => (
                      <SelectGroup key={g.role}>
                        <SelectLabel className="text-[10px] uppercase tracking-wide">
                          {g.label}
                        </SelectLabel>
                        {g.members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nm-subject">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nm-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What is this about?"
                  maxLength={200}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nm-staff-message">
                  Message <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="nm-staff-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message…"
                  className="min-h-24 text-sm"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => onOpenChange(false)}
            disabled={sending}
            className="rounded-xl px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={sending || !canSend}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : type === 'class' ? (
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {sending
              ? 'Sending…'
              : type === 'class'
                ? `Send to ${selectedClass ? selectedClass.label : 'class'}`
                : type === 'parent' || type === 'student'
                  ? selectedIds.size > 1
                    ? `Send to ${selectedIds.size} recipients`
                    : 'Send Message'
                  : 'Send Message'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
