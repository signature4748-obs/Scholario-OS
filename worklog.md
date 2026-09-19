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
- All chunks + all API routes disk-cached → module loads fast; browser sessions work in bursts.
- Keepalive auto-recovers OOM kills in ~5-60s. The user-visible worst case is a brief auto-reload.
- Round 1 (Task ID 4) complete: Principal account-security parity + shared PasswordField across roles.

## Current goals / verification results

- ✅ Import complete and clean (no garbage, no dead deps, no duplication)
- ✅ Zero tsc errors, zero lint errors
- ✅ AI question generator works via z-ai-web-dev-sdk (no API key needed)
- ✅ All four roles verified in browser: login → dashboard → modules → sign-out
- ✅ Public website, Login Portal, Platform landing render with zero console errors
- ✅ Responsive at 390px (no horizontal overflow)
- ✅ Realtime socket.io handshake verified direct + via gateway
- ✅ Keepalive watchdog + warm-up tooling in place for ongoing stability
- ✅ NEW: Principal Settings → My Account (login & security, change password, session info)
- ✅ NEW: shared PasswordField (eye toggle, live counter, a11y) used by all three role settings
- ✅ Round-1 QA: student Fees/Notices/Messages verified, zero errors

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

---
Task ID: 4
Agent: Z.ai Code (cron webDevReview round 1 — 2026-09-18/19)
Task: QA sweep + new feature + styling detail (mandatory: features & styling polish).

Work Log:
- QA burst (student role): Fees (balance due, real fee lines), Notices (My Feed/Announcements/Calendar,
  12 items), Messages (real teacher threads, unread counts) — all render, zero console/page errors.
- Gap found: Teacher + Student Settings both have "Login & Security" (change-password UI backed by the
  role-agnostic /api/auth/change-password) — **the Principal had NO account/security surface at all**.
- NEW FEATURE (PR-SEC): `principal/modules/school-settings/security-tab.tsx` — a "My Account" tab at the
  end of the School Settings tab strip: sign-in identity (email, account type, last sign-in from
  User.lastLoginAt), live session context (started, device browser/OS, IP), change-password form (same
  API + revokes other sessions server-side), and sign-out. Wired into index.tsx tab registry
  (value="account", ShieldCheck icon). Verified in browser: tab activates, real data renders
  (principal@greenwood.edu.in · Principal · Chrome·Linux · ::1), validation fires
  ("Fill in all three password fields."), toast flow unchanged.
- STYLING/UX DETAIL: new shared `src/components/shared/password-field.tsx` — show/hide eye toggle
  (aria-label + aria-pressed, keyboard accessible), live "n/6+ chars" counter on new-password fields,
  password-manager autocomplete hints, unified focus ring. Replaced the duplicated PasswordField in
  student AND teacher section-security (killed triplication; removed the now-redundant static
  "Minimum 6 characters" hint). New `SettingsInfoRow` primitive in school-settings/shared.tsx
  (label→value rows with hairlines, matching the Finance InfoRow rhythm).
- MEMORY NOTE (important for next rounds): source edits invalidate chunks → any browser login then
  recompiles them WITH the browser attached → OOM restart loop (reproduced). FIX: after editing files,
  CLOSE the browser, wait for health, run `bash /home/z/.qa/warm-chunks.sh` (~2 min, discovers new chunk
  hashes via the runtime tables), THEN browser QA — this round's verification only succeeded after
  re-warming. Radix tabs need full pointer-event dispatch (pointerdown→mousedown→pointerup→mouseup→click)
  for synthetic activation; plain .click() only works on plain buttons (sidebar nav).
- Gates: tsc --noEmit 0 errors ✓ · bun run lint clean ✓ · console/page errors zero ✓ ·
  screenshot: /home/z/.qa/qa-principal-my-account.png.

Stage Summary:
- Principal now has full account-security parity with Teacher/Student (new tab + real session data).
- One shared PasswordField across all three roles (dedup + eye toggle + live counter + a11y).
- QA: student Fees/Notices/Messages verified; all green.

---
Task ID: 5
Agent: Z.ai Code (cron webDevReview round 2 — 2026-09-19)

