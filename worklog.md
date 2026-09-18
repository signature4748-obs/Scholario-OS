# Scholario-OS Worklog

## Project Snapshot

- **App**: Scholario — multi-role school ERP (Super Admin / Principal / Teacher / Student).
- **Source**: imported from github.com/akasharyan4748-droid/Scholario-oz @ ff026a7.
- **Entry**: single route `/` (src/app/page.tsx) — client-side SPA; role panels:
  `src/components/{principal,teacher,student,superadmin}/*-panel*`.
- **Auth**: credential login (localStorage `scholario-auth` + httpOnly session cookie), API `/api/auth/login`.
  - principal@greenwood.edu.in / principal123
  - rohan.mehta@greenwood.edu.in / teacher123
  - aarav.sharma@greenwood.edu.in / student123
  - admin@scholario.cloud / admin123
- **Data layer**: Prisma + SQLite (`db/custom.db`, `DATABASE_URL=file:/home/z/my-project/db/custom.db`)
  plus Zustand persisted stores (tenant-scoped) under `src/lib/store/*`.
- **Tenants**: School A (Demo/Greenwood) + School B (SPS-002) — capability matrix in `src/lib/tenant/*`.
- **Realtime**: socket.io event-stream mini-service on :3003 (broadcasts payments/announcements/messages
  polled from SQLite); frontend connects via `io("/?XTransformPort=3003")`; gateway forwarding verified
  (`curl ":81/?XTransformPort=3003&EIO=4&transport=polling"` → sid 200).
- **Env**: Next.js 16 (Turbopack) on :3000 via `bun run dev`; keepalive watchdog `keepalive.mjs`
  auto-restarts the dev server if it dies.

---
Task ID: 1
Agent: Z.ai Code (main orchestrator)
Task: Import github.com/akasharyan4748-droid/Scholario-oz into the sandbox, production-ready: no garbage, no dead deps, all four roles working.

Work Log:
- Cloned repo @ ff026a7 (1639 files). Excluded garbage from import: qa-*.png, qa-shots/, screenshots/,
  verify/, agent-tasks/, agent-ctx/, audit-report.txt, old worklogs, scripts/, upload/ pasted-content txts,
  mini-services/dev-server (a supervisor that would double-start `bun run dev` because sandbox
  `.zscripts/dev.sh` auto-starts every mini-service with a dev script → EADDRINUSE loop), prisma/dev.db
  (stale copy; canonical DB is db/custom.db).
- Imported: src/ (1236 files, 161 API routes), prisma/ (schema + seed scripts), db/custom.db (seeded 1.5MB),
  public/ (logo.svg, robots.txt), mini-services/event-stream (socket.io :3003), .env, next.config.ts,
  tsconfig.json, eslint.config.mjs (repo rules + cleaned ignores), .gitignore.
