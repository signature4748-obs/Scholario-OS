'use client'

/**
 * Scanned Form Attachment Badge.
 *
 * Shown at the top of the wizard when the draft was populated from a
 * scanned form — summarises the file name and the engine's confidence.
 */
import { Paperclip } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function ScannedAttachmentBadge({
  attachment,
}: {
  attachment: { fileName: string; date: string; confidence: number }
}) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-300">
      <div className="flex items-center gap-2 min-w-0">
        <Paperclip className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="min-w-0">
          Draft populated from <strong className="font-semibold">{attachment.fileName}</strong>
          <span className="text-emerald-700/80 dark:text-emerald-400/80"> · read at {attachment.confidence}% confidence — please verify each section before submitting.</span>
        </span>
      </div>
      <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-none text-[10px] shrink-0">
        Scanned Form Attached
      </Badge>
    </div>
  )
}
