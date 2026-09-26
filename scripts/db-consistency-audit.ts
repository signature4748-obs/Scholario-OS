/**
 * PHASE 7 (§19) — Database consistency audit.
 * Checks: duplicate attendance, orphan fee txns, duplicate receipts,
 * orphan/duplicate marks, orphan timetable/CSA records, invalid refs,
 * orphan students/users, stale drafts. READ-ONLY — repairs are separate.
 */
import { db } from '../src/lib/db'

async function main() {
  const issues: string[] = []
  const ok: string[] = []

  // 1. Duplicate attendance (studentId + date) — the unique constraint
  const attRows = await db.attendance.findMany({ select: { studentId: true, date: true } })
  const attKeys = new Map<string, number>()
  for (const r of attRows) {
    const k = r.studentId + '|' + r.date.toISOString().slice(0, 10)
    attKeys.set(k, (attKeys.get(k) || 0) + 1)
  }
  const dupAtt = [...attKeys.entries()].filter(([, n]) => n > 1)
  if (dupAtt.length) { for (const [k, n] of dupAtt.slice(0, 5)) issues.push(`DUPLICATE ATTENDANCE: ${k} ×${n}`) } else ok.push(`attendance: ${attRows.length} rows, 0 duplicates`)

  // 2. Orphan attendance — studentId FKs are required (constraint-enforced);
  // verify the studentIds actually resolve against the Student table.
  const attStudentIds = new Set(await db.student.findMany({ select: { id: true } }).then(rs => rs.map(r => r.id)))
  const attBad = (await db.attendance.findMany({ select: { studentId: true }, distinct: ['studentId'] })).filter(r => !attStudentIds.has(r.studentId))
  if (attBad.length) issues.push(`ORPHAN ATTENDANCE (unresolvable studentId): ${attBad.length}`); else ok.push('attendance: 0 orphan students')

  // 3. Fee transactions — orphans + receipt uniqueness
  const txns = await db.feeTransaction.findMany({ select: { id: true, studentId: true, receiptNo: true, status: true } })
  const orphanTxns = txns.filter(t => t.studentId) // studentId nullable — check resolvability
  const students = await db.student.findMany({ select: { id: true } })
  const studentIds = new Set(students.map(s => s.id))
  const unresolvableTxns = txns.filter(t => t.studentId && !studentIds.has(t.studentId))
  if (unresolvableTxns.length) issues.push(`ORPHAN FEE TXNS (student missing): ${unresolvableTxns.length}`); else ok.push(`fee txns: ${txns.length} rows, all students resolve`)
  const receiptKeys = new Map<string, number>()
  for (const t of txns) { const rk = t.receiptNo || `__noreceipt_${t.id}`; receiptKeys.set(rk, (receiptKeys.get(rk) || 0) + 1) }
  const dupReceipts = [...receiptKeys.entries()].filter(([k, n]) => n > 1 && !k.startsWith('__noreceipt'))
  if (dupReceipts.length) { for (const [k, n] of dupReceipts.slice(0, 5)) issues.push(`DUPLICATE RECEIPT: ${k} ×${n}`) } else ok.push('receipts: 0 duplicates')

  // 4. Exam marks — duplicates per (exam, student, subject)
  const marks = await db.examMark.findMany({ select: { id: true, examId: true, studentId: true, subjectId: true } })
  const markKeys = new Map<string, number>()
  for (const m of marks) { const k = `${m.examId}|${m.studentId}|${m.subjectId}`; markKeys.set(k, (markKeys.get(k) || 0) + 1) }
  const dupMarks = [...markKeys.entries()].filter(([, n]) => n > 1)
  if (dupMarks.length) { for (const [k, n] of dupMarks.slice(0, 5)) issues.push(`DUPLICATE MARKS: ${k} ×${n}`) } else ok.push(`exam marks: ${marks.length} rows, 0 duplicates`)

  // 5. Timetable orphans — classId FK required; verify resolvability
  const classIds = new Set(await db.class.findMany({ select: { id: true } }).then(rs => rs.map(r => r.id)))
  const ttBad = (await db.timetable.findMany({ select: { classId: true }, distinct: ['classId'] })).filter(r => !classIds.has(r.classId))
  if (ttBad.length) issues.push(`ORPHAN TIMETABLE (unresolvable classId): ${ttBad.length}`); else ok.push('timetable: 0 orphan classes')

  // 6. CSA orphans — FKs required; verify resolvability
  const subjectIds = new Set(await db.subject.findMany({ select: { id: true } }).then(rs => rs.map(r => r.id)))
  const csaRows = await db.classSubjectAssignment.findMany({ select: { classId: true, subjectId: true } })
  const csaBad = csaRows.filter(r => !classIds.has(r.classId) || !subjectIds.has(r.subjectId))
  if (csaBad.length) issues.push(`ORPHAN CSA (unresolvable refs): ${csaBad.length}`); else ok.push(`CSA: ${csaRows.length} rows, 0 orphans`)

  // 7. Students without users / users (STUDENT role) without student rows
  const userIds = new Set(await db.user.findMany({ select: { id: true } }).then(rs => rs.map(r => r.id)))
  const stuRows = await db.student.findMany({ select: { userId: true } })
  const stuNoUser = stuRows.filter(s => !userIds.has(s.userId))
  if (stuNoUser.length) issues.push(`STUDENTS WITHOUT USER: ${stuNoUser.length}`); else ok.push('students: all users resolve')
  const studentUsers = await db.user.findMany({ where: { role: 'STUDENT' }, select: { id: true } })
  const stuUserIds = new Set(stuRows.map(s => s.userId))
  const usersWithoutStudent = studentUsers.filter(u => !stuUserIds.has(u.id))
  if (usersWithoutStudent.length) issues.push(`STUDENT USERS WITHOUT STUDENT ROW: ${usersWithoutStudent.length}`); else ok.push('student users: all have student rows')

  // 8. Stale attendance drafts
  const drafts = await db.attendanceDraft.findMany()
  const staleDrafts = drafts.filter(d => {
    const ageH = (Date.now() - d.updatedAt.getTime()) / 3_600_000
    return ageH > 72
  })
  if (staleDrafts.length) issues.push(`STALE ATTENDANCE DRAFTS (>72h): ${staleDrafts.length}`); else ok.push(`attendance drafts: ${drafts.length} (0 stale >72h)`)

  // 9. Sessions expired but present (light check)
  const expiredSessions = await db.session.count({ where: { expiresAt: { lt: new Date() } } })
  if (expiredSessions > 20) issues.push(`EXPIRED SESSIONS CLUTTER: ${expiredSessions}`); else ok.push(`sessions: ${expiredSessions} expired (acceptable)`)

  console.log('=== CONSISTENCY AUDIT RESULT ===')
  for (const o of ok) console.log('  OK  ', o)
  if (issues.length) { console.log('=== ISSUES ==='); for (const i of issues) console.log('  !!  ', i) } else console.log('=== NO ISSUES FOUND ===')
}
main().then(() => process.exit(0))
