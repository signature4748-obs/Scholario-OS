import { db } from '../src/lib/db'
async function main() {
  const marks = await db.examMark.findMany({
    where: { examId: 'cmtartfd200bbju860t5szyqv', classId: 'cmugboa84000npwj1woyg8pqz', subjectId: 'cmue8p1zg000fsv8mrd2a0xzx' },
    include: { student: { include: { user: { select: { name: true } } } } },
    orderBy: { student: { rollNo: 'asc' } },
  })
  console.log('ExamMark rows (should be SUBMITTED with real marks):')
  for (const m of marks) {
    console.log(`  ${m.student.rollNo} ${m.student.user?.name}: marks=${m.marksObtained} status=${m.status} wf=${m.workflowStatus} by=${m.enteredBy}`)
  }
  const drafts = await db.marksScanDraft.count()
  console.log('Remaining scan drafts:', drafts, '(should be 0 — consumed)')
}
main().catch(console.error)
