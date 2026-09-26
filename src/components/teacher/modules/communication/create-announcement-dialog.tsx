'use client'

/**
 * communication/create-announcement-dialog — publish ONE canonical school
 * announcement (a real Notification row with audience targeting, never
 * per-recipient copies). Permission model (mirrored server-side):
 *   · CLASS-SCOPED audiences (the class teacher's own class — students,
 *     parents or everyone) need only the class-teacher appointment.
 *   · SCHOOL-WIDE audiences additionally need the 'announcements'
 *     position permission (the composer hides them otherwise).
 * Optional schedule (publishAt) + expiry (expiresAt) persist on the row —
 * every feed reader filters through notificationVisibilityWhere, so a
 * scheduled announcement appears for everyone at the same moment and an
 * expired one disappears everywhere.
 */

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Eye, Loader2, Megaphone, Pencil } from 'lucide-react'
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { publishAnnouncement } from './hooks'
import { priorityTone } from './shared'

interface CreateAnnouncementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** the teacher's own class-teacher classes (server-derived id + label) */
  classes: { id: string; label: string }[]
  /** true when the teacher's active permissions allow school-wide reach */
  canAnnounceSchoolWide: boolean
  onPublished: () => void
}

const PRIORITIES = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

const SCHOOL_AUDIENCES = [
  { value: 'whole-school', label: 'Whole School' },
  { value: 'all-teachers', label: 'All Teachers' },
  { value: 'all-parents', label: 'All Parents' },
  { value: 'all-staff', label: 'All Staff' },
]

/** local datetime → "14 Sep 2026, 4:30 PM" for the preview. */
function previewWhen(local: string): string {
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function CreateAnnouncementDialog({
  open,
  onOpenChange,
  classes,
  canAnnounceSchoolWide,
  onPublished,
}: CreateAnnouncementDialogProps) {
  const [step, setStep] = useState<'compose' | 'preview'>('compose')
  const [title, setTitle] = useState('')
  const [audience, setAudience] = useState('')
  const [priority, setPriority] = useState('NORMAL')
  const [message, setMessage] = useState('')
  const [publishAt, setPublishAt] = useState('') // datetime-local; '' = now
  const [expiresAt, setExpiresAt] = useState('')
  const [publishing, setPublishing] = useState(false)

  const defaultAudience = classes[0] ? `class:${classes[0].id}` : SCHOOL_AUDIENCES[0].value

  useEffect(() => {
    if (open) {
      setStep('compose')
      setTitle('')
      setAudience(defaultAudience)
      setPriority('NORMAL')
      setMessage('')
      setPublishAt('')
      setExpiresAt('')
      setPublishing(false)
    }
  }, [open])

  const audienceOptions = useMemo(() => {
    const classOptions = classes.map((c) => [
      { value: `class:${c.id}`, label: `My Class · ${c.label} — Everyone` },
      { value: `class-parents:${c.id}`, label: `My Class · ${c.label} — Parents` },
      { value: `class-students:${c.id}`, label: `My Class · ${c.label} — Students` },
    ])
    return [...classOptions.flat(), ...(canAnnounceSchoolWide ? SCHOOL_AUDIENCES : [])]
  }, [classes, canAnnounceSchoolWide])

  const selectedOption = audienceOptions.find((a) => a.value === audience) ?? null
  const SCHOOL_TAG_LABELS: Record<string, string> = {
    'whole-school': 'Whole school',
    'all-teachers': 'Teachers',
    'all-parents': 'Parents',
    'all-staff': 'Staff',
  }
  const audienceLabelValue = useMemo(() => {
    if (!selectedOption) return '—'
    if (audience.startsWith('class:'))
      return `Class community · ${selectedOption.label.replace('My Class · ', '').replace(' — Everyone', '')}`
    if (audience.startsWith('class-parents:'))
      return `Parents of ${selectedOption.label.replace('My Class · ', '').replace(' — Parents', '')}`
    if (audience.startsWith('class-students:'))
      return `Students of ${selectedOption.label.replace('My Class · ', '').replace(' — Students', '')}`
    return SCHOOL_TAG_LABELS[audience] ?? 'School'
  }, [audience, selectedOption])

  const valid =
    title.trim().length >= 3 && message.trim().length >= 3 && audienceOptions.length > 0 && audience !== ''
  const priorityInfo = priorityTone(priority)

  const handlePublish = async () => {
    if (publishing || !valid) return
    setPublishing(true)
    try {
      const result = await publishAnnouncement({
        title: title.trim(),
        message: message.trim(),
        audience,
        priority,
        publishAt: publishAt ? new Date(publishAt).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      toast.success(
        result.publishAt ? 'Announcement scheduled' : 'Announcement published',
        {
          description: result.publishAt
            ? `Goes live on ${previewWhen(publishAt)} — hidden from every feed until then.`
            : `Visible now to: ${audienceLabelValue}.`,
        },
      )
      onOpenChange(false)
      onPublished()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Announcement could not be published')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {step === 'compose' ? 'New announcement' : 'Preview announcement'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === 'compose'
              ? 'One canonical notice with audience targeting — no duplicate copies per recipient.'
              : 'Exactly what your audience will see. Publish when it reads right.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'compose' ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ch-ann-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ch-ann-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Science fair — volunteers needed"
                maxLength={120}
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <Select value={audience || defaultAudience} onValueChange={setAudience}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    {audienceOptions.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!canAnnounceSchoolWide && (
                  <p className="text-[10px] text-muted-foreground">
                    School-wide audiences need the announcements permission — class audiences
                    always work for a class teacher.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ch-ann-message">
                Message <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="ch-ann-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write the announcement…"
                className="min-h-28 text-sm"
                maxLength={2000}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ch-ann-publish">
                  Publish <span className="text-[10px] font-normal text-muted-foreground">(empty = now)</span>
                </Label>
                <Input
                  id="ch-ann-publish"
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ch-ann-expiry">
                  Expires <span className="text-[10px] font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="ch-ann-expiry"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold">{title.trim() || 'Untitled announcement'}</p>
                <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {audienceLabelValue}
                </span>
                {priority !== 'NORMAL' && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                    <span className={cn('h-1.5 w-1.5 rounded-full', priorityInfo.dot)} aria-hidden="true" />
                    {priorityInfo.label}
                  </span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-foreground/90">
                {message.trim() || 'No message yet.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" aria-hidden="true" />
                  {publishAt ? `Live ${previewWhen(publishAt)}` : 'Live immediately'}
                </span>
                {expiresAt && <span>Expires {previewWhen(expiresAt)}</span>}
                <span>By you</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The notice appears in the Communication Hub and notification feed of everyone in the
              audience — exactly as shown above.
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => (step === 'preview' ? setStep('compose') : onOpenChange(false))}
            disabled={publishing}
            className="flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
          >
            {step === 'preview' ? (
              <>
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Keep editing
              </>
            ) : (
              'Cancel'
            )}
          </button>
          {step === 'compose' ? (
            <button
              onClick={() => valid && setStep('preview')}
              disabled={!valid}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/50 disabled:opacity-60"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Preview
            </button>
          ) : (
            <button
              onClick={() => void handlePublish()}
              disabled={publishing}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {publishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {publishAt ? 'Schedule' : 'Publish'}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
