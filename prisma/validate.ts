/**
 * SCHOLARIO — DEVELOPMENT DATA VALIDATION SUITE (stabilization §35)
 *
 * Checks the demo database for:
 *   1.  Orphan / invalid logical references (subjects not configured, teachers
 *       not on the roster, students outside valid classes…)
 *   2.  Duplicate canonical records (receipt numbers, subject names…)
 *   3.  Timetable conflicts (class / teacher / room double-booking)
 *   4.  Attendance integrity (canonical identity = student+date)
 *   5.  Marks integrity (range vs ExamSubjectConfig, student-subject validity)
 *   6.  Fee arithmetic (paid <= billed, ledger consistency, verification states)
 *   7.  Teacher-assignment validity (timetable cells vs CSA + roster)
 *   8.  Class-teacher assignments (valid User.id, role TEACHER)
 *   9.  Cross-role consistency (canonical counts per class)
 *   10. Multi-tenant scoping (every row carries the right schoolId)
 *
 * Exit code 0 = ZERO critical errors; 1 = critical issues found.
 * Run: bun prisma/validate.ts   (or bun run db:validate)
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const CRITICAL: string[] = []
const WARNINGS: string[] = []
const OK: string[] = []

function crit(msg: string) { CRITICAL.push(msg) }
function warn(msg: string) { WARNINGS.push(msg) }
function ok(msg: string) { OK.push(msg) }

async function main() {
  const school = await db.school.findFirst({ where: { slug: 'demo-school' } })
  if (!school) { crit('NO demo-school record — the app has no school to boot from'); return }
  const schoolId = school.id

  // ─────────────────────────────────────────────────────────────
  // Load canonical master data
  // ─────────────────────────────────────────────────────────────
  const [classes, subjects, teachers, students, csas] = await Promise.all([
    db.class.findMany({ where: { schoolId }, include: { _count: { select: { students: true } } } }),
    db.subject.findMany({ where: { schoolId } }),
    db.teacher.findMany({ where: { schoolId }, include: { user: true } }),
    db.student.findMany({ where: { schoolId }, include: { user: true, class: true } }),
    db.classSubjectAssignment.findMany({ where: { schoolId }, include: { class: true, subject: true } }),
  ])
  const classById = new Map(classes.map(c => [c.id, c]))
  const subjectById = new Map(subjects.map(s => [s.id, s]))
  const studentById = new Map(students.map(s => [s.id, s]))
  const teacherNames = new Set(teachers.map(t => t.user?.name).filter(Boolean) as string[])
  const activeCSA = new Set(csas.filter(c => c.isActive).map(c => `${c.classId}:${c.subjectId}`))
  const anyCSA = new Set(csas.map(c => `${c.classId}:${c.subjectId}`))

  // ─────────────────────────────────────────────────────────────
  // 1. DUPLICATE SUBJECT NAMES / CODES per school
  // ─────────────────────────────────────────────────────────────
  const byName = new Map<string, number>()
  for (const s of subjects) byName.set(s.name, (byName.get(s.name) ?? 0) + 1)
  for (const [name, n] of byName) if (n > 1) warn(`Duplicate subject name ×${n}: "${name}"`)

  // ─────────────────────────────────────────────────────────────
  // 2. STUDENT → CLASS integrity (§11)
  // ─────────────────────────────────────────────────────────────
  let orphanStudents = 0
  for (const s of students) {
    if (!s.classId) { orphanStudents++; continue }
    if (!classById.has(s.classId)) crit(`Student ${s.user?.email ?? s.id} references MISSING class ${s.classId}`)
  }
  if (orphanStudents > 0) warn(`${orphanStudents} student(s) have no class assignment (classId null)`)

  // ─────────────────────────────────────────────────────────────
  // 3. CLASS-TEACHER assignments valid User.id + TEACHER role (§12)
  // ─────────────────────────────────────────────────────────────
  const teacherUsers = new Map(teachers.map(t => [t.userId, t.user]))
  for (const c of classes) {
    if (!c.classTeacherId) continue
    const u = await db.user.findUnique({ where: { id: c.classTeacherId } })
    if (!u) crit(`Class ${c.name}: classTeacherId ${c.classTeacherId} has NO User row`)
    else if (u.role !== 'TEACHER') crit(`Class ${c.name}: class teacher ${u.email} has role ${u.role} (expected TEACHER)`)
    else if (u.schoolId !== schoolId) crit(`Class ${c.name}: class teacher ${u.email} belongs to another school`)
    else if (!teacherUsers.has(u.id)) warn(`Class ${c.name}: class teacher ${u.email} has no Teacher record`)
  }

  // ─────────────────────────────────────────────────────────────
  // 4. TIMETABLE integrity (§13) — conflicts + config validity
  // ─────────────────────────────────────────────────────────────
  const tt = await db.timetable.findMany({ where: { schoolId }, include: { subject: true, class: true } })
  const validDays = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
  const classSlot = new Map<string, string>()
  const teacherSlot = new Map<string, string>()
  const roomSlot = new Map<string, string>()
  let nullSubject = 0, unconfigured = 0, unknownTeacher = 0, badDay = 0, badPeriod = 0

  for (const row of tt) {
    if (!row.subjectId) { nullSubject++; continue }
    if (!validDays.has(row.day)) { badDay++; crit(`Timetable row ${row.id}: invalid day "${row.day}"`) }
    if (row.period < 1 || row.period > 10) { badPeriod++; crit(`Timetable row ${row.id}: invalid period ${row.period}`) }
    if (!activeCSA.has(`${row.classId}:${row.subjectId}`)) {
      unconfigured++
      crit(`Timetable ${row.day} P${row.period} ${row.class?.name}: subject "${row.subject?.name}" NOT in active class config`)
    }
    if (row.teacherName && !teacherNames.has(row.teacherName)) {
      unknownTeacher++
      crit(`Timetable ${row.day} P${row.period} ${row.class?.name}: teacher "${row.teacherName}" not on the roster`)
    }
    const cs = `${row.classId}|${row.day}|${row.period}`
    if (classSlot.has(cs)) crit(`CLASS CONFLICT: ${row.class?.name} ${row.day} P${row.period} has ${classSlot.get(cs)} AND ${row.subject?.name}`)
    else classSlot.set(cs, row.subject?.name ?? '?')
    if (row.teacherName) {
      const ts = `${row.teacherName}|${row.day}|${row.period}`
      if (teacherSlot.has(ts)) {
        const prev = teacherSlot.get(ts)
        crit(`TEACHER CONFLICT: "${row.teacherName}" ${row.day} P${row.period} → "${prev}" AND "${row.class?.name} · ${row.subject?.name}"`)
      } else teacherSlot.set(ts, `${row.class?.name} · ${row.subject?.name}`)
    }
    if (row.room) {
      const rs = `${row.room}|${row.day}|${row.period}`
      if (roomSlot.has(rs)) {
        const prev = roomSlot.get(rs)
        if (prev !== `${row.class?.name} · ${row.subject?.name}`)
          crit(`ROOM CONFLICT: room ${row.room} ${row.day} P${row.period} → "${prev}" AND "${row.class?.name} · ${row.subject?.name}"`)
      } else roomSlot.set(rs, `${row.class?.name} · ${row.subject?.name}`)
    }
  }
  if (nullSubject > 0) crit(`${nullSubject} timetable rows with NULL subject (orphan slots)`)
  if (unknownTeacher > 0) crit(`${unknownTeacher} timetable rows reference off-roster teachers`)

  // ─────────────────────────────────────────────────────────────
  // 5. CSA sanity: subject referenced must exist in the SAME school
  // ─────────────────────────────────────────────────────────────
  for (const csa of csas) {
    if (!subjectById.has(csa.subjectId)) crit(`CSA ${csa.id}: subject ${csa.subjectId} missing from school subjects`)
    if (!classById.has(csa.classId)) crit(`CSA ${csa.id}: class ${csa.classId} missing from school classes`)
  }

  // ─────────────────────────────────────────────────────────────
  // 6. ATTENDANCE integrity (§14) — canonical student+date identity
  // ─────────────────────────────────────────────────────────────
  const att = await db.attendance.findMany({ where: { schoolId } })
  const attKey = new Set<string>()
  const VALID_STATUS = new Set(['PRESENT', 'ABSENT', 'LATE', 'LEAVE'])
  let attDupe = 0, badStatus = 0, badClass = 0, badStudent = 0
  for (const a of att) {
    const k = `${a.studentId}|${a.date.toISOString().slice(0, 10)}`
    if (attKey.has(k)) { attDupe++; crit(`Attendance duplicate: student ${a.studentId} on ${k.split('|')[1]}`) }
    attKey.add(k)
    if (!VALID_STATUS.has(a.status)) { badStatus++; crit(`Attendance ${a.id}: invalid status "${a.status}"`) }
    if (!studentById.has(a.studentId)) { badStudent++; crit(`Attendance ${a.id}: unknown student ${a.studentId}`) }
    else {
      const st = studentById.get(a.studentId)!
      if (a.classId && st.classId && a.classId !== st.classId) { badClass++; crit(`Attendance ${a.id}: classId ${a.classId} ≠ student's class ${st.classId}`) }
    }
  }
  if (attDupe === 0 && badStatus === 0 && badClass === 0 && badStudent === 0)
    ok(`Attendance: ${att.length} rows, canonical identity intact`)

  // ─────────────────────────────────────────────────────────────
  // 7. EXAM MARKS integrity (§15)
  // ─────────────────────────────────────────────────────────────
  const marks = await db.examMark.findMany({ where: { exam: { schoolId } } })
  const escConfigs = await db.examSubjectConfig.findMany({ where: { exam: { schoolId } } })
  const escKey = new Map(escConfigs.map(c => [`${c.examId}:${c.classId}:${c.subjectId}`, c]))
  let outOfRange = 0, noConfig = 0, studentNotInClass = 0, subjectNotConfigured = 0
  for (const m of marks) {
    const cfg = escKey.get(`${m.examId}:${m.classId}:${m.subjectId}`)
    if (!cfg) { noConfig++; warn(`ExamMark ${m.id}: no ExamSubjectConfig for exam/class/subject`) }
    if (m.marksObtained != null) {
      const max = cfg?.maxMarks ?? 100
      if (m.marksObtained < 0 || m.marksObtained > max) { outOfRange++; crit(`ExamMark ${m.id}: ${m.marksObtained} outside 0..${max}`) }
    }
    const st = studentById.get(m.studentId)
    if (!st) crit(`ExamMark ${m.id}: unknown student ${m.studentId}`)
    else if (st.classId !== m.classId) { studentNotInClass++; crit(`ExamMark ${m.id}: student ${st.user?.email} is in ${st.class?.name} but mark is for ${classById.get(m.classId)?.name}`) }
    if (!anyCSA.has(`${m.classId}:${m.subjectId}`)) { subjectNotConfigured++; crit(`ExamMark ${m.id}: subject not configured for class`) }
  }

  // ─────────────────────────────────────────────────────────────
  // 8. RESULT (legacy) integrity
  // ─────────────────────────────────────────────────────────────
  const results = await db.result.findMany({ include: { student: { include: { class: true } }, subject: true, exam: true } })
  for (const r of results) {
    if (r.marks < 0 || r.marks > r.totalMarks) crit(`Result ${r.id}: ${r.marks}/${r.totalMarks} out of range`)
    if (r.student.classId && !anyCSA.has(`${r.student.classId}:${r.subjectId}`))
      warn(`Result ${r.id}: subject "${r.subject.name}" not in CSA for ${r.student.class?.name} (historical?)`)
  }

  // ─────────────────────────────────────────────────────────────
  // 9. FEE arithmetic (§16)
  // ─────────────────────────────────────────────────────────────
  const fees = await db.fee.findMany({ where: { schoolId }, include: { payments: true, student: true } })
  let feeOverflow = 0, feeStatusMismatch = 0, orphanFeeStudent = 0
  for (const f of fees) {
    if (f.paid < 0 || f.paid > f.amount) { feeOverflow++; crit(`Fee ${f.id} (${f.title}): paid ${f.paid} outside 0..${f.amount}`) }
    const expectStatus = f.paid >= f.amount ? 'PAID' : f.paid > 0 ? 'PARTIAL' : 'UNPAID'
    if (f.status === 'PAID' && expectStatus !== 'PAID') { feeStatusMismatch++; warn(`Fee ${f.id}: status PAID but paid ${f.paid}/${f.amount}`) }
    if (f.paid > 0 && f.status === 'UNPAID') { feeStatusMismatch++; crit(`Fee ${f.id}: paid ${f.paid} but status UNPAID`) }
    if (!f.student) { orphanFeeStudent++; crit(`Fee ${f.id}: student ${f.studentId} has no Student row`) }
  }

  // FeeTransaction ledger — receiptNo uniqueness + verification states
  const txns = await db.feeTransaction.findMany({ where: { schoolId } })
  const receiptNo = new Map<string, number>()
  let badTxnState = 0, orphanTxnStudent = 0, pendingAsPaid = 0
  for (const t of txns) {
    if (t.receiptNo) receiptNo.set(t.receiptNo, (receiptNo.get(t.receiptNo) ?? 0) + 1)
    if (t.studentId && !studentById.has(t.studentId)) { orphanTxnStudent++; crit(`FeeTransaction ${t.id}: unknown student ${t.studentId}`) }
    if (t.status === 'PENDING' && t.verifiedAt) { badTxnState++; crit(`FeeTransaction ${t.id}: PENDING but verifiedAt set`) }
    if (t.status === 'UNDER_VERIFICATION' && t.verifiedAt) { pendingAsPaid++; crit(`FeeTransaction ${t.id}: UNDER_VERIFICATION but verifiedAt set (pending counted as paid!)`) }
    if (t.status === 'REJECTED' && t.verifiedAt) { badTxnState++; crit(`FeeTransaction ${t.id}: REJECTED but verifiedAt set`) }
    if (t.amount <= 0) crit(`FeeTransaction ${t.id}: non-positive amount ${t.amount}`)
  }
  for (const [rn, n] of receiptNo) if (n > 1) crit(`DUPLICATE RECEIPT: "${rn}" appears on ${n} transactions`)

  // ─────────────────────────────────────────────────────────────
  // 10. BEHAVIOR records reference valid students/teachers
  // ─────────────────────────────────────────────────────────────
  const behavior = await db.behaviorRecord.findMany({ where: { schoolId } })
  for (const b of behavior) {
    if (!studentById.has(b.studentId)) crit(`BehaviorRecord ${b.id}: unknown student ${b.studentId}`)
    if (!b.recordedById) crit(`BehaviorRecord ${b.id}: no recording teacher`)
  }

  // ─────────────────────────────────────────────────────────────
  // 11. CROSS-ROLE canonical counts (§8) — the numbers every role must agree on
  // ─────────────────────────────────────────────────────────────
  console.log('\n── CANONICAL CLASS ROSTERS (must match in every role view) ──')
  for (const c of classes.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`   ${c.name.padEnd(14)} students=${String(c._count.students).padStart(2)}  room=${c.room ?? '-'}  classTeacher=${c.classTeacherId ? teacherUsers.get(c.classTeacherId)?.name ?? '?' : '—'}`)
  }
  const totalStudents = students.length
  console.log(`   TOTAL students=${totalStudents}, classes=${classes.length}, subjects=${subjects.length}, active-CSA=${activeCSA.size}, timetable-rows=${tt.length}`)

  // ─────────────────────────────────────────────────────────────
  // 12. MULTI-TENANT scoping (§31) — every row must point at the SAME school
  // ─────────────────────────────────────────────────────────────
  const [attSchools, ttSchools, csaSchools, subjectSchools, classSchools, feeSchools, feeTxnSchools] = await Promise.all([
    db.attendance.findMany({ distinct: ['schoolId'], select: { schoolId: true } }),
    db.timetable.findMany({ distinct: ['schoolId'], select: { schoolId: true } }),
    db.classSubjectAssignment.findMany({ distinct: ['schoolId'], select: { schoolId: true } }),
    db.subject.findMany({ distinct: ['schoolId'], select: { schoolId: true } }),
    db.class.findMany({ distinct: ['schoolId'], select: { schoolId: true } }),
    db.fee.findMany({ distinct: ['schoolId'], select: { schoolId: true } }),
    db.feeTransaction.findMany({ distinct: ['schoolId'], select: { schoolId: true } }),
  ])
  const leaky = [
    ...attSchools, ...ttSchools, ...csaSchools, ...subjectSchools,
    ...classSchools, ...feeSchools, ...feeTxnSchools,
  ].filter(r => r.schoolId !== schoolId)
  if (leaky.length > 0) crit(`${leaky.length} row-set(s) reference a DIFFERENT school than the demo school (cross-tenant leak)`)

  // ─────────────────────────────────────────────────────────────
  // REPORT
  // ─────────────────────────────────────────────────────────────
  console.log('\n════════════ VALIDATION REPORT ════════════')
  console.log(`Subjects: ${subjects.length} | Classes: ${classes.length} | Students: ${students.length} | Teachers: ${teachers.length}`)
  console.log(`CSA: ${csas.length} (${activeCSA.size} active) | Timetable: ${tt.length} rows | Attendance: ${att.length} | ExamMarks: ${marks.length} | Results: ${results.length}`)
  console.log(`Fees: ${fees.length} | FeeTransactions: ${txns.length} | Behavior: ${behavior.length}`)
  if (OK.length) { console.log(`\n✔ PASSED CHECKS (${OK.length}):`); OK.forEach(m => console.log(`   ✓ ${m}`)) }
  if (WARNINGS.length) { console.log(`\n⚠ WARNINGS (${WARNINGS.length}):`); WARNINGS.slice(0, 40).forEach(m => console.log(`   ⚠ ${m}`)) }
  if (CRITICAL.length) {
    console.log(`\n✘ CRITICAL ISSUES (${CRITICAL.length}):`)
    CRITICAL.forEach(m => console.log(`   ✘ ${m}`))
    process.exitCode = 1
  } else {
    console.log('\n✔ ZERO CRITICAL DATA ERRORS — database is internally consistent.')
  }
}

main()
  .catch(e => { console.error('VALIDATION CRASHED:', e); process.exitCode = 2 })
  .finally(() => db.$disconnect())
