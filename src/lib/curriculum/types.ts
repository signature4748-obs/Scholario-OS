/**
 * curriculum/types — the GLOBAL curriculum library contract.
 *
 * The library is the single source of truth for OFFICIAL board curricula
 * (NCERT / CBSE), keyed by academic session + class level + subject. It is
 * IMMUTABLE code data: schools never mutate it — they instantiate their own
 * school-scoped CurriculumTopic rows from it (see prisma + lesson-planner).
 *
 * Hierarchy (spec §9):  Session → Class → Subject → Unit/Part → Chapter →
 * (description carries the chapter's scope). Books whose official structure
 * uses Units/Parts/Themes preserve those as units; flat chapter-list books
 * use a single book-level unit. Nothing is invented — every chapter below
 * was verified against the current official textbook structure.
 */

/** Canonical subject keys the library knows. */
export type CurriculumSubjectKey =
  | 'mathematics'
  | 'science'
  | 'english'
  | 'hindi'
  | 'social-science'
  | 'computer-applications'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'accountancy'
  | 'business-studies'
  | 'economics'
  | 'history'
  | 'political-science'
  | 'geography'

/** One chapter (the plan row a teacher schedules and completes). */
export interface CurriculumTopicSeed {
  /** Exact official chapter title. */
  name: string
  /** Short official scope of the chapter. */
  description: string
  /** Estimated teaching periods incl. practice/assessment. */
  periods: number
}

/** A unit / part / book-section grouping. */
export interface CurriculumUnitSeed {
  unitNo: number
  unitName: string
  topics: CurriculumTopicSeed[]
}

/** One subject's official curriculum for a class in a session. */
export interface SubjectCurriculum {
  key: CurriculumSubjectKey
  /** Display label, e.g. "Mathematics". */
  subjectLabel: string
  /** Book + source label, e.g. "Ganita Manjari — NCERT (Class 9, 2026-27)". */
  bookLabel: string
  /** Persisted traceability tag on instantiated rows, e.g. "NCERT-2026-27". */
  sourceBoard: string
  units: CurriculumUnitSeed[]
  /** Optional note surfaced in the syllabus library card. */
  note?: string
}

/** All subjects offered for one class level in a session. */
export interface ClassCurriculum {
  classLevel: number
  label: string
  subjects: SubjectCurriculum[]
}
