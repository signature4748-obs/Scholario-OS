import { db } from '../src/lib/db'
async function main() {
  const marks = await db.examMark.findMany({
    where: { exam: { name: 'QA Scan Verification Test' } },
    include: { student: { include: { user: { select: { name: true } } } } },
    orderBy: { student: { rollNo: 'asc' } },
  })
  for (const m of marks) console.log(`  ${m.student.rollNo} ${m.student.user?.name}: marks=${m.marksObtained} wf=${m.workflowStatus}`)
}
main().catch(console.error)
