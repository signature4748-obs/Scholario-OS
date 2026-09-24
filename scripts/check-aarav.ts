import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const users = await db.user.findMany({
    where: { OR: [{ email: 'student1@demoschool.edu' }, { email: 'aarav.sharma@greenwood.edu.in' }] },
    include: { student: { include: { class: true } } },
  });
  for (const u of users) {
    console.log(`${u.email} → student=${u.student?.id ?? 'NONE'} class=${u.student?.class?.name ?? 'NONE'} roll=${u.student?.rollNo ?? '—'} admission=${u.student?.admissionNo ?? '—'}`);
  }
}
main().finally(() => db.$disconnect());
