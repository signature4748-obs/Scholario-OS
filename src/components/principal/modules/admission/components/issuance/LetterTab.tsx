'use client'

import { Button } from '@/components/ui/button'
import { ShieldCheck } from 'lucide-react'
import { OfficialAdmissionLetter } from '../../../OfficialAdmissionLetter'
import type { IssuanceArtifacts } from './letter-data'

interface LetterTabProps {
  artifacts: IssuanceArtifacts
  onBack: () => void
}

export function LetterTab({ artifacts, onBack }: LetterTabProps) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3">
        <span className="flex items-start gap-2 min-w-0">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong className="font-semibold">Privacy policy active</strong> — sensitive details (Aadhaar,
            Religion, Category, Blood Group, medical) are excluded from this letter. Configure exposure in
            Admissions → Settings → Documents &amp; Privacy.
          </span>
        </span>
        <Button size="sm" variant="outline" onClick={() => window.print()} className="h-7 text-xs bg-white text-foreground shrink-0">
          Print Letter
        </Button>
      </div>

      <OfficialAdmissionLetter data={artifacts.letterData} onClose={onBack} />
    </div>
  )
}
