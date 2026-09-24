'use client'

/**
 * results/remark — TEACHER'S FEEDBACK.
 *
 * The school's published subject remarks as elegant attributed quotes
 * sitting directly on the page: a hairline VIOLET accent (the academic
 * voice — distinct from the emerald of positive metrics), the words in
 * the foreground, the subject beneath. No shell card, no fabricated
 * encouragement — when the declared exam carries no remarks the section
 * says so quietly. (The exam-level remark with its "Class Teacher · 2-A"
 * attribution belonged to the retired client-side seed — only real
 * subject remarks from the server render here.)
 */

import { MessageSquareQuote } from 'lucide-react'
import { SectionLabel } from '../../shell/page-header'

/** A real remark the school entered against one subject row. */
export interface SubjectRemark {
  subject: string
  text: string
}

export function Remark({ remarks }: { remarks: SubjectRemark[] }) {
  return (
    <section aria-label="Teacher's feedback" className="flex h-full flex-col">
      <SectionLabel>Teacher&apos;s Feedback</SectionLabel>

      {remarks.length > 0 ? (
        <div className="mt-2.5 flex h-full flex-col gap-2.5">
          {remarks.map((r) => (
            <figure key={r.subject} className="flex h-full flex-col rounded-r-lg border-l-2 border-violet-500/60 bg-violet-500/[0.045] py-3 pl-4 pr-3.5 dark:bg-violet-500/[0.07]">
              <blockquote className="text-sm leading-relaxed text-foreground/90">&ldquo;{r.text}&rdquo;</blockquote>
              <figcaption className="mt-auto flex items-center gap-2.5 pt-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400" aria-hidden>
                  <MessageSquareQuote className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">{r.subject}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">Subject remark</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="mt-2.5 flex flex-1 items-center gap-2.5 rounded-r-lg border-l-2 border-border/70 bg-muted/25 px-4 py-5">
          <MessageSquareQuote className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
          <p className="text-xs text-muted-foreground">No teacher remark was published with this result.</p>
        </div>
      )}
    </section>
  )
}
