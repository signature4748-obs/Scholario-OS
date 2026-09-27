/**
 * admission/lib/scan-fields — maps OCR-recognized lines into the CANONICAL
 * admission draft fields (Wave 2 deep spec §34).
 *
 * No second OCR-only data model: every extraction targets a real key of
 * AdmissionFormData. Per-field confidence is the REAL Tesseract line
 * confidence; values that fail format validation are flagged for review
 * regardless of confidence (spec §33 — never silently normalize uncertain
 * data).
 */

import type { FormData } from '../constants'
import type { OcrLine } from './doc-ocr'

export interface ExtractedField {
  fieldKey: keyof FormData
  label: string
  value: string
  /** Real Tesseract confidence 0–100 (-1 unknown). */
  confidence: number
  /** True when validation or low confidence requires a human look. */
  needsReview: boolean
  /** Why review is needed (shown as the ⚠ hint). */
  reviewHint?: string
}

/** Below this real confidence the field is marked for review. */
export const FIELD_REVIEW_THRESHOLD = 80

type FieldRule = {
  key: keyof FormData
  label: string
  /** Label aliases matched at line start (case-insensitive). */
  aliases: string[]
  /** Optional format validation → value cleanup. */
  clean?: (raw: string) => { value: string; problem?: string } | null
}

const dateRE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/
const isoRE = /^(\d{4})-(\d{2})-(\d{2})$/
const phoneRE = /^[+]?[\d][\d\s-]{8,13}\d$/
const pinRE = /^\d{6}$/
const aadhaarRE = /^\d{4}\s?\d{4}\s?\d{4}$/

function toIsoDate(raw: string): { value: string; problem?: string } | null {
  const t = raw.trim()
  const m = t.match(dateRE)
  if (m) {
    const [, d, mo, y] = m
    const dd = d.padStart(2, '0'), mm = mo.padStart(2, '0')
    if (+dd < 1 || +dd > 31 || +mm < 1 || +mm > 12) return { value: t, problem: 'Date looks invalid' }
    return { value: `${y}-${mm}-${dd}` }
  }
  if (isoRE.test(t)) return { value: t }
  return { value: t, problem: 'Expected DD/MM/YYYY' }
}

