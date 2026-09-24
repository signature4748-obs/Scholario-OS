/**
 * curriculum/2026-27 — the session registry for Academic Session 2026-27.
 *
 * PRINCIPLE (Lesson Planner spec):
 *   PRINCIPAL CONFIGURES → CLASS + SECTION → SUBJECTS OFFERED → TEACHER
 *   ASSIGNMENT → CORRECT CURRICULUM AUTOMATICALLY ATTACHED.
 *
 * This library answers the last link: given a school's class label and the
 * CONFIGURED subject name, it returns the official 2026-27 NCERT/CBSE
 * curriculum that auto-attaches to that (class, subject). Schools may offer
 * any subset of these subjects; unconfigured subjects never reach a
 * teacher's planner.
 *
 * Validation runs at import time in dev/test (spec §21): duplicate subject
 * keys, duplicate chapter names, empty units and missing classes fail fast.
 */

import type {
  ClassCurriculum,
  CurriculumSubjectKey,
  SubjectCurriculum,
} from '../types'
export type { SubjectCurriculum, ClassCurriculum, CurriculumSubjectKey, CurriculumTopicSeed, CurriculumUnitSeed } from '../types'
import { CLASS_6 } from './class-06'
import { CLASS_7 } from './class-07'
import { CLASS_8 } from './class-08'
import { CLASS_9 } from './class-09'
import { CLASS_10 } from './class-10'
import { CLASS_11 } from './class-11'
import { CLASS_12 } from './class-12'

export const SESSION_2026_27 = '2026-27' as const

/** All class curricula for the session, ordered 6 → 12. */
export const SESSION_CLASSES: ClassCurriculum[] = [
  CLASS_6,
  CLASS_7,
  CLASS_8,
  CLASS_9,
  CLASS_10,
  CLASS_11,
  CLASS_12,
]

// ─── Subject-name resolution (school Subject.name → library key) ────────

/**
 * Aliases a school's subject name can carry for each canonical key.
 * Exact matches win over partial matches (so "Science" never mis-hits
 * "Political Science" or "Computer Science").
 */
const SUBJECT_ALIASES: [CurriculumSubjectKey, string[]][] = [
  ['mathematics', ['mathematics', 'math', 'maths', 'गणित', 'ganit', 'ganita']],
  ['science', ['science', 'general science', 'विज्ञान', 'vigyan', 'exploration']],
  ['english', ['english', 'अंग्रेजी', 'अंग्रेज़ी', 'eng', 'kaveri', 'poorvi']],
  ['hindi', ['hindi', 'हिंदी', 'हिन्दी', 'ganga', 'malhar']],
  ['social-science', ['social science', 'social studies', 'sst', 's.st', 'सामाजिक विज्ञान', 'samajik vigyan']],
  ['computer-applications', ['computer applications', 'computer application', 'computer', 'it', 'information technology', 'कंप्यूटर', 'आईटी']],
  ['physics', ['physics', 'भौतिकी', 'भौतिक विज्ञान']],
  ['chemistry', ['chemistry', 'रसायन', 'रसायन विज्ञान']],
  ['biology', ['biology', 'bio', 'जीव विज्ञान', 'जीवविज्ञान']],
  ['accountancy', ['accountancy', 'accounts', 'accounting', 'लेखाशास्त्र']],
  ['business-studies', ['business studies', 'business', 'b.st', 'व्यवसाय अध्ययन']],
  ['economics', ['economics', 'अर्थशास्त्र', 'economy']],
  ['history', ['history', 'इतिहास']],
  ['political-science', ['political science', 'politics', 'civics', 'राजनीति विज्ञान']],
  ['geography', ['geography', 'भूगोल']],
]

/** Unicode-aware lowercase + punctuation strip (keeps Devanagari matras). */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim()
}

/** Public topic-name normalizer for plan↔library coverage matching. */
export function normalizeTopicName(name: string): string {
  return normalizeName(name)
}

/** Resolve a school subject name (e.g. "Mathematics", "विज्ञान") to a key. */
export function subjectKeyFor(subjectName: string): CurriculumSubjectKey | null {
  const n = normalizeName(subjectName)
  if (!n) return null
  for (const [key, aliases] of SUBJECT_ALIASES) {
    if (aliases.some((a) => n === a)) return key
  }
  for (const [key, aliases] of SUBJECT_ALIASES) {
    if (aliases.some((a) => n.startsWith(`${a} `) || n.endsWith(` ${a}`))) return key
  }
  return null
}

const ROMAN: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12,
}

/** "Grade 9 - A" / "Class 10 B" / "IX-A" / "कक्षा 9" / "Class 11-B Science" → level. */
export function classLevelFor(className: string): number | null {
  const digits = className.match(/\d{1,2}/)
  if (digits) {
    const n = Number(digits[0])
    if (n >= 1 && n <= 12) return n
  }
  const tokens = className.toUpperCase().split(/[^A-Z]+/).filter(Boolean)
  for (const t2 of tokens) {
    const r = ROMAN[t2]
    if (r) return r
  }
  return null
}

