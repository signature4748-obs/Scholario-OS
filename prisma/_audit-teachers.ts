import { PrismaClient } from '../node_modules/.prisma/client/index.js'
const db = new PrismaClient()
async function main() {
  const school = await db.school.findFirst({ select: { id: true } })
  const teachers = await db.teacher.findMany({ where: { schoolId: school!.id }, include: { user: { select: { name: true, email: true } } } })
  console.log('DB TEACHERS:')
  for (const t of teachers) console.log(`  ${t.id} → ${t.user.name} (${t.user.email})`)
  const classes = await db.class.findMany({ where: { schoolId: school!.id }, select: { name: true, section: true, classTeacherId: true } })
  for (const c of classes) {
    const t = teachers.find(x => x.id === c.classTeacherId)
    console.log(`${c.name}-${c.section}: CT=${t ? t.user.name : `RAW:${c.classTeacherId}`}`)
  }
}
main().catch(console.error).finally(() => db.$disconnect())
