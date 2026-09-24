/**
 * ONE-TIME DATA REPAIR — Remove the invalid "Computer Applications" (CA)
 * configuration from the Demo School DB.
 *
 * WHY: CA was seeded into ClassSubjectAssignment + Timetable + Curriculum
 * for Grade 9-A / 10-A by an earlier seed script, but the Principal NEVER
 * configured CA for any class (the school's subject registry — what the
 * Principal manages — contains only Hindi, English, Science, Maths,
 * Social Science, Arts & Drawing, Physics, Chemistry, Biology).
 * Per the data-integrity rule "Principal configuration is the single
 * source of truth", every CA relationship is an invalid record and must
 * be removed — not hidden with a frontend filter.
 *
 * SAFE DELETION ORDER (all FKs cascade from Subject):
 *   1. Report every referencing table first (audit trail).
 *   2. Delete the CA Subject row → cascades CSA / Timetable rows /
 *      CurriculumTopic (+ completions) / ExamSubjectConfig / ExamMark /
 *      SubjectAttendanceSession / Homework rows that reference CA.
 *   3. Report the after-state per class.
 */
import { PrismaClient } from '../node_modules/.prisma/client/index.js'
const db = new PrismaClient()

async function main() {
  const school = await db.school.findFirst({ select: { id: true, name: true } })
  if (!school) throw new Error('No school')
  console.log('SCHOOL:', school.id, school.name)

  const ca = await db.subject.findFirst({
    where: { schoolId: school.id, name: { contains: 'Computer' } },
  })
  if (!ca) {
    console.log('No Computer Applications subject found — nothing to repair.')
    return
  }
  console.log('CA SUBJECT:', ca.id, ca.name)

  // ── 1. Audit what references CA before deletion ──────────────────────
  const csas = await db.classSubjectAssignment.findMany({
    where: { subjectId: ca.id }, include: { class: true },
  })
  const tt = await db.timetable.findMany({
    where: { subjectId: ca.id }, include: { class: true },
  })
  const topics = await db.curriculumTopic.findMany({
    where: { subjectId: ca.id }, include: { class: true },
  })
  const completions = await db.lessonTopicCompletion.count({ where: { subjectId: ca.id } })
  const examCfg = await db.examSubjectConfig.findMany({
    where: { subjectId: ca.id }, include: { exam: { select: { name: true } }, class: true },
  })
  const marks = await db.examMark.count({ where: { subjectId: ca.id } })
  const sas = await db.subjectAttendanceSession.count({ where: { subjectId: ca.id } })
  const hw = await db.homework.count({ where: { subjectId: ca.id } })

  console.log('REFERENCES:')
  console.log('  ClassSubjectAssignment:', csas.map(c => `${c.class.name}-${c.class.section}(active=${c.isActive})`).join(', ') || 'none')
  console.log('  Timetable rows:', tt.length, tt.map(t => `${t.class.name} ${t.day} P${t.period} ${t.teacherName}`).join(' | '))
  console.log('  CurriculumTopic rows:', topics.length, `(${topics[0]?.class.name ?? ''}…${topics[topics.length - 1]?.class.name ?? ''})`)
  console.log('  LessonTopicCompletion rows:', completions)
  console.log('  ExamSubjectConfig:', examCfg.map(c => `${c.exam.name} · ${c.class.name}`).join(', ') || 'none')
  console.log('  ExamMark rows:', marks)
  console.log('  SubjectAttendanceSession rows:', sas)
  console.log('  Homework rows:', hw)

  // ── 2. Delete (cascade from Subject) ─────────────────────────────────
  // Everything referencing CA stems from the invalid seed configuration —
  // these are demo relationships, not legitimate history (the school never
  // actually ran CA for these classes).
  await db.subject.delete({ where: { id: ca.id } })
  console.log('\nDELETED CA subject row + all cascaded references.')

  // ── 3. After-state ────────────────────────────────────────────────────
  const classes = await db.class.findMany({
    where: { schoolId: school.id }, orderBy: { name: 'asc' },
    select: { id: true, name: true, section: true },
  })
  for (const c of classes) {
    const csas2 = await db.classSubjectAssignment.findMany({
      where: { classId: c.id, isActive: true },
      include: { subject: { select: { name: true } } },
      orderBy: { displayOrder: 'asc' },
    })
    console.log(`AFTER ${c.name}-${c.section}:`, csas2.map(x => x.subject.name).join(', '))
  }
  const totalTT = await db.timetable.count({ where: { schoolId: school.id } })
  console.log('TOTAL TT after:', totalTT)
  const orphans = await db.timetable.count({
    where: { schoolId: school.id, subjectId: null },
  })
  console.log('TT rows with null subject (orphan check):', orphans)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