const RULES: FieldRule[] = [
  {
    key: 'firstName', label: 'Student Name', aliases: ['student name', 'name of student', 'candidate name', "student's name", 'name of the student', 'scholar name'],
    clean: (raw) => {
      const parts = raw.trim().split(/\s+/).filter(Boolean)
      if (parts.length === 0) return null
      if (parts.length === 1) return { value: parts[0], problem: 'Only one name — check surname' }
      // Keep the FULL name visible in the review box (honest extraction);
      // extractedToFormData splits first/surname on apply.
      return { value: parts.join(' ') }
    },
  },
  { key: 'lastName', label: 'Surname', aliases: ['surname', 'last name', 'family name'],
    clean: (raw) => {
      const parts = raw.trim().split(/\s+/).filter(Boolean)
      if (parts.length === 0) return null
      return { value: parts[parts.length - 1] }
    } },
  { key: 'dob', label: 'Date of Birth', aliases: ['date of birth', 'dob', 'd.o.b', 'birth date', 'd.o.b.'], clean: toIsoDate },
  { key: 'gender', label: 'Gender', aliases: ['gender', 'sex'],
    clean: (raw) => {
      const t = raw.trim().toLowerCase()
      if (t.startsWith('m') || t.startsWith('b')) return { value: 'Male' }
      if (t.startsWith('f') || t.startsWith('g')) return { value: 'Female' }
      if (t.startsWith('o')) return { value: 'Other' }
      return { value: raw.trim(), problem: 'Not a recognized gender' }
    } },
  { key: 'aadhaarNo', label: 'Aadhaar Number', aliases: ['aadhaar', 'aadhaar no', 'aadhaar number', 'aadhaar no.', 'uid', 'uidai'],
    clean: (raw) => {
      const digits = raw.replace(/\s/g, '')
      if (aadhaarRE.test(digits)) return { value: digits }
      return { value: raw.trim(), problem: 'Expected 12-digit Aadhaar' }
    } },
  { key: 'bloodGroup', label: 'Blood Group', aliases: ['blood group', 'blood grp'] },
  { key: 'religion', label: 'Religion', aliases: ['religion'] },
  { key: 'category', label: 'Category', aliases: ['category', 'social category'] },
  { key: 'fatherName', label: "Father's Name", aliases: ["father's name", 'father name', 'fathers name', 'name of father', 'father/guardian name'] },
  { key: 'fatherOccupation', label: "Father's Occupation", aliases: ['father occupation', "father's occupation", 'fathers occupation'] },
  { key: 'fatherPhone', label: "Father's Phone", aliases: ['father phone', "father's phone", 'fathers phone', 'father mobile', 'father contact', 'father contact no'],
    clean: (raw) => (phoneRE.test(raw.trim()) ? { value: raw.trim() } : { value: raw.trim(), problem: 'Not a phone number' }) },
  { key: 'motherName', label: "Mother's Name", aliases: ["mother's name", 'mother name', 'mothers name', 'name of mother'] },
  { key: 'motherPhone', label: "Mother's Phone", aliases: ['mother phone', "mother's phone", 'mothers phone', 'mother mobile', 'mother contact'],
    clean: (raw) => (phoneRE.test(raw.trim()) ? { value: raw.trim() } : { value: raw.trim(), problem: 'Not a phone number' }) },
  { key: 'emergencyName', label: 'Emergency Contact', aliases: ['emergency contact', 'emergency person', 'guardian name', 'local guardian'] },
  { key: 'currentAddress', label: 'Address', aliases: ['address', 'current address', 'residential address', 'correspondence address', 'home address'] },
  { key: 'city', label: 'City', aliases: ['city', 'town'] },
  { key: 'district', label: 'District', aliases: ['district'] },
  { key: 'state', label: 'State', aliases: ['state'] },
  { key: 'pincode', label: 'PIN Code', aliases: ['pincode', 'pin code', 'pin', 'zip', 'postal code'],
    clean: (raw) => (pinRE.test(raw.trim()) ? { value: raw.trim() } : { value: raw.trim(), problem: 'Expected 6-digit PIN' }) },
  { key: 'previousSchool', label: 'Previous School', aliases: ['previous school', 'last school', 'school last attended', 'name of previous school', 'previous school name'] },
  { key: 'previousClass', label: 'Last Class', aliases: ['previous class', 'last class', 'class last studied', 'last passed class'] },
  { key: 'previousBoard', label: 'Previous Board', aliases: ['previous board', 'board', 'last board'] },
  { key: 'tcNumber', label: 'TC Number', aliases: ['tc number', 'tc no', 'tc no.', 'transfer certificate no', 'transfer certificate number'] },
  { key: 'className', label: 'Class Applied For', aliases: ['class applied for', 'applying for class', 'class applying for', 'class', 'admission sought in', 'class seeking admission'] },
  { key: 'section', label: 'Section', aliases: ['section'] },
  { key: 'previousYear', label: 'Academic Session', aliases: ['academic session', 'session', 'academic year'] },
]

const LABEL_VALUE_RE = /^\s*([^:]{2,40}?)\s*[:.\-—]\s*(.+)$/
/** A label with nothing after the separator ("Student Name:") — columnar forms. */
const LABEL_ONLY_RE = /^\s*([^:]{2,40}?)\s*[:.\-—]\s*$/

/** Match a raw label (already lowercased/normalized) against a rule. */
function ruleForLabel(rawLabel: string, aliases: string[]): boolean {
  return aliases.some((a) => rawLabel === a || rawLabel.startsWith(a + ' ') || rawLabel.startsWith(a + ':'))
}

/**
 * Extract canonical admission fields from recognized lines (two passes):
 *
 *   PASS 1 — inline forms: "Student Name : Nisha Verma" on one line.
 *   PASS 2 — columnar forms (real school layouts): the label line
 *            ("Student Name:") pairs with the value line that sits at the
 *            same vertical position to its RIGHT (bbox geometry from
 *            Tesseract — deterministic matching, no guessing).
 *
 * Uncertain pairings (large vertical offset) are kept but marked for
 * review (spec §33) — never silently dropped or invented.
 */
