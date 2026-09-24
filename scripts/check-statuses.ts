import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const rows = await db.attendance.findMany({ select: { status: true }, distinct: ['status'] });
  console.log('Distinct attendance statuses:', rows.map(r => r.status));
}
main().finally(() => db.$disconnect());
