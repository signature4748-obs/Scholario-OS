/**
 * SCHOLARIO-OS — Real-time Event Stream Service
 * ----------------------------------------------
 * Broadcasts genuine database events (fee payments, announcements,
 * admissions) to connected dashboards over socket.io.
 *
 * Strategy: lightweight poller over the shared SQLite file (bun:sqlite).
 * Every POLL_MS it looks for rows created since the last tick and emits
 * `school-event` frames to all clients (clients filter by their own
 * schoolId on the frontend, keeping the service auth-agnostic).
 *
 * Port: 3003 (reached via gateway as /?XTransformPort=3003)
 */
import { createServer } from 'http'
import { Server } from 'socket.io'
import { Database } from 'bun:sqlite'

const PORT = 3003
const POLL_MS = 4000
const DB_PATH = new URL('../../db/custom.db', import.meta.url).pathname

// ─── socket.io bootstrap (path '/' is required by the Caddy gateway) ───
// NOTE: engine.io owns every URL path (path '/'), so plain HTTP probes are
// answered by engine.io itself. A 200 socket.io handshake —
//   curl "http://localhost:3003/?EIO=4&transport=polling"
// — is the service health check.
const httpServer = createServer()

const io = new Server(httpServer, {
  // DO NOT change the path — Caddy forwards /?XTransformPort=3003 here
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60_000,
  pingInterval: 25_000,
})

// ─── SQLite (read-only) ───
let sqlite: Database | null = null
try {
  sqlite = new Database(DB_PATH, { readonly: true })
  console.log(`[event-stream] attached SQLite at ${DB_PATH}`)
} catch (e) {
  console.error('[event-stream] FATAL: cannot open SQLite', e)
}

// Boot marker — only stream rows created after this service started,
// so clients never get a flood of historical rows.
// NOTE: Prisma stores DateTime as epoch-millis INTEGER in SQLite.
const bootAt = Date.now()
let lastMs: number = bootAt
// Dedupe guard — second-precision timestamps could re-emit the same row
const seen = new Set<string>()
const markAndCheck = (key: string) => {
  if (seen.has(key)) return false
  seen.add(key)
  if (seen.size > 5000) {
    // keep memory bounded — drop the oldest half
    const it = seen.values()
    for (let i = 0; i < 2500; i++) seen.delete(it.next().value)
  }
  return true
}
// Prisma epoch-millis → ISO string for wire frames
const msToIso = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) ? new Date(n).toISOString() : new Date().toISOString()

interface StreamEvent {
  kind: 'payment' | 'announcement' | 'admission' | 'message' | 'timetable'
  schoolId: string
  title: string
  detail: string
  amount?: number
  method?: string
  /** For message events: the User.id of the recipient so clients can
  // badge only their own inbox (service stays auth-agnostic). */
  recipientId?: string | null
  at: string
}

