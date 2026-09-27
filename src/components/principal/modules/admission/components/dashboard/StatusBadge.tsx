import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AdmissionStatus } from '@/lib/store/admission-store'
import { getAdmissionStatusMeta } from '@/lib/store/admission-store/status'

/**
 * Canonical admission status badge (spec §8) — renders from the single
 * ADMISSION_STATUS_META map used by every screen in the module.
 */
export function StatusBadge({ status, className }: { status: AdmissionStatus; className?: string }) {
  const meta = getAdmissionStatusMeta(status)
  return (
    <Badge
      variant="outline"
      title={meta.description}
      className={cn('text-[10px] font-semibold', meta.className, className)}
    >
      {meta.label}
    </Badge>
  )
}
