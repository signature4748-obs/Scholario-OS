import type React from 'react'
import {
  User, Users, MapPin, School, HeartPulse, GraduationCap, Wallet,
  FileText, Camera,
} from 'lucide-react'
import type { SectionKey } from '@/lib/store/admission-store'
import type { AdmissionDocumentPolicy } from '@/lib/store/school-settings-store'
import { getCollectedDocuments } from '../../lib/documents'

export interface SectionConfig {
  key: SectionKey
  title: string
  icon: React.ElementType
}

export interface SectionVisibilityFlags {
  enableMedical?: boolean
  enablePreviousSchool?: boolean
  enableStudentPhoto?: boolean
}

/**
 * Build the verification checklist, filtered by the admission feature
 * flags AND the school's document policy. The section count is derived
 * from the school's ACTUAL configuration — nothing is hardcoded (spec
 * §16/§36). Settings like `enableMedical`, `enablePreviousSchool`, and
 * `enableStudentPhoto` really hide the corresponding sections; when the
 * school collects no documents at all, the Documents section disappears.
 */
export function getSectionsConfig(
  flags: SectionVisibilityFlags = {},
  documentPolicy?: AdmissionDocumentPolicy
): SectionConfig[] {
  const sections: SectionConfig[] = [
    { key: 'personal', title: 'Personal', icon: User },
    { key: 'parents', title: 'Parents & Emergency Contact', icon: Users },
    { key: 'address', title: 'Address', icon: MapPin },
  ]

  if (flags.enablePreviousSchool !== false) {
    sections.push({ key: 'previousSchool', title: 'Previous School', icon: School })
  }

  if (flags.enableMedical !== false) {
    sections.push({ key: 'medical', title: 'Medical', icon: HeartPulse })
  }

  sections.push({ key: 'classAllocation', title: 'Class & Section', icon: GraduationCap })
  sections.push({ key: 'fees', title: 'Fee / Financial', icon: Wallet })

  if (getCollectedDocuments(documentPolicy).length > 0) {
    sections.push({ key: 'documents', title: 'Documents', icon: FileText })
  }

  if (flags.enableStudentPhoto !== false) {
    sections.push({ key: 'photo', title: 'Photo', icon: Camera })
  }

  return sections
}
