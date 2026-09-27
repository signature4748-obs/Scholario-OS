import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const rows = await db.attendance.findMany({ select: { date: true, status: true, classId: true } })
  const byDate = new Map<string, number>()
  const byStatus = new Map<string, number>()
  for (const r of rows) {
    const d = r.date.toISOString().slice(0, 10)
    byDate.set(d, (byDate.get(d) ?? 0) + 1)
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1)
  }
  console.log('dates:', [...byDate.entries()].map(([d, n]) => `${d}(${n})`).join(', '))
  console.log('statuses:', [...byStatus.entries()].map(([s, n]) => `${s}:${n}`).join(', '))
}
main().finally(() => db.$disconnect())
