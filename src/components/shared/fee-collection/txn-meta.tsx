'use client'

/**
 * txn-meta — the shared vocabulary of the canonical fee-collection
 * workflow (src/lib/fee-workflow.ts, mirrored client-side).
 *
 * ONE set of chips/labels rendered by EVERY surface: the teacher's
 * collection table, the principal's verification queue, the student
 * profile payment history — so a payment looks identical everywhere
 * (MASTER TASK §31: design consistency across data permissions).
 */

export type TxnStatus = 'UNDER_VERIFICATION' | 'SUCCESS' | 'REJECTED' | 'REFUNDED' | 'PENDING' | 'FAILED'

export interface TxnStatusMeta {
  label: string
  short: string
  chip: string
  variant: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
  dot: string
}

export const TXN_STATUS_META: Record<string, TxnStatusMeta> = {
  UNDER_VERIFICATION: {
    label: 'Awaiting verification',
    short: 'Pending',
    chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    variant: 'warning',
    dot: 'bg-amber-500',
  },
  SUCCESS: {
    label: 'Verified',
    short: 'Verified',
    chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
    variant: 'success',
    dot: 'bg-emerald-500',
  },
  REJECTED: {
    label: 'Rejected',
    short: 'Rejected',
    chip: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
    variant: 'danger',
    dot: 'bg-rose-500',
  },
  REFUNDED: {
    label: 'Refunded',
    short: 'Refunded',
    chip: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25',
    variant: 'neutral',
    dot: 'bg-slate-500',
  },
  PENDING: {
    label: 'Processing',
    short: 'Processing',
    chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25',
    variant: 'info',
    dot: 'bg-sky-500',
  },
  FAILED: {
    label: 'Failed',
    short: 'Failed',
    chip: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/25',
    variant: 'neutral',
    dot: 'bg-slate-400',
  },
}

export function txnStatusMeta(status: string): TxnStatusMeta {
  return TXN_STATUS_META[status] ?? TXN_STATUS_META.PENDING
}

export const SOURCE_META: Record<string, { label: string }> = {
  CLASS_TEACHER: { label: 'Class Teacher' },
  PRINCIPAL: { label: 'Principal' },
  SCHOOL_OFFICE: { label: 'School Office' },
  ONLINE: { label: 'Online' },
  BANK_TRANSFER: { label: 'Bank Transfer' },
}

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return 'School Office'
  return SOURCE_META[source]?.label ?? source
}

export const METHOD_META: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  NET_BANKING: 'Net Banking',
  BANK_TRANSFER: 'Bank Transfer',
}

export function methodLabel(method: string | null | undefined): string {
  if (!method) return '—'
  return METHOD_META[method] ?? method
}

/** "20 Sep 2026" — the house date format for money surfaces. */
export function txnDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "20 Sep 2026, 4:15 PM" — when the time matters (collection moments). */
export function txnDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
}

/** The one-line source story under a payment:
 *   "Collected by Rohan Mehta" · "Paid through School Office" · … */
export function sourceStory(t: {
  source: string | null
  collectedBy: string | null
}): string {
  if (t.source === 'CLASS_TEACHER') {
    return t.collectedBy ? `Collected by ${t.collectedBy}` : 'Collected by class teacher'
  }
  if (t.source === 'PRINCIPAL') return 'Paid through the Principal'
  if (t.source === 'SCHOOL_OFFICE') return 'Paid through School Office'
  if (t.source === 'ONLINE') return 'Paid online'
  if (t.source === 'BANK_TRANSFER') return 'Bank transfer'
  return t.collectedBy ? `Recorded by ${t.collectedBy}` : 'School record'
}
