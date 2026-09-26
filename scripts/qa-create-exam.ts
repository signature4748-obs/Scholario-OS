import { db } from '../src/lib/db'
async function main() {
  const school = await db.school.findFirst({ where: { name: { contains: 'Demo' } } })
  const cls = await db.class.findFirst({ where: { schoolId: school.id, name: { contains: '10' }, section: 'B' } })
  const subject = await db.subject.findFirst({ where: { schoolId: school.id, name: 'Mathematics' } })
  const exam = await db.exam.create({
    data: {
      schoolId: school.id,
      name: 'QA Scan Verification Test',
      term: 'QA',
      type: 'Unit Test',
      session: '2026-2027',
      status: 'Ongoing',
      resultStatus: 'In Progress',
      startDate: new Date('2026-09-28'),
      endDate: new Date('2026-09-29'),
    },
  })
  await db.examClass.create({ data: { examId: exam.id, classId: cls.id } })
  await db.examSubjectConfig.create({
    data: { examId: exam.id, classId: cls.id, subjectId: subject.id, maxMarks: 100, passMarks: 33 },
  })
  console.log('QA exam created:', exam.id, 'for', cls.name + '-' + cls.section)
}
main().catch(console.error)
