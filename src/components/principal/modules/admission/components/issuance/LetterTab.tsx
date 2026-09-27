'use client'

import { OfficialAdmissionLetter } from '../../../OfficialAdmissionLetter'
import type { IssuanceArtifacts } from './letter-data'

interface LetterTabProps {
  artifacts: IssuanceArtifacts
  onBack: () => void
}

/**
 * The OFFICIAL DOCUMENT of an issued admission: the admission letter
 * (print/download live in its own action bar). Sensitive demographic
 * data is excluded from the letter by the Official Documents display
 * policy — silently, without a banner announcing it.
 */
export function LetterTab({ artifacts, onBack }: LetterTabProps) {
  return <OfficialAdmissionLetter data={artifacts.letterData} onClose={onBack} />
}
