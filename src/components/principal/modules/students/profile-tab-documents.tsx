'use client'

/**
 * DocumentsTab — the student's on-file document record (Principal store
 * view). Documents are office-held metadata records (title · type ·
 * verified · uploaded date) — there is no downloadable file behind them,
 * so the tab renders an honest read-only list with verification status
 * and an explicit empty state. No decorative download affordance.
 */

import { CheckCircle2, FileText, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StudentRecord } from '@/lib/store/students-store'
import { Section } from './shared'

type Props = { student: StudentRecord }

export function DocumentsTab({ student }: Props) {
  return (
    <div className="space-y-4">
      <Section title="Student Documents">
        {student.documents.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/40 p-6 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-medium">No documents on file</p>
            <p className="text-xs text-muted-foreground mt-1">
              Documents submitted to the admissions office will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {student.documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', doc.verified ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}>
                  {doc.verified ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-[11px] text-muted-foreground">{doc.type} · Uploaded {formatDate(doc.uploadedDate)}</p>
                </div>
                <Badge variant={doc.verified ? 'default' : 'secondary'} className="text-[10px]">{doc.verified ? 'Verified' : 'Pending'}</Badge>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground px-1">
              Originals are held with the school office — verification status is shown per document.
            </p>
          </div>
        )}
      </Section>
    </div>
  )
}
