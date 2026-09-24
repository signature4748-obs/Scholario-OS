import { PrismaClient } from '../node_modules/.prisma/client/index.js'
const db = new PrismaClient()
async function main() {
  const teachers = await db.teacher.findMany({ include: { user: { select: { id: true, name: true } } } })
  for (const t of teachers) console.log(`TEACHER ${t.id} | USER ${t.user.id} | ${t.user.name} | same=${t.id === t.user.id}`)
}
main().catch(console.error).finally(() => db.$disconnect())
