import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const users = await db.user.findMany({
    select: { id: true, email: true, role: true, name: true, status: true, schoolId: true }
  });
  console.log('USERS:');
  users.forEach(u => console.log(`  ${u.role.padEnd(10)} ${u.email.padEnd(35)} status=${u.status ?? 'null'} school=${u.schoolId}`));
  const schools = await db.school.findMany({ select: { id: true, name: true, slug: true, academicYear: true, board: true, status: true } });
  console.log('SCHOOLS:', JSON.stringify(schools, null, 1));
  const counts = {
    classes: await db.class.count(),
    subjects: await db.subject.count(),
    students: await db.student.count(),
    teachers: await db.teacher.count(),
    timetable: await db.timetable.count(),
    attendance: await db.attendance.count(),
    csa: await db.classSubjectAssignment.count(),
    fees: await db.fee.count(),
    payments: await db.payment.count(),
    examMarks: await db.examMark.count(),
    results: await db.result.count(),
  };
  console.log('COUNTS:', JSON.stringify(counts));
}
main().finally(() => db.$disconnect());
