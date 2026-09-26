import { db } from '../src/lib/db'
async function main() {
  const marks = await db.examMark.findMany({
    where: { examId: 'cmtartfd200bbju860t5szyqv', classId: 'cmugboa84000npwj1woyg8pqz', subjectId: 'cmue8p1zg000fsv8mrd2a0xzx' },
    select: { studentId: true, marksObtained: true, status: true, workflowStatus: true },
  })
  console.log('ExamMark rows for UT2/10-B/Math:', marks.length)
  for (const m of marks) console.log(' ', m.studentId, m.marksObtained, m.status, m.workflowStatus)
  const draft = await db.marksScanDraft.findMany({ select: { rowsJson: true } })
  for (const d of draft) {
    const rows = JSON.parse(d.rowsJson)
    console.log('draft rows sample:', JSON.stringify(rows.slice(0, 2)))
  }
}
main().catch(console.error)
