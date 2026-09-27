'use client'

/**
 * Scanned-form provenance badge — shown at the top of the wizard when the
 * draft was populated from a scanned paper form (spec §35: subtle, only
 * when useful — no technical OCR vocabulary).
 */
import { Paperclip } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function ScannedAttachmentBadge({
  attachment,
}: {
  attachment: { fileName: string; date: string; confidence: number }
}) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Paperclip className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="truncate">
          Imported from scanned form — <strong className="font-semibold">{attachment.fileName}</strong> ({attachment.confidence}% read confidence)
        </span>
      </div>
      <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-none text-[10px] shrink-0">
        Scanned Form
      </Badge>
    </div>
  )
}
