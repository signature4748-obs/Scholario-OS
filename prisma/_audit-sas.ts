import { PrismaClient } from '../node_modules/.prisma/client/index.js'
const db = new PrismaClient()
async function main() {
  const school = await db.school.findFirst({ select: { id: true } })
  const cnt = await db.subjectAttendanceSession.count({ where: { schoolId: school!.id } })
  console.log('SubjectAttendanceSession rows (stale demo?):', cnt)
  if (cnt > 0) {
    const del = await db.subjectAttendanceSession.deleteMany({ where: { schoolId: school!.id } })
    console.log('Deleted stale subject sessions:', del.count)
  }
}
main().catch(console.error).finally(() => db.$disconnect())
