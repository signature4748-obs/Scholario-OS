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

---
Task ID: 6
Agent: Z.ai Code (cron webDevReview round 3 — 2026-09-19)

Task: Full-status assessment + agent-browser QA, fix discovered bugs, then
feature + styling development (mandates: more features, more styling detail).

Work Log:
- **STATUS ASSESSMENT**: server healthy, event-stream :3003 healthy, disk 6.8G,
  tsc 0 / lint 0 at round start. Baseline QA burst on the student Timetable
  module found a REAL BUG: "No timetable for Grade 9 - A yet" (empty state).
- **BUG ROOT CAUSE (label-universe mismatch)**: the student Timetable module
  read the Zustand timetable-store seed (className universe "Class 9-A",
  "Class 2-A", "Class 12-Sci-A"…) and joined it on the SERVER enrollment
  label ("Grade 9 - A" from /api/auth/me SD-3b). 0 matches ⇒ empty state.
  The DB Timetable (78 rows, classes "Grade 9 - A"/"Grade 10 - A", 7 teaching
  periods × 6 days each) is the same truth the student Dashboard and the
  Teacher My-Timetable already consume — the module was the odd one out.
- **FIX (server-backed student timetable)**:
  - NEW `GET /api/student/timetable` (requireStudent → classId-scoped rows +
    school-wide master rows + canonical schoolDays; permission model mirrors
    /api/teacher/timetable; nothing fabricated).
  - NEW `student/modules/timetable/server-slots.ts` — maps DB teaching-period
    numbers (1-7, breaks not stored) onto the canonical PERIODS ladder by
    START-TIME matching (fallback: nth non-break ladder period; final
    fallback: synthesized time) so Short Break / Lunch re-appear correctly
    between periods.
  - REWROTE `student/modules/timetable/index.tsx`: server payload is now the
    single source (classLabel, section, mySlots, masterSlots); loading =
    staggered skeleton; error = honest retry card; stale data + failed
    refresh = amber banner with Retry (teacher-module parity); the store is
    used ONLY for the "Updated" publications chip (display-only).
  - Verified in browser: My Class renders Grade 9 - A · Section A, 6 school
    days · 7 subjects, full Saturday timeline with real teacher/room data +
    breaks + live "Next" badge; School view renders the master sheet with
    BOTH real classes and the class filter (All / Grade 9 - A / Grade 10 - A).
- **NEW FEATURE — Timetable ICS calendar export (Student + Teacher)**:
  - NEW `src/lib/ics/builder.ts` — pure RFC 5545 builder: CRLF, 75-octet line
    folding, TEXT escaping, fixed-offset VTIMEZONE (Asia/Kolkata +0530),
    DTSTART/DTEND;TZID, RRULE:FREQ=WEEKLY;COUNT=12 (one term), stable UIDs,
    X-WR-CALNAME/DESC, and a Blob download helper. Validated offline against
    the real API payload: 42 events, 0 lines >75 octets, correct VTIMEZONE.
  - NEW shared `src/components/shared/export-ics-button.tsx` — "Add to
    Calendar" affordance with two design-language variants (glass = student
    pill, toolbar = teacher emerald), disabled-on-empty, focus ring, active
    scale, compatibility tooltip, sonner success/error toasts.
  - Student toolbar (My Class row) exports the personal class schedule
    (42 events, toast verified). Teacher My-Timetable ModuleToolbar action
    exports their teaching cells (14 events, matches Periods/Week stat,
    toast verified). Sample artifact: download/sample-timetable-export.ics.
- **NEW FEATURE — Public site SEO/OG metadata pass** (layout.tsx): title
  template, expanded keywords, applicationName/category, canonical, full
  openGraph (type/siteName/url/images with dims + alt), twitter
  summary_large_image, robots with googleBot max-image-preview, and a
  Viewport export with light/dark themeColor matched to the app palette
  (#f9fdfa / #06140f). Generated a branded 1344×768 OG image (emerald
  enterprise aesthetic) via z-ai image CLI → public/og-image.jpg; verified
  served 200 image/jpeg and all og:/twitter:/theme-color tags present in
  the rendered HTML.
- **GOTCHA FIXED**: lucide-react in this repo has NO `CalendarDown` export —
  Turbopack build failed (tsc did NOT catch it; loose module typing).
  Switched to `CalendarPlus`. LESSON: after icon-name edits, verify with
  `curl /` (Turbopack compile) in addition to tsc.
