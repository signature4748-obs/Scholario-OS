/**
 * Canonical admission status model (Wave 2 spec §8).
 *
 * ONE meaning per status — the list, detail page, verification workspace,
 * issuance dossier and dashboard all render badges from this single map.
 * The underlying state machine (AdmissionStatus in ./types) is unchanged;
 * this file only standardizes PRESENTATION.
 */
import {
  FileText, Clock, AlertTriangle, CheckCircle2, UserCheck,
  XCircle, Archive, RefreshCw,
} from 'lucide-react'
import type { AdmissionStatus } from './types'

export interface AdmissionStatusMeta {
  /** Canonical display label (used everywhere). */
  label: string
  /** One-line meaning for tooltips / accessible descriptions. */
  description: string
  /** Badge text/border classes (Tailwind, dark-mode aware). */
  className: string
  /** Dot color for compact indicators. */
  dotClass: string
  icon: typeof Clock
}

export const ADMISSION_STATUS_META: Record<AdmissionStatus, AdmissionStatusMeta> = {
  Draft: {
    label: 'Draft',
    description: 'Saved but not yet submitted',
    className: 'bg-muted/60 text-muted-foreground border-border',
    dotClass: 'bg-muted-foreground/50',
    icon: FileText,
  },
  Submitted: {
    label: 'Submitted',
    description: 'Waiting for the admission office to start review',
    className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
    dotClass: 'bg-sky-500',
    icon: Clock,
  },
  'Under Review': {
    label: 'Under Review',
    description: 'Verification checklist in progress',
    className: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30',
    dotClass: 'bg-teal-500',
    icon: Clock,
  },
  'Need Correction': {
    label: 'Needs Correction',
    description: 'Returned to applicant for corrections',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-500',
    icon: AlertTriangle,
  },
  Resubmitted: {
    label: 'Resubmitted',
    description: 'Corrections received — back in review',
    className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
    dotClass: 'bg-sky-500',
    icon: RefreshCw,
  },
  Approved: {
    label: 'Approved',
    description: 'Cleared for admission issuance',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  Completed: {
    label: 'Issued & Enrolled',
    description: 'Admission issued — student is enrolled',
    className: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30',
    dotClass: 'bg-teal-500',
    icon: UserCheck,
  },
  Rejected: {
    label: 'Rejected',
    description: 'Application rejected (retention policy applies)',
    className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    dotClass: 'bg-rose-500',
    icon: XCircle,
  },
  Archived: {
    label: 'Archived',
    description: 'Historical record — read only',
    className: 'bg-muted/60 text-muted-foreground border-border',
    dotClass: 'bg-muted-foreground/50',
    icon: Archive,
  },
}

export function getAdmissionStatusMeta(status: AdmissionStatus): AdmissionStatusMeta {
  return ADMISSION_STATUS_META[status] ?? ADMISSION_STATUS_META.Draft
}