export function extractAdmissionFields(lines: OcrLine[]): ExtractedField[] {
  const out = new Map<keyof FormData, ExtractedField>()
  const usedLineIdx = new Set<number>()

  const pushField = (
    rule: FieldRule,
    value: string,
    confidence: number,
    problem?: string,
  ) => {
    if (!value || out.has(rule.key)) return
    const needsReview =
      !!problem || (confidence >= 0 && confidence < FIELD_REVIEW_THRESHOLD)
    out.set(rule.key, {
      fieldKey: rule.key,
      label: rule.label,
      value,
      confidence,
      needsReview,
      reviewHint: problem,
    })
  }

  // ── PASS 1: LABEL : VALUE on the same line ──
  lines.forEach((line) => {
    const m = line.text.match(LABEL_VALUE_RE)
    if (!m) return
    const rawLabel = m[1].toLowerCase().replace(/\s+/g, ' ').trim()
    const rawValue = m[2].replace(/\s{2,}/g, ' ').trim()
    if (!rawValue || rawValue.length > 80) return
    for (const rule of RULES) {
      if (out.has(rule.key)) continue
      if (!ruleForLabel(rawLabel, rule.aliases)) continue
      let value = rawValue
      let problem: string | undefined
      if (rule.clean) {
        const cleaned = rule.clean(rawValue)
        if (!cleaned) return
        value = cleaned.value
        problem = cleaned.problem
      }
      pushField(rule, value, line.confidence, problem)
      return
    }
  })

  // ── PASS 2: columnar forms — label-only line + value line to its right ──
  lines.forEach((labelLine, idx) => {
    const m = labelLine.text.match(LABEL_ONLY_RE)
    if (!m) return
    const rawLabel = m[1].toLowerCase().replace(/\s+/g, ' ').trim()
    const rule = RULES.find((r) => !out.has(r.key) && ruleForLabel(rawLabel, r.aliases))
    if (!rule) return

    // Candidates: unused, non-label lines starting to the right of this
    // label, vertically aligned with it (within ~1.2 line heights).
    const labelCy = (labelLine.y0 + labelLine.y1) / 2
    const labelH = Math.max(1, labelLine.y1 - labelLine.y0)
    const candidates: Array<{ line: OcrLine; idx: number; dy: number }> = []
    lines.forEach((cand, cIdx) => {
      if (usedLineIdx.has(cIdx) || cIdx === idx) return
      if (cand.text.match(LABEL_ONLY_RE)) return
      if (cand.text.match(LABEL_VALUE_RE)) return // inline pairs handled in pass 1
      // Must start to the right of the label's end (columnar layout).
      if (cand.x0 < labelLine.x1 - 12) return
      const cCy = (cand.y0 + cand.y1) / 2
      const dy = Math.abs(cCy - labelCy)
      if (dy > labelH * 1.25) return
      candidates.push({ line: cand, idx: cIdx, dy })
    })
    if (candidates.length === 0) return
    const best = candidates.reduce((a, b) => (b.dy < a.dy ? b : a))
    const rawValue = best.line.text.replace(/\s{2,}/g, ' ').trim()
    if (!rawValue || rawValue.length > 80) return

    let value = rawValue
    let problem: string | undefined
    if (rule.clean) {
      const cleaned = rule.clean(rawValue)
      if (!cleaned) return
      value = cleaned.value
      problem = cleaned.problem
    }
    usedLineIdx.add(best.idx)
    // A pairing that is vertically loose gets a review hint even at high OCR confidence.
    const loose = best.dy > labelH * 0.6
    pushField(rule, value, best.line.confidence, problem || (loose ? 'Check pairing' : undefined))
  })

  return Array.from(out.values())
}

/** Build the Partial<FormData> payload from reviewed fields (§32: never auto-submit). */
export function extractedToFormData(fields: ExtractedField[]): Partial<FormData> {
  const payload: Record<string, string> = {}
  for (const f of fields) {
    if (f.value) payload[f.fieldKey as string] = f.value
  }
  // A single "Student Name: <full name>" line carries the surname too —
  // without a separate Surname field on the form, split the remainder into
  // lastName instead of silently dropping it.
  if (payload.firstName && !payload.lastName) {
    const parts = payload.firstName.trim().split(/\s+/)
    if (parts.length > 1) {
      payload.firstName = parts[0]
      payload.lastName = parts.slice(1).join(' ')
    }
  }
  return payload as Partial<FormData>
}

/** Re-validate one field after a manual edit (spec §33: the Principal can
 *  always correct values; the ⚠ Review flag must follow the CURRENT value —
 *  cleared when fixed, raised when the edit introduces a problem). */
export function revalidateExtractedField(field: ExtractedField, newValue: string): ExtractedField {
  const rule = RULES.find((r) => r.key === field.fieldKey)
  let value = newValue
  let problem: string | undefined
  if (rule?.clean) {
    const cleaned = rule.clean(newValue)
    if (!cleaned) {
      return { ...field, value: newValue, needsReview: true, reviewHint: 'Empty value' }
    }
    value = cleaned.value
    problem = cleaned.problem
  }
  return {
    ...field,
    value,
    needsReview: !!problem,
    reviewHint: problem,
  }
}
