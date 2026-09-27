'use client'

/**
 * DossierSummary — the official-record header of the Admission Dossier
 * (Wave 2 spec §5/§6).
 *
 * Hierarchy: IDENTITY → ADMISSION DETAILS → ACADEMIC ALLOCATION, followed
 * by PARENT / GUARDIAN, DOCUMENT STATUS, FEE STATUS and TIMELINE sections.
 * Concise labels, no marketing copy, whitespace instead of text.
 */
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GraduationCap, Users, FileStack, Wallet, History, User } from 'lucide-react'
import { formatDate, formatINR } from '@/lib/format'
import type { AdmissionApplication } from '@/lib/store/admission-store'
import { getAdmissionStatusMeta } from '@/lib/store/admission-store/status'
import type { IssuanceArtifacts } from './letter-data'
import { evaluateRequiredDocs, summarizeDocGroup, REQUIRED_DOCS, OPTIONAL_DOCS } from '../../lib/documents'
import type { AdmissionFeeSummary } from '../../lib/fee-summary'

interface DossierSummaryProps {
  app: AdmissionApplication
  artifacts: IssuanceArtifacts
  feeSummary: AdmissionFeeSummary
  verificationEnabled: boolean
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{label}</dt>
      <dd className={`text-sm font-semibold text-foreground truncate ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </dd>
    </div>
  )
}

function DossierSection({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/70">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-foreground">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

export function DossierSummary({ app, artifacts, feeSummary, verificationEnabled }: DossierSummaryProps) {
  const f = app.formData
  const statusMeta = getAdmissionStatusMeta(app.status)
  const fullName = `${f.firstName} ${f.lastName}`.trim()

  const requiredIssues = evaluateRequiredDocs(f.docStatuses || {})
  const missingRequired = requiredIssues.filter((i) => i.kind === 'missing').length
  const reqDocs = summarizeDocGroup(REQUIRED_DOCS, f.docStatuses || {}, verificationEnabled)
  const optDocs = summarizeDocGroup(OPTIONAL_DOCS, f.docStatuses || {}, verificationEnabled)

  const timeline = [
    { label: 'Submitted', value: app.submittedDate },
    ...(app.decisionDate ? [{ label: 'Decision', value: `${app.decisionDate} · ${app.status === 'Rejected' ? 'Rejected' : 'Approved'}` }] : []),
    ...(app.status === 'Completed' ? [{ label: 'Admission Issued', value: app.lastUpdatedDate }] : []),
  ]

  return (
    <div className="space-y-4">
      {/* ── ADMISSION CONFIRMATION — identity + key identifiers ── */}
      <Card className="border-border/70">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Admission Confirmation</h2>
            <Badge variant="outline" className={`text-[11px] font-bold ${statusMeta.className}`}>
              {statusMeta.label}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-base">
              {fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-foreground truncate">{fullName || '—'}</p>
              <p className="text-xs text-muted-foreground">
                {f.dob ? `DOB ${formatDate(f.dob)}` : ''}{f.gender ? ` · ${f.gender}` : ''}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3">
            <Field label="Admission No." value={artifacts.admissionNo} mono />
            <Field label="Student ID" value={artifacts.studentId} mono />
            <Field label="Class" value={`${f.className}${f.section ? `-${f.section}` : ''}`} />
            <Field label="Roll No." value={artifacts.rollNo} mono />
            <Field label="Session" value={app.academicSession || '—'} />
            <Field label="Reg. No." value={artifacts.regNo} mono />
          </dl>
        </CardContent>
      </Card>

      {/* ── PARENT / GUARDIAN ── */}
      <DossierSection icon={Users} title="Parent / Guardian">
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
          <Field label="Father" value={f.fatherName || '—'} />
          <Field label="Mother" value={f.motherName || '—'} />
          <Field label="Primary Phone" value={f.fatherPhone || f.motherPhone || '—'} mono />
        </dl>
      </DossierSection>

      {/* ── DOCUMENT STATUS ── */}
      <DossierSection icon={FileStack} title="Document Status">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10 px-3 py-2.5">
            <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300">Required</p>
            <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
              {reqDocs.total} total · {reqDocs.uploaded} uploaded
              {verificationEnabled && reqDocs.pending > 0 ? ` · ${reqDocs.pending} pending` : ''}
              {reqDocs.deferred > 0 ? ` · ${reqDocs.deferred} deferred` : ''}
            </p>
            {missingRequired > 0 && (
              <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 mt-1">
                {missingRequired} missing — enrollment blocked
              </p>
            )}
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 dark:bg-cyan-500/10 px-3 py-2.5">
            <p className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300">Optional</p>
            <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
              {optDocs.total} total · {optDocs.uploaded} uploaded
            </p>
          </div>
        </div>
      </DossierSection>

      {/* ── FEE STATUS (canonical fee engine) ── */}
      <DossierSection icon={Wallet} title="Fee Status">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          <Field label="Gross Fee" value={formatINR(feeSummary.grossFee)} mono />
          <Field label="Concession" value={feeSummary.totalDiscount > 0 ? `− ${formatINR(feeSummary.totalDiscount)}` : '—'} mono />
          <Field label="Net Payable" value={formatINR(feeSummary.netTotal)} mono />
          <Field label="Payment Mode" value={app.feeData?.paymentMethod || 'Online Banking'} />
        </dl>
      </DossierSection>

      {/* ── TIMELINE ── */}
      <DossierSection icon={History} title="Timeline">
        <ol className="space-y-2">
          {timeline.map((t, i) => (
            <li key={i} className="flex items-center gap-3 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span className="text-muted-foreground w-32 shrink-0">{t.label}</span>
              <span className="font-medium text-foreground tabular-nums">{t.value}</span>
            </li>
          ))}
        </ol>
      </DossierSection>
    </div>
  )
}
