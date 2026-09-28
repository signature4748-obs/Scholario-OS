'use client'

import { Award, BookOpen, GraduationCap, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StudentRecord } from '@/lib/store/students-store'
import type { StudentProfileRealData } from './profile-real-data'
import { Metric, Section } from './shared'

type Props = { student: StudentRecord; real?: StudentProfileRealData }

export function AcademicsTab({ student, real }: Props) {
  // ── Teacher / server-authorized view: the latest exam with entered
  // marks (real ExamMark rows). No overall grade or class rank exists in
  // this data — only the honest average and per-subject marks. ──────────
  if (real) {
    const exam = real.latestExam ?? null
    if (!exam || exam.subjects.length === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No exam marks entered for this class yet.</p>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{exam.examName}</p>
            <p className="text-[10px] text-muted-foreground">
              Latest exam with entered marks · {exam.subjects.length} subject{exam.subjects.length === 1 ? '' : 's'}
            </p>
          </div>
          <p className={cn(
            'font-display text-lg font-bold tabular-nums shrink-0',
            exam.averagePct < 40 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
          )}>
            {exam.averagePct}%
          </p>
        </div>
        <Section title="Subject Performance">
          <div className="rounded-lg border border-border/60 bg-card/30 overflow-hidden divide-y divide-border/40">
            {exam.subjects.map((sub) => (
              <div key={sub.subjectId} className="p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-sm font-semibold text-foreground truncate">{sub.subjectName}</span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground shrink-0">
                    {sub.marks} / {sub.maxMarks}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', sub.pct >= 90 ? 'bg-emerald-500' : sub.pct >= 40 ? 'bg-amber-500' : 'bg-rose-500')}
                      style={{ width: `${Math.min(100, sub.pct)}%` }}
                    />
                  </div>
                  <span className={cn(
                    'w-11 shrink-0 rounded-full px-2 py-0.5 text-right text-[10px] font-semibold tabular-nums',
                    sub.pct < 40 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                  )}>
                    {sub.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    )
  }

  // ── Principal store view (unchanged) ──────────────────────────────────
  return (
    <div className="space-y-4">
      {/* OVERALL / AVERAGE / RANK — preserved exactly as before */}
      <div className="grid grid-cols-3 gap-2">
        <Metric icon={<GraduationCap className="h-3.5 w-3.5" />} label="Overall" value={student.academics.overallGrade} color="text-violet-600 dark:text-violet-400" />
        <Metric icon={<TrendingUp className="h-3.5 w-3.5" />} label="Average" value={`${student.academics.overallPercent}%`} color="text-emerald-600 dark:text-emerald-400" />
        <Metric icon={<Award className="h-3.5 w-3.5" />} label="Rank" value={`#${student.academics.rankInClass}`} color="text-amber-600 dark:text-amber-400" />
      </div>

      {/* Subject Performance — premium digital report card */}
      <Section title="Subject Performance">
        <div className="rounded-lg border border-border/60 bg-card/30 overflow-hidden divide-y divide-border/40">
          {student.academics.subjects.map((subj, i) => {
            const pct = subj.percent
            const pctColor = pct >= 90 ? 'text-emerald-600 dark:text-emerald-400'
              : pct >= 75 ? 'text-amber-600 dark:text-amber-400'
              : pct >= 50 ? 'text-violet-600 dark:text-violet-400'
              : 'text-rose-600 dark:text-rose-400'
            const barColor = pct >= 90 ? 'bg-emerald-500'
              : pct >= 75 ? 'bg-amber-500'
              : pct >= 50 ? 'bg-violet-500'
              : 'bg-rose-500'
            const badgeBg = pct >= 90 ? 'bg-emerald-500/10 text-emerald-700'
              : pct >= 75 ? 'bg-amber-500/10 text-amber-700'
              : pct >= 50 ? 'bg-violet-500/10 text-violet-700'
              : 'bg-rose-500/10 text-rose-700'

            return (
              <div key={i} className="p-3">
                {/* Subject header row */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-sm font-semibold text-foreground truncate">{subj.name}</span>
                  </div>
                  <span className={cn('text-sm font-bold tabular-nums shrink-0', pctColor)}>
                    {pct}%
                  </span>
                </div>

                {/* Compact thin progress + teacher + grade in one line */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">{subj.teacher}</span>
                  <span className={cn('text-[9px] shrink-0 rounded-full px-2 py-0.5 font-semibold', badgeBg)}>{subj.grade}</span>
                </div>
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
