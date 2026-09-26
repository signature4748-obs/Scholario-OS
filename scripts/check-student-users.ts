import { db } from '../src/lib/db'
async function main() {
  const sa = await db.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { email: true, name: true } })
  console.log('ALL SUPERADMINS:', JSON.stringify(sa))
  const scholarioAdmin = await db.user.findUnique({ where: { email: 'admin@scholario.cloud' }, select: { email: true, role: true } })
  console.log('admin@scholario.cloud:', JSON.stringify(scholarioAdmin))
}
main().then(() => process.exit(0))
