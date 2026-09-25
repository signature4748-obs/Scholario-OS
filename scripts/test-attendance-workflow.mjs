import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const base = 'http://localhost:3000'

const login = async (email) => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'teacher123' }),
  })
  await res.text().catch(() => "");
  return res.headers.get("set-cookie")?.split(";")[0] ?? ""
}
const rohan = await login('rohan.mehta@greenwood.edu.in')
const priya = await login('priya.iyer@greenwood.edu.in')
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null) })

const school = await db.school.findFirst({ where: { slug: { contains: 'demo' } } })
  ?? await db.school.findFirst()
const nineA = await db.class.findFirst({ where: { schoolId: school.id, name: { contains: '9' }, section: 'A' } })
const students = await db.student.findMany({ where: { classId: nineA.id }, select: { id: true }, orderBy: { rollNo: 'asc' } })
const today = new Date().toISOString().slice(0, 10)
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

// ── TEST 1: draft → before-boundary rejection → temp boundary → finalize
const draftEntries = students.map((s, i) => ({ studentId: s.id, status: i === 2 ? 'ABSENT' : 'PRESENT' }))
let r = await j(await fetch(`${base}/api/teacher/class-attendance/draft`, {
  method: 'PUT', headers: { cookie: rohan, 'Content-Type': 'application/json' },
  body: JSON.stringify({ classId: nineA.id, date: today, entries: draftEntries }),
}))
console.log('T1 PUT draft:', r.status, JSON.stringify(r.body))

r = await j(await fetch(`${base}/api/teacher/class-attendance/board?classId=${nineA.id}&date=${today}`, { headers: { cookie: rohan } }))
console.log('T1 board draft exists:', r.body?.data?.draft?.exists, 'source:', r.body?.data?.draft?.source)

r = await j(await fetch(`${base}/api/teacher/class-attendance/draft?classId=${nineA.id}&date=${today}`, { method: 'POST', headers: { cookie: rohan } }))
console.log('T1 finalize BEFORE boundary:', r.status, JSON.stringify(r.body))

// lower the boundary to 01:00 for the test
await db.attendanceSetting.upsert({
  where: { schoolId: school.id },
  create: { schoolId: school.id, autosaveFinalize: true, endOfDayMinutes: 60 },
  update: { autosaveFinalize: true, endOfDayMinutes: 60 },
})
r = await j(await fetch(`${base}/api/teacher/class-attendance/draft?classId=${nineA.id}&date=${today}`, { method: 'POST', headers: { cookie: rohan } }))
console.log('T1 finalize AFTER boundary:', r.status, JSON.stringify(r.body))

r = await j(await fetch(`${base}/api/teacher/class-attendance/board?classId=${nineA.id}&date=${today}`, { headers: { cookie: rohan } }))
const b = r.body?.data
console.log('T1 post-finalize: baseline.exists:', b?.baseline?.exists, 'markedBy:', b?.baseline?.markedBy, 'counts:', JSON.stringify(b?.baseline?.counts), 'draft:', b?.draft?.exists)

// idempotency: finalize again → already-submitted
r = await j(await fetch(`${base}/api/teacher/class-attendance/draft?classId=${nineA.id}&date=${today}`, { method: 'POST', headers: { cookie: rohan } }))
console.log('T1 finalize again (idempotent):', r.status, JSON.stringify(r.body))

// ── TEST 2: edit audit (yesterday, seeded attendance)
const dayStart = new Date(`${yesterday}T00:00:00.000Z`)
const dayEnd = new Date(dayStart.getTime() + 86400000)
const before = await db.attendance.findMany({ where: { classId: nineA.id, date: { gte: dayStart, lt: dayEnd } } })
const beforeCount = before.length
const prevStatuses = Object.fromEntries(before.map((x) => [x.studentId, x.status]))
console.log('T2 yesterday rows:', beforeCount, 'sample:', JSON.stringify(Object.values(prevStatuses).slice(0, 5)))
// change first student's status
const edited = students.map((s, i) => ({ studentId: s.id, status: i === 0 ? 'LATE' : (prevStatuses[s.id] ?? 'PRESENT') }))
r = await j(await fetch(`${base}/api/teacher/class-attendance/baseline`, {
  method: 'POST', headers: { cookie: rohan, 'Content-Type': 'application/json' },
  body: JSON.stringify({ classId: nineA.id, date: yesterday, entries: edited }),
}))
console.log('T2 baseline edit:', r.status, JSON.stringify(r.body))
const after = await db.attendance.findMany({ where: { classId: nineA.id, date: { gte: dayStart, lt: dayEnd } } })
console.log('T2 rows after edit (must equal):', after.length)
const audits = await db.attendanceAuditLog.findMany({ where: { classId: nineA.id }, orderBy: { createdAt: 'desc' }, take: 3 })
console.log('T2 audit rows:', audits.length, JSON.stringify(audits.map(a => ({ prev: a.previousStatus, new: a.newStatus, by: a.changedBy, src: a.source }))))

// Priya reads the SAME canonical record (prefill) — no duplicates
r = await j(await fetch(`${base}/api/teacher/class-attendance/board?classId=${nineA.id}&date=${yesterday}`, { headers: { cookie: priya } }))
const pb = r.body?.data
console.log('T3 priya board: isClassTeacher:', pb?.isClassTeacher, 'subjects:', pb?.subjects?.map(s => s.name), 'baseline.exists:', pb?.baseline?.exists, 'baseline entries sample:', JSON.stringify(Object.entries(pb?.baseline?.entries ?? {}).slice(0, 3)))

// Priya saves the same data as her English session → canonical unchanged, NO new audit (no changes)
r = await j(await fetch(`${base}/api/teacher/class-attendance/session`, {
  method: 'POST', headers: { cookie: priya, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    classId: nineA.id, subjectId: pb.subjects.find(s => s.name === 'English')?.id, date: yesterday,
    entries: students.map((s) => ({ studentId: s.id, status: prevStatuses[s.id] ?? 'PRESENT' })),
  }),
}))
console.log('T3 priya session save (same data):', r.status, JSON.stringify(r.body))
const after2 = await db.attendance.findMany({ where: { classId: nineA.id, date: { gte: dayStart, lt: dayEnd } } })
const audits2 = await db.attendanceAuditLog.findMany({ where: { classId: nineA.id } })
console.log('T3 rows (no duplicates — must equal):', after2.length, 'audit total:', audits2.length)

// board audit list renders for rohan
r = await j(await fetch(`${base}/api/teacher/class-attendance/board?classId=${nineA.id}&date=${today}`, { headers: { cookie: rohan } }))
console.log('T3 board audit list:', JSON.stringify(r.body?.data?.audit))

// ── cleanup: restore boundary 930; keep yesterday's honest LATE edit + audit
await db.attendanceSetting.update({ where: { schoolId: school.id }, data: { endOfDayMinutes: 930 } })
// remove today's autosaved test rows to preserve the "9-A today unmarked" demo state + its zero-audit
const del = await db.attendance.deleteMany({ where: { classId: nineA.id, date: { gte: new Date(`${today}T00:00:00.000Z`), lt: new Date(new Date(`${today}T00:00:00.000Z`).getTime() + 86400000) } } })
console.log('cleanup today autosave rows deleted:', del.count)
await db.attendanceDraft.deleteMany({ where: { classId: nineA.id } })
console.log('cleanup drafts cleared')
await db.$disconnect()
