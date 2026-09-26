/**
 * SCHOLARIO — Class & Student Management master refinement (Task 1, Phase A)
 * One-shot data restructure: canonical student universe + realistic faculty.
 *
 * Run: bun run scripts/seed-refactor.ts
 * Idempotency: guarded — skips if Grade 3-A already exists.
 */
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const SCHOOL_DOMAIN = 'greenwood.edu.in'
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const PERIODS: { p: number; start: string; end: string }[] = [
  { p: 1, start: '08:30', end: '09:15' },
  { p: 2, start: '09:15', end: '10:00' },
  { p: 3, start: '10:00', end: '10:45' },
  { p: 4, start: '11:00', end: '11:45' },
  { p: 5, start: '11:45', end: '12:30' },
  { p: 6, start: '13:15', end: '14:00' },
  { p: 7, start: '14:00', end: '14:45' },
]

// deterministic PRNG so reruns produce a stable timetable
let rngState = 20260925
function rnd(): number {
  rngState = (rngState * 1103515245 + 12345) % 2147483648
  return rngState / 2147483648
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)]
}

async function main() {
  const school = await db.school.findFirst({ where: { name: { contains: 'Scholario' } } })
  if (!school) throw new Error('Demo school not found')
  const schoolId = school.id

  const existing3A = await db.class.findFirst({ where: { schoolId, name: 'Grade 3 - A' } })
  if (existing3A) {
    const pa1Check = await db.exam.findFirst({ where: { schoolId, name: 'Periodic Assessment 1' } })
    const c9aCheck = await db.class.findFirst({ where: { schoolId, name: 'Grade 9 - A' } })
    const marksDone =
      pa1Check && c9aCheck
        ? (await db.examMark.count({ where: { examId: pa1Check.id, classId: c9aCheck.id, marksObtained: { not: null } } })) >= 50
        : false
    const topicsDone =
      (await db.curriculumTopic.count({ where: { schoolId, classId: existing3A.id } })) > 0
    if (marksDone && topicsDone) {
      console.log('Seed fully applied already — nothing to do.')
      return
    }
    console.log('Resuming: structural steps done, finishing marks + curriculum…')
    await finishSeed(schoolId, existing3A)
    return
  }

  // ────────────────────────────────────────────────────────────────────
  // STEP 1 — MERGE the duplicate Aarav universe into ONE canonical student
  // ────────────────────────────────────────────────────────────────────
  const rohan = await db.user.findUnique({ where: { email: 'rohan.mehta@greenwood.edu.in' } })
  if (!rohan) throw new Error('Rohan (teacher login) not found')
  const pwHash = rohan.passwordHash

  const loginAaravUser = await db.user.findUnique({ where: { email: 'aarav.sharma@greenwood.edu.in' } })
  const fillerAaravUser = await db.user.findUnique({ where: { email: 'student1@demoschool.edu' } })
  if (!loginAaravUser || !fillerAaravUser) throw new Error('Aarav rows not found')
  const loginAarav = await db.student.findUnique({ where: { userId: loginAaravUser.id } })
  const fillerAarav = await db.student.findUnique({ where: { userId: fillerAaravUser.id } })
  if (!loginAarav || !fillerAarav) throw new Error('Aarav student rows not found')
  console.log(`Merging student1-Aarav (${fillerAarav.id.slice(-6)}) → login Aarav (${loginAarav.id.slice(-6)})`)

  // 1a — canonical identity: roll 01 · DEMO-2026-0001, richer profile fields win
  const fillerFields = {
    guardianName: fillerAarav.guardianName,
    guardianPhone: fillerAarav.guardianPhone,
    dob: fillerAarav.dob,
    gender: fillerAarav.gender,
    bloodGroup: fillerAarav.bloodGroup,
    address: fillerAarav.address,
  }
  await db.student.update({
    where: { id: loginAarav.id },
    data: {
      rollNo: '01',
      admissionNo: 'DEMO-2026-0001',
      classId: fillerAarav.classId ?? loginAarav.classId,
      guardianName: loginAarav.guardianName ?? fillerFields.guardianName,
      guardianPhone: loginAarav.guardianPhone ?? fillerFields.guardianPhone,
      dob: loginAarav.dob ?? fillerFields.dob,
      gender: loginAarav.gender ?? fillerFields.gender,
      bloodGroup: loginAarav.bloodGroup ?? fillerFields.bloodGroup,
      address: loginAarav.address ?? fillerFields.address,
    },
  })

  // 1b — migrate every STUDENT-scoped child row from the filler row
  const F = fillerAarav.id
  const G = loginAarav.id
  const skipDates = new Set(
    (await db.attendance.findMany({ where: { studentId: G }, select: { date: true } })).map((a) => a.date.toISOString().slice(0, 10)),
  )
  const dupAtt = await db.attendance.findMany({ where: { studentId: F, date: { in: [...skipDates].map((d) => new Date(d)) } }, select: { id: true } })
  if (dupAtt.length) await db.attendance.deleteMany({ where: { id: { in: dupAtt.map((a) => a.id) } } })
  await db.attendance.updateMany({ where: { studentId: F }, data: { studentId: G } })
  await db.fee.updateMany({ where: { studentId: F }, data: { studentId: G } })
  await db.feeTransaction.updateMany({ where: { studentId: F }, data: { studentId: G } })
  await db.behaviorRecord.updateMany({ where: { studentId: F }, data: { studentId: G } })
  await db.teacherFollowUp.updateMany({ where: { studentId: F }, data: { studentId: G } })
  await db.parentConversation.updateMany({ where: { studentId: F }, data: { studentId: G } })
  // marks/results: reassign non-conflicting, delete conflicting duplicates
  const em = await db.examMark.findMany({ where: { studentId: F } })
  for (const m of em) {
    const clash = await db.examMark.findFirst({
      where: { examId: m.examId, classId: m.classId, subjectId: m.subjectId, studentId: G },
    })
    if (clash) await db.examMark.delete({ where: { id: m.id } })
    else await db.examMark.update({ where: { id: m.id }, data: { studentId: G } })
  }
  const rr = await db.result.findMany({ where: { studentId: F } })
  for (const r of rr) {
    const clash = await db.result.findFirst({
      where: { examId: r.examId, subjectId: r.subjectId, studentId: G },
    })
    if (clash) await db.result.delete({ where: { id: r.id } })
    else await db.result.update({ where: { id: r.id }, data: { studentId: G } })
  }
  await db.learningActivity.updateMany({ where: { studentId: F }, data: { studentId: G } })
  await db.learningBookmark.updateMany({ where: { studentId: F }, data: { studentId: G } })
  await db.studyTask.updateMany({ where: { studentId: F }, data: { studentId: G } })
  await db.studyGroupMember.updateMany({ where: { studentId: F }, data: { studentId: G } })
  await db.studyGroupQuestion.updateMany({ where: { studentId: F }, data: { studentId: G } })
  await db.flashcardReviewState.updateMany({ where: { studentId: F }, data: { studentId: G } })
  await db.studyMaterialTarget.updateMany({ where: { studentId: F }, data: { studentId: G } })
  await db.bookIssue.updateMany({ where: { studentId: F }, data: { studentId: G } })
  // Relations with their own unique constraints (e.g. ExamAttendance's
  // examId+studentId+subjectId+date) — reassign row-by-row, deleting the
  // filler's copy when the canonical student already has one.
  const migrateUnique = async (
    find: () => Promise<{ id: string }[]>,
    update: (id: string) => Promise<unknown>,
    del: (id: string) => Promise<unknown>,
    label: string,
  ) => {
    const rows = await find()
    for (const r of rows) {
      try {
        await update(r.id)
      } catch (e: unknown) {
        if ((e as { code?: string })?.code === 'P2002') {
          await del(r.id)
        } else {
          console.warn(`  ! ${label} row ${r.id.slice(-6)} not migrated:`, (e as Error).message)
        }
      }
    }
  }
  await migrateUnique(
    () => db.examAttendance.findMany({ where: { studentId: F }, select: { id: true } }),
    (id) => db.examAttendance.update({ where: { id }, data: { studentId: G } }),
    (id) => db.examAttendance.delete({ where: { id } }),
    'examAttendance',
  )
  await migrateUnique(
    () => db.examSeatAssignment.findMany({ where: { studentId: F }, select: { id: true } }),
    (id) => db.examSeatAssignment.update({ where: { id }, data: { studentId: G } }),
    (id) => db.examSeatAssignment.delete({ where: { id } }),
    'examSeatAssignment',
  )
  await migrateUnique(
    () => db.examResultOutcome.findMany({ where: { studentId: F }, select: { id: true } }),
    (id) => db.examResultOutcome.update({ where: { id }, data: { studentId: G } }),
    (id) => db.examResultOutcome.delete({ where: { id } }),
    'examResultOutcome',
  )
  await migrateUnique(
    () => db.homeworkSubmission.findMany({ where: { studentId: F }, select: { id: true } }),
    (id) => db.homeworkSubmission.update({ where: { id }, data: { studentId: G } }),
    (id) => db.homeworkSubmission.delete({ where: { id } }),
    'homeworkSubmission',
  )

  // 1c — delete the filler user (cascades: sessions, its Student row)
  await db.user.delete({ where: { id: fillerAaravUser.id } })
  console.log('  ✔ Aarav merged: login user is now roll 01 · DEMO-2026-0001 with the full fee ledger')

  // ────────────────────────────────────────────────────────────────────
  // STEP 2 — FACULTY: emails/logins for existing teachers + 5 new teachers
  // ────────────────────────────────────────────────────────────────────
  const teacherSpecs: { name: string; email: string; subjects: string; dept: string; employeeId: string }[] = [
    { name: 'Mrs. Kavita Sharma', email: `kavita.sharma@${SCHOOL_DOMAIN}`, subjects: 'SCI', dept: 'Science', employeeId: 'GW-T-102' },
    { name: 'Mr. Arjun Nair', email: `arjun.nair@${SCHOOL_DOMAIN}`, subjects: '', dept: 'Class Teacher Corps', employeeId: 'GW-T-103' },
    { name: 'Ms. Priya Iyer', email: `priya.iyer@${SCHOOL_DOMAIN}`, subjects: 'ENG,BIO', dept: 'Languages', employeeId: 'GW-T-104' },
    { name: 'Mrs. Meera Krishnan', email: `meera.krishnan@${SCHOOL_DOMAIN}`, subjects: 'HIN,SST', dept: 'Humanities', employeeId: 'GW-T-105' },
    { name: 'Mrs. Sunita Rao', email: `sunita.rao@${SCHOOL_DOMAIN}`, subjects: 'ENG,MAT,EVS', dept: 'Primary', employeeId: 'GW-T-106' },
    { name: 'Mr. Deepak Kulkarni', email: `deepak.kulkarni@${SCHOOL_DOMAIN}`, subjects: 'MAT,SCI', dept: 'Middle School', employeeId: 'GW-T-107' },
    { name: 'Mr. Vikram Desai', email: `vikram.desai@${SCHOOL_DOMAIN}`, subjects: 'PHY,CHE,MAT', dept: 'Science', employeeId: 'GW-T-108' },
    { name: 'Mrs. Lakshmi Menon', email: `lakshmi.menon@${SCHOOL_DOMAIN}`, subjects: 'ENG,HIS,POL', dept: 'Humanities', employeeId: 'GW-T-109' },
  ]
  const teacherIdByName = new Map<string, string>()
  for (const spec of teacherSpecs) {
    let u = await db.user.findFirst({ where: { name: spec.name, schoolId, role: 'TEACHER' } })
    if (!u) {
      u = await db.user.create({
        data: { schoolId, email: spec.email, passwordHash: pwHash, name: spec.name, role: 'TEACHER', status: 'ACTIVE' },
      })
    } else if (u.email !== spec.email) {
      u = await db.user.update({ where: { id: u.id }, data: { email: spec.email, passwordHash: pwHash, status: 'ACTIVE' } })
    }
    const t = await db.teacher.findUnique({ where: { userId: u.id } })
    if (t) {
      await db.teacher.update({ where: { id: t.id }, data: { subjects: spec.subjects, department: spec.dept, employeeId: spec.employeeId } })
    } else {
      await db.teacher.create({
        data: { schoolId, userId: u.id, subjects: spec.subjects, department: spec.dept, employeeId: spec.employeeId },
      })
    }
    teacherIdByName.set(spec.name, u.id)
  }
  await db.teacher.updateMany({ where: { userId: rohan.id }, data: { subjects: 'MAT', department: 'Mathematics', employeeId: 'GW-T-101' } })
  console.log(`  ✔ Faculty ready (${teacherSpecs.length + 1} teachers, logins @${SCHOOL_DOMAIN} · teacher123)`)

  // ────────────────────────────────────────────────────────────────────
  // STEP 3 — CLASSES: new Grade 3-A + Grade 10-B, streams, class teachers
  // ────────────────────────────────────────────────────────────────────
  const mkClass = async (name: string, section: string, stream: string, room: string, grade: string) => {
    const existing = await db.class.findFirst({ where: { schoolId, name } })
    if (existing) {
      return db.class.update({ where: { id: existing.id }, data: { section, stream, room, gradeLevel: grade } })
    }
    return db.class.create({ data: { schoolId, name, section, stream, room, gradeLevel: grade, capacity: 40 } })
  }
  const c3a = await mkClass('Grade 3 - A', 'A', 'General', 'Room 104', '3')
  const c6a = await mkClass('Grade 6 - A', 'A', 'General', 'Room 108', '6')
  const c7a = await mkClass('Grade 7 - A', 'A', 'General', 'Room 112', '7')
  const c8a = await mkClass('Grade 8 - A', 'A', 'General', 'Room 116', '8')
  const c9a = await mkClass('Grade 9 - A', 'A', 'General', 'Room 204', '9')
  const c10a = await mkClass('Grade 10 - A', 'A', 'General', 'Room 205', '10')
  const c10b = await mkClass('Grade 10 - B', 'B', 'General', 'Room 206', '10')
  const c11a = await mkClass('Grade 11 - A', 'A', 'Science-PCB', 'Lab 1', '11')
  const c11b = await mkClass('Grade 11 - B', 'B', 'Humanities', 'Room 301', '11')
  const c12a = await mkClass('Grade 12 - A', 'A', 'Science-PCM', 'Lab 2', '12')
  const c12b = await mkClass('Grade 12 - B', 'B', 'Humanities', 'Room 302', '12')

  const CT: Record<string, string | null> = {
    [c3a.id]: teacherIdByName.get('Mrs. Sunita Rao')!,
    [c6a.id]: teacherIdByName.get('Mr. Deepak Kulkarni')!,
    [c7a.id]: null,
    [c8a.id]: null,
    [c9a.id]: rohan.id,
    [c10a.id]: teacherIdByName.get('Mrs. Kavita Sharma')!,
    [c10b.id]: teacherIdByName.get('Mr. Arjun Nair')!,
    [c11a.id]: null,
    [c11b.id]: teacherIdByName.get('Mrs. Lakshmi Menon')!,
    [c12a.id]: null,
    [c12b.id]: null,
  }
  for (const [classId, ctId] of Object.entries(CT)) {
    await db.class.update({ where: { id: classId }, data: { classTeacherId: ctId } })
  }
  console.log('  ✔ Classes: 3-A + 10-B created; streams set (11-A PCB · 12-A PCM · 11-B/12-B Humanities); CTs appointed')

  // ────────────────────────────────────────────────────────────────────
  // STEP 4 — SUBJECTS + ClassSubjectAssignments (Principal's curriculum)
  // ────────────────────────────────────────────────────────────────────
  const mkSubject = async (name: string, code: string) => {
    const s = await db.subject.findFirst({ where: { schoolId, code } })
    if (s) return db.subject.update({ where: { id: s.id }, data: { name, status: 'Active' } })
    return db.subject.create({ data: { schoolId, name, code, fullMarks: 100, passMarks: 33 } })
  }
  const subj = {
    ENG: await mkSubject('English', 'ENG'),
    MAT: await mkSubject('Mathematics', 'MAT'),
    SCI: await mkSubject('Science', 'SCI'),
    SST: await mkSubject('Social Science', 'SST'),
    HIN: await mkSubject('Hindi', 'HIN'),
    PHY: await mkSubject('Physics', 'PHY'),
    CHE: await mkSubject('Chemistry', 'CHE'),
    BIO: await mkSubject('Biology', 'BIO'),
    ECO: await mkSubject('Economics', 'ECO'),
    EVS: await mkSubject('Environmental Studies', 'EVS'),
    HIS: await mkSubject('History', 'HIS'),
    POL: await mkSubject('Political Science', 'POL'),
  }
  const CSA: Record<string, string[]> = {
    [c3a.id]: ['ENG', 'MAT', 'EVS'],
    [c6a.id]: ['MAT', 'SCI', 'SST', 'ENG', 'HIN'],
    [c7a.id]: ['MAT', 'SCI', 'SST', 'ENG', 'HIN'],
    [c8a.id]: ['MAT', 'SCI', 'SST', 'ENG', 'HIN'],
    [c9a.id]: ['MAT', 'SCI', 'SST', 'ENG', 'HIN'],
    [c10a.id]: ['MAT', 'SCI', 'SST', 'ENG', 'HIN'],
    [c10b.id]: ['MAT', 'SCI', 'SST', 'ENG', 'HIN'],
    [c11a.id]: ['PHY', 'CHE', 'BIO', 'ENG'],
    [c11b.id]: ['ENG', 'HIS', 'POL', 'ECO'],
    [c12a.id]: ['PHY', 'CHE', 'MAT', 'ENG'],
    [c12b.id]: ['ENG', 'HIS', 'POL'],
  }
  // remove assignments that no longer apply, then (re)create the target set
  const allClassIds = Object.keys(CSA)
  await db.classSubjectAssignment.deleteMany({ where: { schoolId, classId: { in: allClassIds } } })
  for (const [classId, codes] of Object.entries(CSA)) {
    for (let i = 0; i < codes.length; i++) {
      await db.classSubjectAssignment.create({
        data: {
          schoolId,
          classId,
          subjectId: subj[codes[i]].id,
          isCore: true,
          isActive: true,
          examinable: true,
          displayOrder: i + 1,
        },
      })
    }
  }
  console.log('  ✔ Class-subject assignments rebuilt from the Principal curriculum')

  // ────────────────────────────────────────────────────────────────────
  // STEP 5 — TIMETABLE rebuild (conflict-free, teacher-sourced scope)
  // ────────────────────────────────────────────────────────────────────
  const TEACHES: Record<string, { subject: string; teacher: string | null; slots: number }[]> = {
    [c3a.id]: [
      { subject: 'ENG', teacher: 'Mrs. Sunita Rao', slots: 5 },
      { subject: 'MAT', teacher: 'Mrs. Sunita Rao', slots: 5 },
      { subject: 'EVS', teacher: 'Mrs. Sunita Rao', slots: 5 },
    ],
    [c6a.id]: [
      { subject: 'MAT', teacher: 'Mr. Deepak Kulkarni', slots: 4 },
      { subject: 'SCI', teacher: 'Mr. Deepak Kulkarni', slots: 4 },
      { subject: 'ENG', teacher: null, slots: 3 },
      { subject: 'HIN', teacher: null, slots: 3 },
      { subject: 'SST', teacher: null, slots: 3 },
    ],
    [c7a.id]: [
      { subject: 'MAT', teacher: 'Mr. Deepak Kulkarni', slots: 4 },
      { subject: 'SCI', teacher: 'Mr. Deepak Kulkarni', slots: 4 },
      { subject: 'ENG', teacher: null, slots: 3 },
      { subject: 'HIN', teacher: null, slots: 3 },
      { subject: 'SST', teacher: null, slots: 3 },
    ],
    [c8a.id]: [
      { subject: 'MAT', teacher: 'Mr. Deepak Kulkarni', slots: 4 },
      { subject: 'SCI', teacher: 'Mr. Deepak Kulkarni', slots: 4 },
      { subject: 'ENG', teacher: null, slots: 3 },
      { subject: 'HIN', teacher: null, slots: 3 },
      { subject: 'SST', teacher: null, slots: 3 },
    ],
    [c9a.id]: [
      { subject: 'MAT', teacher: 'Rohan Mehta', slots: 5 },
      { subject: 'SCI', teacher: 'Mrs. Kavita Sharma', slots: 5 },
      { subject: 'ENG', teacher: 'Ms. Priya Iyer', slots: 5 },
      { subject: 'HIN', teacher: 'Mrs. Meera Krishnan', slots: 4 },
      { subject: 'SST', teacher: 'Mrs. Meera Krishnan', slots: 4 },
    ],
    [c10a.id]: [
      { subject: 'MAT', teacher: 'Rohan Mehta', slots: 5 },
      { subject: 'SCI', teacher: 'Mrs. Kavita Sharma', slots: 5 },
      { subject: 'ENG', teacher: 'Ms. Priya Iyer', slots: 5 },
      { subject: 'HIN', teacher: 'Mrs. Meera Krishnan', slots: 4 },
      { subject: 'SST', teacher: 'Mrs. Meera Krishnan', slots: 4 },
    ],
    [c10b.id]: [
      { subject: 'MAT', teacher: 'Rohan Mehta', slots: 5 },
      { subject: 'SCI', teacher: 'Mrs. Kavita Sharma', slots: 5 },
      { subject: 'ENG', teacher: 'Ms. Priya Iyer', slots: 5 },
      { subject: 'HIN', teacher: 'Mrs. Meera Krishnan', slots: 4 },
      { subject: 'SST', teacher: 'Mrs. Meera Krishnan', slots: 4 },
    ],
    [c11a.id]: [
      { subject: 'PHY', teacher: 'Mr. Vikram Desai', slots: 4 },
      { subject: 'CHE', teacher: 'Mr. Vikram Desai', slots: 4 },
      { subject: 'BIO', teacher: 'Ms. Priya Iyer', slots: 4 },
      { subject: 'ENG', teacher: 'Mrs. Lakshmi Menon', slots: 3 },
    ],
    [c11b.id]: [
      { subject: 'ENG', teacher: 'Mrs. Lakshmi Menon', slots: 3 },
      { subject: 'HIS', teacher: 'Mrs. Lakshmi Menon', slots: 3 },
      { subject: 'POL', teacher: 'Mrs. Lakshmi Menon', slots: 3 },
      { subject: 'ECO', teacher: 'Mrs. Lakshmi Menon', slots: 3 },
    ],
    [c12a.id]: [
      { subject: 'PHY', teacher: 'Mr. Vikram Desai', slots: 4 },
      { subject: 'CHE', teacher: 'Mr. Vikram Desai', slots: 4 },
      { subject: 'MAT', teacher: 'Mr. Vikram Desai', slots: 5 },
      { subject: 'ENG', teacher: 'Mrs. Lakshmi Menon', slots: 3 },
    ],
    [c12b.id]: [
      { subject: 'ENG', teacher: 'Mrs. Lakshmi Menon', slots: 3 },
      { subject: 'HIS', teacher: 'Mrs. Lakshmi Menon', slots: 3 },
      { subject: 'POL', teacher: 'Mrs. Lakshmi Menon', slots: 3 },
    ],
  }
  const roomByClass = new Map<string, string>(
    allClassIds.map((id) => [id, [c3a, c6a, c7a, c8a, c9a, c10a, c10b, c11a, c11b, c12a, c12b].find((c) => c.id === id)!.room ?? 'Room 100']),
  )
  await db.timetable.deleteMany({ where: { schoolId } })
  const classBusy = new Map<string, Set<string>>()
  const teacherBusy = new Map<string, Set<string>>()
  let ttCount = 0
  for (const [classId, entries] of Object.entries(TEACHES)) {
    const busy = new Set<string>()
    classBusy.set(classId, busy)
    for (const entry of entries) {
      let placed = 0
      let guard = 0
      while (placed < entry.slots && guard < 500) {
        guard++
        const day = pick([...DAY_NAMES])
        const period = PERIODS[Math.floor(rnd() * PERIODS.length)]
        const key = `${day}|${period.p}`
        if (busy.has(key)) continue
        if (entry.teacher) {
          const tb = teacherBusy.get(entry.teacher) ?? new Set<string>()
          if (tb.has(key)) continue
          tb.add(key)
          teacherBusy.set(entry.teacher, tb)
        }
        busy.add(key)
        await db.timetable.create({
          data: {
            schoolId,
            classId,
            subjectId: subj[entry.subject].id,
            day,
            period: period.p,
            startTime: period.start,
            endTime: period.end,
            teacherName: entry.teacher,
            room: roomByClass.get(classId) ?? 'Room 100',
          },
        })
        ttCount++
        placed++
      }
    }
  }
  console.log(`  ✔ Timetable rebuilt: ${ttCount} slots, 0 teacher conflicts`)

  // ────────────────────────────────────────────────────────────────────
  // STEP 6 — STUDENTS: 9-A roll 11 + rosters for every new class
  // ────────────────────────────────────────────────────────────────────
  let admissionSeq = 19
  let emailSeq = 19
  const mkStudent = async (
    klass: { id: string },
    name: string,
    gender: 'MALE' | 'FEMALE',
    dob: string,
    guardian: string,
    phone: string,
  ) => {
    const roll = String(await db.student.count({ where: { classId: klass.id } }) + 1).padStart(2, '0')
    const email = `student${emailSeq++}@demoschool.edu`
    const u = await db.user.create({ data: { schoolId, email, name, role: 'STUDENT', status: 'ACTIVE' } })
    await db.student.create({
      data: {
        schoolId,
        userId: u.id,
        classId: klass.id,
        rollNo: roll,
        admissionNo: `DEMO-2026-${String(admissionSeq++).padStart(4, '0')}`,
        guardianName: guardian,
        guardianPhone: phone,
        gender,
        dob,
      },
    })
  }
  await mkStudent(c9a, 'Tanvi Kulkarni', 'FEMALE', '2012-03-14', 'Nilesh Kulkarni', '+91 9822014567')
  const NEW_ROSTERS: { klass: { id: string }; students: [string, 'MALE' | 'FEMALE', string, string, string][] }[] = [
    {
      klass: c3a,
      students: [
        ['Aarohi Deshmukh', 'FEMALE', '2018-06-12', 'Prasad Deshmukh', '+91 9822011201'],
        ['Vihaan Pandit', 'MALE', '2018-02-25', 'Sandeep Pandit', '+91 9822011202'],
        ['Saanvi Bhatt', 'FEMALE', '2018-09-08', 'Rajesh Bhatt', '+91 9822011203'],
        ['Advait Rane', 'MALE', '2018-11-30', 'Sameer Rane', '+91 9822011204'],
        ['Anaya Kale', 'FEMALE', '2018-04-18', 'Vinod Kale', '+91 9822011205'],
      ],
    },
    {
      klass: c6a,
      students: [
        ['Kabir Saxena', 'MALE', '2015-01-20', 'Alok Saxena', '+91 9822011301'],
        ['Myra Chowdhury', 'FEMALE', '2015-07-05', 'Debasis Chowdhury', '+91 9822011302'],
        ['Rudra Malhotra', 'MALE', '2015-03-16', 'Nikhil Malhotra', '+91 9822011303'],
        ['Tvisha Gokhale', 'FEMALE', '2015-10-02', 'Amit Gokhale', '+91 9822011304'],
      ],
    },
    {
      klass: c7a,
      students: [
        ['Anvi Trivedi', 'FEMALE', '2014-05-11', 'Harsh Trivedi', '+91 9822011401'],
        ['Shaunak Bhosale', 'MALE', '2014-08-23', 'Girish Bhosale', '+91 9822011402'],
        ['Nitara Raut', 'FEMALE', '2014-12-09', 'Makarand Raut', '+91 9822011403'],
      ],
    },
    {
      klass: c8a,
      students: [
        ['Vivaan Joshi', 'MALE', '2013-02-14', 'Anand Joshi', '+91 9822011501'],
        ['Alisha Menon', 'FEMALE', '2013-06-27', 'Ravi Menon', '+91 9822011502'],
        ['Om Tambe', 'MALE', '2013-09-03', 'Sagar Tambe', '+91 9822011503'],
      ],
    },
    {
      klass: c10b,
      students: [
        ['Reva Kulkarni', 'FEMALE', '2011-04-09', 'Prakash Kulkarni', '+91 9822011601'],
        ['Yash Thakur', 'MALE', '2011-01-17', 'Vikas Thakur', '+91 9822011602'],
        ['Navya Shetty', 'FEMALE', '2011-08-29', 'Ramesh Shetty', '+91 9822011603'],
        ['Abhimanyu Rathore', 'MALE', '2011-11-05', 'Devendra Rathore', '+91 9822011604'],
        ['Kiara Bose', 'FEMALE', '2011-03-22', 'Arunava Bose', '+91 9822011605'],
      ],
    },
    {
      klass: c11a,
      students: [
        ['Aditi Vaidya', 'FEMALE', '2010-05-19', 'Mohan Vaidya', '+91 9822011701'],
        ['Rohan Parab', 'MALE', '2010-09-26', 'Sanjay Parab', '+91 9822011702'],
        ['Sneha Kambli', 'FEMALE', '2010-02-08', 'Umesh Kambli', '+91 9822011703'],
        ['Arnav Chandra', 'MALE', '2010-12-15', 'Rakesh Chandra', '+91 9822011704'],
      ],
    },
    {
      klass: c11b,
      students: [
        ['Ishan Ghosh', 'MALE', '2010-07-07', 'Bapan Ghosh', '+91 9822011801'],
        ['Diya Bhatt', 'FEMALE', '2010-10-30', 'Mahesh Bhatt', '+91 9822011802'],
        ['Krisha Dalal', 'FEMALE', '2010-03-25', 'Jignesh Dalal', '+91 9822011803'],
      ],
    },
    {
      klass: c12a,
      students: [
        ['Omkar Jadhav', 'MALE', '2009-06-03', 'Ashok Jadhav', '+91 9822011901'],
        ['Ritu Nambiar', 'FEMALE', '2009-11-21', 'Balachandran Nambiar', '+91 9822011902'],
        ['Pranav Salvi', 'MALE', '2009-04-14', 'Nitin Salvi', '+91 9822011903'],
      ],
    },
    {
      klass: c12b,
      students: [
        ['Tejas Rana', 'MALE', '2008-08-16', 'Chandra Rana', '+91 9822012001'],
        ['Meera Qureshi', 'FEMALE', '2009-01-28', 'Imran Qureshi', '+91 9822012002'],
      ],
    },
  ]
  for (const roster of NEW_ROSTERS) {
    for (const [name, gender, dob, guardian, phone] of roster.students) {
      await mkStudent(roster.klass, name, gender, dob, guardian, phone)
    }
  }
  const totalStudents = await db.student.count({ where: { schoolId } })
  console.log(`  ✔ Students: 33 added (9-A back to 11, all classes staffed) — school total ${totalStudents}`)

  // ────────────────────────────────────────────────────────────────────
  // STEP 7 — ATTENDANCE: past week for every new class + today's snapshot
  // ────────────────────────────────────────────────────────────────────
  const d = (s: string) => new Date(`${s}T09:00:00.000Z`)
  const pastDays = [d('2026-09-18'), d('2026-09-21'), d('2026-09-22'), d('2026-09-23'), d('2026-09-24')]
  const sprinkle = (i: number, dayIdx: number): string => {
    // deterministic pattern: 1 absent, 1 late, 1 leave per class per week
    if (i === 1 && dayIdx === 1) return 'ABSENT'
    if (i === 2 && dayIdx === 2) return 'LATE'
    if (i === 0 && dayIdx === 3) return 'LEAVE'
    if (i === 3 && dayIdx === 4 && dayIdx % 2 === 0) return 'ABSENT'
    return 'PRESENT'
  }
  for (const roster of NEW_ROSTERS) {
    const students = await db.student.findMany({ where: { classId: roster.klass.id }, orderBy: { rollNo: 'asc' } })
    for (let dayIdx = 0; dayIdx < pastDays.length; dayIdx++) {
      for (let i = 0; i < students.length; i++) {
        const date = pastDays[dayIdx]
        const exists = await db.attendance.findFirst({ where: { studentId: students[i].id, date } })
        if (exists) continue
        await db.attendance.create({
          data: {
            schoolId,
            studentId: students[i].id,
            classId: roster.klass.id,
            date,
            status: sprinkle(i, dayIdx),
            markedBy: 'Class Teacher',
          },
        })
      }
    }
  }
  // today (2026-09-25): 10-A · 10-B · 6-A · 3-A · 11-B marked; 9-A left
  // unmarked so the Class Teacher Hub shows the honest "mark now" state.
  const today = d('2026-09-25')
  for (const klass of [c10a, c10b, c6a, c3a, c11b]) {
    const students = await db.student.findMany({ where: { classId: klass.id }, orderBy: { rollNo: 'asc' } })
    for (let i = 0; i < students.length; i++) {
      await db.attendance.create({
        data: {
          schoolId,
          studentId: students[i].id,
          classId: klass.id,
          date: today,
          status: i === 1 && klass.id === c10b.id ? 'ABSENT' : i === 2 && klass.id === c10a.id ? 'LATE' : 'PRESENT',
          markedBy: 'Class Teacher',
        },
      })
    }
  }
  // 9-A's new student (roll 11) needs history too — follow 9-A's existing dates
  const tanvi = await db.student.findFirst({ where: { classId: c9a.id, rollNo: '11' } })
  if (tanvi) {
    for (const day of pastDays) {
      await db.attendance.create({
        data: { schoolId, studentId: tanvi.id, classId: c9a.id, date: day, status: 'PRESENT', markedBy: 'Class Teacher' },
      })
    }
  }
  const attCount = await db.attendance.count({ where: { schoolId } })
  const leaveCount = await db.attendance.count({ where: { schoolId, status: 'LEAVE' } })
  console.log(`  ✔ Attendance seeded (${attCount} rows, LEAVE now present: ${leaveCount})`)

  // ────────────────────────────────────────────────────────────────────
  // STEP 8 — FEES: canonical ledgers for the new CT classes + txns
  // ────────────────────────────────────────────────────────────────────
  const principal = await db.user.findFirst({ where: { schoolId, role: 'PRINCIPAL' } })
  const principalName = principal?.name ?? 'Principal'
  let receiptSeq = 3
  const receipt = () => `SCH-2026-${String(receiptSeq++).padStart(6, '0')}`
  const studentsOf = async (classId: string) =>
    db.student.findMany({ where: { classId }, orderBy: { rollNo: 'asc' }, include: { user: { select: { name: true } } } })

  const mkFee = async (
    studentId: string,
    title: string,
    amount: number,
    paid: number,
    dueDate: string,
  ) => {
    const outstanding = amount - paid
    return db.fee.create({
      data: {
        schoolId,
        studentId,
        title,
        amount,
        paid,
        dueDate: d(dueDate),
        status: outstanding <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
        method: 'CASH',
        paidDate: paid > 0 ? d(dueDate) : null,
      },
    })
  }

  // 10-B — the fullest picture (Arjun's class)
  {
    const [reva, yash, navya, abhi, kiara] = await studentsOf(c10b.id)
    await mkFee(reva.id, 'Tuition Fee — Term 1', 22000, 22000, '2026-08-15')
    await db.feeTransaction.create({
      data: {
        schoolId, studentId: reva.id, studentName: reva.user.name, className: 'Grade 10 - B',
        feeHeadName: 'Tuition Fee — Term 1', amount: 22000, method: 'CASH', status: 'SUCCESS',
        source: 'SCHOOL_OFFICE', collectedByName: 'School Office', collectedAt: d('2026-08-14'),
        verifiedByName: principalName, verifiedAt: d('2026-08-15'), receiptNo: receipt(),
      },
    })
    const yashFee = await mkFee(yash.id, 'Tuition Fee — Term 1', 22000, 22000, '2026-08-15')
    await db.feeTransaction.create({
      data: {
        schoolId, studentId: yash.id, studentName: yash.user.name, className: 'Grade 10 - B',
        feeId: yashFee.id, feeHeadName: 'Tuition Fee — Term 1', amount: 22000, method: 'UPI', status: 'SUCCESS',
        source: 'CLASS_TEACHER', collectedByName: 'Mr. Arjun Nair', collectedAt: d('2026-08-20'),
        verifiedByName: principalName, verifiedAt: d('2026-08-21'), receiptNo: receipt(),
        referenceNumber: 'UPI-8847261',
      },
    })
    const navyaFee = await mkFee(navya.id, 'Tuition Fee — Term 1', 22000, 10000, '2026-08-15')
    await db.feeTransaction.create({
      data: {
        schoolId, studentId: navya.id, studentName: navya.user.name, className: 'Grade 10 - B',
        feeId: navyaFee.id, feeHeadName: 'Tuition Fee — Term 1', amount: 10000, method: 'CASH', status: 'SUCCESS',
        source: 'CLASS_TEACHER', collectedByName: 'Mr. Arjun Nair', collectedAt: d('2026-09-10'),
        verifiedByName: principalName, verifiedAt: d('2026-09-11'), receiptNo: receipt(),
      },
    })
    await mkFee(abhi.id, 'Tuition Fee — Term 1', 22000, 0, '2026-08-15') // overdue
    const kiaraFee = await mkFee(kiara.id, 'Tuition Fee — Term 1', 22000, 15000, '2026-08-15')
    await db.feeTransaction.create({
      data: {
        schoolId, studentId: kiara.id, studentName: kiara.user.name, className: 'Grade 10 - B',
        feeId: kiaraFee.id, feeHeadName: 'Tuition Fee — Term 1', amount: 15000, method: 'NET_BANKING', status: 'SUCCESS',
        source: 'CLASS_TEACHER', collectedByName: 'Mr. Arjun Nair', collectedAt: d('2026-09-05'),
        verifiedByName: principalName, verifiedAt: d('2026-09-06'), receiptNo: receipt(),
        referenceNumber: 'NEFT-5521047',
      },
    })
    await db.feeTransaction.create({
      data: {
        schoolId, studentId: kiara.id, studentName: kiara.user.name, className: 'Grade 10 - B',
        feeId: kiaraFee.id, feeHeadName: 'Tuition Fee — Term 1', amount: 1500, method: 'CASH', status: 'UNDER_VERIFICATION',
        source: 'CLASS_TEACHER', collectedByName: 'Mr. Arjun Nair', collectedAt: new Date(),
      },
    })
  }
  // 3-A — primary, light
  {
    const kids = await studentsOf(c3a.id)
    for (const kid of kids) {
      await mkFee(kid.id, 'Annual Charges — 2026-27', 12000, kid.rollNo === '05' ? 8000 : 12000, '2026-07-31')
    }
  }
  // 6-A — includes a REJECTED collection (Deepak)
  {
    const [kabir, myra, rudra, tvisha] = await studentsOf(c6a.id)
    for (const kid of [kabir, myra, rudra]) await mkFee(kid.id, 'Tuition Fee — Term 1', 15000, 15000, '2026-09-05')
    const tvFee = await mkFee(tvisha.id, 'Tuition Fee — Term 1', 15000, 0, '2026-09-05')
    await db.feeTransaction.create({
      data: {
        schoolId, studentId: tvisha.id, studentName: tvisha.user.name, className: 'Grade 6 - A',
        feeId: tvFee.id, feeHeadName: 'Tuition Fee — Term 1', amount: 2000, method: 'UPI', status: 'REJECTED',
        source: 'CLASS_TEACHER', collectedByName: 'Mr. Deepak Kulkarni', collectedAt: d('2026-09-19'),
        rejectedByName: principalName, rejectedAt: d('2026-09-20'),
        rejectionReason: 'UPI reference could not be traced to any bank credit. Please recount and re-collect.',
        referenceNumber: 'UPI-2299810',
      },
    })
  }
  // 11-B — higher-secondary humanities
  {
    const [ishan, diya, krisha] = await studentsOf(c11b.id)
    await mkFee(ishan.id, 'Tuition Fee — Term 1', 26000, 26000, '2026-09-10')
    await db.feeTransaction.create({
      data: {
        schoolId, studentId: ishan.id, studentName: ishan.user.name, className: 'Grade 11 - B',
        feeHeadName: 'Tuition Fee — Term 1', amount: 26000, method: 'BANK_TRANSFER', status: 'SUCCESS',
        source: 'SCHOOL_OFFICE', collectedByName: 'School Office', collectedAt: d('2026-09-08'),
        verifiedByName: principalName, verifiedAt: d('2026-09-09'), receiptNo: receipt(),
      },
    })
    const diyaFee = await mkFee(diya.id, 'Tuition Fee — Term 1', 26000, 14000, '2026-09-10')
    await db.feeTransaction.create({
      data: {
        schoolId, studentId: diya.id, studentName: diya.user.name, className: 'Grade 11 - B',
        feeId: diyaFee.id, feeHeadName: 'Tuition Fee — Term 1', amount: 14000, method: 'CASH', status: 'SUCCESS',
        source: 'CLASS_TEACHER', collectedByName: 'Mrs. Lakshmi Menon', collectedAt: d('2026-09-15'),
        verifiedByName: principalName, verifiedAt: d('2026-09-16'), receiptNo: receipt(),
      },
    })
    await mkFee(krisha.id, 'Tuition Fee — Term 1', 26000, 0, '2026-09-10')
  }
  console.log('  ✔ Fees: 10-B (paid/partial/overdue/₹1,500 pending by Arjun), 3-A, 6-A (₹2,000 rejected), 11-B')

  // ────────────────────────────────────────────────────────────────────
  // STEP 9 — BEHAVIOR: all three types + follow-up + monitoring states
  // ────────────────────────────────────────────────────────────────────
  const arjun = teacherIdByName.get('Mr. Arjun Nair')!
  const deepak = teacherIdByName.get('Mr. Deepak Kulkarni')!
  const lakshmi = teacherIdByName.get('Mrs. Lakshmi Menon')!
  const sunita = teacherIdByName.get('Mrs. Sunita Rao')!
  {
    const [reva, , , abhi, kiara] = await studentsOf(c10b.id)
    await db.behaviorRecord.create({
      data: {
        schoolId, studentId: reva.id, recordedById: arjun, date: d('2026-09-20'),
        category: 'leadership', type: 'positive',
        description: 'Volunteered to run the class library register over the weekend and coordinated the book-drive poster with three classmates.',
        status: 'resolved', parentNotified: true,
      },
    })
    const concern = await db.behaviorRecord.create({
      data: {
        schoolId, studentId: abhi.id, recordedById: arjun, date: d('2026-09-22'),
        category: 'classroom-concern', type: 'concern',
        description: 'Repeatedly unprepared for the third class this week — incomplete notebook and distracted during instructions.',
        actionTaken: 'Spoke with the student after class; guardian call scheduled.',
        followUpRequired: true, followUpDate: d('2026-09-28'),
        status: 'open', privateNote: 'Guardian mentioned a family function last week — watch, do not escalate yet.',
      },
    })
    await db.teacherFollowUp.create({
      data: {
        schoolId, teacherId: arjun, kind: 'behavior', studentId: abhi.id, recordId: concern.id,
        reason: 'Classroom Concern follow-up — Abhimanyu Rathore', dueDate: d('2026-09-28'), priority: 'high', status: 'open',
      },
    })
    await db.behaviorRecord.create({
      data: {
        schoolId, studentId: kiara.id, recordedById: arjun, date: d('2026-09-18'),
        category: 'attendance-concern', type: 'concern',
        description: 'Two late arrivals this week; cause shared by guardian as transport change.',
        actionTaken: 'Bus route change noted with the transport desk.',
        status: 'monitoring',
      },
    })
    const [kabir] = await studentsOf(c6a.id)
    await db.behaviorRecord.create({
      data: {
        schoolId, studentId: kabir.id, recordedById: deepak, date: d('2026-09-19'),
        category: 'class-participation', type: 'observation',
        description: 'Quiet in large-group discussions but contributes well in smaller groups — worth grouping deliberately.',
        status: 'resolved',
      },
    })
    const [, diya] = await studentsOf(c11b.id)
    await db.behaviorRecord.create({
      data: {
        schoolId, studentId: diya.id, recordedById: lakshmi, date: d('2026-09-21'),
        category: 'academic-effort', type: 'positive',
        description: 'Outstanding essay on the Panchayati Raj system — shared as a model answer with the class.',
        status: 'resolved', parentNotified: true,
      },
    })
    const [, , saanvi] = await studentsOf(c3a.id)
    await db.behaviorRecord.create({
      data: {
        schoolId, studentId: saanvi.id, recordedById: sunita, date: d('2026-09-22'),
        category: 'respect-conduct', type: 'positive',
        description: 'Helped a new classmate settle in during the lunch break without being asked.',
        status: 'resolved',
      },
    })
  }
  console.log('  ✔ Behavior: positive/observation/concern + open concern w/ follow-up + monitoring')

  await finishSeed(schoolId, c3a)
  console.log('\nALL DONE — canonical universe restructured.')
}


