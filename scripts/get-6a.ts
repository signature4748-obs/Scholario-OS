import { db } from '../src/lib/db'
async function main() {
  const school = await db.school.findFirst({ where: { name: { contains: 'Demo' } } })
  const cls = await db.class.findFirst({ where: { schoolId: school.id, name: { contains: '6' } } })
  const subject = await db.subject.findFirst({ where: { schoolId: school.id, name: 'Mathematics' } })
  console.log(JSON.stringify({ classId: cls.id, subjectId: subject.id, label: cls.name + '-' + cls.section }))
}
main().catch(console.error)
