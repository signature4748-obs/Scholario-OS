import { PrismaClient } from '../node_modules/.prisma/client/index.js'
const db = new PrismaClient()
async function main() {
  const school = await db.school.findFirst({ select: { id: true, name: true } })
  console.log('SCHOOL:', school?.id, school?.name)
  // Subjects named like Computer
  const subs = await db.subject.findMany({ where: { schoolId: school!.id }, select: { id: true, name: true, status: true, classId: true } })
  const ca = subs.filter(s => /computer/i.test(s.name))
  console.log('CA SUBJECT ROWS:', JSON.stringify(ca))
  // CSA rows for CA
  for (const s of ca) {
    const csas = await db.classSubjectAssignment.findMany({ where: { subjectId: s.id }, include: { class: { select: { name: true, section: true } } } })
    console.log('CSA for', s.name, '→', csas.map(c => `${c.class.name}-${c.class.section ?? ''} active=${c.isActive}`).join(', ') || 'NONE')
    const tt = await db.timetable.findMany({ where: { subjectId: s.id }, select: { id: true, day: true, period: true, teacherName: true, room: true, class: { select: { name: true, section: true } } } })
    console.log('TIMETABLE rows:', tt.length, JSON.stringify(tt.slice(0, 20)))
  }
  // All classes + CSA count
  const classes = await db.class.findMany({ where: { schoolId: school!.id }, orderBy: { name: 'asc' }, select: { id: true, name: true, section: true, classTeacherId: true } })
  for (const c of classes) {
    const csas = await db.classSubjectAssignment.findMany({ where: { classId: c.id, isActive: true }, include: { subject: { select: { name: true } } }, orderBy: { displayOrder: 'asc' } })
    console.log(`CLASS ${c.name}-${c.section ?? ''} [ct=${c.classTeacherId ?? '-'}]:`, csas.map(x => x.subject.name + (x.isActive ? '' : '(inactive)')).join(', '))
  }
  const totalCSA = await db.classSubjectAssignment.count({ where: { schoolId: school!.id } })
  const totalTT = await db.timetable.count({ where: { schoolId: school!.id } })
  console.log('TOTAL CSA:', totalCSA, 'TOTAL TT:', totalTT)
  // teachers in timetable
  const teachers = await db.timetable.findMany({ where: { schoolId: school!.id }, select: { teacherName: true }, distinct: ['teacherName'] })
  console.log('TT TEACHERS:', teachers.map(t => t.teacherName).join(' | '))
}
main().catch(console.error).finally(() => db.$disconnect())
