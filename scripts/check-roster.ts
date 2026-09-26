import { db } from '../src/lib/db'
async function main() {
  const classes = await db.class.findMany({
    where: { school: { domain: { not: null } } },
    include: { school: { select: { name: true } }, students: { include: { user: { select: { name: true, status: true } } }, orderBy: { rollNo: 'asc' } } },
  })
  for (const c of classes) {
    const active = c.students.filter((s) => s.user?.status === 'ACTIVE')
    if (active.length) {
      console.log(`${c.school?.name} | ${c.name}-${c.section} (${active.length}):`)
      console.log('  ' + active.map((s) => `${s.rollNo}:${s.user?.name}`).join(', '))
    }
  }
  // Rohan's timetable
  const tt = await db.timetable.findMany({ where: { teacherName: 'Rohan Mehta' }, select: { classId: true, subjectId: true }, distinct: ['classId', 'subjectId'] })
  const names = await Promise.all(tt.map(async (t) => {
    const cls = await db.class.findUnique({ where: { id: t.classId } })
    const sub = await db.subject.findUnique({ where: { id: t.subjectId } })
    return `${cls?.name}-${cls?.section}/${sub?.name}`
  }))
  console.log('Rohan teaches:', names.join(', '))
}
main().catch(console.error)
