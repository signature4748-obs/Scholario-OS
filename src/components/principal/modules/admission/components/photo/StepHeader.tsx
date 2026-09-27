import { Camera } from 'lucide-react'

/** Compact step header for the Photo section — icon + title only. The
 *  upload/camera actions and the preview speak for themselves. */
export function PhotoStepHeader({ title = 'Photo' }: { title?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Camera className="h-4 w-4" />
      </div>
      <h2 className="font-display text-sm font-bold tracking-tight">{title}</h2>
    </div>
  )
}