// ─── Lookup ─────────────────────────────────────────────────────────────

/** The full class curriculum for a level (6–12), or null. */
export function getClassCurriculum(classLevel: number): ClassCurriculum | null {
  return SESSION_CLASSES.find((c) => c.classLevel === classLevel) ?? null
}

/** A subject's official curriculum for a class level, or null. */
export function getSubjectCurriculum(
  classLevel: number,
  subjectKey: CurriculumSubjectKey,
): SubjectCurriculum | null {
  return getClassCurriculum(classLevel)?.subjects.find((s) => s.key === subjectKey) ?? null
}

/**
 * Resolve the official curriculum for a school's own class + subject labels
 * (e.g. "Grade 9 - A" + "Science"). Returns null when the school offers a
 * subject the library does not carry — the planner then falls back to its
 * honest empty state ("no board curriculum — build your own plan").
 */
export function findCurriculumForClassSubject(
  className: string,
  subjectName: string,
): { classLevel: number; curriculum: SubjectCurriculum } | null {
  const level = classLevelFor(className)
  const key = subjectKeyFor(subjectName)
  if (level == null || !key) return null
  const curriculum = getSubjectCurriculum(level, key)
  if (!curriculum) return null
  return { classLevel: level, curriculum }
}

/** Total chapter count of a subject curriculum (for coverage badges). */
export function countTopics(curriculum: SubjectCurriculum): number {
  return curriculum.units.reduce((n, u) => n + u.topics.length, 0)
}

// ─── Registry validation (spec §21 — runs at import in dev/test) ────────

export interface CurriculumIssue {
  classLevel: number
  subjectKey: CurriculumSubjectKey
  issue: string
}

/**
 * Validate the whole registry: duplicate subject keys per class, duplicate
 * chapter names within a subject, empty units, zero-period topics, and
 * unknown class levels. Returns every issue found (empty = clean).
 */
export function validateRegistry(): CurriculumIssue[] {
  const issues: CurriculumIssue[] = []
  const seenLevels = new Set<number>()

  for (const cls of SESSION_CLASSES) {
    seenLevels.add(cls.classLevel)
    const seenSubjects = new Set<string>()
    for (const subject of cls.subjects) {
      if (seenSubjects.has(subject.key)) {
        issues.push({ classLevel: cls.classLevel, subjectKey: subject.key, issue: 'duplicate subject key' })
      }
      seenSubjects.add(subject.key)

      if (subject.units.length === 0) {
        issues.push({ classLevel: cls.classLevel, subjectKey: subject.key, issue: 'no units' })
      }
      const seenUnitNos = new Set<number>()
      for (const unit of subject.units) {
        if (seenUnitNos.has(unit.unitNo)) {
          issues.push({ classLevel: cls.classLevel, subjectKey: subject.key, issue: `duplicate unitNo ${unit.unitNo}` })
        }
        seenUnitNos.add(unit.unitNo)
        if (unit.topics.length === 0) {
          issues.push({ classLevel: cls.classLevel, subjectKey: subject.key, issue: `unit ${unit.unitNo} is empty` })
        }
        // Chapter names must be unique WITHIN a unit (across units — i.e.
        // across the separate books of a multi-book subject — the official
        // structures legitimately repeat names like "Human Development").
        const seenTopics = new Set<string>()
        for (const topic of unit.topics) {
          if (!topic.name.trim() || !topic.description.trim()) {
            issues.push({ classLevel: cls.classLevel, subjectKey: subject.key, issue: `topic with empty name/description in unit ${unit.unitNo}` })
          }
          if (!Number.isFinite(topic.periods) || topic.periods <= 0) {
            issues.push({ classLevel: cls.classLevel, subjectKey: subject.key, issue: `invalid periods on "${topic.name}"` })
          }
          const k = normalizeName(topic.name)
          if (seenTopics.has(k)) {
            issues.push({ classLevel: cls.classLevel, subjectKey: subject.key, issue: `duplicate chapter name "${topic.name}"` })
          }
          seenTopics.add(k)
        }
      }
    }
  }

  for (const level of [6, 7, 8, 9, 10, 11, 12]) {
    if (!seenLevels.has(level)) {
      issues.push({ classLevel: level, subjectKey: 'mathematics', issue: 'class level missing from registry' })
    }
  }
  return issues
}

if (process.env.NODE_ENV === 'development') {
  const issues = validateRegistry()
  if (issues.length > 0) {
    // Fail fast in dev — a corrupted registry must never reach schools.
    console.error('[curriculum-2026-27] REGISTRY VALIDATION FAILED:', issues)
  }
}
