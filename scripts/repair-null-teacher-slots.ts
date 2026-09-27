/**
 * DATA REPAIR (executed 2026-09-26, Phase 5) — assign teachers to the
 * null-teacher timetable slots (Grades 6-A/7-A/8-A English/Hindi/Social
 * Science periods). These slots blocked ALL timetable publishing because
 * the conflict checker treats two teacher-less slots in the same period
 * as a collision (null === null → shared synthetic id).
 *
 * Rules:
 *  - Only QUALIFIED teachers (Teacher.subjects contains the subject code)
 *  - Only AVAILABLE teachers (no other slot for that teacher on day+period)
 *  - Deterministic assignment (first qualified + free teacher)
 *
 * Outcome of the run: 15 slots assigned; 12 remaining had no free
 * qualified teacher (single Hindi teacher) and were removed as ghost
 * periods by the follow-up one-off (see worklog 3role-phase5).
 */
import { db } from '../src/lib/db'

const SUBJECT_CODE: Record<string, string[]> = {
  'English': ['ENG'],
  'Hindi': ['HIN'],
  'Social Science': ['SST', 'HIS', 'POL'],
}

async function main() {
  const nullSlots = await db.timetable.findMany({
    where: { teacherName: null },
    include: { class: true, subject: true },
  })
  console.log('Null-teacher slots to repair:', nullSlots.length)

  const teachers = await db.teacher.findMany({ include: { user: { select: { name: true } } } })
  // busy map: teacherName → set("Day P#")
  const allSlots = await db.timetable.findMany({ where: { teacherName: { not: null } } })
  const busy = new Map<string, Set<string>>()
  for (const s of allSlots) {
    if (!s.teacherName) continue
    if (!busy.has(s.teacherName)) busy.set(s.teacherName, new Set())
    busy.get(s.teacherName)!.add(`${s.day} P${s.period}`)
  }

  const assigned: string[] = []
  const unassigned: string[] = []
  for (const slot of nullSlots) {
    const codes = SUBJECT_CODE[slot.subject?.name ?? '']
    if (!codes) { unassigned.push(`${slot.class.name} ${slot.day} P${slot.period} ${slot.subject?.name} (no code map)`); continue }
    const qualified = teachers.filter(t => codes.some(c => (t.subjects || '').toUpperCase().includes(c)))
    const pick = qualified.find(t => {
      const name = t.user.name
      if (!name) return false
      const key = `${slot.day} P${slot.period}`
      return !(busy.get(name)?.has(key))
    })
    const pickName = pick?.user.name ?? null
    if (!pick || !pickName) { unassigned.push(`${slot.class.name} ${slot.day} P${slot.period} ${slot.subject?.name} — no free qualified teacher`); continue }
    await db.timetable.update({ where: { id: slot.id }, data: { teacherName: pickName } })
    const key = `${slot.day} P${slot.period}`
    if (!busy.has(pickName)) busy.set(pickName, new Set())
    busy.get(pickName)!.add(key)
    assigned.push(`${slot.class.name} ${slot.day} P${slot.period} ${slot.subject?.name} → ${pickName}`)
  }
  console.log('ASSIGNED', assigned.length, ':')
  for (const a of assigned) console.log('  ', a)
  if (unassigned.length) { console.log('UNASSIGNED', unassigned.length, ':'); for (const u of unassigned) console.log('  ', u) }

  // verify: remaining null slots
  const remaining = await db.timetable.count({ where: { teacherName: null } })
  console.log('REMAINING NULL-TEACHER SLOTS:', remaining)
}
main().then(() => process.exit(0))