Task: Full-status assessment + agent-browser QA of all remaining modules, fix bugs, then
feature + styling development (mandates: more features, more styling detail).

Work Log:
- **INFRA INCIDENT (fixed)**: root-page compile hung forever ("○ Compiling / ..." with CPU frozen
  ~0:31, every fresh server, deterministic). Root cause: poisoned Turbopack cache in .next/dev
  after a pre-session crash-loop (keepalive logged restarts 00:20→00:39 before this round began).
  Fix: paused keepalive (SIGSTOP) → killed dev → `mv .next/dev .next/dev.poisoned-*` → keepalive
  resumed → clean compile succeeded in 47s → warm-chunks.sh (319 chunks) → full recovery.
  Quarantine deleted after verification. LESSON: if a fresh server hangs on "Compiling /" for
  >2min with frozen CPU, quarantine .next/dev and let it rebuild (clean compile ≈ 47s).
- **QA — MODULE COVERAGE NOW 100%** across all four roles (browser-verified render + real data):
  - Principal +5: Admissions, Calendar, Transport, Inventory, Downloads.
  - Teacher +7: Student Directory, Application Reviews, Student Behavior, Performance Analytics,
    Exam Duties, My Salary & Payments, My Attendance.
  - Student +6: My Profile, Class Leadership, Attendance, Certificates, Transport, Applications.
  - Super Admin: verified in prior rounds (Overview, Schools, Platform Controls).
- **OOM burst protocol (empirical)**: server retains ~2.8GB RSS after serving pages; kernel OOM
  kills next-server at ~3.0GB anon RSS (dmesg confirmed). Warmed chunks serve from DISK in ~4ms
  (no recompile) — so bursts survive on a FRESH server (~6-7 module loads) but die on a
  loaded one. Protocol: close browser → kill dev tree (bun run dev + next dev + next-server,
  keepalive auto-restarts) → verify robots:200 + low RSS → browser burst ≤6 modules → close.
  Login form gotcha: React controlled inputs need set-value → dispatch → set-value → dispatch
  (setting both before dispatching clears the password on re-render).
- **BUG FIXED (pre-existing)**: public-website Admissions card decorative halo
  (`absolute -top-12 -right-12`) had no overflow-hidden → 23px horizontal scroll at 390px
  (scrollWidth 413). Added `overflow-hidden` to the card wrapper → 391 (remaining 1px is a
  subpixel rounding artifact; zero elements exceed 390).
- **NEW FEATURE — Public Notice Board** (`public-website.tsx`): the /api/schools/public payload
  already carried `announcements` (latest 5, audience ALL/STUDENTS/PUBLIC) but the public site
  never rendered them. New section between Facilities and Admissions: live-pill header
  ("Live notice board", pulsing emerald dot), featured newest notice (calendar-tile date badge,
  priority chip URGENT/HIGH/NORMAL with rose/amber/emerald tones, accent bar, verified-broadcast
  footer line) + compact stack for the rest, portal CTA strip, FadeIn stagger, hover lift,
  dark-mode dual-tone, a11y (article/aria-label/time dateTime). Section hidden entirely when
  no notices. Header nav gained "Notices" → #notices. Renders with 3 real DB announcements.
- **NEW FEATURE — Composer public-reach hint** (`comm-compose.tsx`): when the principal selects
  a public-mapped audience (All Students → STUDENTS), an emerald Globe hint explains the notice
  will also appear on the public website notice board. Verified in browser: hidden for All
  Parents, appears for All Students (58 recipients).
- **Infra**: event-stream :3003 had died mid-round; restarted (direct 200 + gateway forward
  200). Disk cleaned (6.8GB free).
- Gates: `bunx tsc --noEmit` 0 errors ✓ · `bun run lint` clean ✓ · screenshots:
  /home/z/.qa/qa-public-noticeboard{,-2}.png, qa-noticeboard-mobile.png,
  qa-composer-public-hint.png, qa-teacher-behavior.png.
- Console errors: zero in stable windows; only transient "Failed to fetch" during the
  documented OOM-restart windows (self-healing).

