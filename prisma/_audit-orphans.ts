import { PrismaClient } from '../node_modules/.prisma/client/index.js'
const db = new PrismaClient()
async function main() {
  const school = await db.school.findFirst({ select: { id: true } })
  const orphans = await db.timetable.findMany({
    where: { schoolId: school!.id, subjectId: null },
    include: { class: { select: { name: true, section: true } } },
  })
  console.log(JSON.stringify(orphans.map(o => ({ id: o.id, day: o.day, period: o.period, teacher: o.teacherName, class: `${o.class?.name}-${o.class?.section}`, start: o.startTime, end: o.endTime })), null, 1))
  // Also check: TT rows whose (classId,subjectId) has no ACTIVE CSA
  const rows = await db.timetable.findMany({ where: { schoolId: school!.id, subjectId: { not: null } }, select: { id: true, classId: true, subjectId: true, teacherName: true, day: true, period: true } })
  const csas = await db.classSubjectAssignment.findMany({ where: { schoolId: school!.id, isActive: true }, select: { classId: true, subjectId: true } })
  const keys = new Set(csas.map(c => `${c.classId}|${c.subjectId}`))
  const noCsa = rows.filter(r => !keys.has(`${r.classId}|${r.subjectId}`))
  console.log('ROWS WITHOUT ACTIVE CSA:', noCsa.length)
  console.log(JSON.stringify(noCsa.map(r => ({ day: r.day, p: r.period, t: r.teacherName, class: r.classId, subj: r.subjectId }))))
}
main().catch(console.error).finally(() => db.$disconnect())