- **QA process notes**: agent-browser @refs go stale across re-renders —
  prefer DOM eval clicks (`document.querySelectorAll` + find by text +
  .click()) for this SPA; `[role=tab]` exists in multiple widgets (scope by
  container); server restarts mid-session trigger VersionGuard reloads that
  invalidate in-flight evals — re-query after any Fast Refresh cycle.
  Login-portal flow: public site → "Login Portal" button → role chip →
  Sign In (hash URL #portal alone does not re-enter the portal view).
- Infra events this round: one OOM during first-compile-with-browser (known
  structural issue; keepalive recovered; re-warmed chunks before continuing).
  Login via API for server-side endpoint tests: POST /api/auth/login with
  {"email","password"} (NOT "identifier").

Stage Summary:
- Student Timetable BUG FIXED (server-truth rewiring; the module now shows the
  real enrollment-scoped schedule + real master sheet).
- Two new user-visible capabilities: .ics calendar export for Student + Teacher
  timetables, and a complete SEO/OG metadata surface for the public site.
- Gates: tsc 0 errors ✓ · lint clean ✓ · robots 200 ✓ · og-image 200 ✓ ·
  zero console errors in QA windows · dev.log clean.

## Current project status (end of round 3)

- Dev server :3000 healthy (keepalive-guarded), all 319 chunks warmed, DB in
  sync, disk ~6.6G free, event-stream :3003 running.
- All four roles remain browser-verified end-to-end; the student Timetable is
  now server-backed (was the one module on stale client-seed data).
- Zero tsc errors, zero lint errors, no dead code, no duplicate files.

## Current goals / verification results (round 3)

- ✅ Student Timetable empty-state bug diagnosed + fixed (label universes
  reconciled by moving the module to the server truth)
- ✅ NEW /api/student/timetable (enrollment-scoped, permission-modeled)
- ✅ NEW ICS export (shared RFC 5545 builder + shared button, student +
  teacher, verified in browser with toasts; sample in download/)
- ✅ NEW SEO/OG metadata + generated OG image (tags verified in served HTML)
- ✅ Loading / error / stale states for the student timetable (skeleton,
  retry card, amber stale banner)
- ✅ Gates green: tsc 0, lint clean, robots 200, og 200

## Unresolved issues / risks, next-phase priorities

1. **Sandbox memory ceiling (unchanged, structural)**: bursts of ≤6 module
   loads on a fresh server are safe; longer sessions or bursts on a loaded
   server OOM (self-heals in ~5-60s). This round reproduced it once during
   first-compile-with-browser; re-warming chunks fixed it.
2. **Icon-name trap**: tsc does not catch missing lucide-react exports —
   always `curl /` (or check dev.log) after touching icon imports.
3. **Principal Timetable editor still operates on the client store universe**
   ("Class 2-A"… labels), which no longer matches what students/teachers see
   (DB rows). Next-phase candidate: rewire the Principal Timetable module to
   the DB (read + publish) so the whole timetable pipeline is one universe.
4. Other next-phase candidates: timetable ICS export for the principal view,
   superadmin platform activity feed merging ActivityLog + payments +
   sessions (16/15/318 rows exist), public-site news/announcements RSS,
   principal fee-defaulter outreach workflow, keepalive "recycle" subcommand.
5. The ICS fold() counts UTF-16 code units, not octets — lines with many
   multibyte chars could theoretically exceed 75 octets; current content
   (ASCII + a few · separators) stays far below; all parsers tolerate it.

---
Task ID: 7
Agent: Z.ai Code (cron webDevReview round 4 — 2026-09-19)

Task: Full-status assessment + agent-browser QA, fix discovered gaps, then
feature + styling development (mandates: more features, more styling detail).

Work Log:
- **STATUS ASSESSMENT**: all gates green at start (tsc 0 / lint 0 / robots 200 /
  stream 200 / 6.7G disk). QA burst targeted the top known architectural debt:
  the Principal Timetable editor still operating on the client-store seed
  universe ("Class 2-A"…, 54 slots, 5 classes) while students/teachers read the
  DB (Grade 9 - A / Grade 10 - A, 78 rows) — confirmed in the browser: the
  principal's publishes could never reach any student or teacher view.
- **FEATURE — Timetable pipeline unified on ONE data universe (Principal ↔ DB)**:
  - `src/lib/timetable/config.ts` — removed 'use client' (pure constants) so
    client components AND server route handlers share the one period ladder.
  - NEW `src/lib/timetable/server-mapping.ts` — the shared bidirectional
    DB ⇄ TimetableSlot mapping (teaching-period numbers ↔ ladder periods via
    start-time matching with positional fallbacks; "HH:MM" ↔ ladder-style range
    strings). The student module's server-slots.ts became a re-export shim
    (dedup: both directions use ONE algorithm).
  - REWROTE `GET /api/timetable` to the flat ServerSlot shape (no prior
    consumers) with class labels resolved server-side.
  - NEW `POST /api/timetable/publish` (PRINCIPAL-only, roles-guarded twice):
    shared mapping → resolve classes/subjects by name (create genuinely-new
    ones) → replace-all within the school (publish = the new truth) →
    ActivityLog audit entry (TIMETABLE_PUBLISHED). Validated: EMPTY_TIMETABLE
    and FORBIDDEN error paths; live 78-row round-trip with ZERO drift (lost 0 /
    gained 0) and no duplicate Class/Subject rows created.
  - Store: NEW `hydrateFromServer(slots)` action (replaces slots +
    publishedSlots, clears pending; no-op on empty).
  - Principal `index.tsx`: mount-time hydration from /api/timetable (unknown
    teachers get STABLE synthetic ids `srv-<name-slug>` — never '' — so
    conflict detection sees distinct people: conflicts went 22 → 0, faculty
    2 → 4); dynamic classOptions/roomOptions derived from live slots (was
    static CLASSES/ROOMS — hydrated classes would have vanished from the grid
    and filters); selectedClass default 'all'; publish now syncs to the server
    with an honest failure path (toast.warning "Published locally — server
    sync failed" + retry).
  - FiltersBar / ScheduleGrid / AutoTimetableDialog / overview-cards: accept
    live class/room options (static lists only as fallback); "Across N classes"
    count now derived from the schedule; removed an unused CLASSES import.
- **END-TO-END PROOF (browser, full pipeline)**: principal → Edit → removed
  "Physics · Grade 10 - A · Monday Period 1" → Apply Changes → Publish →
  toast "1 change shared with affected users · 77 server slots across 2
  classes" → DB verified (77 rows; Grade 10-A Monday starts P2) → student API
  verified (masterSlots reflect the removal) → original 78-row state restored
  via the publish API (rows back to 78, Monday P1 present). The Principal now
  publishes and the whole school actually sees it.
- **NEW FEATURE — Super Admin Platform Activity Feed (real server records)**:
  - NEW `GET /api/superadmin/activity` (SUPER_ADMIN-only): merges ActivityLog
    (with user + school names), successful Payments (student/class/method),
    and Sessions (compact device label via parseUserAgent — "Chrome · Linux ·
    Desktop", "(API)" for curl) into one newest-first timeline (take 30).
  - NEW `superadmin/modules/activity-feed.tsx` — Panel with refresh action,
    staggered loading skeleton, honest error + retry, empty state, hairline
    ledger rows (kind icon chip · actor · summary · school badge · relative
    timestamp), max-h-96 scroll area. Wired into the Overview below the tenant
    change log (mock control plane vs REAL records — now visually adjacent).
    The feed already shows this round's TIMETABLE_PUBLISHED entries live.
- **STYLING**: data-lineage chips on the principal timetable header — emerald
  pulsing "Synced with school records" / amber "Local snapshot (server
  unreachable)" / muted "Syncing…" (aria-live); publish toast now carries real
  server counts; activity-feed ledger rhythm matches the tenant panels.
- **QA process notes**: this round reproduced the OOM crash-loop twice — the
  server died every ~30s WHILE the browser was attached (dmesg: next-server
  anon-rss 3.13GB). Recovery: close browser → keepalive restarts → re-warm →
  SHORT bursts. After source edits land mid-session, Fast Refresh remounts
  the SPA and resets viewState — redo portal navigation after the HMR cycles
  finish; Chrome caches the "site can't be reached" interstitial (fresh
  `agent-browser open`, never reload). Evals can hit the pre-hydration DOM
  right after `open` — wait 6-8s before asserting on button text.

Stage Summary:
- The timetable pipeline is ONE universe end-to-end: Principal edits/publishes
  → DB rows → Student + Teacher views (browser-proven with a live edit that
  propagated to the student-visible master timetable, then restored).
- Super Admin gained a REAL activity feed (staff actions + payments + sign-ins).
- Gates: tsc 0 errors ✓ · lint clean ✓ · robots 200 ✓ · stream 200 ✓ ·
  zero console errors in QA windows · dev.log clean.

## Current project status (end of round 4)

- Dev server :3000 healthy (keepalive-guarded, chunks re-warmed after every
  source batch), event-stream :3003 healthy, disk 6.6G free.
- All four roles browser-verified; the timetable domain is now fully connected
  across Principal → DB → Student/Teacher (was the largest known gap).
- Zero tsc errors, zero lint errors, no dead code, no duplicate files.

## Current goals / verification results (round 4)

- ✅ Principal Timetable hydrated from the server (78 real slots, 2 real
  classes, 0 conflicts, 4 faculty, sync chip)
- ✅ NEW POST /api/timetable/publish (permission-guarded, replace semantics,
  class/subject resolution, audit log; round-trip drift: zero)
- ✅ Full publish pipeline proven in the browser + student API, then restored
- ✅ NEW Super Admin activity feed (real ActivityLog/Payments/Sessions, styled
  ledger, loading/error/empty states) — renders live data including this
  round's publishes
- ✅ Styling: lineage chips, server-count toasts, ledger rhythm, skeletons
- ✅ Gates green: tsc 0, lint clean, robots 200, stream 200

## Unresolved issues / risks, next-phase priorities

1. **Sandbox memory ceiling (unchanged, structural)**: OOM crash-loops
   reproduced twice this round while a browser was attached to a compiling
   server. The protocol (close browser → recover → warm → short bursts)
   works but costs time; keep bursts to login + ≤1 module.
2. **Timetable editor teacher picker is roster-bound**: hydrated slots whose
   teacher is not in the mock roster (Mrs. Kavita Sharma etc.) carry synthetic
   ids; editing such a slot requires re-picking a roster teacher. A future
   round could load teachers from the server (Teacher table) instead of mocks.
3. **Public-website + login metadataBase** is `http://localhost:3000`
   (sandbox-only; harmless here, set a real origin if ever deployed).
4. Next-phase candidates: teacher picker server-backed (Teacher table);
   principal timetable "publish" notification fan-out via the event-stream
   service (:3003) so open student tabs live-refresh without reload; the
   remaining store-seeded modules audit (any other module whose labels could
   disagree with server truth); fee-defaulter outreach workflow; public-site
   RSS for the notice board.
5. ActivityLog coverage is thin by design (only workflows that already log);
   consider adding activity logging to more principal workflows (fee
   reminders, certificate issuance) to enrich the superadmin feed.

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
10. ICON TRAP (Task 6): tsc does NOT catch missing lucide-react exports (loose module typing) —
    after touching icon imports, verify with `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
    (500 = Turbopack import error; check dev.log for the exact export name). Available calendar icons
    here: CalendarPlus/CalendarCheck/CalendarClock… but NOT CalendarDown.
11. SPA clicking (Task 6): agent-browser @refs go stale across re-renders — prefer DOM eval clicks:
    `agent-browser eval '(() => { for (const x of document.querySelectorAll("nav button")) if (x.textContent.trim() === "Timetable") { x.click(); return "ok" } return "none" })()'`.
    Wrap in an IIFE (top-level consts persist between evals and redeclare-error). Scope [role=tab]
    queries by container (several widgets have tabs). Server restarts mid-session trigger VersionGuard
    reloads — re-query elements after any Fast Refresh cycle.
12. Server-side endpoint tests: POST /api/auth/login expects {"email","password"} (not "identifier");
    cookie jar via curl -c/-b, then GET the API under test and assert the {ok:true,data} envelope.
13. OOM CRASH-LOOP (Task 7, reproduced twice): when a browser is attached while the server still
    needs to compile (fresh server + first page/modules), the server dies every ~30s
    (dmesg: next-server anon-rss ~3.1GB) and Chrome caches the "site can't be reached"
    interstitial. Protocol: `agent-browser close` → wait for keepalive (robots:200, ~30s) →
    `bash /home/z/.qa/warm-chunks.sh` → fresh `agent-browser open` (NEVER reload — the
    interstitial is cached) → burst = login + ≤1 module → close. Prefer curl-based API tests
    over browser clicks whenever the assertion does not need rendering.
14. FAST-REFRESH REMOUNTS (Task 7): source edits landing while a browser is attached trigger
    HMR that remounts the SPA — page.tsx viewState resets to the public website and refs/evals
    go stale mid-flow. After any edit → warm first, then re-login. Also: right after
    `agent-browser open`, the DOM may be pre-hydration (buttons render with no text) —
    wait 6-8s before eval-based assertions.

---
Task ID: 8
Agent: Z.ai Code (cron webDevReview round 5 — 2026-09-19)

Task: Full-status assessment + agent-browser QA, then feature + styling
development (mandates: more features, more styling detail).

Work Log:
- **STATUS ASSESSMENT**: all gates green at start (robots 200 / stream 200 /
  tsc 0 / lint 0 / 6.7G disk). QA bursts verified round-4 surfaces still
  healthy: Principal Timetable (sync chip, 78 real slots, real classes) and
  Super Admin activity feed ("School records activity", 30 real rows).
  No bugs found → proceeded to feature development.
- **NEW FEATURE 1 — Timetable publish LIVE fan-out (event-stream)**:
  - `mini-services/event-stream/index.ts`: poll source #4 — ActivityLog rows
    (action=TIMETABLE_PUBLISHED) → `school-event` frames with NEW kind
    `timetable` (title "Timetable updated", detail carries slot counts +
    actor name, schoolId-scoped); watermark query extended. Service
    auto-restarted via bun --hot; verified by log line
    `[event-stream] timetable → 78 slots across 2 classes (replaced 78 rows) (Dr. Ananya Iyer)`.
  - `live-feed-store.ts`: kind union + `timetableVersion` counter (bumped on
    every timetable push) — modules detect "changed since I loaded" without
    polling.
  - `app-shell.tsx`: handles the timetable kind — amber-accent premium toast
    (CalendarCheck icon chip + LIVE pill), bell entry (type TIMETABLE),
    live-feed mirror. `notifications-dropdown.tsx`: TIMETABLE icon branch
    (CalendarCheck, amber tones). `live-activity-ticker.tsx`: KIND_META
    timetable entry (principal dashboard ticker).
  - Student `timetable/index.tsx` + teacher `my-timetable.tsx`: watch
    `timetableVersion` (baseline set at first load); on a NEW publish →
    quiet background refetch (skeleton only renders pre-first-load, so an
    open tab never flashes) + emerald "Updated · live" chip (pulsing Radio
    dot, role=status aria-live, tooltip) in the toolbar.
  - **END-TO-END PROOF (browser)**: student tab open via the GATEWAY origin →
    curl no-op round-trip publish (78→78, zero drift) → within ~5s the toast
    "Timetable updated [Live] 78 slots across 2 classes (replaced 78 rows) ·
    by Dr. Ananya Iyer" + the "Updated · live" chip appeared; bell shows the
    unread TIMETABLE entry. Screenshots:
    download/qa-round5-student-live-refresh.png.
- **NEW FEATURE 2 — Public notice board RSS feed**:
  - NEW `GET /api/public/notices/rss` — RSS 2.0 (xmlns:atom), same source as
    the public notice board (audience ALL/STUDENTS/PUBLIC, latest 15):
    XML-escaped titles/descriptions, RFC 822 pubDates, stable GUIDs, priority
    tags ([URGENT]/[HIGH]), atom:link self, graceful empty-feed fallback when
    the DB is down. Verified via curl — real notices render (Unit Test 2,
    Hydroponics Club, Mid-Term Results…).
  - Public site notice board header: amber-hover "RSS feed" chip (Rss icon,
    a11y label, focus ring, hover lift) linking to the feed.
  - `layout.tsx` metadata: `alternates.types["application/rss+xml"]` —
    RSS autodiscovery from every page's <head>.
- **NEW FEATURE 3 — Server-backed teacher picker (Principal timetable)**:
  - NEW `src/lib/store/teacher-roster-store.ts` — client zustand store,
    mock-seeded for instant paint, `ensure()` fetches GET /api/teachers
    (idempotent, in-flight guard) → REAL Teacher rows (id, employeeId,
    department, derived initials avatar, comma-split subjects); source
    'server'|'mock' for honest lineage.
  - Rewired ALL 7 mock-teacher consumers in the timetable module:
    index.tsx (hydration awaits roster+timetable in parallel → ids consistent
    from the start; change summaries; save handler), slot-editor-dialog.tsx
    (picker options + "live" micro-badge on the Teacher label),
    filters-bar.tsx (faculty filter), overview-cards.tsx ("of N on roster"),
    auto-timetable-dialog.tsx (roster-driven subject→teacher map: mock-id
    names + server subject codes MATH/PHY/ENG… via SUBJECT_CODE_TO_NAME,
    general-pool fallback so small rosters still generate), schedule-grid.tsx
    + timetable-pdf.ts (imperative teacherNameById).
  - **Verified in browser**: "Faculty roster · 4 live" teal lineage chip next
    to the sync chip; slot editor picker lists the REAL DB faculty (Mrs.
    Kavita Sharma DEMO-T-001 · Mathematics, Rohan Mehta GWS-T-014,
    Ms. Priya Iyer DEMO-T-003, Mr. Arjun Nair DEMO-T-002) with the live
    badge. Screenshot: download/qa-round5-teacher-picker-live.png +
    qa-round5-principal-roster-chip.png.
- **STYLING DETAILS shipped with the features**: amber timetable toast
  accent + CalendarCheck chips; emerald "Updated · live" pills (student
  glass + teacher toolbar variants); teal "Faculty roster · N live" lineage
  chip; "live" micro-badge in the slot editor; amber-hover RSS chip on the
  public site; TIMETABLE bell icon branch.
- **QA/INFRA LESSONS (important for next rounds)**:
  1. **Gateway-origin testing**: agent-browser must open the app via
     `http://localhost:81` (the Caddy gateway), NOT localhost:3000 — the
     socket.io URL `/?XTransformPort=3003` only forwards through the gateway.
     A localhost:3000 page silently fails the socket (fetch test returned the
     Next.js HTML instead of the engine.io handshake). Real users always come
     through the gateway, so :81 is the honest test origin.
  2. **Fresh-server burst discipline (refined)**: after source edits, warm
     chunks AND pre-warm the API routes the burst will hit (curl login + the
     module endpoints — API routes compile on demand in dev and an
     on-demand compile with Chrome attached OOMs). Then kill the tree →
     keepalive restart → verify LOW RSS (~400MB) → burst. A server that
     already compiled `/` retains ~2.8-3GB and dies with the browser attached.
  3. **Portal login flakiness**: right after `agent-browser open` on a fresh
     compile, the first "Open Login Portal" click can be swallowed by the
     settling page — re-query buttons and redo the click sequence (portal →
     chip → Sign In) if chips are missing. The Student quick-access chip
     autofills student1@demoschool.edu (a real seeded account — different
     from aarav.sharma; both work).
- **Gates**: `bunx tsc --noEmit` 0 errors ✓ · `bun run lint` clean ✓ ·
  robots 200 ✓ · stream 200 ✓ · dev.log clean ✓ · disk 6.6G free ✓.
  NOTE: tsc needs `NODE_OPTIONS=--max-old-space-size=1500` (900MB cap OOMs —
  the codebase needs ~890MB+).

Stage Summary:
- The timetable pipeline is now LIVE end-to-end: Principal publishes →
  open student/teacher tabs get the broadcast in ≤5s (toast + bell +
  auto-refresh + chip) — browser-proven through the real gateway path.
- Public notice board is subscribable (RSS 2.0 + autodiscovery).
- The principal's timetable editor now operates on the school's REAL teacher
  roster (7 consumers rewired to one server-backed store).

## Current project status (end of round 5)

- Dev server :3000 healthy (keepalive-guarded), event-stream :3003 healthy
  with the new timetable broadcast source, all chunks warmed, DB in sync,
  disk 6.6G free.
- All four roles remain browser-verified; three new user-visible capabilities
  shipped and verified end-to-end this round.
- Zero tsc errors, zero lint errors, no dead code, no duplicate files.

## Current goals / verification results (round 5)

- ✅ Round-4 surfaces re-verified (principal timetable hydration, superadmin
  activity feed with 30 live rows)
- ✅ NEW live timetable broadcast: publish → toast + bell + auto-refresh +
  "Updated · live" chip on open student tabs (gateway-origin browser proof)
- ✅ NEW RSS feed: valid RSS 2.0 with real notices + autodiscovery + chip
- ✅ NEW server-backed teacher picker: real DB faculty in the editor,
  roster lineage chip, auto-scheduler on the real roster
- ✅ Styling: five new chip/toast/badge surfaces in the established design
  language
- ✅ Gates green: tsc 0 (with 1500MB cap), lint clean, robots 200, stream 200

## Unresolved issues / risks, next-phase priorities

1. **Sandbox memory ceiling (unchanged, structural)**: this round reproduced
   the OOM crash-loop twice during browser bursts on loaded servers. The
   refined protocol (warm chunks + pre-warm APIs via curl → kill tree →
   fresh low-RSS server → burst via :81) worked reliably. Budget ~5 min per
   browser burst cycle.
2. **RSS feed origin**: the feed's <link>/self URLs use localhost:3000
   (matches the app's metadataBase — sandbox-only; set a real origin if
   deployed).
3. **Auto-timetable general-pool fallback**: subjects with no dedicated
   roster teacher now fall back to any free teacher (better than empty
   periods on a small roster). If undesired for big schools, gate it behind
   roster size.
4. Next-phase candidates: principal "publish" also bumps a PUBLISHED banner
   on the principal's own dashboard ticker (currently only students/teachers
   refresh); superadmin activity feed already shows TIMETABLE_PUBLISHED rows
   (enriched by this round's publishes); fee-defaulter outreach workflow;
   event-stream broadcast for fee-reminder sends; per-role notification
   preferences.
5. The student quick-access chip account (student1@demoschool.edu) differs
   from the worklog's documented aarav.sharma credentials — both are real
   seeded students; document or unify if it confuses future QA.

---
Task ID: 9
Agent: Z.ai Code (cron webDevReview round 6 — 2026-09-19)

Task: Full-status assessment + agent-browser QA, then feature + styling
development (mandates: more features, more styling detail).

Work Log:
- **STATUS ASSESSMENT**: all gates green at start (robots 200 / stream 200 /
  tsc 0 / lint 0 / 6.6G disk). Pre-warmed APIs via curl, recycled to a fresh
  server, browser-burst verified round-5 surfaces: Principal Timetable
  (sync chip ✓, "Faculty roster · 4 live" ✓, 78 slots / 2 classes /
  0 conflicts ✓, full grid with real teachers/rooms); Super Admin activity
  feed (live rows incl. this session's sign-ins) + student timetable via
  API. NO BUGS FOUND → proceeded to the top next-phase candidate.
- **NEW FEATURE — Fee-Defaulter Outreach Workflow (Principal → Students,
  live + audited)**:
  - NEW `GET /api/fees/defaulters` (PRINCIPAL/MANAGEMENT): server-truth
    aggregation over Fee rows where paid < amount, grouped per student —
    outstanding total, per-line breakdown, earliest due date, honest
    daysOverdue, guardian name/phone, lastRemindedAt (matched by the
    stable "Fee Reminder" subject prefix). Verified: 5 real defaulters,
    ₹105,400 outstanding, 4 overdue by 354 days.
  - NEW `POST /api/fees/defaulters/remind`: for each selected student with
    dues — anti-spam guard (recipients of a reminder in the last 24h are
    SKIPPED, reported honestly), a personalized Message row (subject
    "Fee Reminder — ₹X outstanding", body with line-by-line breakdown +
    due dates + payment guidance + real signature), one FEE_REMINDER_SENT
    ActivityLog audit row. Verified: single send, retry-skip, empty-body
    validation ("Select at least one student"), message content in DB.
  - NEW `fees-defaulters.tsx` — "Outreach" tab in Fee Management (always
    present, after Student Accounts; keyboard shortcuts extended 1-6 → 1-9):
    4 KPI SummaryCards (Total Outstanding rose / Students With Dues amber /
    Past Due Date rose / Reminded This Week sky), status filter chips
    (All/Past due/Due soon) + class filter + student search, ledger table
    with initials avatars, guardian contact, ₹ outstanding, due chips
    (rose "Nd overdue" / amber "in Nd" / date), "reminded Xm ago" column,
    expandable per-student fee lines (AnimatePresence), select-all +
    per-row checkboxes with emerald row tint, animated selection bar
    ("N selected · ₹X outstanding total"), and a preview dialog rendering
    the EXACT message text with real school/principal names (fetched from
    /api/auth/me — same values the endpoint uses) + recipient roll-up +
    anti-spam note; all states honest (staggered loading skeleton, error +
    retry, celebratory all-settled empty, filtered-empty).
  - **Live fan-out reuses the existing message broadcast**: a socket test
    client received EXACTLY 1 frame per sent message → open student tabs
    get the toast + bell entry within seconds (event-stream source #3).
  - **Super Admin feed enriched automatically**: 4 "Fee reminder sent"
    rows (kind staff) now visible in /api/superadmin/activity.
- **STYLING/CONNECTIVITY — Overview entry points to Outreach**
  (`fees-overview.tsx`): "Students With Dues" KPI card now navigates to
  the Outreach tab (sub: "across N classes · reminders ready"); the
  "Outstanding Dues" panel gained an emerald "Send reminders" action
  (Send icon, emerald border/hover tones) beside "View accounts".
  Browser-verified: both navigate to the Outreach tab with live data.
- **END-TO-END PROOF (browser, gateway origin)**: principal → Outreach
  tab → KPIs + 5 real rows → expanded Pari Iyer's fee lines (Tuition Fee
  Q1, due 30 Sep 2025) → selected Aadhya + Pari → selection bar "2
  selected · ₹50,000 outstanding total" → preview dialog ("Dear Aadhya
  Patel (Grade 10 - A)" + "…and 1 more: Pari Iyer") → Send 2 Reminders →
  dialog closed + data refreshed (both rows "Xm ago", never=0) → DB
  verified (2 messages + activity row "2 fee reminders · ₹50,000") →
  socket client confirmed 1 frame per message.
- **INFRA EVENTS (resolved)**:
  1. event-stream :3003 had died; my restart attempt failed (port still
     held by the live process — the pgrep pattern "event-stream" doesn't
     match `bun --hot index.ts`; use `lsof -i :3003`). Clean-restarted
     with a fresh log; direct + gateway 200.
  2. event-stream log showed 3× duplicate broadcast lines per message —
     fd artifact of two processes writing one truncated log (my failed
     restart), NOT duplicate emissions: a live socket client received
     exactly 1 frame per message. Fixed by the clean restart.
  3. Browser stuck at the mounted-gate skeleton after a Fast-Refresh
     cycle: Chrome had cached a broken RSC response. FIX: fresh
     `agent-browser open` with a CACHE-BUSTING query (`http://localhost:81/?fresh=1`)
     — full render immediately. Add to the runbook.
  4. Dev server recycled (kill tree → keepalive) before each browser
     burst per protocol; chunks re-warmed after every source batch
     (319→321 chunks).
- **DATA STATE (intentional, for future QA)**: all 5 demo defaulters have
  now been reminded — 5 "Fee Reminder" Message rows + 4 FEE_REMINDER_SENT
  ActivityLog rows exist. The 24h anti-spam window locks further sends to
  these students until ~2026-09-20 04:50 UTC (sends then report "skipped
  (reminded in the last 24h)" — honest). New sends work for any student
  with dues outside the window.
- **Gates**: `bunx tsc --noEmit` 0 errors ✓ (1500MB cap) · `bun run lint`
  clean ✓ · robots 200 ✓ · stream 200 ✓ · dev.log clean ✓ · zero console
  errors in QA windows ✓. Screenshots: download/qa-round6-outreach-tab.png,
  qa-round6-outreach-all-reminded.png, qa-round6-outreach-entry.png,
  qa-round6-overview-buttons.png.

Stage Summary:
- The fee pipeline is now TWO-WAY end-to-end: Principal sees real
  defaulters → sends personalized reminders → students get live toasts +
  Messages inbox entries → Super Admin sees the audit trail. All
  browser-proven through the gateway path.
- Styling mandate: 4-tone KPI strip, due chips, expandable ledger rows,
  animated selection bar, message preview dialog, emerald overview entry
  points — all in the established fees design language.
- Gates green; no dead code; one new API pair + one new component + two
  surgical overview edits.

## Current project status (end of round 6)

- Dev server :3000 healthy (keepalive-guarded, 321 chunks warmed),
  event-stream :3003 healthy (clean log, direct + gateway 200), DB in
  sync, disk 6.6G free, tsc 0 / lint 0.
- All four roles browser-verified across rounds; the fee domain now has
  a complete outreach loop (the #1 candidate from rounds 3–5).

## Current goals / verification results (round 6)

- ✅ QA assessment: round-5 surfaces healthy, no bugs found
- ✅ NEW fee-defaulter outreach: GET/POST APIs + Outreach tab + live
  fan-out + audit trail, all verified end-to-end in the browser
- ✅ NEW Overview entry points (KPI card + Outstanding Dues panel action)
- ✅ Anti-spam guard + validation + honest skip reporting verified
- ✅ Super Admin activity feed enriched with real FEE_REMINDER rows
- ✅ Gates: tsc 0, lint clean, robots 200, stream 200

## Unresolved issues / risks, next-phase priorities

1. **Sandbox memory ceiling (unchanged, structural)**: browser bursts on
   fresh servers remain the safe protocol; budget ~5 min per burst cycle.
   NEW runbook item: if the browser sticks at the mounted-gate skeleton
   after HMR cycles, open with a cache-busting query (`/?fresh=1`).
2. **event-stream pgrep**: the service process matches `bun --hot
   index.ts`, NOT "event-stream" — use `lsof -i :3003` to find/kill it.
3. **24h reminder anti-spam lock on demo data** (until ~2026-09-20
   04:50 UTC): future QA sends to the 5 seeded defaulters report honest
   skips; create a new Fee row (POST /api/fees) to test fresh sends.
4. Next-phase candidates: student-side Fees banner surfacing the latest
   reminder (currently the loop closes via Messages/bell); principal
   dashboard "Principal Attention" fee alert → deep-link to Outreach;
   per-role notification preferences UI; keepalive "recycle" subcommand;
   certificates-issuance activity logging (more superadmin feed richness).

---
Task ID: 10
Agent: Z.ai Code (cron webDevReview round 7 — 2026-09-19)

Task: Full-status assessment + agent-browser QA, then fix-first development
(QA found a data-consistency bug) + two new features + styling detail
(mandates: more features, more styling).

Work Log:
- **STATUS ASSESSMENT**: all gates green at start (robots 200 / stream 200 /
  tsc 0 / lint 0 / 6.4G disk). Browser QA (principal) re-verified round-6
  surfaces (Fees Overview entry points, Outreach tab, Principal Attention
  feed). NO crashes or broken flows — but a **data-consistency bug class**
  found: three contradictory dues stories across surfaces (Dashboard KPI
  mock "₹1.84 Cr / 142 students"; Fees Overview ledger "₹2.05 L / 56";
  Outreach server-truth "₹1.05 L / 5"). The bridges (KPI → Outreach) showed
  mismatched numbers → fixed this round + 2 features from the next-phase
  candidates list.
- **CONSISTENCY FIX — one live dues truth for every Outreach-facing surface**:
  - NEW `GET /api/fees/defaulters?summary=1` — lightweight aggregate mode
    (totalOutstanding, defaulterCount, overdueCount, remindedThisWeek,
    classesWithDues, top defaulter, asOf); full per-student ledger skipped
    for KPI consumers.
  - NEW `src/lib/store/dues-summary-store.ts` — ensure()/refresh() zustand
    store, idempotent in-flight guard, 60s freshness window, honest lineage
    (`status==='server'` only after a successful sync).
  - Dashboard `kpi-row.tsx` "Pending Fees": server-truth value + sub
    ("5 students · 4 past due") + LIVE chip (new `chip` prop on the shared
    SummaryCard) + mock sparkline dropped when live (no fake trend under a
    real number) + deep-link to the Outreach tab (focus-store type
    'fee-outreach', handled by a new effect in fees-shell.tsx).
  - Fees Overview KPI 4 "Students With Dues": server count + "across N
    classes · ₹X outstanding" + LIVE chip. Ledger cards stay ledger-scoped
    (Outstanding → accounts; subtitle now "25 ledger accounts · largest
    balances"; "Send reminders · 5 live" count bridge on the panel action).
  - NEW shared `live-chip.tsx` (pulsing emerald lineage pill, a11y title).
- **NEW FEATURE — Principal Attention LIVE fee alert** (candidate #2):
  NEW `live-fee-alert.tsx` pinned above the simulated alert rows — REAL
  server dues ("5 students owe ₹1,05,400 · 4 past due · 5 reminded this
  week · largest Ananya Gupta ₹25.0K"), rose/amber gradient stripe by
  urgency, LIVE pill, "1 live" hint in the panel subtitle, one click →
  Outreach deep-link. Browser-verified end-to-end.
- **NEW FEATURE — Student fee-reminder banner** (candidate #1):
  - `/api/student/dashboard` feesSection now joins the latest "Fee Reminder"
    Message row (subject/excerpt/createdAt/senderName; queried only when
    outstanding > 0). types.ts DashboardFees extended.
  - NEW `fee-reminder-banner.tsx` at the top of the student dashboard:
    "Fee reminder from Dr. Ananya Iyer" + NEW pill (<48h) + relative stamp
    + the principal's actual excerpt + ₹ outstanding chip + dueLabel +
    "View message" (→ Messages) + "Pay fees" (→ Fees) + session dismiss X.
  - **Live refresh**: useStudentDashboard watches the live-feed ring — a new
    message broadcast (AppShell already recipient-filters) triggers a
    debounced QUIET refetch (no skeleton flash; errors stay quiet too).
  - END-TO-END PROOF (gateway origin): student tab open → principal sends 2
    normal messages via API → dashboard fetch count 1→2 within seconds +
    unread count 3→5 live. Banner + CTAs browser-verified.
- **STYLING shipped**: LIVE chips on 2 KPI cards; pinned alert (gradient
  stripe, icon chip, hover affordance, a11y label); "1 live" subtitle;
  amber→rose banner with watermark icon, NEW pulse pill, due chips, dual
  CTAs; live-count bridge on the Send reminders button; ledger-scoped
  subtitle.
- **QA/INFRA — ROOT CAUSE of the crash loop found and documented**: the
  ~45s dev-server restart loop during browser QA was **zombie Chrome
  processes**: `agent-browser close` leaves ~14 chrome procs (~700MB) that,
  with the 3GB warm dev server, push the 4GB cgroup into OOM
  (dmesg: oom-kill task=next-server anon-rss≈3.0GB). PROTOCOL UPDATE:
  after every `agent-browser close`, run `pkill -9 -f chrome` and verify
  `ps aux | grep -c "[c]hrome"` → 0. Also: pre-warm the app-shell's poll
  routes too (/api/auth/me, /api/notifications-feed, /api/app-version) —
  not just the module endpoints — before attaching the browser.
- **DATA STATE (intentional, for future QA)**: 2 realistic test messages
  sent to student1@demoschool.edu ("Library book return", "Science fair
  registration" from Dr. Ananya Iyer) — they live in the Messages demo
  data. The 5 seeded defaulters remain under the 24h reminder anti-spam
  lock until ~2026-09-20 04:50 UTC.
- **Gates**: `bunx tsc --noEmit` 0 errors ✓ (1500MB cap) · `bun run lint`
  clean ✓ · robots 200 ✓ · stream 200 ✓ · disk 6.4G free ✓. Screenshots:
  download/qa-round7-principal-live-kpi.png, qa-round7-fees-overview-live.png,
  qa-round7-student-banner.png, qa-round7-live-refresh-proof.png.

Stage Summary:
- The fee domain now has ONE dues truth on every surface that links into
  Outreach (dashboard KPI, attention alert, overview KPI — all quoting the
  server aggregation the Outreach tab shows), with honest lineage chips.
- The outreach loop is now fully bidirectional: principal sends → student
  sees the reminder AT the top of their dashboard (banner + live refresh).
- Root-caused and documented the QA instability (zombie Chrome + OOM) with
  the updated protocol.

## Current project status (end of round 7)

- Dev server :3000 healthy (keepalive-guarded), event-stream :3003 healthy,
  DB in sync, disk 6.4G free, tsc 0 / lint 0, no dead code.
- All four roles browser-verified; the fee domain is consistent
  (live-vs-ledger explicitly labeled) and the outreach loop closes on the
  student dashboard.

## Current goals / verification results (round 7)

- ✅ QA assessment: round-6 surfaces healthy; dues data-inconsistency found
- ✅ FIX: server-truth dues on all Outreach-facing KPIs + lineage chips
- ✅ NEW: Principal Attention live fee alert with Outreach deep-link
- ✅ NEW: student fee-reminder banner + live message-driven refresh
- ✅ Gates green: tsc 0, lint clean, robots 200, stream 200

## Unresolved issues / risks, next-phase priorities

1. **Sandbox memory ceiling — PROTOCOL UPDATE (important)**: after every
   browser burst, `agent-browser close` + `pkill -9 -f chrome` (zombies
   cause the 45s OOM restart loop); pre-warm app poll routes (auth/me,
   notifications-feed, app-version) along with module APIs before
   reattaching. Budget ~5 min per burst cycle; keep bursts ≤3 interactions.
2. **Anti-spam lock on demo defaulters** (until ~2026-09-20 04:50 UTC):
   new reminder sends to the 5 seeded students will honestly skip; create a
   new Fee row (POST /api/fees) for a non-reminded student to test fresh
   sends + the banner's live NEW-pill path end-to-end.
3. The student Fees MODULE still renders the client mock ledger
   (DEMO_STUDENT_ID) while the dashboard is server-truth — intentional
   (module = ledger showcase, dashboard = live record) but a future round
   could server-truth the module's BalanceHero the same way.
4. Next-phase candidates: per-role notification preferences UI;
   certificates-issuance activity logging (superadmin feed richness);
   keepalive "recycle" subcommand (automate the warm→kill→restart burst
   prep); payment-event → dues-summary store auto-refresh (currently the
   60s window + manual refresh()).

---
Task ID: 11
Agent: Z.ai Code (round 8 — teacher Class Attendance upgrade — 2026-09-19)

Task: User request: "In the teachers role, the student attendance, UI and
little bit working and function. I think that needs improvement." → full
UI + functionality upgrade of the teacher Class Attendance module.

Work Log:
- **STATUS ASSESSMENT (start)**: gates green (robots 200 / stream 200 /
  tsc 0 / lint 0 / 6.5G disk / 0 chrome zombies). API-level QA of round-7
  surfaces: dues summary (5 defaulters · ₹105,400 · 4 overdue), student1
  fee-reminder banner data (₹5,400 + reminder from Dr. Ananya Iyer),
  superadmin activity feed (live sign-ins incl. this session). NOTE:
  the student quick-access chip account is student1@demoschool.edu /
  password123 (NOT student123 — documented in login-page/data.tsx).
- **API — attendance history slice**: GET /api/teacher/class-attendance/board
  extended with `history` — the last 10 MARKED school days for the class
  inside a 30-day lookback ending TODAY (today-anchored so the week strip
  knows about days after the viewed date). Per day: date, counts, present
  rate, per-student entries. Verified: 10 real days (11-student full days
  on 16/17 Sep + single-student seeded rows 4–12 Sep).
- **UI — date navigation**: prev/next chevrons + Today button around the
  date input (next/future disabled), unsaved-changes pulsing amber dot
  inside the Save button.
- **UI — week strip**: Mon–Sun chips of the viewed week (weekday letter +
  day number); emerald dot on marked days, primary dot on today,
  selected-day ring, future days disabled; click → select that date.
- **UI — count cards**: thin animated progress bar under each of the 4
  cards (share of total).
- **UI — roster rows**: last-5-marked-days status dots (emerald/rose/
  amber/info, tooltip per dot) + attendance-rate chip (emerald ≥90%,
  amber ≥75%, rose below; title "n/m present across last N marked days");
  P/A/L/L legend added to the footer.
- **FEATURE — Insights view** (segmented Roster | Insights on the roster
  card): headline average present rate across the window + window line;
  10-day daily-present-rate bar chart (tone by rate, tooltip with full
  counts); "Attention needed" top-5 absentees (avatar, absences/late/
  leave breakdown, rate chip); "Perfect record" students (n/n ✓ chips);
  honest empty state when no marked days.
- **UX — dirty-discard notices**: switching class or date with unsaved
  changes now toasts "Unsaved changes discarded".
- **INFRA INCIDENT (fixed this round)**: a mid-round sandbox reset DELETED
  keepalive.mjs + keepalive.log from the project root and killed the
  watchdog (dev server died with nothing to revive it). ALSO discovered
  the old keepalive's `pgrep -f "bun run dev"` liveness check FALSE-
  MATCHES the event-stream mini-service (its dev script is also
  `bun run dev`) — the revived v3 watchdog saw "dev process exists" and
  waited forever while :3000 was dead. RECREATED keepalive.mjs (v4):
  liveness = `execFile('pgrep', ['-f', 'next dev|next-server'])` — no
  bash wrapper (self-match trap), no event-stream match; header documents
  recreation from this worklog. Verified: detects dead server → spawns →
  healthy in 3s; survived two more OOM restarts during the QA bursts.
- **/home/z/.qa/ warm tooling is GONE** (same reset). Cache stayed intact
  (.next 1.2GB), so warming = curl `/` once (25s first, then cached) +
  the poll routes. If the cache is ever fully invalidated, recreate the
  chunk warmer per Task-5 notes.
- **BROWSER QA (gateway origin, two bursts, OOM recovered between)**:
  teacher login → Class Attendance: week strip M14–S20 rendered, count
  cards 11/11, roster 11 rows with dots + rate chips (Aarav 80%), marked
  Diya Patel ABSENT → Present 10/11 + Absent 1/11 + "Unsaved changes" →
  Save → toast "Attendance saved · Grade 9 - A · 10 present · 1 absent" +
  "In sync with the saved record" → prev-day nav (honest 18-Sep defaults)
  → back to today (saved state). Insights: avg 87% across 10 days, trend
  bars, Attention (Aarav 2 absences · 80%, Ananya 1 · 50%), Perfect
  record (8 students 2/2). Screenshots: download/qa-round8-attendance-
  roster.png, qa-round8-attendance-insights.png, qa-round8-attendance-
  saved.png. Zero console errors in verified windows; the one
  notifications-feed 500 was during the OOM window (200 with session
  after recovery).
- **DATA STATE (intentional, for future QA)**: 2026-09-19 baseline for
  Grade 9 - A was overwritten by QA save — Diya Patel now ABSENT
  (10 present · 1 absent, marked by Rohan Mehta). Today's week-strip dot
  is emerald.
- **Gates**: `bunx tsc --noEmit` 0 errors ✓ · `bun run lint` clean ✓ ·
  robots 200 ✓ · stream 200 ✓ · disk 7.1G free ✓.

Stage Summary:
- The teacher Class Attendance module is now one of the richest surfaces:
  week-aware date navigation, per-student recent history + rate context,
  live count bars, dirty-state affordances, and a real analytics view —
  all from ONE extended API (no extra round-trips).
- Infrastructure self-healing restored and hardened (keepalive v4 with
  the event-stream-safe liveness check); root-file deletion by the
  sandbox reset documented + mitigated.

## Current project status (end of round 8)

- Dev server :3000 healthy (keepalive v4 guarded), event-stream :3003
  healthy, DB in sync, tsc 0 / lint 0, disk 7.1G free, no chrome zombies.
- All four roles verified in earlier rounds; the teacher attendance
  module fully re-verified end-to-end this round (mark → save → insights).

## Current goals / verification results (round 8)

- ✅ User-reported surface (teacher student-attendance) upgraded: UI
  detail + history context + insights + navigation + guards
- ✅ History API verified with 10 real marked days
- ✅ Save/refresh/insights/date-nav browser-proven via the gateway
- ✅ keepalive v4 restored after sandbox reset (event-stream-safe)
- ✅ Gates green

## Unresolved issues / risks, next-phase priorities

1. **Sandbox resets are now deleting ROOT files too** (keepalive.mjs,
   keepalive.log, /home/z/.qa/*) — if the dev server seems dead with no
   watchdog, recreate keepalive.mjs (spec in its header + Task 11 log).
2. **Memory ceiling unchanged**: this round OOMed twice during browser
   bursts on loaded servers (root cause per Task 7: zombie chrome +
   compile spikes). Protocol remains: fresh server + warmed cache +
   short bursts + `pkill -9 -f chrome` after every close.
3. Attendance history only counts OFFICIAL baselines (Attendance rows);
   subject-teacher sessions are not in the dots/insights yet — a future
   round could layer subject sessions into the insights view.
4. Next-phase candidates (from round 7, unchanged): per-role notification
   preferences UI; certificates-issuance activity logging; payment-event
   → dues-summary store auto-refresh; keepalive "recycle" subcommand;
   absence-notice-to-guardians workflow off the new attendance save
   (Message rows + live fan-out, mirrors the fee-reminder pattern).
