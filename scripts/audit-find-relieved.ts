import { db } from '../src/lib/db'
async function main() {
  const users = await db.user.findMany({
    where: { role: 'TEACHER' },
    select: { email: true, status: true, name: true },
  })
  for (const u of users) console.log(u.email, '|', u.status, '|', u.name)
}
main().catch((e) => console.log('ERR', e.message)).finally(() => db.$disconnect())