// ─── Poller ───
async function poll() {
  if (!sqlite) return
  try {
    // 1) Successful fee payments
    const payments = sqlite
      .query(
        `SELECT p.id, p.amount, p.method, p.createdAt AS ts,
                u.name AS student, f.title AS feeTitle, f.schoolId AS schoolId
         FROM Payment p
         JOIN Fee f ON f.id = p.feeId
         JOIN Student st ON st.id = f.studentId
         JOIN User u ON u.id = st.userId
         WHERE p.status = 'SUCCESS' AND p.createdAt > ?
         ORDER BY p.createdAt ASC LIMIT 20`
      )
      .all(lastMs) as Array<{
        id: string; amount: number; method: number | string; ts: number;
        student: string; feeTitle: string; schoolId: string
      }>

    for (const p of payments) {
      if (!markAndCheck(`payment:${p.id}`)) continue
      const evt: StreamEvent = {
        kind: 'payment',
        schoolId: p.schoolId,
        title: 'Fee payment received',
        detail: `${p.student} · ${p.feeTitle}`,
        amount: p.amount,
        method: String(p.method),
        at: msToIso(p.ts),
      }
      io.emit('school-event', evt)
      console.log(`[event-stream] payment → ${p.student} ₹${p.amount} (${p.method})`)
    }

    // 2) New school announcements
    const notices = sqlite
      .query(
        `SELECT n.id, n.title, n.message, n.schoolId, n.createdAt AS ts
         FROM Notification n
         WHERE n.createdAt > ?
         ORDER BY n.createdAt ASC LIMIT 10`
      )
      .all(lastMs) as Array<{ id: string; title: string; message: string; schoolId: string; ts: number }>

    for (const n of notices) {
      if (!markAndCheck(`notice:${n.id}`)) continue
      const evt: StreamEvent = {
        kind: 'announcement',
        schoolId: n.schoolId,
        title: n.title,
        detail: n.message.slice(0, 120),
        at: msToIso(n.ts),
      }
      io.emit('school-event', evt)
      console.log(`[event-stream] announcement → ${n.title}`)
    }

    // 3) New direct messages — subject + sender; recipientId carried on the
    // frame so the client can mark "new message" only for the addressee.
    const messages = sqlite
      .query(
        `SELECT m.id, m.subject, m.body, m.schoolId, m.recipientId, m.createdAt AS ts,
                su.name AS sender
         FROM Message m
         LEFT JOIN User su ON su.id = m.senderId
         WHERE m.createdAt > ?
         ORDER BY m.createdAt ASC LIMIT 10`
      )
      .all(lastMs) as Array<{ id: string; subject: string; body: string; schoolId: string; recipientId: string | null; ts: number; sender: string | null }>

    for (const m of messages) {
      if (!markAndCheck(`message:${m.id}`)) continue
      const evt: StreamEvent & { recipientId?: string | null } = {
        kind: 'message',
        schoolId: m.schoolId,
        title: m.subject,
        detail: m.sender ? `From ${m.sender} · ${m.body.slice(0, 100)}` : m.body.slice(0, 120),
        recipientId: m.recipientId,
        at: msToIso(m.ts),
      }
      io.emit('school-event', evt)
      console.log(`[event-stream] message → ${m.subject} (to ${m.recipientId ?? 'unknown'})`)
    }

    // 4) Timetable publications — TIMETABLE_PUBLISHED rows in ActivityLog.
    //    These are the school-wide "master schedule changed" moments: open
    //    student/teacher tabs live-refresh their timetable views on this
    //    frame (the Principal publishes → the whole school sees it, live).
    const publishes = sqlite
      .query(
        `SELECT a.id, a.detail, a.schoolId, a.createdAt AS ts, u.name AS actor
         FROM ActivityLog a
         LEFT JOIN User u ON u.id = a.userId
         WHERE a.action = 'TIMETABLE_PUBLISHED' AND a.createdAt > ?
         ORDER BY a.createdAt ASC LIMIT 5`
      )
      .all(lastMs) as Array<{ id: string; detail: string | null; schoolId: string | null; ts: number; actor: string | null }>

    for (const a of publishes) {
      if (!markAndCheck(`activity:${a.id}`)) continue
      if (!a.schoolId) continue // platform-level rows carry no school scope
      const evt: StreamEvent = {
        kind: 'timetable',
        schoolId: a.schoolId,
        title: 'Timetable updated',
        detail: a.actor
          ? `${a.detail ?? 'New schedule published'} · by ${a.actor}`
          : (a.detail ?? 'New schedule published'),
        at: msToIso(a.ts),
      }
      io.emit('school-event', evt)
      console.log(`[event-stream] timetable → ${a.detail} (${a.actor ?? 'unknown'})`)
    }

    // 5) Admissions: no Admission table exists (admissions module is client-mock)
    // — payments + announcements + messages + timetable covers the live stream.

    // advance the watermark so the next poll only sees strictly newer rows
    if (payments.length || notices.length || messages.length || publishes.length) {
      const newest = sqlite.query(
        `SELECT MAX(x) AS m FROM (
           SELECT MAX(p.createdAt) AS x FROM Payment p WHERE p.status='SUCCESS'
           UNION ALL SELECT MAX(n.createdAt) FROM Notification n
           UNION ALL SELECT MAX(m.createdAt) FROM Message m
           UNION ALL SELECT MAX(a.createdAt) FROM ActivityLog a WHERE a.action='TIMETABLE_PUBLISHED'
         )`
      ).get() as { m: number | null }
      if (typeof newest?.m === 'number') lastMs = newest.m
    }
  } catch (e) {
    console.error('[event-stream] poll error', e)
  }
}

io.on('connection', (socket) => {
  console.log(`[event-stream] client connected: ${socket.id}`)
  socket.emit('hello', { ok: true, serverTime: new Date().toISOString(), since: new Date(lastMs).toISOString() })
  socket.on('disconnect', () => console.log(`[event-stream] client gone: ${socket.id}`))
  socket.on('error', (e) => console.error(`[event-stream] socket error (${socket.id})`, e))
})

httpServer.listen(PORT, () => {
  console.log(`[event-stream] listening on :${PORT} (streaming events since ${new Date(lastMs).toISOString()})`)
  setInterval(poll, POLL_MS)
  // one quick pass shortly after boot to pick up anything racing the start
  setTimeout(poll, 1500)
})

process.on('SIGTERM', () => { httpServer.close(); process.exit(0) })
process.on('SIGINT', () => { httpServer.close(); process.exit(0) })
