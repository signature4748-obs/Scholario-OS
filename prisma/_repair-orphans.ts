import { PrismaClient } from '../node_modules/.prisma/client/index.js'
const db = new PrismaClient()
async function main() {
  const school = await db.school.findFirst({ select: { id: true } })
  // A timetable cell without a subject is not a valid teaching entry
  // (Requirement H) — delete every orphan.
  const del = await db.timetable.deleteMany({ where: { schoolId: school!.id, subjectId: null } })
  console.log('Deleted null-subject timetable rows:', del.count)
  // Also detect rows referencing a class with no ACTIVE CSA for that subject.
  const rows = await db.timetable.findMany({ where: { schoolId: school!.id, subjectId: { not: null } }, select: { classId: true, subjectId: true } })
  const csas = await db.classSubjectAssignment.findMany({ where: { schoolId: school!.id, isActive: true }, select: { classId: true, subjectId: true } })
  const keys = new Set(csas.map(c => `${c.classId}|${c.subjectId}`))
  const noCsa = rows.filter(r => !keys.has(`${r.classId}|${r.subjectId}`))
  console.log('Remaining rows without ACTIVE CSA:', noCsa.length)
  if (noCsa.length > 0) {
    const del2 = await db.timetable.deleteMany({
      where: { schoolId: school!.id, AND: rows.filter(r => !keys.has(`${r.classId}|${r.subjectId}`)).map(r => ({ classId: r.classId, subjectId: r.subjectId })) },
    })
    console.log('Deleted rows without CSA:', del2.count)
  }
  const total = await db.timetable.count({ where: { schoolId: school!.id } })
  console.log('TOTAL TT after orphan repair:', total)
}
main().catch(console.error).finally(() => db.$disconnect())
