/**
 * holiday-data — the demo school's official 2026-27 holiday calendar.
 * Seeded into the DB as SchoolEvent HOLIDAY rows (the scheduler treats
 * these as non-teaching days) and mirrored for display in
 * src/lib/mock/school-calendar.ts — KEEP THE TWO IN SYNC.
 */

export const HOLIDAY_SEED: { title: string; start: string; end: string }[] = [
  { title: 'Ambedkar Jayanti', start: '2026-04-14', end: '2026-04-14' },
  { title: 'Labour Day', start: '2026-05-01', end: '2026-05-01' },
  { title: 'Summer Break', start: '2026-05-18', end: '2026-06-14' },
  { title: 'Independence Day', start: '2026-08-15', end: '2026-08-15' },
  { title: 'Janmashtami', start: '2026-09-04', end: '2026-09-04' },
  { title: 'Gandhi Jayanti', start: '2026-10-02', end: '2026-10-02' },
  { title: 'Dussehra Break', start: '2026-10-19', end: '2026-10-21' },
  { title: 'Diwali Break', start: '2026-11-07', end: '2026-11-10' },
  { title: 'Christmas', start: '2026-12-25', end: '2026-12-25' },
  { title: 'Republic Day', start: '2027-01-26', end: '2027-01-26' },
]