- package.json: renamed scholario-os@1.0.0; removed 14 unused deps after full `rg` audit
  (@dnd-kit/*, @google/genai, @hookform/resolvers, @mdxeditor/editor, @reactuses/core, @supabase/supabase-js,
  @tanstack/react-query, @tanstack/react-table, next-auth, next-intl, react-markdown,
  react-syntax-highlighter, uuid, zod) — kept everything actually imported.
- Converted `/api/ai/generate-questions` from @google/genai (needed GEMINI_API_KEY, never set) to
  z-ai-web-dev-sdk (sandbox standard, actually works); template fallback preserved.
- Verified repo's rumored `page.tsx` line-41 corruption is a terminal display artifact — `od -c` shows
  `const [mounted, setMounted]` intact; no ESC bytes anywhere in src/. No fix needed.
- bun install ✓ · prisma generate ✓ · db push "already in sync" ✓ · tsc --noEmit 0 errors ✓ · lint clean ✓.
- event-stream service cleaned: removed dead HTTP health-probe handler (engine.io owns every path when
  path:'/'); documented handshake-as-health-check (`curl ":3003/?EIO=4&transport=polling"` → 200).
- All four role logins verified 200 via API; gateway socket.io forwarding verified.

Stage Summary:
- Codebase imported clean: zero tsc errors, zero lint errors, zero unused deps, DB seeded and in sync.

---
Task ID: 2
Agent: Z.ai Code (main orchestrator)
Task: Stabilize the app against sandbox OOM kills (4GB cgroup, no swap) and make all four roles browsable.

Work Log:
- Diagnosed the crash pattern: Turbopack dev root compile ~2.8-2.9GB RSS retained; +headless browser
  (~700MB) + any new compile/packaging spike → cgroup OOM kills next-server mid-session
  (ChunkLoadError / blank page in the browser). The repo's own worklog documents the same 4GB fight.
- Code-split all four role panels at MODULE granularity via next/dynamic + shared `ModuleLoading` skeleton
  (`src/components/shared/module-loading.tsx`): principal-panel registry (19 modules), teacher
  module-router (13) + MySalaryModule, student-panel (14), superadmin-panel (3). Lazy chunks = browser
  loads only the active module; nav shows a skeleton while a chunk compiles. tsc + lint stay clean.
- Memory tuning (empirically A/B tested):
  - `NODE_OPTIONS=--max-old-space-size=1024` in the dev script.
  - `turbopackMemoryLimit: 2200` — 1400 makes big compiles crash-loop (eviction thrash mid-compile;
    reproduced twice); 2200 lets the ~25s root compile finish. Any config change invalidates the
    Turbopack cache → full recompile — do NOT flip configs casually.
- Built `keepalive.mjs` (project root; log/pid at root, NOT .zscripts — a sandbox process periodically
  resets .zscripts and deleted files there): probes `robots.txt` every 10s (**never `/`** — a page probe
  triggers a ~3GB compile and a probing watchdog keeps a fresh server in a permanent compile→OOM crash
  loop — reproduced), respawns `bun run dev` if dead, waits for health, exponential backoff 30→300s.
- Cache warm-up (server-side, zero browser): `/home/z/.qa/warm-chunks.sh` recursively fetches the page +
  every chunk referenced in runtime chunk tables (319 chunks, fixpoint); `/home/z/.qa/warm-apis.sh`
  pace-warms all 160 API routes (8s spacing for GC headroom, health-checked, auto-resumes after restarts).
  Ran twice (re-run after config flips invalidated cache). All 160 routes warmed with zero deaths when paced.
- Discovered the VersionGuard reload loop: with a browser open, a server death → respawn → VersionGuard
  auto-reloads the page → the heavy reload itself OOMs the marginal server → loop. Mitigation: browser QA
  in short bursts, browser CLOSED between batches (the steady-state serving server is stable indefinitely).

Stage Summary:
- Module code splitting + tuned memory limits + static-asset keepalive probe + full chunk/API warm-up +
  browser-burst discipline = all four roles browsable; self-healing in ~5-60s if OOM still strikes.

---
Task ID: 3
Agent: Z.ai Code (main orchestrator)
Task: End-to-end browser verification of all four roles + final polish.

Work Log:
- **Public website**: full render (hero, why-us, stages, facilities, admissions inquiry form, footer),
  zero console errors. Login Portal ↔ public navigation works; hash routes (#portal/#platform) work.
- **Principal** (Dr. Ananya Iyer): Dashboard KPIs live (1,842 students · 96 teachers · 93% attendance ·
  ₹1.84 Cr pending fees · 47 admissions · Principal Attention alerts). Modules verified rendering with real
  data: Examinations, Fee Management (₹5.19 L collected, trend charts, outstanding dues), Library
  (catalogue, overdue/fines), Certificates, Settings. Sign-out works.
- **Teacher** (Rohan Mehta): Dashboard with position-assignment banner (Examination Incharge, real
  workflow). Modules verified: My Timetable, Marks Entry, Lesson Planner, Class Attendance.
- **Student** (Aarav Sharma): Dashboard (Grade 9-A · Roll 18 · 100% attendance · Up Next). Modules
  verified: Timetable, Results, Learning.
- **Super Admin** (Arjun Malhotra): Platform Overview (3 schools · 2 active · 1 trial · 49 enabled
  modules), Schools (3 demo tenants + Control Center), Platform Controls (adapters, policies).
- **Responsive**: 390px viewport → scrollWidth 390, zero horizontal overflow. Screenshots:
  /home/z/.qa/qa-superadmin-{mobile,desktop}.png.
- Console errors: zero in clean sessions (ChunkLoadErrors only during server-restart windows; the
  app self-recovers via reload).
- Final gates: tsc --noEmit 0 errors ✓ · bun run lint clean ✓ · all 4 logins 200 ✓ · server healthy ✓.
- Cleanup: /tmp/scholario-import removed; no garbage imported (no screenshots/, qa-shots/, agent-ctx/,
  agent-tasks/, verify/, audit-report); no dead deps; no duplicate files.

Stage Summary:
- ALL FOUR ROLES verified end-to-end in the browser with real data, zero lint/tsc errors, responsive at
  390px, self-healing infrastructure. Production-ready within sandbox constraints.

## Current project status

- Dev server :3000 stable (keepalive-guarded), event-stream :3003 running, gateway forwarding verified.
- All chunks (319) + all API routes (160) disk-cached → module loads fast; browser sessions work in bursts.
- Keepalive auto-recovers OOM kills in ~5-60s. The user-visible worst case is a brief auto-reload.

## Current goals / verification results

- ✅ Import complete and clean (no garbage, no dead deps, no duplication)
- ✅ Zero tsc errors, zero lint errors
- ✅ AI question generator works via z-ai-web-dev-sdk (no API key needed)
- ✅ All four roles verified in browser: login → dashboard → modules → sign-out
- ✅ Public website, Login Portal, Platform landing render with zero console errors
- ✅ Responsive at 390px (no horizontal overflow)
- ✅ Realtime socket.io handshake verified direct + via gateway
- ✅ Keepalive watchdog + warm-up tooling in place for ongoing stability

## Unresolved issues / risks / next-phase priorities

1. **Sandbox memory ceiling (structural)**: 4GB cgroup, no swap; Turbopack dev retains ~2.8GB for this
   app. A headless QA browser (~700MB) + a first-load compile spike can still OOM-kill the server;
   keepalive recovers in ~5-60s and the app auto-reloads. Browser QA should be done in short bursts.
   NEVER probe `/` from any monitor (use robots.txt). NEVER delete .next. NEVER set
   turbopackMemoryLimit below 2200 (compiles crash-loop).
2. **.zscripts resets**: an external sandbox process periodically resets `.zscripts/` (deleted keepalive
   log + 5 infra scripts at ~22:10). Keepalive v3 writes to project root instead. If mini-service logs
   are needed, keep them inside mini-services/<svc>/.
3. **Razorpay webhooks** need RAZORPAY_* env vars for live payments; route degrades gracefully (mock
   provider covers demo flows).
4. Next-phase candidates (for the 15-min webDevReview rounds): deeper per-module data reconciliation
  (fees ↔ applications linkage, certificates history), event-stream end-to-end (payment → school-event
  broadcast → live badge), dark-mode sweep, keyboard nav audit, more module tours per role
  (principal: Admissions/Teachers/Students/Calendar/Transport/Inventory/Downloads/Messaging;
  teacher: Student Directory/Application Reviews/Student Behavior/Performance Analytics/Settings;
  student: Profile/My Class/Attendance/Notices/Messages/Fees/Certificates/Bus/Applications).
5. Warm-up tooling lives in /home/z/.qa/ (warm-chunks.sh, warm-apis.sh, qa-lib.sh login/click helpers) —
  re-run both if the cache is ever invalidated (config change or .next loss); paced API warming takes
  ~25 min, chunk warming ~2 min.

## Operational runbook (for cron agents)

1. Read this worklog first. Check server: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/robots.txt`
   (expect 200; if not, keepalive needs ≤60s — check `tail keepalive.log`).
2. Browser QA in SHORT bursts; close the browser between batches (`agent-browser close`).
3. If a module click leaves a blank page: the server restarted mid-load — reload the page after the
   server is healthy again.
4. Login helper: /tmp/qa-lib.sh may be gone; recreate from this worklog's credentials section or use
   agent-browser fill/click directly on the Login Portal.
5. After ANY code change: run `bunx tsc --noEmit` and `bun run lint`; then re-warm chunks/APIs if routes
   or imports changed structurally.