// ─────────────────────────────────────────────────────────────────────
// finishSeed — STEPS 10 + 11 (marks + curriculum), resumable on its own
// ─────────────────────────────────────────────────────────────────────
async function finishSeed(schoolId: string, c3a: { id: string }) {
  const subjCodes = ['ENG', 'MAT', 'SCI', 'SST', 'HIN', 'PHY', 'CHE', 'BIO', 'ECO', 'EVS', 'HIS', 'POL']
  const subj: Record<string, { id: string }> = {}
  for (const code of subjCodes) {
    const s = await db.subject.findFirst({ where: { schoolId, code } })
    if (s) subj[code] = { id: s.id }
  }
  const c9a = await db.class.findFirst({ where: { schoolId, name: 'Grade 9 - A' } })
  const c10a = await db.class.findFirst({ where: { schoolId, name: 'Grade 10 - A' } })
  const c10b = await db.class.findFirst({ where: { schoolId, name: 'Grade 10 - B' } })
  const c11b = await db.class.findFirst({ where: { schoolId, name: 'Grade 11 - B' } })
  const c12b = await db.class.findFirst({ where: { schoolId, name: 'Grade 12 - B' } })
  if (!c9a || !c10a || !c10b || !c11b || !c12b) throw new Error('Classes not found in finishSeed')
  const studentsOf = async (classId: string) =>
    db.student.findMany({ where: { classId }, orderBy: { rollNo: 'asc' }, include: { user: { select: { name: true } } } })

  const pa1 = await db.exam.findFirst({ where: { schoolId, name: 'Periodic Assessment 1' } })
  const ut2 = await db.exam.findFirst({ where: { schoolId, name: 'Unit Test 2' } })
  if (!pa1 || !ut2) throw new Error('PA-1 / UT-2 exams not found')

  const upsertMark = async (
    examId: string, classId: string, subjectId: string, studentId: string,
    marks: number, workflow: 'DRAFT' | 'SUBMITTED',
  ) => {
    await db.examMark.upsert({
      where: { examId_classId_subjectId_studentId: { examId, classId, subjectId, studentId } },
      create: {
        examId, classId, subjectId, studentId,
        marksObtained: marks, workflowStatus: workflow, status: 'PRESENT',
        enteredAt: new Date(),
      },
      update: { marksObtained: marks, workflowStatus: workflow, status: 'PRESENT' },
    })
  }
  // 9-A: every student × every subject (SUBMITTED) — the class teacher's
  // complete submission matrix. Deterministic realistic marks. PA-1 is a
  // 50-mark assessment (ExamSubjectConfig maxMarks = 50), so every value
  // is scaled to /50 — percentages must always stay honest.
  {
    const students = await studentsOf(c9a.id)
    const subjects = ['MAT', 'SCI', 'ENG', 'HIN', 'SST']
    const baseByName = new Map<string, number>(students.map((s, i) => [s.user.name ?? '', 66 + ((i * 7) % 26)]))
    // the canonical Aarav sits at a strong ~84%
    baseByName.set('Aarav Sharma', 84)
    baseByName.set('Diya Patel', 79)
    baseByName.set('Myra Mehta', 88)
    const subjectOffset: Record<string, number> = { MAT: 4, SCI: -2, ENG: 2, HIN: -5, SST: 1 }
    for (const s of students) {
      const base = baseByName.get(s.user.name ?? '') ?? 72
      for (const code of subjects) {
        const marks = Math.max(18, Math.min(49, Math.round((base + subjectOffset[code]) / 2)))
        await upsertMark(pa1.id, c9a.id, subj[code].id, s.id, marks, 'SUBMITTED')
      }
    }
  }
  // 10-A: Math + Science SUBMITTED, English DRAFT (in-progress picture) —
  // same /50 scale.
  {
    const students = await studentsOf(c10a.id)
    for (let i = 0; i < students.length; i++) {
      const base = 62 + ((i * 9) % 30)
      await upsertMark(pa1.id, c10a.id, subj.MAT.id, students[i].id, Math.min(49, Math.round((base + 3) / 2)), 'SUBMITTED')
      await upsertMark(pa1.id, c10a.id, subj.SCI.id, students[i].id, Math.min(49, Math.round((base - 1) / 2)), 'SUBMITTED')
      await upsertMark(pa1.id, c10a.id, subj.ENG.id, students[i].id, Math.min(49, Math.round((base + 1) / 2)), 'DRAFT')
    }
  }
  // 10-B: link UT-2 + Math marks in DRAFT (ongoing exam)
  {
    const link = await db.examClass.findFirst({ where: { examId: ut2.id, classId: c10b.id } })
    if (!link) await db.examClass.create({ data: { examId: ut2.id, classId: c10b.id } })
    const cfg = await db.examSubjectConfig.findFirst({ where: { examId: ut2.id, classId: c10b.id, subjectId: subj.MAT.id } })
    if (!cfg) await db.examSubjectConfig.create({ data: { examId: ut2.id, classId: c10b.id, subjectId: subj.MAT.id, maxMarks: 100 } })
    const students = await studentsOf(c10b.id)
    for (let i = 0; i < students.length; i++) {
      await upsertMark(ut2.id, c10b.id, subj.MAT.id, students[i].id, 58 + ((i * 11) % 35), 'DRAFT')
    }
  }
  const markCount = await db.examMark.count({ where: { exam: { schoolId } } })
  console.log(`  ✔ Marks: PA-1 complete for 9-A, partial for 10-A, UT-2 draft for 10-B (${markCount} rows)`)

  // ────────────────────────────────────────────────────────────────────
  // STEP 11 — CURRICULUM topics for the new class/subject pairs
  // ────────────────────────────────────────────────────────────────────
  const mkTopics = async (classId: string, code: string, units: [string, string[]][]) => {
    let topicNo = 1
    let order = 1
    for (let u = 0; u < units.length; u++) {
      for (const topic of units[u][1]) {
        await db.curriculumTopic.create({
          data: {
            schoolId, classId, subjectId: subj[code].id, sourceBoard: 'CBSE',
            unitNo: u + 1, unitName: units[u][0], topicNo, topicName: topic,
            periodsNeeded: 4 + (topicNo % 3), orderIndex: order++,
          },
        })
        topicNo++
      }
    }
  }
  await mkTopics(c3a.id, 'ENG', [
    ['Reading & Comprehension', ['Guided reading of short stories', 'Identifying the main idea', 'Sequencing events in a passage']],
    ['Grammar Corner', ['Nouns: naming words', 'Verbs: doing words', 'Introduction to tenses']],
    ['Creative Expression', ['Writing a simple paragraph', 'Picture composition']],
  ])
  await mkTopics(c3a.id, 'MAT', [
    ['Numbers', ['Numbers up to 10,000', 'Place value & expanded form', 'Ordering and comparing numbers']],
    ['Operations', ['Addition with carrying', 'Subtraction with borrowing', 'Multiplication tables 6–10', 'Division as equal sharing']],
    ['Geometry & Measurement', ['Shapes and their properties', 'Measuring length and weight']],
  ])
  await mkTopics(c3a.id, 'EVS', [
    ['Living World', ['Plants around us', 'Animals and their homes']],
    ['Our Body & Health', ['Body parts and senses', 'Good food habits']],
    ['Our Environment', ['Water and its uses', 'Weather and seasons']],
  ])
  const HIS_11 = [
    ['Early Societies', ['Introduction to world history', 'From hunting to farming']],
    ['Writing and City Life', ['Mesopotamia: the first cities', 'Language and record keeping']],
    ['An Empire Across Three Continents', ['The Roman Empire — expansion', 'State and citizenship in Rome']],
    ['Central Islamic Lands', ['The rise of Islam', 'Culture and learning in the Islamic world']],
  ] as [string, string[]][]
  await mkTopics(c11b.id, 'HIS', HIS_11)
  await mkTopics(c12b.id, 'HIS', [
    ['Bricks, Beads and Bones', ['The Harappan civilisation', 'Town planning and crafts']],
    ['Kings, Farmers and Towns', ['Early states and economies', 'The second urbanisation']],
    ['Colonialism and the Countryside', ['Agrarian society under colonial rule', 'The Deccan Ryotwari settlement']],
    ['Rebels and the Raj', ['The revolt of 1857', 'Aftermath and reorganisation']],
  ])
  await mkTopics(c11b.id, 'POL', [
    ['Constitution', ['Constitution: why and how?', 'Rights in the Indian Constitution']],
    ['Organs of Government', ['Election and representation', 'The Executive', 'The Legislature']],
    ['Federalism', ['Division of powers: Union and States']],
  ])
  await mkTopics(c12b.id, 'POL', [
    ['Contemporary World Politics', ['The end of bipolarity', 'US hegemony in world politics']],
    ['Alternative Centres of Power', ['European Union and ASEAN', 'Rise of China']],
    ['Politics in India', ['Globalisation and Indian politics', 'Contemporary South Asia']],
  ])
  console.log('  ✔ Curriculum topics seeded for 3-A + Humanities classes')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
