/**
 * seed-computer-apps — LP-2 demo data: adopt "Computer Applications"
 * (CBSE code 165) in the Demo School for Grade 9-A and 10-A, taught by
 * Rohan Mehta in a weekly computer-lab period.
 *
 * The subject ships with NO CurriculumTopic rows ON PURPOSE: opening the
 * Lesson Planner on it auto-feeds the complete CBSE session plan from
 * src/lib/syllabus-templates.ts — the "plan is already there" showcase.
 *
 * Idempotent: safe to run repeatedly.
 *   bun run prisma/seed-computer-apps.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const SLOTS: {
  classId: string
  className: string
  day: string
  period: number
  startTime: string
  endTime: string
}[] = [
  // Grade 9-A — new P8 (14:45–15:30) lab slot, 3×/week
  { classId: 'cmtartdq7000xju86thrfrl0z', className: 'Grade 9 - A', day: 'Wednesday', period: 8, startTime: '14:45', endTime: '15:30' },
  { classId: 'cmtartdq7000xju86thrfrl0z', className: 'Grade 9 - A', day: 'Friday', period: 8, startTime: '14:45', endTime: '15:30' },
  { classId: 'cmtartdq7000xju86thrfrl0z', className: 'Grade 9 - A', day: 'Saturday', period: 8, startTime: '14:45', endTime: '15:30' },
  // Grade 10-A — new P7 (14:00–14:45) lab slot, 3×/week
  { classId: 'cmtartdq9000zju86a0qrlkmx', className: 'Grade 10 - A', day: 'Wednesday', period: 7, startTime: '14:00', endTime: '14:45' },
  { classId: 'cmtartdq9000zju86a0qrlkmx', className: 'Grade 10 - A', day: 'Friday', period: 7, startTime: '14:00', endTime: '14:45' },
  { classId: 'cmtartdq9000zju86a0qrlkmx', className: 'Grade 10 - A', day: 'Saturday', period: 7, startTime: '14:00', endTime: '14:45' },
]

async function main() {
  const school = await db.school.findFirst({ where: { name: { contains: 'Demo School' } } })
  if (!school) throw new Error('Demo school not found')
  console.log(`School: ${school.name} (${school.board})`)

  // 1 — the subject
  let subject = await db.subject.findFirst({
    where: { schoolId: school.id, name: 'Computer Applications' },
  })
  if (!subject) {
    subject = await db.subject.create({
      data: { schoolId: school.id, name: 'Computer Applications', code: 'CA165' },
    })
    console.log(`✓ Subject created: ${subject.name} (${subject.id})`)
  } else {
    console.log(`• Subject exists: ${subject.name} (${subject.id})`)
  }

  // 2 — active class-subject assignments
  for (const classId of [...new Set(SLOTS.map((s) => s.classId))]) {
    const cls = await db.class.findUnique({ where: { id: classId } })
    if (!cls) throw new Error(`Class ${classId} not found`)
    const existing = await db.classSubjectAssignment.findFirst({
      where: { schoolId: school.id, classId, subjectId: subject.id },
    })
    if (!existing) {
      await db.classSubjectAssignment.create({
        data: {
          schoolId: school.id,
          classId,
          subjectId: subject.id,
          isCore: false,
          isActive: true,
          examinable: false,
        },
      })
      console.log(`✓ Assignment created: ${cls.name} · Computer Applications`)
    } else if (!existing.isActive) {
      await db.classSubjectAssignment.update({
        where: { id: existing.id },
        data: { isActive: true },
      })
      console.log(`✓ Assignment re-activated: ${cls.name} · Computer Applications`)
    } else {
      console.log(`• Assignment exists: ${cls.name} · Computer Applications`)
    }
  }

  // 3 — Rohan's computer-lab periods
  let added = 0
  for (const slot of SLOTS) {
    const clash = await db.timetable.findFirst({
      where: {
        schoolId: school.id,
        classId: slot.classId,
        day: slot.day,
        period: slot.period,
      },
    })
    if (clash) {
      console.log(`• Slot taken (${slot.className} ${slot.day} P${slot.period}: ${clash.subjectId}) — skipped`)
      continue
    }
    await db.timetable.create({
      data: {
        schoolId: school.id,
        classId: slot.classId,
        subjectId: subject.id,
        day: slot.day,
        period: slot.period,
        startTime: slot.startTime,
        endTime: slot.endTime,
        teacherName: 'Rohan Mehta',
        room: 'Computer Lab',
      },
    })
    added += 1
    console.log(`✓ Timetable: ${slot.className} ${slot.day} P${slot.period} (${slot.startTime}) — Computer Lab`)
  }
  console.log(`Done — ${added} new timetable cells.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