Stage Summary:
- 100% module coverage across all 4 roles in the browser; poisoned-cache incident resolved.
- New user-visible capability: principal broadcasts now reach the PUBLIC website (notice board),
  with the connection made explicit inside the composer.
- Pre-existing 390px overflow bug fixed; gates green.

## Current project status (end of round 2)

- Dev server :3000 healthy (keepalive-guarded), event-stream :3003 healthy (direct + gateway),
  all chunks warmed (319), DB in sync, disk 6.8GB free.
- EVERY module of EVERY role has now been browser-verified at least once across rounds 1–2.
- Zero tsc errors, zero lint errors, no dead code introduced; two focused new features.

## Current goals / verification results (round 2)

- ✅ Poisoned Turbopack cache diagnosed + recovered (clean-cache compile path proven)
- ✅ 100% role/module QA coverage (18 newly verified modules this round)
- ✅ Public Notice Board shipped (real data, responsive, dark-mode, a11y)
- ✅ Composer public-reach hint shipped + browser-verified
- ✅ 390px overflow bug fixed (413 → 391, no overflowing elements)
- ✅ event-stream service restarted + gateway forward verified
- ✅ Gates: tsc 0 errors, lint clean

## Unresolved issues / risks, next-phase priorities

1. **Sandbox memory ceiling (unchanged, structural)**: bursts of ≤6 module loads on a fresh
   server are safe; longer sessions or bursts on a loaded server OOM (self-heals in ~5-60s).
   Next candidate if desired: keepalive "recycle" subcommand to standardize the
   kill→health→warm cycle (manual protocol documented above works).
2. **turbopack cache poisoning can recur** after crash-loops: if "Compiling /" hangs >2min with
   frozen CPU on a fresh server, quarantine .next/dev and rebuild (proven 47s path). Do NOT
   delete .next wholesale — only .next/dev, and never while the server runs.
3. Next-phase feature candidates: dark-mode visual sweep was audited statically (clean — the
   remaining hardcoded colors are intentional paper-document surfaces); deeper candidates:
   timetable ICS export, per-role notification preferences UI, superadmin activity/audit feed,
   public site SEO/OG metadata pass, principal fee-defaulter outreach workflow.
4. The 1px scrollWidth artifact at 390px (391 vs 390) is subpixel rounding — no element
   actually overflows; safe to ignore.

## Operational runbook (for cron agents)

1. Read this worklog first. Check server: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/robots.txt`
   (expect 200; if not, keepalive needs ≤60s — check `tail keepalive.log`).
2. Browser QA in SHORT bursts; close the browser between batches (`agent-browser close`).
   PROVEN PROTOCOL (Task 5): bursts survive ~6 module loads on a FRESH server only. Before each
   burst: close browser → `for p in $(pgrep -f "bun run dev"; pgrep -f "next dev -p 3000";
   pgrep -f "next-server"); do kill -9 $p; done` → wait ~25s (keepalive restarts) → robots:200
   → burst → close. A loaded server (~2.8GB RSS) + browser will OOM within 1-2 module loads.
3. If a module click leaves a blank page: the server restarted mid-load — reload the page after the
   server is healthy again.
4. Login helper: /tmp/qa-lib.sh may be gone; recreate from this worklog's credentials section or use
   agent-browser fill/click directly on the Login Portal.
5. After ANY code change: run `bunx tsc --noEmit` and `bun run lint`; then re-warm chunks/APIs if routes
   or imports changed structurally.
6. AFTER EDITING SOURCE FILES, always: close browser → wait for server health → run
   `bash /home/z/.qa/warm-chunks.sh` (re-fetches the new chunk hashes; ~2 min) → THEN browser QA.
   Skipping this recompiles edited chunks with the browser attached → OOM restart loop.
7. Radix UI tabs need full pointer-event dispatch to activate synthetically:
   pointerdown → mousedown → pointerup → mouseup → click. Plain .click() works only on plain buttons.
8. In some headless sessions document.innerText returns "" for rendered pages — use textContent
   (or check specific elements) instead of innerText for content assertions.
9. Chrome caches its own "site can't be reached" interstitial — if a reload shows blank text, do a
   fresh `agent-browser open` instead of `reload`.
