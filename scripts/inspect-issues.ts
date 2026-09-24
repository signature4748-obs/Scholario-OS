import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  // 1. Attendance dupes on 2026-09-16 — inspect exact timestamps + markedBy
  const att = await db.attendance.findMany({
    where: { date: { gte: new Date('2026-09-15'), lt: new Date('2026-09-18') } },
    orderBy: [{ studentId: 'asc' }, { date: 'asc' }],
    include: { student: { include: { user: true, class: true } } }
  });
  console.log(`Attendance rows Sept 15-18: ${att.length}`);
  const byStudent = new Map<string, typeof att>();
  for (const a of att) {
    const arr = byStudent.get(a.studentId) ?? [];
    arr.push(a); byStudent.set(a.studentId, arr);
  }
  let shown = 0;
  for (const [sid, rows] of byStudent) {
    if (rows.length > 1 && shown < 3) {
      shown++;
      console.log(`\nStudent ${rows[0].student?.user?.name} (${rows[0].student?.class?.name}):`);
      rows.forEach(r => console.log(`  id=${r.id} date=${r.date.toISOString()} status=${r.status} markedBy=${r.markedBy} classId=${r.classId}`));
    }
  }
  // 2. The orphan FeeTransactions
  const txns = await db.feeTransaction.findMany({
    where: { studentId: { in: ['STU-1', 'STU-2', 'STU-37'] } },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`\nOrphan FeeTransactions: ${txns.length}`);
  txns.forEach(t => console.log(`  ${t.id} student=${t.studentId} name=${t.studentName} class=${t.className} amount=${t.amount} status=${t.status} source=${t.source} receipt=${t.receiptNo} created=${t.createdAt.toISOString().slice(0,10)} feeHead=${t.feeHeadName}`));
  // 3. The duplicate receipt
  const dupReceipts = await db.feeTransaction.findMany({ where: { receiptNo: 'RCP-2026-1061' } });
  console.log(`\nRCP-2026-1061 holders:`);
  dupReceipts.forEach(t => console.log(`  ${t.id} student=${t.studentId} name=${t.studentName} amount=${t.amount} status=${t.status} verified=${t.verifiedByName} created=${t.createdAt.toISOString().slice(0,10)}`));
  // 4. The historical Results exam context
  const results = await db.result.findMany({
    where: { subject: { name: { in: ['Physics', 'Chemistry', 'Biology'] } } },
    include: { exam: true, student: { include: { class: true } } },
    take: 3
  });
  console.log(`\nPhysics/Chem/Bio results — exam context:`);
  results.forEach(r => console.log(`  exam="${r.exam.name}" type=${r.exam.type} session=${r.exam.session} status=${r.exam.status} resultStatus=${r.exam.resultStatus} class=${r.student.class?.name} marks=${r.marks}/${r.totalMarks}`));
  const examIds = new Set(results.map(r => r.examId));
  for (const eid of examIds) {
    const ex = await db.exam.findUnique({ where: { id: eid } });
    if (ex) console.log(`  EXAM ${ex.name}: declared=${ex.declaredAt?.toISOString().slice(0,10) ?? 'no'} resultStatus=${ex.resultStatus}`);
  }
}
main().finally(() => db.$disconnect());
