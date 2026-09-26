import { db } from '../src/lib/db'
async function main() {
  const cls = await db.class.findFirst({ where: { name: 'Grade 9 - A' }, select: { id: true, name: true } })
  const aarav = await db.student.findFirst({ where: { admissionNo: 'DEMO-2026-0001' }, select: { id: true, user: { select: { name: true } } } })
  const records = await db.attendance.findMany({
    where: { classId: cls!.id, studentId: aarav!.id, date: { gte: new Date('2026-09-24') } },
    orderBy: { date: 'desc' },
    select: { id: true, date: true, status: true, markedBy: true },
  })
  console.log('CLASS:', cls?.name, '| STUDENT:', aarav?.user?.name)
  for (const r of records) console.log(r.date.toISOString().slice(0, 10), '|', r.status, '| by:', r.markedBy?.slice(-6) ?? '?')
  const logs = await db.attendanceAuditLog.count({ where: { studentId: aarav!.id } })
  console.log('AUDIT LOGS for Aarav:', logs)
}
main().then(() => process.exit(0))
