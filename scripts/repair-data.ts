import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  // ── REPAIR 1: Attendance duplicates ────────────────────────────
  // Group all rows by (studentId, calendar-day); keep the LATEST row
  // (latest save wins — it represents the most recent correction), snap
  // its date to midnight UTC, delete the rest.
  const all = await db.attendance.findMany({ orderBy: { createdAt: 'asc' } });
  const groups = new Map<string, typeof all>();
  for (const a of all) {
    const key = `${a.studentId}|${a.date.toISOString().slice(0, 10)}`;
    const arr = groups.get(key) ?? [];
    arr.push(a); groups.set(key, arr);
  }
  let merged = 0, normalized = 0, deletedRows = 0;
  for (const [, rows] of groups) {
    if (rows.length === 1) {
      const only = rows[0];
      const midnight = new Date(`${only.date.toISOString().slice(0, 10)}T00:00:00.000Z`);
      if (only.date.getTime() !== midnight.getTime()) {
        await db.attendance.update({ where: { id: only.id }, data: { date: midnight } });
        normalized++;
      }
      continue;
    }
    merged++;
    const keep = rows[rows.length - 1]; // latest createdAt wins
    const day = keep.date.toISOString().slice(0, 10);
    const midnight = new Date(`${day}T00:00:00.000Z`);
    await db.attendance.deleteMany({ where: { id: { in: rows.filter(r => r.id !== keep.id).map(r => r.id) } } });
    deletedRows += rows.length - 1;
    if (keep.date.getTime() !== midnight.getTime()) {
      await db.attendance.update({ where: { id: keep.id }, data: { date: midnight } });
      normalized++;
    }
    console.log(`  merged ${rows.length}→1 rows for ${keep.studentId} on ${day} (kept status=${keep.status} markedBy=${keep.markedBy})`);
  }
  console.log(`REPAIR-1: ${merged} day-groups merged, ${deletedRows} dup rows deleted, ${normalized} dates normalized to midnight UTC`);

  // ── REPAIR 2: stale demo FeeTransactions (old mock universe) ──
  const staleIds = ['cmtbdn59d001njunrlu8naa30','cmtbea1j7001pjunr9fl1tdvw','cmth0yn4s000hnj72a3mi7yrp','cmth2imwg000jnj72n3524d76','cmth4t45g000lnj722rx1eist','cmth6ed9v000nnj72hh0zs36b','cmth6h1d5000pnj72nvb3r1ys','cmth6iht9000rnj724oqptz9z'];
  // safety: only delete rows that reference studentIds matching NO real Student
  const realStudents = await db.student.findMany({ select: { id: true, admissionNo: true } });
  const realIds = new Set(realStudents.map(s => s.id));
  const stale = await db.feeTransaction.findMany({ where: { id: { in: staleIds } } });
  const toDelete = stale.filter(t => t.studentId && !realIds.has(t.studentId));
  const skip = stale.filter(t => !t.studentId || realIds.has(t.studentId));
  if (skip.length) console.log(`  SKIPPED ${skip.length} rows (studentId resolves to a real student)`);
  const del = await db.feeTransaction.deleteMany({ where: { id: { in: toDelete.map(t => t.id) } } });
  console.log(`REPAIR-2: deleted ${del.count} stale FeeTransactions (mock universe STU-1/2/37, Pre-Nursery/Class-11 labels, incl. duplicate receipt RCP-2026-1061)`);
}
main().finally(() => db.$disconnect());
