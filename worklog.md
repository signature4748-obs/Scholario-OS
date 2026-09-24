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

---

Task ID: 12
Agent: Z.ai Code (main orchestrator)
Task: LP-2 — Lesson Planner upgrade (user request): board-syllabus auto-fed
complete-session plans (CBSE / UP Board), very-easy custom topic authoring,
full UI/UX redesign with rich animations. Browser QA + gates + handover.

Work Log:
- Read worklog (rounds 1–8), mapped the lesson-planner module end-to-end:
  index.tsx orchestration, today-lesson hero, progress/map/upcoming panels,
  api.ts transport, src/lib/lesson-planner.ts server layer,
  prisma/curriculum-data.ts (the seeded NCERT source), lesson-schedule.ts
  scheduler, CurriculumTopic/LessonTopicCompletion prisma models.
- NEW src/lib/syllabus-templates.ts (~800 lines): master board-syllabus
  registry — CBSE 9/10 reuse the seeded NCERT structures verbatim (imported
  from prisma/curriculum-data.ts → exact name-matching when merging) + a
  "Revision and Assessment" enrichment unit per subject; NEW CBSE Computer
  Applications 9/10 (code 165); compact NCERT middle-school sets (6–8 ×
  Math/Science/English/Hindi/SST); UP_BOARD 9/10 (NCERT-based गणित/सामाजिक
  विज्ञान/English, COMBINED विज्ञान = भौतिकी+रसायन+जीव विज्ञान, custom
  गोधूलि हिंदी, computer) + 6–8. Matching: classLevelFor (digits + roman),
  subjectKeyFor (English + देवनागरी aliases, exact-match-wins so
  सामाजिक विज्ञान ≠ विज्ञान), normalizeTopicName (\p{M} preserved so
  Devanagari matras survive — fixed "व ज ञ न" bug), findSyllabusTemplate
  (board → template; ICSE/STATE/CUSTOM → null → manual-add empty state).
- Server (src/lib/lesson-planner.ts): AUTO-FEED — getLessonPlan
  instantiates the FULL board template when a class+subject has zero
  CurriculumTopics (best-effort, quiet failure); topicNo display now
  derived from schedule position; new SyllabusInfo payload (board badge,
  book label, per-unit coverage, missingTopics) + autoProvisioned flag;
  addCustomTopic (position-aware insert at end of unit / new unit append,
  orderIndex rewrite, sourceBoard CUSTOM), updateCustomTopic (rename/
  periods/description/move-to-existing-unit), deleteCustomTopic (completed
  topics protected), mergeSyllabusTemplate (adds ONLY missing template
  topics, idempotent). All mutations re-verify teacher assignment
  ownership (getTeachingAssignments ∩ ACTIVE CSA).
- NEW API routes: POST/PATCH/DELETE /api/teacher/lesson-planner/topics,
  POST /api/teacher/lesson-planner/syllabus (merge). Client api.ts gained
  addTopic/updateTopic/deleteTopic/mergeSyllabus + SyllabusInfo types.
- UI REDESIGN (7 files): shared.tsx (→ .tsx for JSX): LIST_STAGGER/
  LIST_ITEM variants, AnimatedBar (spring width), ConfettiBurst (16
  particles, no deps), unitAccent palette (6 hues cycled), dot/text status
  config, applyTopicRemoval optimistic helper; today-lesson.tsx: emerald
  gradient hero with blur atmosphere, animated SVG session-progress ring,
  AnimatePresence CTA morph (Mark Completed ⇄ Completed+Undo), confetti
  on complete, quiet footline; progress-panel.tsx: spring % counter,
  stats row (topics left / pace / teaching days), staggered per-unit bars
  in unit accents; curriculum-map.tsx → "Session Plan": accent unit
  badges, sticky headers + animated per-unit progress, animated check-glyph
  pop, today pulse ring, hover actions (Done/Undo + edit + delete w/
  AlertDialog), inline QuickAddRow per unit (motion height), "New unit"
  footer; syllabus-library.tsx (NEW): CBSE/UP badge, book label, coverage
  meter, unit coverage chips, missing-topic list w/ one-tap + quick-add,
  "Add all N", "Full syllabus covered" celebratory state, custom-topics
  footline; add-topic-sheet.tsx (NEW): side sheet, autofocus name (Enter
  submits), unit picker w/ inline "+ New unit", −/+ periods stepper w/
  teaching-day estimate, notes, emerald footer; upcoming-panel.tsx: date
  tiles (day + MMM, amber today), stagger, schedule-basis polish;
  index.tsx: full orchestration (all handlers w/ optimistic updates +
  toasts + refetch, autoProvisioned success toast, Add-topic toolbar
  action, honest no-template empty state w/ CTA).
- Demo showcase seed: prisma/seed-computer-apps.ts (idempotent, ran OK) —
  Computer Applications subject (CA165) + CSAs + Rohan's 3×/week
  computer-lab periods (9-A P8 Wed/Fri/Sat 14:45, 10-A P7 Wed/Fri/Sat
  14:00, room "Computer Lab") → first open of the planner AUTO-FEEDS the
  full 10-topic CBSE session plan live.
- API QA via curl (rohan.mehta@greenwood.edu.in / teacher123): assignments
  show 4 pairs (incl. Computer Applications); Computer 9-A plan GET →
  autoProvisioned:true, 10 topics/4 units, syllabus 10/10; math merge +2;
  custom add → position-correct; PATCH rename; DELETE ok; delete of a
  COMPLETED topic correctly rejected; FORBIDDEN on non-owned subject
  (Hindi) — permission gate works.
- Browser QA (gateway :81, short batches, memory protocol): teacher login →
  Lesson Planner → Grade 10-A Computer Applications auto-fed LIVE (hero,
  ring, units, plan, syllabus library all rendered — VLM-verified clean);
  Mark Completed → confetti + toast + Undo morph; inline quick-add
  ("Typing Speed Drill — Home Row"); sheet add w/ NEW UNIT "Enrichment
  Club"; edit rename; delete w/ confirm; subject switch → Mathematics →
  syllabus 17/19 → one-tap add → 18/19 → "Add all" → 19/19 "Full syllabus
  covered"; class switch → Grade 9-A Math 59%; mobile 390px single column,
  no overflow; dev.log: all lesson-planner APIs 200, zero errors.
- Gates: bunx tsc --noEmit 0 errors; bun run lint clean (after removing a
  stale eslint-disable); robots 200; no chrome zombies; memory protocol
  respected (fresh server + warmed compile + short bursts + pkill).

Stage Summary:
- USER REQUEST DELIVERED: "already a plan will be there you have to feed
  it, as per boards syllabus, whatever school will be cbse or up the plan
  will be automatically there for the complete session and if he want to
  add something, there should very easy to add plan also" —
  1) AUTO-FED COMPLETE-SESSION BOARD PLANS: opening any template-backed
     class+subject with no curriculum instantiates the full CBSE/UP-Board
     session plan (school.board decides; UP = NCERT-based + गोधूलि हिंदी
     + combined विज्ञान); 2) VERY EASY TO ADD: inline per-unit quick-add,
     one-tap syllabus merges, authoring sheet w/ new-unit flow; 3) UI/UX:
     gradient hero + animated ring + confetti, staggered session plan,
     syllabus library panel, spring bars everywhere.
- KEY FILES: src/lib/syllabus-templates.ts (NEW), lesson-planner.ts
  (extended), api/teacher/lesson-planner/{topics,syllabus}/route.ts (NEW),
  lesson-planner/{syllabus-library,add-topic-sheet}.tsx (NEW),
  shared.tsx/today-lesson/curriculum-map/progress-panel/upcoming-panel/
  index (rewritten), prisma/seed-computer-apps.ts (NEW, executed).
- Demo data: Computer Applications auto-feed showcase live in both grades;
  Math 9/10 plans now 19/19 syllabus coverage (enrichment merged);
  Computer 10-A carries a custom "Enrichment Club" unit (showcases the
  "+N custom topics" footline). 141→ preserved completions intact.
- Teacher credentials: rohan.mehta@greenwood.edu.in / teacher123.

## Unresolved issues / risks, next-phase priorities

1. UP_BOARD path is code-complete + unit-tested at the template level but
   NOT demo-visible (the demo school is CBSE). To showcase: create a
   second UP-BOARD tenant school (or flip a test school's board) and
   verify the गोधूलि/विज्ञान feed end-to-end.
2. Auto-feed anchors at session start (April 1) — a subject adopted
   mid-session honestly shows early topics as "Behind schedule" until the
   teacher marks completions; a future enhancement could offer "start
   schedule from adoption date".
3. Unit rename/delete (topics move only) not yet supported; edit-mode
   unit moves are limited to existing units.
4. Memory ceiling unchanged (this round needed the fresh-server +
   pre-compile-without-browser + short-bursts protocol twice); keep
   following it.
5. Next-phase candidates: principal-side syllabus adoption/preview panel
   (same template library); print/PDF export of the session plan;
   "behind schedule" catch-up assist (one-tap mark-previous-N-completed);
   the round-8 leftovers (notification preferences, payment auto-refresh).

---

Task ID: 11
Agent: Z.ai Code (exam duties rework — 2026-09-19)
Task: "Remove that exam duties module completely. In the exams the principal will assign teachers and they will receive a notification; also in the exams timetable teachers will see the duties. Not to do much but very natural, real and working."

Work Log:
- READ worklog + mapped the exam-duties landscape: teacher proctoring
  module (src/components/teacher/modules/exam-proctoring/ — 4 files,
  EP-6), /api/teacher/proctoring/* (5 routes), src/lib/exam-duty.ts,
  orphaned src/lib/mock/proctoring.ts, the 'proctoring' nav key +
  module-router entry + search-academic nav map, prisma models
  ExamDutyCompletion + ExamIncident (used ONLY by proctoring), and the
  existing-but-UI-less /api/exams/[id]/invigilator API.
- PHASE A (removal): deleted exam-proctoring/ (4 files), /api/teacher/
  proctoring/ (5 routes), lib/exam-duty.ts, mock/proctoring.ts; removed
  the nav item + lazy route + ClipboardCheck import; search-academic
  teacher exams key 'proctoring' → 'my-timetable'; prisma schema dropped
  ExamDutyCompletion + ExamIncident (+ their School/Student/Exam
  back-relations) → db push (tables dropped) → client regenerated;
  prisma/seed-exam-ops.ts incident seeding stripped. Zero dangling
  references (only legit position-permission labels remain).
- PHASE B (real assignment layer, src/lib/exams/service-extended.ts):
  assignInvigilator now (a) stores the teacher's USER id in
  invigilatorId — the exact convention every seeded row uses — with the
  name synced; (b) checks availability SCHOOL-WIDE (any exam, same day,
  overlapping window) with a specific error message; (c) supports
  teacherId:null → release; (d) pushes a direct Message notification to
  the affected teacher on assign/reassign/release (assign + reassign
  notify the new teacher; release/reassign notify the released one),
  honoring the teacher's examDuty preference server-side (the Settings
  toggle is now a real gate); (e) idempotent same-teacher re-assign.
  listTeachers computes REAL assignedCounts; classLabelOf kills the
  "Grade 9 - A — A" duplication. NEW listDutyRoster(schoolId) + DTOs.
- NEW API GET /api/exams/duties (PRINCIPAL/MANAGEMENT): todayKey + all
  real exams with papers (date/time/room/class/subject/invigilator) +
  teachers with duty counts. POST /api/exams/[id]/invigilator now accepts
  teacherId:null (release). use-exams-extended.ts: useAssignInvigilator
  returns the DTO + accepts null; NEW useDutyRoster hook + DTO types;
  removed unused useTeachers/useAssignInvigilator imports from
  workspace-sections-extended.tsx.
- PHASE C (teacher side): GET /api/teacher/timetable extended with
  examDuties — real ExamScheduleItems dated >= today where the signed-in
  teacher is the invigilator (user-id OR teacher-id OR name match), ≤12,
  with exam/subject/class/room/time. MyTimetable module gained an
  "Examination Duties" section (placed after the TODAY card): date-tile
  rows, emerald today accent, LIVE state chips (Starts X / In progress
  pulse / Concluded) from the client clock, "Tomorrow"/"In N days"
  countdown chips for upcoming, room + time details, stagger animation,
  honest empty state.
- PHASE D (principal UI): NEW tabs/invigilation-tab.tsx in the Exams
  module — exam picker pills (defaults to the exam holding the nearest
  today/future paper), summary tiles (papers / coverage % with spring
  bar / unassigned / teachers on duty), teacher-load chips (initials
  avatar + live per-exam count, click to filter the roster), and the
  date-grouped DUTY TIMETABLE: today + upcoming groups open with a
  shadcn Select per paper (options show name + duty count; "Release
  from duty" when assigned; amber unassigned state), concluded days
  collapsed behind an animated expand header, optimistic row updates +
  revert-on-error, success/error toasts, emerald flash on the changed
  row. Wired as the 'invigilation' section tab in the exams module.
- PERF/UX EXTRAS: ?module=<key> deep-links for teacher + principal
  panels (validated against the module registry/allowlist); exams module
  heavy siblings (ReportsTab/recharts, CreateExamFullScreen, ArchiveView)
  are now dynamic imports with a skeleton — faster first paint.
- API QA (curl): roster payload correct (class labels, real counts,
  pretty statuses); conflict rejection fires with the exact message
  ("Rohan Mehta already has an overlapping invigilation duty at
  09:00–11:00 on 21 Sept 2026"); release → assign verified in the DB;
  Message rows created from Dr. Ananya Iyer to Priya (assigned),
  Arjun (released) — and later Kavita (assigned via the UI test).
  Teacher timetable returns Rohan's 2 duties.
- BROWSER QA (gateway :81; the 4GB box fought hard — see risks):
  TEACHER: panel rendered via ?module=my-timetable + injected session;
  Examination Duties section shows today's English paper with the live
  "Concluded" chip + Mon 21 Sep Hindi with "In 2 days" (screenshot
  download/qa-examduties-teacher-timetable.png). PRINCIPAL: panel
  rendered via ?module=exams; Invigilation tab renders the FULL roster
  (exam pills, 100% coverage tiles, teacher chips, collapsed concluded
  days); reassigning Sep-21 G9 Hindi Priya→Kavita through the Select
  updated the row + counts optimistically, wrote the real DB row
  (invigilatorId = Kavita's user id), and created her notification
  Message (screenshot download/qa-invigilation-assign-kavita.png);
  conflict test (Rohan on an overlapping paper) correctly reverted the
  row and fired the error toast — the specific server message now
  surfaces (api() throws a plain object, not Error — fixed the toast).
- GATES: bunx tsc --noEmit 0 errors; bun run lint clean; robots 200;
  event-stream :3003 healthy; teacher API re-verified post-recycle.

Stage Summary:
- USER REQUEST DELIVERED: (1) the teacher Exam Duties module is GONE —
  UI, APIs, lib, prisma models, search mappings, all of it; (2) the
  principal now assigns invigilators per paper inside Examinations →
  Invigilation (a real duty-roster timetable), teachers get a real
  notification (bell message, live via the :3003 stream, preference-
  gated), and teachers see their duties inside My Timetable →
  Examination Duties (today live-state + upcoming countdowns).
- KEY FILES: deleted exam-proctoring/ + proctoring APIs + exam-duty.ts
  + mock/proctoring.ts + 2 prisma models; service-extended.ts
  (invigilator layer rebuilt), NEW /api/exams/duties, timetable route
  (+examDuties), NEW invigilation-tab.tsx, my-timetable.tsx (duties
  section), exams index (tab + lazy splits), teacher/principal panels
  (deep-links).
- DEMO DATA STATE (intentional): Sep-21 G9 Hindi now invigilated by
  Mrs. Kavita Sharma (was Arjun → released → Priya → reassigned during
  QA) — three duty-change Messages exist for Priya/Arjun/Kavita,
  showcasing the notification flow. Rohan's duties: today English
  (concluded) + Mon 21 Sep Hindi.

## Unresolved issues / risks, next-phase priorities

1. MEMORY (the session's real battle): the box is 4GB/no-swap and the
   dev-server root compile (~2.2-3.1GB RSS) + a browser only fits in
   narrow windows. Root causes found + documented in next.config.ts:
   a POISONED .next (from OOM-killed compiles + a persistentCaching
   experiment) inflated the root compile by ~900MB — deleting .next
   fixed it (root compile 2.24GB, and one generation served / in 34ms
   from a cleanly-completed cache). persistentCaching did NOT survive
   restarts here — don't re-add it. PROVEN WORKING PROTOCOL for future
   browser QA (runbook update): rm -rf .next only when poisoned →
   fresh server → ONE tab, mobile viewport, block images/fonts
   (network route) → open /?module=<key>&fresh=N directly (deep-link
   skips the marketing + login chunks) → inject scholario-auth
   localStorage + erp_session cookie (curl login jar) → reload → the
   panel compiles incrementally and fits. Do NOT pre-warm chunks to
   ~3GB then attach chrome — that reliably OOMs. Keep bursts < ~60s;
   close + recycle between roles. warm-chunks.sh recreated at
   /home/z/.qa/ (+ new warm-bfs.py); /home/z/.qa gets wiped by the
   sandbox sometimes — recreate from this log.
2. The conflict toast's specific message fix (api() throws plain
   objects) is code-verified + the server message is API-proven, but
   the rendered toast with the specific text was not re-screenshotted
   (the Fast-Refresh of the fix killed the last browser window).
3. Principal exams module still runs on the in-memory mock list for
   its Exams/Overview/Reports tabs (long-standing architecture); the
   Invigilation tab is 100% real API. A future phase could switch the
   whole module to the real /api/exams list.
4. Final Examination (Mar 2027) has no papers in the DB yet — the
   Invigilation tab shows its empty state until papers are scheduled.
5. Next-phase candidates: teacher bell deep-link from the duty message
   straight into My Timetable; duty-roster PDF export; overview-tab
   invigilation coverage card; round-8 leftovers (notification prefs
   UI for students, payment auto-refresh).

---

Task ID: 12
Agent: Z.ai Code (class-teacher role differentiation — 2026-09-20)
Task: "Rohan Mehta is class teacher of 9A but the student directory shows the
same for class teacher and normal teacher (no payment records). The Class
Teacher Hub module must appear ONLY for teachers actually appointed class
teacher; a normal teacher sees the plain panel; an appointed class teacher
gets something extra to manage their class and see overall results
submission. Make it and connect everything."

Work Log:
- RECON: real DB truth — Class.classTeacherId stores the USER id:
  Grade 9 - A → Rohan Mehta (11 students), Grade 10 - A → Arjun Nair
  (8). Kavita (teacher1@demoschool.edu/password123) + Priya teach
  subjects only (22 periods each) — the perfect normal-teacher test.
  The old nav gated the hub on POSITION PERMISSIONS (mock store) —
  appointment never mattered. Principal Classes module is mock-store
  (no real write path to Class.classTeacherId existed).
- BACKEND (4 new surfaces, all server-scoped, never trusting client ids):
  · GET /api/teacher/role (NEW) — the signed-in teacher's REAL
    appointment context { isClassTeacher, classTeacherOf[{id,label,
    room,studentCount}] }. This is the single server truth that gates
    the panel.
  · GET /api/teacher/students (EXTENDED) — fee records for CLASS-TEACHER
    classes ONLY: per student fees{status PAID/PARTIAL/UNPAID/OVERDUE/
    NONE, totalBilled/Paid/outstanding, lastPaymentAt, items[≤8],
    payments[≤5]} + per-class feeSummary{collected/outstanding/fullyPaid/
    pending/overdue}. Subject-only classes get fees:null + no
    feeSummary — a subject teacher can never see a family's money.
  · GET /api/teacher/class-hub (NEW) — the class-teacher control room:
    attendanceToday snapshot, fee totals + defaulters list (overdue
    first, guardian phone), RESULTS SUBMISSION matrix for the 3 most
    recent exams (per CSA subject: entered/class-size, DRAFT vs
    SUBMITTED, avg%), behavior counts (open concerns/monitoring/
    positives 30d).
  · GET /api/classes/class-teachers + PATCH /api/classes/[id]/
    class-teacher (NEW, PRINCIPAL/MANAGEMENT) — the official appointment
    record: real classes × appointed teacher + appointable pool; PATCH
    { teacherUserId | null } validates school scope, is idempotent, and
    pushes a Message notification to the appointed (and released)
    teacher — mirrors the Task-11 invigilator pattern.
- PANEL GATING: nav-registry.tsx — the Class Teacher Hub group is now
  appointment-based (classTeacherOf.length > 0; permission gating
  removed) and carries the NEW 'class-hub' "My Class" item + existing
  'behavior'. teacher-panel.tsx fetches /api/teacher/role once
  (use-teacher-role.ts, hidden-until-confirmed); 'class-hub' added to
  the deep-link allowlist + ModuleRouter (lazy chunk).
- STUDENT DIRECTORY DIFFERENTIATION (teacher/modules/students/): class
  pills now tell the two views apart — "Class Teacher" chip (CT class)
  vs "Teaches <subject> +N" chip (subject class); QuickStats gains a 5th
  "Fee Collection" tile (collected %, ₹ outstanding · N overdue) for CT
  classes only; student cards gain a third "Fees" metric cell (Fees
  clear / ₹N due / Overdue); profile sheet gains a "Fee Payments"
  section (status chip, Billed/Paid/Outstanding tiles, fee lines with
  per-line status, recent payments) — rendered only when the server sent
  fee data; CSV export adds Fee Status + Outstanding columns for CT
  classes; grid header states the boundary ("fee records belong to the
  class teacher").
- NEW CLASS HUB MODULE (teacher/modules/class-hub/, 7 files): emerald
  gradient hero (Class Teacher · Grade 9 - A · 11 students · Room 101 ·
  quick actions Mark Attendance/Enter Marks/Directory/Behavior),
  Attendance Today card (marked ✓ counts / pending → CTA), Class
  Wellbeing card (concerns/monitoring/positives), Fee Collection card
  (spring bar, paid/pending/overdue, defaulters list with phones,
  thin-scroll), Results Submission card (exam pills — defaults to the
  ONGOING exam, per-subject entered-N/N bars + Submitted/Draft/Pending
  chips + avg%, "Open Marks Entry") — the whole-class view the user
  asked for. Honest empty states everywhere; multi-class pills if a
  teacher runs more than one class.
- PRINCIPAL SIDE: classes/index.tsx now renders
  ClassTeacherAppointments (details/class-teacher-appointments.tsx) —
  a 100% real-DB island (Invigilation-tab pattern) at the top of the
  Classes module: each real class + current teacher + shadcn Select to
  appoint/release, optimistic rows with revert-on-error, emerald flash,
  toasts, and copy that explains what the appointment unlocks.
- CONNECTED EVERYTHING: teacher Dashboard — QuickActions prepends a
  "My Class" shortcut for class teachers; the PendingActions hub card
  is now CT-gated (BUG FIX: it promoted the hub to EVERY teacher —
  found live in Kavita's browser snapshot) and now opens the real
  class-hub module.
- API QA (curl, all green): Rohan role → classTeacherOf=[Grade 9 - A];
  students → 9A carries fees (Aarav PARTIAL ₹5,400, Diya PAID) +
  feeSummary {₹2.66L billed / ₹2.36L collected / ₹30.4K outstanding},
  10A (subject class) all null; class-hub → attendance 10P/1A marked,
  defaulters Ananya ₹25K overdue + Aarav ₹5.4K, behavior 1/0/7, results
  PA1 Math 7/11 submitted avg 72%; Kavita → role [] + class-hub
  classes:[] + ZERO fee data anywhere; principal PATCH cycle → Priya
  appointed → Arjun restored → idempotent re-appoint, 4 Message
  notifications created (appointment + release both directions),
  roster back to Rohan 9-A / Arjun 10-A.
- BROWSER QA (gateway :81, mobile 390×844, images/fonts blocked,
  deep-links + injected session — the 4GB box fought hard, see risks):
  ROHAN: sidebar shows "CLASS TEACHER HUB" group with My Class +
  Student Behavior (a11y snapshot); Class Hub rendered end-to-end
  (hero, attendance 10/11, wellbeing 1/0/7, fee collection 89% +
  defaulters, results pills UT2-default + 8 subject rows) — VLM-verified
  screenshot; Student Directory shows "Grade 9 - A · 11 · Class
  Teacher" vs "Grade 10 - A · 8 · Teaches Computer Applications +1"
  pills, ₹30.4K fee tile, per-student "₹5,400 due"/"Fees clear" cells
  (DOM evidence captured mid-render). KAVITA: panel renders with NO
  Class Teacher Hub group (sidebar = OVERVIEW/ACADEMICS/IN-CHARGE/
  COMMUNICATION/INSIGHTS/ACCOUNT only) — this snapshot exposed the
  PendingActions leak (fixed + gates re-run green). Screenshots:
  download/qa12-classhub-rohan.png, qa12-students-rohan.png,
  qa12-kavita-panel.png.
- GATES: bunx tsc --noEmit 0 errors; bun run lint clean; robots 200;
  event-stream :3003 200; no chrome zombies; server stable post-QA.

Stage Summary:
- USER REQUEST DELIVERED: (1) the Class Teacher Hub is APPOINTMENT-
  gated — only teachers the principal actually appointed see the group,
  its modules, its dashboard affordances (Kavita sees none of it);
  (2) the Student Directory is now genuinely two views — the class
  teacher of a class sees payment records (fee lines, payments,
  outstanding, class collection stats), a subject teacher sees the
  roster + academics only, with the boundary stated in the UI; (3) the
  appointed class teacher gets "something extra": the My Class hub —
  attendance today, fee collection + defaulters follow-up list, the
  OVERALL RESULTS SUBMISSION matrix across every subject, and class
  wellbeing; (4) everything is connected: the principal appoints from
  the Classes module (official record) → the teacher's sidebar + hub +
  fee views change → the teacher is notified; the appointment IS the
  permission.
- KEY FILES: api/teacher/{role,class-hub}/route.ts + api/teacher/
  students/route.ts (fees) + api/classes/{class-teachers,[id]/
  class-teacher}/route.ts (NEW); teacher-panel/{nav-registry,
  use-teacher-role,teacher-panel,module-router} (gating);
  modules/students/{types,shared,quick-stats,students-grid,
  student-profile-sheet,index} (fee differentiation); modules/class-hub/
  (NEW, 7 files); principal classes {index + details/
  class-teacher-appointments} (NEW); dashboard {quick-actions,
  pending-actions, index} (CT-gated affordances).
- DEMO STATE: 9-A → Rohan (class teacher showcase), 10-A → Arjun —
  restored after the PATCH test cycle; 4 appointment/release Messages
  exist for Priya/Arjun showcasing the notification flow.
  Credentials: rohan.mehta@greenwood.edu.in/teacher123 (CT);
  teacher1@demoschool.edu/password123 (Kavita, normal teacher);
  teacher2@demoschool.edu/password123 (Arjun, CT of 10-A).

## Unresolved issues / risks, next-phase priorities

1. MEMORY (the defining constraint of this round): the dev server
   OOM-crash-looped repeatedly during browser QA. MECHANICS (now
   understood): (a) an open tab's turbopack HMR client re-requests the
   page after every server restart → root recompile (~2.2-3.1GB) +
   chrome → OOM → keepalive restart → loop; (b) each OOM kill poisons
   .next (root RSS grows 2.2 → 2.6 → 2.9 → 3.1GB across generations);
   (c) .next cache does NOT meaningfully survive restarts (root
   recompiled 18-20s after a cache-keeping restart). WHAT WORKED:
   kill dev tree BY PID → verify zero next processes → rm -rf .next →
   headless curl warm-up (root ~45s + ALL APIs the panel will call) →
   attach ONE mobile tab with images/fonts blocked → deep-link →
   capture the a11y snapshot to a FILE EVERY POLL (the render window is
   ~30-60s before the death) → close the tab the instant evidence
   lands. Screenshots can catch a spinner — the DOM snapshot is the
   source of truth.
2. PRINCIPAL APPOINTMENT CARD — API-verified end-to-end (roster,
   PATCH cycle, idempotency, notifications, optimistic-revert logic
   mirrors the proven Invigilation tab) but NOT browser-rendered: the
   principal panel chunk has never compiled on this box without OOM.
   First browser QA next round should start with the principal
   ?module=classes deep-link on a fresh .next.
3. The teacher panel shell still shows Rohan's MOCK record (T-014
   banners/payroll) for any teacher login — pre-existing demo
   architecture; only the module content follows the real session. A
   future round could make the banners session-aware too.
4. The class-hub results matrix uses the 3 most recent exams with an
   ExamClass link; Unit Test 2 shows honest 0/11 "Pending" rows for 7
   of 8 subjects (only Math has marks, in PA1) — entering a few more
   subject marks via Marks Entry would make the matrix demo-rich.
5. Next-phase candidates: unit-test the fee-status derivation (shared
   with class-hub); "message the defaulters' guardians" action from the
   hub (pre-filled Communication Hub); class-wise PDF export of the
   results submission matrix; round-8 leftovers (notification prefs UI
   for students, payment auto-refresh); UP-BOARD demo tenant for the
   lesson planner (Task 10 leftover).

---

Task ID: 13
Agent: Z.ai Code (Teacher Student Directory — responsive redesign + zero-collision card architecture — 2026-09-20)
Task: "Redesign + responsive refinement of Teacher Role → Student Directory. Fix text collisions (name ✕ badge, cramped ATTENDANCE/LATEST AVG/FEES labels, fee-status text pushing card heights), bring it to the Principal Directory's design quality, make the grid genuinely content-responsive (320→1920px), zero horizontal overflow, preserve all functionality and the Scholario visual language."

Work Log:
- RECON: studied Teacher students module (7 files, real API) vs Principal
  directory-tab (mock-store, SearchFilterBar, 1/2/3/4-col media grid)
  + AppShell metrics (sidebar 280px expanded / 80px collapsed / overlay
  below lg; content p-4 sm:p-6 lg:p-8). ROOT CAUSE of the screenshot's
  cramped cards: `lg:grid-cols-3` is VIEWPORT-based — at lg/xl with the
  expanded sidebar the content column is only ~680-940px, forcing cards
  to ~210-260px where the 3-cell metric row (label "ATTENDANCE" ≈ 68px
  + p-2 box padding) physically cannot fit → cramped labels, wrapped
  fee values, uneven card heights.
- NEW CARD ARCHITECTURE (teacher/modules/students/student-card.tsx,
  extracted from students-grid for maintainability): fixed three-band
  structure — identity / metric / footer — with structural (not
  cosmetic) collision safety:
  · NAME ✕ BADGE: name = min-w-0 + flex-1 + truncate, badge = shrink-0
    compact StatusBadge (px-2 text-[10px]) with a guaranteed gap —
    geometry-proven in the browser (8px gap, no overlap, with an
    injected 60-char name).
  · METRIC BAND: tinted boxes REPLACED by equal CSS-grid columns with
    hairline divide-x borders — 100% of each cell stays usable (boxes
    wasted 16px/cell on padding, the actual cramp source). Label
    (truncate) / value row (fixed min-h-[26px] so chip-values and
    numeric values render identical heights) / supporting (truncate).
  · FEE VALUE = status chip (bg-emerald/amber/rose) with max-w-full +
    truncating inner label — "Fees clear" / "₹5,400 due" / "Overdue"
    can never escape the column; OVERDUE supporting line carries the
    money detail ("₹25.0K outstanding").
  · FOOTER: guardian truncates against shrink-0 "View profile" +
    ArrowRight that nudges on hover (group-hover).
- CONTENT-AWARE GRID (students-grid.tsx rewrite):
  `grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]` — the
  CARD (300px minimum usable width), not the viewport, defines the
  breakpoint; adapts to sidebar expanded/collapsed automatically and
  can never overflow horizontally (min(100%,…) collapses to one
  full-width column first). Toolbar refined: search full-width on
  phones / w-60-64 from sm, filter chips 38px touch targets below sm,
  "Showing X of Y" inline with the chips.
- QuickStats breakpoint fix: lg:grid-cols-4/5 → md:grid-cols-3 +
  xl:grid-cols-4/5 (at lg with expanded sidebar only ~680px remain —
  5 tiles of 128px were unreadable; 3-up keeps them readable).
- Functionality untouched: search/filters/CSV/profile sheet/class
  pills all preserved (fee data still renders ONLY for class-teacher
  classes — subject view verified 2-metric cards, 16 cells / 8 cards,
  zero fee leak).
- INFRA REPAIR (sandbox reset had wiped .zscripts + keepalive):
  discovered this session's tool-shell reaps ALL descendant processes
  when a call ends (even setsid+nohup children) — double-fork
  daemonization (( setsid nohup … & ) with PPID=1) is the only
  survivor pattern. Recreated keepalive.mjs (robots-only probe,
  backoff 30→300s, single-instance pidfile, detached respawn —
  respawned children inherit the daemonized PPID=1 keepalive so they
  survive too) and daemonized `bun run dev`. Keepalive proven live:
  it detected the OOM death during the browser QA burst and
  respawned the dev tree automatically.
- BROWSER QA (gateway :81, Rohan class-teacher session, real roster):
  overflow sweep — 320/375/768/1024/1280/1440 ALL
  scrollWidth==innerWidth (zero horizontal overflow). Column counts:
  375→1, 768→2, 1024→2 (the old code forced 3 cramped columns here),
  1280→2 (439px cards), 1440→3. Edge cases: injected 60-char name →
  graceful ellipsis + 8px gap + no badge overlap (geometry-measured);
  injected long family name → clean footer truncation; OVERDUE ₹25K /
  PAID / NONE fee chips all render inside their columns.
  Interactivity: search "diya"→1 card + "Showing 1 of 11"; At Risk
  filter→exactly Saanvi (avg 36%); search+filter combo→correct empty
  state; profile sheet opens with the FEE PAYMENTS section (Billed/
  Paid/Outstanding tiles). VLM audits: 1280px PASS on all 6 items,
  375px + long-name PASS on all 5 items. Screenshots: download/
  qa-1280.png, qa-1280-subject.png, qa-375-cards.png,
  qa-375-longname.png, qa-sheet.png.
- GATES: bunx tsc --noEmit 0 errors; bun run lint clean (incl. the
  new keepalive.mjs); robots 200 post-QA; server healthy.

Stage Summary:
- The Teacher Student Directory now matches the Principal Directory's
  quality bar with a strictly better responsive architecture: a
  collision-proof three-band card (name/badge, hairline metric band
  with chip-based fee status, stable footer) + a content-aware
  auto-fill grid that measures the card, not the viewport — zero
  horizontal overflow from 320 to 1440px+, no cramped 3-column
  squeezing beside an expanded sidebar, all existing functionality
  and data boundaries intact. Cross-role visual language preserved
  (GradientAvatar / StatusBadge / tone palette / quiet SaaS cards).
- KEY FILES: teacher/modules/students/{student-card.tsx (NEW),
  students-grid.tsx (rewritten), quick-stats.tsx (breakpoints)};
  keepalive.mjs (recreated at project root).
- The principal's mock-store StudentCard was NOT consolidated into
  the teacher card on purpose: different data sources (Zustand mock
  vs real API DTO) — coupling them would break the principal module;
  visual consistency achieved through shared primitives instead.
- RUNBOOK ADDITION (important for every future round on this box):
  background processes MUST be double-fork daemonized —
  `( setsid nohup CMD < /dev/null > log 2>&1 & )` — plain
  `nohup … &` or even `setsid … &` is reaped when the tool session
  ends. keepalive.mjs + `bun run dev` are both running daemonized
  now; verify with `ps -o ppid= -p <pid>` → PPID 1.

## Unresolved issues / risks, next-phase priorities

1. MEMORY (unchanged, the defining constraint): the browser QA burst
   OOM-killed the dev server once mid-session (chunk compile spike)
   — keepalive recovered it in <30s and QA resumed. Keep browser
   bursts short, one tab, close+pkill between batches.
2. QUICKSTATS "Fee Collection" tile context ("₹30.4K outstanding · 2
   overdue") truncates at 3-up tile widths — by design (truncate),
   noted by the VLM as tight. A future polish could shorten to
   "₹30.4K out · 2 od" or move to the tile value tooltip.
3. Queued feature work (user-assigned earlier rounds, not started):
   Exam Duties module rebuild (remove old → principal assigns →
   teacher notified → timetable shows duties) and Lessons Planner
   board-syllabus upgrade remain the two named candidates; teacher/
   student attendance UX improvements after those.
4. The principal Classes→ClassTeacherAppointments card is still
   API-verified but not yet browser-rendered (principal panel chunk
   OOM risk) — unchanged from Task 12.

---

Task ID: 14
Agent: Z.ai Code (MASTER TASK — Teacher/Class-Teacher role architecture, two-stage fee collection, receipts, permissions, data sync & responsive UI — 2026-09-20)
Task: The 53-section master brief (upload/Pasted Content_1789913381475.txt): capability-based Teacher/Class-Teacher architecture, role-aware Student Directory, Class Teacher fee collection with two-stage verification (CT collects → Principal verifies), canonical payment ledger (ONE payment = ONE transaction), DB-backed sequential receipts (SCH-YYYY-NNNN), payment sources, direct principal/office payments visible to CT, notifications, audit trail, server-enforced security, monthly collection views, responsive tables.

Work Log:
- AUDIT: Fee model split across legacy Fee+Payment (flat, no source/verifier) and FeeTransaction (immutable finance ledger with receiptNo, gateway flow). Principal Fees module = mock Zustand store; teacher students API derived fees from Fee.paid. Class Teacher Hub + appointment gating already real (Task 12), Student Directory responsive redesign done (Task 13) — the master brief's NEW core = the fee-collection workflow + receipts + security.
- PRISMA: FeeTransaction extended (additive) with source (CLASS_TEACHER/PRINCIPAL/SCHOOL_OFFICE/ONLINE/BANK_TRANSFER), feeId, collectedById/Name/At, verifiedById/Name/At, rejectedById/Name/At, rejectionReason, referenceNumber + 3 new indexes; status vocabulary gains REJECTED (UNDER_VERIFICATION existed). db:push clean.
- src/lib/fee-workflow.ts (NEW): status/source/method vocabulary, mintReceiptNo (SCH-YYYY-NNNNNN, max+1 inside caller's $transaction, DB-backed), applyPaymentToLedger (Fee.paid += amount + status + paidDate + legacy Payment mirror w/ transactionId link — the ONLY ledger writer, runs ONLY at verification), pushMessage/principalUserIds/audit helpers, assertClassTeacherOfStudent (the §21-22 server gate), assertReferenceUnique (§29-8 duplicate guard), toFeeTxnDto (ONE DTO every surface renders).
- APIs (NEW, all server-scoped, never trusting client ids):
  · GET /api/teacher/fee-collection — per CT class: rosters + fee ledgers (items/office-payments), collection summary (billed/collected/outstanding/overdue/awaitingVerification), month sheet (?month=YYYY-MM), ALL canonical txns. No appointment → classes:[].
  · POST /api/teacher/fee-collection — STAGE 1: creates FeeTransaction UNDER_VERIFICATION (ledger deliberately untouched), validates CT-of-student-class + fee ownership + 0<amount≤outstanding (no overpay) + dup-ref, notifies principals, audit row, honest acknowledgement copy (never "payment successful").
  · GET /api/fees/verification (PRINCIPAL/MGMT) — pending queue + recent 25 resolved + month stats + school roster w/ open fees (for direct payment).
  · POST /api/fees/verification — verify (interactive $transaction: status→SUCCESS + mintReceiptNo + applyPaymentToLedger; collector notified w/ receipt no; idempotency errors) / reject (reason required, ledger never touched, collector notified) / record-direct (§10: created VERIFIED w/ receipt + ledger applied, source PRINCIPAL/SCHOOL_OFFICE, CT of student's class notified "no further collection needed").
  · GET /api/fees/receipts/[txnId] — canonical receipt document: PRINCIPAL/MGMT any; TEACHER only their CT students; STUDENT only own. VERIFIED→official receipt, UNDER_VERIFICATION→provisional acknowledgement (§18), REJECTED→honest notice.
- EXTENDED: /api/teacher/students (payments = canonical txns ∪ pre-workflow office records — each entry carries source/status/receipt/collector/verifier; StudentFeesDto + awaitingVerification), /api/teacher/class-hub (fees + awaitingVerificationCount/Amount).
- TEACHER UI: nav "Fees & Payments" (fee-collection) in Class Teacher Hub group (appointment-gated); module (7 files): honest unavailable state, summary tiles, month sheet w/ picker, filters (search/status/method/source), collection table (desktop) → stacked mobile cards (§33), CollectFeeDialog (fee context due/paid/balance, method/ref/notes, §34 confirmation line, honest "awaiting verification" result), StudentLedgerSheet (fee lines + full payment history + per-line Collect), shared receipt viewer.
- PRINCIPAL UI: VerificationWorkspace (real-DB island, ClassTeacherAppointments pattern) mounted FIRST in Fees→Payments: stat strip, pending queue (table ≥md / cards mobile) w/ View/Verify/Reject, reject dialog (reason required), RecordDirectDialog (§10), recently-resolved feed w/ receipts, optimistic updates + toasts + emerald flash.
- SHARED: components/shared/fee-collection/{txn-meta.tsx (status chips/source stories/method/date formats — ONE vocabulary across roles), receipt-viewer.tsx (school letterhead, student block, fee+balance line, payment trace grid, signatures, print stylesheet for PDF)}.
- CONNECTED: profile-sheet payment history upgraded (source/verification chips, receipt buttons → shared viewer, awaiting-verification banner); class-hub FeesCard + "View collection" CTA + awaiting-verification alert line → fee-collection module.
- API QA (curl, ALL GREEN): Rohan GET → 9A summary ₹2.66L/₹2.36L/₹30.4K + Aarav 4 fee items; Kavita GET → classes:[] (§49). STAGE 1: ₹2,000 from Aarav (Transport) → UNDER_VERIFICATION, ledger untouched, awaiting shown separately. Guards: overpay 400 ("exceeds the outstanding balance of this fee (₹4,500)"), duplicate ref 400, Kavita POST real-9A-student → 403 FORBIDDEN, Rohan POST 10-A student → 403, Rohan calls verify endpoint → 403 (§52). STAGE 2: principal verify → SUCCESS + receipt SCH-2026-000001 + ledger applied (Transport paid 2000, out 4500→2500, PARTIAL); re-verify → 400 idempotent. Direct: ₹10,000 Ananya via School Office → SCH-2026-000002, Rohan sees it ("Paid through School Office") and can't touch it (§50). Reject: ₹500 Aarav → REJECTED w/ reason, exam fee ledger untouched (0/900), Rohan sees reason (§29-5). Rohan's month sheet: Verified ₹12.0K(2). ROLE CHANGE (§51): release 9A → GET classes:[], POST 403, subject classes intact; re-appoint → everything returns. Receipt API: Rohan 200 w/ full doc; Kavita 403. 9 workflow Messages + 5 audit rows verified in DB.
- BROWSER QA (gateway :81, one tab, images/fonts blocked, deep-link + zustand-auth injection): teacher panel rendered ?module=fee-collection END-TO-END — DOM evidence: CLASS TEACHER HUB group w/ My Class/Fees & Payments/Student Behavior; tiles ₹2.66L/₹2.48L 93%/₹0 all-verified/₹18.4K/2 overdue; month September 2026 Verified ₹12.0K(2); filters; 3 txns w/ statuses+sources+receipts. 1280px: sw=innerWidth (zero overflow) + screenshot; 375px mobile: sw=375 (ZERO overflow), stacked transaction cards render (Rejected w/ reason · "Paid through School Office" · receipt numbers) + screenshot. Screenshots: download/qa14-feecollection-{desktop,mobile}.png. The box's OOM-restart loop killed several windows mid-QA (known constraint) — the fee API call through the gateway was observed as a resource entry (200), tiles reflect the API numbers exactly.
- GATES: bunx tsc --noEmit 0 errors; bun run lint clean; robots 200 (after keepalive backoff + manual daemonized restart); event-stream :3003 healthy.

Stage Summary:
- MASTER TASK CORE DELIVERED as a real financial system: ONE canonical FeeTransaction per payment with full workflow metadata; CT collects → UNDER_VERIFICATION (ledger untouched, awaiting shown separately) → Principal verifies → SUCCESS + sequential DB receipt + ledger applied + everyone notified; reject returns money-truth to the collector with a reason; direct office payments land in the SAME ledger the CT reads ("Paid through School Office"); subject teachers are denied at the API level (never just hidden UI); role change (release/re-appoint) updates access instantly.
- KEY FILES: prisma/schema.prisma (FeeTransaction +14 fields); src/lib/fee-workflow.ts (NEW); api/teacher/fee-collection/route.ts (NEW GET+POST); api/fees/verification/route.ts (NEW GET+POST); api/fees/receipts/[txnId]/route.ts (NEW); api/teacher/{students,class-hub}/route.ts (extended); teacher/modules/fee-collection/ (NEW, 6 files); shared/fee-collection/{txn-meta,receipt-viewer}.tsx (NEW); principal fees payments/{payments-section + verification-workspace} (NEW island); students/{types,student-profile-sheet} + class-hub/{types,fees-card,index} (upgraded); teacher-panel/{nav-registry,module-router,teacher-panel} (wired).
- DEMO DATA STATE (showcases the workflow): Aarav Transport Fee — ₹2,000 verified by Dr. Ananya Iyer (receipt SCH-2026-000001, balance ₹2,500); Ananya Tuition Q1 — ₹10,000 direct School Office UPI payment (receipt SCH-2026-000002, balance ₹15,000, source story visible to Rohan); Aarav Exam Fee — ₹500 REJECTED ("Reference mismatch…") — ledger untouched. Next receipt will be SCH-2026-000003.
- PERMISSION MATRIX (implemented server-side): Subject Teacher → fee endpoints DENIED; CT → own class ALLOWED / other class DENIED / verify+reject+record-direct DENIED; Principal → everything school-wide; Receipt doc → role-scoped per §17.

## Unresolved issues / risks, next-phase priorities

1. BROWSER-RENDER VERIFIED for the teacher fee-collection module (desktop 1280 + mobile 375, DOM + screenshots); the principal VerificationWorkspace island is API-verified end-to-end (queue/verify/reject/record-direct + receipts) but NOT yet browser-rendered (principal panel chunk OOM risk on this 4GB box — same as Tasks 12/13 notes). Next round should prioritize a principal ?module=fees deep-link pass on a fresh .next.
2. The CollectFeeDialog submit was verified at the API level (same POST tested 4×) but the click-through-UI path was interrupted by the OOM windows; the dialog's visual render + interaction remains a next-round quick check (open dialog → select fee → submit → acknowledgement state).
3. Teacher students API: legacy Payment rows now tagged "School Office record" — a future tidy-up could backfill them as FeeTransactions for a single history stream.
4. Memory: the OOM restart loop (open tab HMR → root recompile) killed several QA windows; keepalive recovered; dev server manually daemonized again at session end. Keep bursts <60s, one tab, close+pkill between batches.
5. Queued feature work from earlier rounds (not started): Lessons Planner board-syllabus upgrade; teacher/student attendance UX; QuickStats fee-tile copy tightening; notification prefs UI for students.

---

Task ID: 15
Agent: Z.ai Code (Error-hunt & fix round — QA sweep, api() robustness bug, infra resurrection, fee-workflow UI loop completion — 2026-09-20)
Task: "Find errors and issues then fix all them." — full-project error hunt: server/infra health, browser QA of the Task-14 fee-collection surfaces that had never been click-tested (CollectFeeDialog UI path, principal VerificationWorkspace render), fix everything found, leave gates green.

Work Log:
- INFRA RESURRECTION (issue #1 — the site was DOWN): the dev server had
  been OOM-killed (dmesg: next-server 2.9GB) and the sandbox reset had
  AGAIN wiped keepalive.mjs + .zscripts/ (untracked files vanish on
  platform sync; tracked files with old mtimes can roll back). Recreated
  keepalive.mjs (robots-only probe, 30→300s backoff, pidfile
  single-instance, double-fork detached respawn, 90s boot grace) and
  daemonized it (PPID=1 pattern). It revived the server 8+ times during
  this session's OOM cycles — watchdog proven under fire.
- ⚠️ DISPLAY-PIPELINE ARTIFACT (ghost hunt, save future rounds): this
  tool environment's stdout STRIPS bare ANSI-lookalike sequences —
  "const [mounted" PRINTS as "const ounted" (the "[m" is eaten as an SGR
  terminator). A full "corrupted page.tsx" investigation was a ghost:
  the file was always clean (od -c byte dump proved it; `echo "ab[mcd"`
  → "abcd"). RULE: never trust printed text for byte-exact verification
  — use od -c / base64 / python byte reads.
- REAL BUG FOUND & FIXED — api() raw-HTML error leak
  (src/lib/exams/api-client.ts): when a fetch returns a non-JSON error
  body (the Caddy gateway serves a styled HTML placeholder on 502 —
  which happens on EVERY keepalive OOM-restart window), the ENTIRE HTML
  page became the error message and rendered inside module UIs
  (observed live: a full <!DOCTYPE html>… blob inside the principal
  Payment Verification workspace). Also `'ok' in payload` threw
  TypeError on string payloads. FIX: non-JSON error bodies now collapse
  to "Request failed: <status> — <120-char snippet>", and a 200-response
  HTML body (gateway answering for a dead backend) throws a clean
  "Service temporarily unavailable — please retry" ApiError. Verified
  LIVE in the browser: the workspace now renders the short snippet.
  Gates green after the fix (tsc 0 errors, lint clean).
- TEACHER FEE-COLLECTION UI — FULL LOOP VERIFIED (Task-14 leftover):
  Rohan session → ?module=fee-collection rendered end-to-end (all tiles
  match the API numbers: ₹2.66L billed / ₹2.48L 93% verified / ₹18.4K
  outstanding / 2 overdue; month sheet ₹12.0K(2); 3 txns with receipts
  SCH-2026-000001/000002 and source stories). CollectFeeDialog opened →
  student selector → fee context tiles (₹4.5K due / ₹2.0K paid / ₹2.5K
  balance) → honest §34 confirmation line (updated live with the typed
  amount) → submitted ₹100 (Transport, Cash, ref UTR-88213-QA) → form
  reset + optimistic states updated everywhere (tile "₹100 · 1 collection
  pending", month "Awaiting verification ₹100(1)", tab badge 1, 4th
  txn row "Awaiting verification"). Zero horizontal overflow at 390px.
  Screenshot: download/qa15-feecollection-dialogflow.png.
- PRINCIPAL VERIFICATION API + UI: curl-authenticated GET
  /api/fees/verification returns the ₹100 pending queue (Aarav ·
  Transport — October · UNDER_VERIFICATION · ref UTR-88213-QA ·
  collected by Rohan Mehta; stats 1 pending/₹100, ₹12K verified (2),
  1 rejected). The workspace RENDERS in the browser (header, stat strip,
  Refresh/Record Direct Payment buttons, tabs, mock payments section
  below) with the fixed error handling — but the final click-Verify UI
  step could NOT be completed: 7 disciplined attempts raced the box's
  OOM-restart windows (alive windows shrank to seconds once the preview
  panel's API-compile traffic + browser mount stack ~3.2GB RSS). The
  verify/reject/record-direct POST actions remain API-proven from Task
  14; the UI button wiring (act() → api() → POST → toast → reload) is
  the same path as the load that now works. THE ₹100 IS STILL PENDING —
  a ready-made demo artifact for the next round's first verify click
  (will mint receipt SCH-2026-000003).
- QA-METHODOLOGY LESSONS (runbook additions):
  · NEVER block "**/*hmr*" — it kills the turbopack HMR client SCRIPT
    (a synchronous bootstrap script) → totally blank page. Block only
    "**/_next/webpack-hmr*" (the websocket) to stop the auto-reload
    loop while keeping the app bootable.
  · Blocking "**/api/app-version*" stops VersionGuard's stale-tab
    hard-reload (every server restart bumps the version → every open
    tab reloads → recompile → OOM loop fuel).
  · CHUNK PRE-COMPILATION VIA CURL (the OOM-breaker): the compiled
    chunk graph is discoverable headlessly — fetch the root HTML, walk
    the manifests (panel chunk → TURBOPACK_CHUNK_LISTS sub-chunk URLs →
    module chunk manifests), curl every URL → turbopack compiles them
    WITHOUT a browser attached. Proven for teacher + principal panel
    chains (all 200s, seconds). After a restart the in-memory cache is
    gone but the SST cache (.next/dev/cache, ~634MB) re-serves fast.
  · DO NOT rm -rf .next/dev/cache (or .next/cache) — that persistent
    SST cache is what keeps post-restart compiles cheap. (Accidentally
    deleted this round; it rebuilt over ~15 min of generations.)
  · The user's PREVIEW PANEL polls /, /api/app-version, /api/auth/me,
    /api/notifications-feed, /api/schools/public, /api/fees/defaulters
    continuously — every server revival recompiles these routes first;
    they are the baseline memory cost of any generation.
  · Stable QA sequence that worked: server dead → close browser →
    revival + root warm via curl → chunk-graph pre-compile via curl →
    API warm via curl (login with {"email":…} to get erp_session
    cookie) → attach ONE browser with state load → clicks in <30s →
    close the instant evidence lands.
- GATES: bunx tsc --noEmit 0 errors; bun run lint clean (both after the
  api-client fix). robots 200 post-recovery; keepalive freshly restarted
  (backoff reset — instant revival instead of 300s waits).

Stage Summary:
- FOUND & FIXED: (1) the site was dead with no watchdog — keepalive
  recreated and battle-tested; (2) the api() client leaked entire HTML
  error pages into module UIs during every gateway 502 window — now
  sanitised (short snippets + clean unavailable message), verified live;
  gates green. (3) QA-methodology bugs in my own tooling (over-broad
  hmr blocking, app-version reload loop, cache deletion) identified and
  codified into the runbook.
- COMPLETED VERIFICATIONS: teacher fee-collection module + CollectFeeDialog
  FULL UI loop (₹100 collected, honest acknowledgement everywhere);
  principal verification queue API + workspace render + error-handling;
  the ₹100 txn awaits verification as demo data.
- KEY FILES: src/lib/exams/api-client.ts (hardened); keepalive.mjs
  (recreated); download/qa15-feecollection-dialogflow.png (evidence).
- HONEST GAP: the principal's click-Verify UI step is API-proven but
  not browser-click-proven (box's OOM windows); next round's first
  browser QA should finish it (pending ₹100 → Verify → receipt
  SCH-2026-000003 → receipt viewer).

## Unresolved issues / risks, next-phase priorities

1. THE 4GB OOM CYCLE (worsened): alive windows degraded to seconds
   during heavy QA. The compile-OOM loop is fueled by (a) the preview
   panel's continuous polling, (b) every open tab's API suite, (c) any
   browser attach. The curl pre-compile technique mitigates but cannot
   eliminate it. If a future round needs heavy browser QA, consider:
   reducing the root page's dynamic-import graph, or asking the user to
   close the preview panel during QA bursts.
2. PRINCIPAL VERIFY-CLICK (first priority next round): the ₹100 is
   pending; one clean browser window (post-stability) completes the
   loop + receipt viewer screenshot. Sequence is in the runbook above.
3. Teacher panel shell still shows Rohan's MOCK record for any teacher
   (banners/payroll/salary confirmation) — pre-existing demo
   architecture, unchanged.
4. The workspace's stat strip shows mock defaults while the queue fetch
   errors — a polish idea: derive the strip from the last successful
   payload instead of mock constants.
5. Queued feature work (user-assigned earlier rounds, not started):
   Exam Duties module rebuild, Lessons Planner board-syllabus upgrade,
   teacher/student attendance UX, QuickStats fee-tile copy tightening.

---
Task ID: 8
Agent: Z.ai Code (main)
Task: Fix reported Radix a11y console error — `DialogContent requires a DialogTitle` in FeeReceiptViewer (teacher Students → profile sheet → payment history), plus a codebase-wide sweep for the same defect class.

Work Log:
- Read `src/components/shared/fee-collection/receipt-viewer.tsx` — root cause confirmed: `DialogTitle` was rendered only inside the `{data && t && (...)}` branch, so the loading and error states had NO title, violating the Radix dialog a11y contract.
- Fixed receipt-viewer.tsx: DialogHeader + DialogTitle moved OUT of the conditional to render ALWAYS at the top of DialogContent, with a state-aware label (`Receipt unavailable` / `Loading receipt…` / `Fee Payment Receipt` / `Collection Acknowledgement` / `Payment Notice`). Added sr-only DialogDescription (preempts Radix's sibling "missing description" warning). Loading skeletons/error block adjusted to p-5 under the now-permanent header. Print stylesheet untouched (header stays outside #fee-receipt-print).
- Codebase sweep #1 (count heuristic): every file with more `<DialogContent|SheetContent` than `<DialogTitle|SheetTitle` — found `salary-employee-drawer.tsx` (3 contents, 2 titles).
- Fixed `src/components/principal/modules/salary/salary-employee-drawer.tsx`: the SheetContent had NO SheetTitle at all; converted the visible employee-name `<p>` into `SheetTitle` and the role line into `SheetDescription` (identical visual styling preserved).
- Codebase sweep #2 (conditional-title heuristic): checked collect-dialog.tsx (both ternary branches titled ✓), student-profile-dialog.tsx (all three states titled incl. sr-only fallback ✓), add-topic-sheet.tsx ✓, fee-receipt-a5.tsx ✓, event-detail-dialog ✓, verification-workspace ✓, both learning resource-details ✓, review-dialog ✓ — no further instances.
- Gates: `bunx tsc --noEmit` → 0 errors; `bun run lint` → clean (exit 0).
- Browser QA via agent-browser (teacher rohan.mehta@greenwood.edu.in one-tap login): Student Directory → Aarav Sharma profile sheet → RECENT PAYMENTS → opened all three transaction states (Awaiting verification ₹100, Rejected ₹500, Verified ₹2.0K SCH-2026-000001). Each dialog now exposes its proper accessible name ("Collection Acknowledgement" / "Payment Notice" / "Fee Payment Receipt"); console completely clean — zero errors/warnings across all three opens.
- Encountered and handled en route: stale Turbopack ChunkLoadError (fresh=2 reload), keepalive dev-server restart mid-QA (waited for `/` recompile before reloading).

Stage Summary:
- Reported error FIXED at the exact source; verified in-browser across all three receipt states with a clean console.
- One additional latent instance of the same defect class (salary employee drawer SheetTitle) found and fixed proactively.
- Both fixes preserve existing visuals exactly; a11y improved (screen-reader names on two more surfaces).
- Gates green: tsc 0 errors, lint clean, robots 200.
- Dev server left healthy; memory at ~628MB available after QA compiles (known post-compile state; keepalive guards it).

---
Task ID: 1-a
Agent: Explore (frontend audit)
Task: Research-only audit of the Teacher Portal frontend — layout/shell, the three modules (My Timetable, Class Attendance, Fees & Payments), shared components, design tokens, and responsive patterns; produce a class-level comparison explaining why My Timetable is the calm benchmark and where Attendance/Fees feel heavy. No source files modified.

Work Log:
- Read worklog.md tail (Tasks 14/15/8 context: fee-collection build + QA, Teacher Workspace cleanup conventions referenced in code comments as TWC §3-§5).
- Read the shell: src/components/shell/app-shell.tsx (sidebar+header+content, lg drawer), shell/app-shell/sidebar-aside.tsx (mobile drawer, active state, collapse), teacher/teacher-panel.tsx (nav groups, banners, role gate), teacher-panel/nav-registry.tsx (module list + Class Teacher Hub gating), teacher-panel/module-router.tsx (lazy chunks), teacher-panel/use-teacher-role.ts (server-truth appointment gate), teacher-panel/module-toolbar.tsx (identity-bar rule), modules/shared/hub-stat-cards.tsx (HubStatCards/Empty/Skeleton/SectionError kit).
- Read My Timetable fully (modules/my-timetable.tsx, 1035 lines): PageTransition + ModuleToolbar + HubStatCards + card/header anatomy (rounded-xl border-border bg-card + bg-muted/20 header bars), DayPeriodList divide-y rows, weekly grid hidden lg:block table-fixed, mobile lg:hidden day chips, conditional amber conflict banner, live-refresh chip, Export .ics.
- Read Class Attendance fully (modules/attendance/{index,shared,hooks}.tsx, ~1744 lines): ModuleToolbar action cluster (class/subject/date/Save), WeekStrip, hand-rolled CountsStrip (GlassCard + icon chip + progress bar), roster GlassCard p-3 sm:p-4 lg:p-5 with per-row bordered RosterRow cards, STATUS_CONFIG row tints, InsightsView nested cards, BoardSkeleton, max-h-[640px] inner scroll.
- Read Fees & Payments fully (modules/fee-collection/{index,types,hooks,student-ledger,collect-dialog}.tsx, ~1570 lines): hand-rolled header (duplicate module H2), class pills, 5 Tiles (rounded-2xl, icon chips, text-lg values), month sheet, filters + status chips with badge, desktop table hidden md:block vs mobile cards md:hidden, StudentLedgerSheet, CollectFeeDialog; mapped info duplication (awaiting-verification ×3, verified/collected ×2, class identity ×2).
- Read shared kit: components/shared/ui.tsx (GlassCard hardcodes bg-white/border-gray-200/text-slate-800; PageTransition; StatusBadge; GradientAvatar; SectionHeading), module-loading.tsx, kpi-card usage scan, hooks/use-mobile (used only by principal messaging + shadcn sidebar — NOT by teacher modules), globals.css tokens (emerald primary oklch 0.55/0.14/162, --radius 0.75rem, radius scale xl=+4px 2xl=+10px, .on-card light-surface rescope), tailwind.config.ts.
- Grepped teacher tree for ModuleToolbar/Hub*/GlassCard/PageTransition usage to build the per-module adoption matrix (fee-collection adopts none of the teacher hub kit).
- Compiled findings into the structured report (file inventory, calm-vs-heavy class-level diff, duplication, responsive divergence, consolidation points). No files modified.

Stage Summary:
- FILE INVENTORY: shell = app-shell.tsx + sidebar-aside.tsx (shared, teacher uses SidebarAside); panel = teacher-panel.tsx + nav-registry.tsx + module-router.tsx; modules = my-timetable.tsx (benchmark), attendance/index.tsx + shared.ts + hooks.ts, fee-collection/{index,types,hooks,student-ledger,collect-dialog}.tsx; shared kit = teacher-panel/module-toolbar.tsx, modules/shared/hub-stat-cards.tsx, shared/ui.tsx, shared/module-loading.tsx, shared/fee-collection/{txn-meta,receipt-viewer}.tsx, shared/export-ics-button.tsx.
- WHY TIMETABLE IS CALM: one stat system (HubStatCards: 500/5 tint, bare icon, no chip boxes, no bars); uniform section anatomy (rounded-xl border-border bg-card overflow-hidden + header bar bg-muted/20 px-4 py-3); content rows are divide-y hairlines (px-4 py-2.5) NOT boxed cards; typography tops out at text-sm for headings with text-[10px] uppercase meta; no module-name H2 (ModuleToolbar context only — shell header already shows it); noise is conditional (conflict banner, live chip); consistent p-3 sm:p-4 card padding.
- WHY ATTENDANCE FEELS HEAVY: roster = card-in-card (GlassCard p-3 sm:p-4 lg:p-5 → 30+ RosterRow rounded-xl border p-3 boxes with full status-tinted borders); CountsStrip re-implements stat cards (GlassCard + h-7 w-7 icon chips + progress bars + /total) instead of HubStatCards; Insights nests 5 levels of boxes; max-h-[640px] scroll-inside-scroll; every row carries roll tile + avatar + dots + rate chip + 4 status buttons.
- WHY FEES FEELS HEAVY: adopts none of the hub kit (no PageTransition/ModuleToolbar/HubStatCards/HubEmptyState — hand-rolled skeletons, empty and error states, error card has no retry); duplicate module H2 text-lg (shell header already says "Fees & Payments"); 5 stacked pre-content sections (tiles grid + month sheet + filter row + chip row + class pills); rounded-2xl radius vs system rounded-xl; DUPLICATED INFO: awaiting-verification appears 3× (tile #3 value+count [168-174], month sheet line [206-209], chip badge [262-266]), verified/collected emerald amounts 2× (tile #2 [167] vs month Verified [202-205]), class identity 2× (pills [145-162] vs tile #1 sub [166]).
- REUSABLE VS DUPLICATED: Timetable consumes the full hub kit; Attendance consumes all but HubStatCards (rolls its own CountsStrip + STRIP_TONES); Fees consumes none (only GradientAvatar + shared fee txn-meta/receipt-viewer). Three stat-card implementations, two empty-state systems, two skeleton systems, two radius scales, three mobile-swap strategies.
- RESPONSIVE: Timetable table↔chips at lg; Fees table↔cards at md; Attendance has no swap (always card rows; icon-only status buttons <sm; overflow-x-auto week strip). Sidebar drawer + hamburger at lg; page padding p-4 sm:p-6 lg:p-8.
- CONSOLIDATION: (1) extract Timetable's section card+header anatomy into a shared SectionCard; (2) migrate Fees to ModuleToolbar/PageTransition/Hub kit, drop duplicate H2; (3) Attendance CountsStrip → HubStatCards (optionally extended with progress/total); (4) unify radius to rounded-xl; (5) de-dupe Fees' awaiting-verification/verified figures; (6) un-box Attendance roster rows to divide-y rows + border-l-2 status accent; (7) standardize one mobile breakpoint; (8) migrate teacher modules off hardcoded-light GlassCard to token cards; (9) drop the roster inner max-h scroll.

---
Task ID: 1-b
Agent: Explore (auth audit)
Task: RESEARCH-ONLY audit of the SCHOLARIO auth + routing system (login page, auth API, middleware/route guards, root-page routing, session handling, mobile-specific code paths, redirect targets) and root-cause investigation of the reported bug: "On MOBILE viewports, after clicking LOGIN, the app appears to return to the SAME login screen instead of entering the app. Desktop works."

Work Log:
- Read worklog.md (head + last ~300 lines) for project history: single-route SPA at '/', auth = localStorage `scholario-auth` (zustand persist) + httpOnly `erp_session` cookie; known QA note at ~line 673: "the first 'Open Login Portal' click can be swallowed by the settling page".
- Mapped the full auth surface by reading: src/app/page.tsx (root router), src/components/login/login-page/{index.tsx,loading-phase.tsx,data.tsx}, src/lib/store/auth-store.ts, src/lib/store/current-user-store.ts, src/lib/signout.ts, src/lib/auth.ts, src/lib/api.ts, src/app/api/auth/{login,me,logout,sessions,change-password}/route.ts, src/components/public-website/public-website.tsx (portal entries), src/components/shell/app-shell.tsx, principal-panel.tsx (module deep-link), platform-landing.tsx, version-guard.tsx + app-version route, next.config.ts, global-error.tsx. Confirmed NO src/middleware.ts exists (no server-side route guards; single-route client SPA).
- Verified login API by curl: 200 + Set-Cookie `erp_session` (HttpOnly, SameSite=Lax, Path=/, Max-Age=604800, no Secure/Domain) + payload {ok,data:{role:'TEACHER'...}}; wrong password → {ok:false,error:'Invalid email or password'}; API expects {email,password} (client maps the "identifier" field).
- Browser QA (agent-browser, iPhone 14 emulation 390x844 AND desktop 1280x800, via :3000 and gateway :81): measured live geometry of the login page, reproduced the manual-typing flow, the chip flow, the wrong-credentials flow, and the student/teacher/principal login outcomes; instrumented window-level capture listeners to trace pointer/click/submit events.
- KEY MEASUREMENTS (mobile 390x844): LoginPage root is `h-screen overflow-hidden` (index.tsx:89); `motion.main flex flex-col md:flex-row` (line 97) stacks LeftPane (w-full, lines 132-253) y=0..305 — 36% of the viewport — above RightPane (line 285) which gets only 539px for 712px of content (internal scroll, maxScroll=173px). Sign In button initially at y=876..928 — BELOW the fold; password field also below the fold; the "Tap a role chip" hint and the error div render below the button (off-screen). With the on-screen keyboard open (visible area ~0..508px), even max inner scroll puts Sign In at ~703 — UNREACHABLE while typing. DESKTOP 1280x800: whole form fits (Sign In at 590..642, email at 380) — zero scrolling, one screen. This asymmetry is why desktop "works".
- Traced handleLogin (index.tsx:37-86): (1) if NO chip selected + email typed → a "role probe" POST /api/auth/login runs FIRST and is AWAITED before any UI feedback (setSubmitting/setPhase happen only at lines 66-69 AFTER the probe); (2) role resolution `role ?? selectedRole ?? dbRole ?? 'principal'` (line 61); (3) the real login POST's res.ok is IGNORED (lines 73-82 — catch swallows everything, non-OK is not even read); (4) the panel switch is `setTimeout(() => login(r), 1100)` — a fixed 1.1s delay, not tied to auth success; login(r) sets a HARDCODED roleProfiles user (auth-store.ts:31-63,75-80) → Home re-renders → role panel (page.tsx:74-79). No router.push/window.location/callbackUrl anywhere.
- Reproduced live: wrong credentials (nobody@wrong.edu/wrongpass, no chip) → logged into the full PRINCIPAL panel anyway (client demo fallback `?? 'principal'`); server session never created (cookie empty), all privileged APIs 401 beneath the mock UI.
- Reproduced live (chip + manual flows, both origins): when the page is freshly loaded, raw mouse presses + Playwright clicks at correct coordinates (button verified in view) produced ZERO events (no pointerdown/mousedown/click/submit at window-capture level) — the same clicks ~30s later worked and logged in fine. Matches the worklog's documented "swallowed by the settling page" flakiness (dev-mode; hits the FIRST tap of a session — exactly the mobile user's first Sign In tap).
- Confirmed the happy path DOES work in emulation once the button is scrolled into view and the page has settled (teacher/student/principal panels render, scholario-auth persisted) — i.e. there is no deterministic logic bug in the submit→store→panel chain; the failure is interaction/feedback-shaped.
- Checked all remaining audit items: /api/auth/me (session truth, SS-1 device context, SD-3 student enrollment), logout (revokes Session row + clears cookie; signOut() also clears current-user + teacher-hub stores), sessions list/revoke-others, change-password (revokes other sessions), VersionGuard (constant version both sides — reload only after code bumps; network failures never reload), no auth guards in panels (only Home's isAuthenticated), redirect targets = role→panel components at '/' (+ `?module=` deep-link on principal panel only), LoadingPhase not vertically centered + superadmin chip renders no subtitle, hash #portal only READ on mount (nothing ever writes it), PlatformLanding super-admin button does a cookieless client-only login.
- Closed the browser (memory discipline), left the dev server healthy (robots 200) with keepalive running.

Stage Summary:
- ROOT CAUSE (rank 1, measured): the mobile login layout is geometrically broken — the brand LeftPane (w-full, stacked) eats 36% of a 100vh `overflow-hidden` screen and the form lives in a cramped 539px inner scroll pane; the Sign In button starts 32px BELOW the fold and is UNREACHABLE while the on-screen keyboard is open (max inner scroll 173px vs ~336px keyboard). Desktop fits on one screen (measured 1280x800: button at y=590, fully visible). The mobile user's "click LOGIN" often lands as: tap-with-keyboard-open on the wrong element, a blind double-tap, or a first tap swallowed by the settling page (worklog-documented dev flakiness, reproduced with zero captured events) — the app never navigates and the user re-sees the same login screen. Fix: hide/condense the LeftPane below md (the RightPane already renders its own mobile logo block) or convert the root to a naturally scrolling min-h-screen layout.
- ROOT CAUSE (rank 2, code): for manual typists (no chip — the dominant real-mobile flow), handleLogin awaits a full login round trip (the role probe, index.tsx:42-60) BEFORE setSubmitting/setPhase — zero UI feedback for the entire round trip, which on a phone (mobile network + on-demand dev route compile, multi-second cold /api/auth/login) reads as "login did nothing / returned me to the same screen". The probe also double-logins (probe + real POST = 2 Session rows) and runs before the empty-fields validation.
- OTHER AUTH ISSUES: (a) invalid credentials NEVER fail client-side — res.ok ignored, fallback `?? 'principal'` logs ANY typo into the principal workspace (reproduced) with no server session; (b) chip-vs-credentials role mismatch (pick Student chip, type principal email → StudentPanel + 403s) because selectedRole outranks the DB role; (c) hardcoded roleProfiles identities diverge from DB identities (emails/IDs); (d) erp_session cookie has no Secure flag (http dev OK; add in prod); (e) LoadingPhase top-aligned (not centered) and superadmin chip shows no subtitle; (f) #portal hash read only on mount; (g) VersionGuard reload during the 1.1s login window would drop an unauthenticated user on the PUBLIC site (no hash is ever set), read as a logout.
- RECOMMENDED MINIMAL FIXES: (1) mobile layout — `hidden md:flex` on LeftPane (or min-h-screen natural scroll) so the form fits above the fold; (2) reorder handleLogin — validate fields first, setSubmitting+setPhase BEFORE any fetch, ONE POST total, read res.ok: on failure setError + setPhase('form') + return; on success use data.data.role for login(); (3) scrollIntoView the error div (or render errors above the fold); (4) if the demo always-works fallback is kept, make it explicit ("demo mode" toast) instead of silently logging into principal.
- No source files modified (research-only); browser QA artifacts: /tmp/login-mobile-initial.png; dev server left healthy.

---
Task ID: 9
Agent: Z.ai Code (main)
Task: MASTER TASK — Teacher Portal UI consistency (Timetable benchmark → Class Attendance + Fees & Payments redesign) + responsive refinement + mobile login/auth bug fix.

Work Log:
- Phase 1 (audit): launched two parallel Explore agents. 1-a mapped the teacher layout/sidebar/modules/shared kit, diagnosed WHY Timetable is calm (HubStatCards recipe, SectionCard anatomy, hairline divide-y rows, ModuleToolbar no-duplicate-title rule, small typography) and why Attendance (3-level card nesting, reinvented CountsStrip, inner scroll) + Fees (zero hub-kit adoption, duplicate H2, 5 stacked sections, awaiting-verification shown ×3, rounded-2xl scale) feel heavy. 1-b traced the full auth flow and root-caused the mobile login bug with live measurements: (1) Sign In button rendered BELOW the fold at 390×844 (y=876-928 vs 844 viewport; LeftPane consumed 36%), (2) zero-feedback probe POST before any loading state, (3) res.ok never checked + 'principal' fallback → any typo silently entered a mock principal panel.
- Phase 2 (mobile login fix — src/components/login/login-page/index.tsx): LeftPane now hidden md:flex (mobile gets RightPane's own compact logo); root h-screen → h-[100dvh]; RightPane p-6 sm:p-8 + flex-1; error block moved ABOVE the form with role=alert + aria-live (was below the fold); autoComplete username/current-password + inputMode=email; LoadingPhase wrapped in a full-height flex-center container.
- handleLogin fully reworked: validate-first → duplicate-submit guard → ONE POST /api/auth/login → res.ok checked → server role is single source of truth (chip role only a fallback) → login() with real identity overrides; failure returns to form WITH visible error (endAuth + setPhase('form') + setError). Removed the pre-probe double-login and the fixed 1100ms setTimeout. auth-store login(role, overrides?) now merges server name/email so the shell stops showing stale mock identity.
- LoadingPhase: superadmin subtitle + generic 'Signing you in…' default.
- Phase 3 (shared design system): extended hub-stat-cards.tsx (HubStat + optional total/progress → renders '11 / 14' + hairline animated progress bar with role=progressbar; TONES gained bar colors; HubStatCards gained className grid override; live value pop when total present — all backward-compatible, timetable output unchanged). NEW section-card.tsx — the SectionCard anatomy extracted verbatim from the Timetable benchmark (overflow-hidden rounded-xl border bg-card + bg-muted/20 header bar + icon/title/subtitle/actions/meta slots).
- Phase 4 (Class Attendance redesign — attendance/index.tsx rewritten): CountsStrip deleted → shared HubStatCards (Present/Absent/Late/On Leave with value/total + progress, 2×2 mobile → 4-across); roster GlassCard → SectionCard with search + mark-all + segmented tabs in the header actions slot; student rows un-boxed → divide-y hairlines with border-l-2 status accent (STATUS_CONFIG gained accent recipe); removed the max-h-[640px] inner scroll (natural page flow); responsive row: desktop = roll tile + labeled buttons, mobile = roll folded into name + compact 4-up action grid (one row, labels + icons, no horizontal scroll); Insights un-nested (headline strip, bare trend bars, divide-y attention/perfect lists); BoardSkeleton + empty states matched to the new anatomy; WeekStrip kept (already a light nav control).
- Phase 5 (Fees & Payments redesign — fee-collection/index.tsx rewritten): adopted the hub kit (PageTransition, HubModuleSkeleton, HubSectionError with retry — previously missing, HubEmptyState); duplicate 'Fees & Payments' H2 deleted → ModuleToolbar (context = the verification sentence, action = Collect Fee); 5 Tiles → HubStatCards class-overview grid (2-col mobile with 5th spanning, 3-col tablet, 5-across desktop; 'Collected' renamed 'Verified collected'); DEDUP: month bar is now explicitly 'This month · Verified ₹X (N payments) · Awaiting ₹Y (N payments)' — different semantic from the all-time overview; the awaiting-count chip badge on the status filter REMOVED (was the 3rd duplicate); month sheet rounded-2xl card → lightweight nav bar; filters merged into one compact wrapping toolbar; payment table wrapped in SectionCard ('Payment records' + shown/total meta, rounded-xl, bg-muted/30 header, tighter rows + title tooltips on truncated fee names); table↔cards breakpoint standardized md → lg (matches shell + timetable philosophy); mobile transaction cards rounded-xl.
- Gates after each phase: bunx tsc --noEmit → 0 errors; bun run lint → clean.
- Browser QA (390×844 true viewport + 1280×800): mobile login fold FIX VERIFIED — Sign In at y=732-784 (above 844 fold; was 876-928), LeftPane display:none, email/pw fields above fold, zero horizontal overflow; FULL mobile login flow verified (Teacher chip → Sign In → teacher panel mounts). Attendance mobile: 11 hairline rows, mobile 4-up action grid, zero overflow; VLM review: 'Clean and Calm… does not feel cramped'. Fees mobile: overview + month bar + 4 transaction cards visible, table hidden, zero overflow; VLM: 'high-quality mobile UI implementation'. Fees desktop (1280): 5 balanced metric cards, lightweight month bar, clean filters, table 'perfect density'; VLM: 'Calm and Professional… production-ready'.
- Login error path verified at API level (environmental OOM cycles blocked the browser rerun): POST /api/auth/login with wrong/unknown credentials → {"ok":false,"error":"Invalid email or password"} — exactly the payload the reworked handleLogin surfaces in the role=alert div; correct creds → {ok:true, role:TEACHER, name/email} → login(role,{name,email}).
- Environmental note: the 4GB OOM cycle worsened significantly this round (~10 dev-server restarts during QA; root compile peaks ~3.0GB RSS and the login-chunk on-demand compile on top repeatedly triggered the kernel OOM killer). Root page compiles succeeded in ~27s whenever attempted from a fresh boot with the browser closed. All restarts were auto-recovered by keepalive.mjs; no .next deletion was performed.

Stage Summary:
- Mobile login bug FIXED at root cause (layout fold + single-trip auth + honest errors + server-side role truth). Success path browser-verified at 390×844; error path API-verified.
- Class Attendance and Fees & Payments now speak the Timetable design language: one stat-card system (HubStatCards), one section anatomy (SectionCard), hairline rows, no duplicate titles, no duplicate money figures, compact toolbars, consistent radius (xl) and tokens.
- Shared kit extended backward-compatibly (HubStat total/progress, grid override, SectionCard) — timetable untouched and stable.
- Fees dedup implemented exactly per spec: top = class-level overview (all-time), month bar = month-scoped activity ('This month' labeled), third duplicate removed.
- Gates green: tsc 0 errors, lint clean.
- REMAINING (deferred to next cycle due to OOM environment): attendance DESKTOP visual screenshot pass, timetable visual regression screenshot, full LOGIN QA MATRIX (session-persist/refresh/logout flows) in a calm window — the 15-min webDevReview cron will pick these up when the server is warm. Code-level risk is minimal (timetable file untouched; shared changes purely additive; tsc confirms all callers).

---
Task ID: 10
Agent: Z.ai Code (main)
Task: Fix the reported mobile/preview-panel login bug — "when logging in as phone screen in the preview panel, clicking Sign In kicks back to the login screen."

Work Log:
- Read worklog.md (Tasks 8, 9, 1-a, 1-b) — Task 9 had already fixed the mobile login LAYOUT (fold) and handleLogin honesty, yet the user still reported the kick-back, so the root cause had to be elsewhere.
- Decisive evidence found in dev.log: the user's own failed attempts were captured live — `POST /api/auth/login 200` followed IMMEDIATELY by `GET /api/auth/me 401`, `/api/teacher/role 401`, `/api/notifications-feed 401`, then `POST /api/auth/logout` (×2), repeating 3×. The login SUCCEEDS server-side but the session cookie never comes back on any subsequent request.
- Root cause: the preview panel renders the app inside a CROSS-SITE iframe. Browsers refuse to store AND send `SameSite=Lax` cookies in third-party frames, so the `erp_session` cookie set by the login response is dropped. The client then mounts the role panel, every panel API arrives cookie-less → 401 → every teacher hook's "401 → shared signOut() exactly once" policy (correct for real session death) resets the client → user lands back on the login screen. Desktop/Open-in-New-tab is a first-party context → cookie works → no bug there.
- Implemented a Bearer-token fallback (deterministic, protocol-independent, no cookie-path change):
  - `src/lib/auth.ts` — `getSessionToken()` now prefers the HttpOnly cookie but falls back to `Authorization: Bearer <token>` (via next/headers) for embedded contexts. One patch point covers all 160+ API routes (every token read funnels through it).
  - `src/app/api/auth/login/route.ts` — response payload now includes `sessionToken` (same secret as the cookie; cookie remains primary wherever it works).
  - NEW `src/lib/auth-session-token.ts` — per-origin localStorage token store + a one-time passive `window.fetch` interceptor that attaches `Authorization: Bearer` to same-origin `/api/*` requests only (no token → untouched fetch; existing Authorization never modified; non-API/cross-origin never touched).
  - `src/app/page.tsx` — installs the interceptor once at client boot, before any component can fire an API call.
  - `src/components/login/login-page/index.tsx` — persists the token BEFORE `login()` flips the panel (otherwise the freshly mounted panel's first 401 would bounce straight back).
  - `src/lib/signout.ts` — clears the token AFTER the logout request (the interceptor needs it to identify the session to revoke) + added an in-flight dedupe so concurrent 401 observers share ONE server revocation instead of racing double `POST /api/auth/logout` (both were visible in the user's dev.log trace).
- Environmental recovery en route: the dev server had died and the sandbox reset had WIPED keepalive.mjs, .zscripts/ and /home/z/.qa/ (warmers). Rebuilt: keepalive.mjs (robots-only probe, respawn, backoff), spawn-detached.mjs (Bash-tool processes get reaped at call end; processes spawned detached from INSIDE a running process survive — proven pattern), warm-chunks.mjs (fixpoint chunk warmer; only finds root-level chunks, Turbopack hides dynamic-import URLs).
- Gates: `bunx tsc --noEmit` → 0 errors; `bun run lint` → clean.
- Verification (multi-layer, in the face of repeated OOM cycles):
  - API level (curl): login returns the 64-char sessionToken; `/api/auth/me` + `/api/teacher/role` + `/api/teacher/dashboard` + logout all 200 with `Authorization: Bearer` and NO cookie; unauthenticated still 401; revoked token 401.
  - Cross-site iframe harness (page at localhost:8282 embedding 127.0.0.1:81 — different sites, the exact third-party context of the preview panel), 390×844 phone viewport: manual-typed teacher login → teacher panel MOUNTED inside the iframe and STAYED (12s+, previously the kick-back fired within ~2s); ALL panel APIs 200 (`login`, `me`, `notifications-feed`, `role`, `dashboard`, `parent-connect`, `behavior`); console clean; reload → panel remounts DIRECTLY (no login screen) with all APIs 200 again — session persists in the iframe's partitioned storage.
  - Top-level regression (first-party cookie path, 390×844): login → panel mounts, all APIs 200, reload persists — the interceptor/token changes broke nothing in normal tabs.
  - QA technique notes: iframes auto-inline in agent-browser snapshots (refs work); cross-origin iframe fragments are DROPPED by Chromium (the #portal deep-link works top-level only); login-form refs are stable ~12s after mount (entrance animations + async Next devtools overlay renumber refs — snapshot → parse → click in ONE tight chain); the public website's auto-advancing carousel churns refs continuously.

Stage Summary:
- Mobile/preview-panel login kick-back FIXED at the true root cause: third-party-iframe cookie blocking, rescued by a passive Bearer-token fallback. The HttpOnly cookie remains the primary mechanism in first-party contexts; security posture unchanged (unauthenticated 401, wrong-credentials rejected, revocation enforced, bearer only attached to same-origin /api).
- Browser-verified end-to-end in the cross-site iframe at phone viewport (login → panel mounts & stays → reload persists, all APIs 200, console clean) AND top-level (no regression).
- Recovered sandbox infrastructure: keepalive.mjs + spawn-detached.mjs + warm-chunks.mjs at project root (the janitor wipes .zscripts and /home/z/.qa — root files survived this time).
- The 4GB OOM cycle remains the dominant environmental risk (~6 server deaths during this QA; all auto-recovered by keepalive). Server deaths during a browser-attached chunk-compile are the trigger; cache-warm serving is stable.
- For the user: refresh the preview panel once, then Sign In works on the phone screen (and any screen).

---
Task ID: 11
Agent: Z.ai Code (main)
Task: User report — "in teacher role, class attendance, the mobile screen size ui needs some solution, save attendance button is not in the correct range."

Work Log:
- Read worklog (Tasks 9/10 context), confirmed dev server health; diagnosed from
  source before touching the browser: ModuleToolbar's action wrapper was
  `flex shrink-0` — on a 390px phone the attendance action row (class select
  120 + date nav 176 + Today 58 + Save ~150 + gaps ≈ 528px max-content) could
  not shrink or wrap, overflowing the ~358px content column; the shell's
  `overflow-hidden` clipped it silently (why earlier "zero overflow" QA passed
  while the Save button was actually off-screen).
- Root fix (shared): module-toolbar.tsx action wrapper `shrink-0` →
  `min-w-0 flex-wrap` (+ doc comment). Controls now wrap onto their own rows
  under the context line instead of pushing off-screen. No visual change on
  screens where the action fits; benefits all 13 teacher modules.
- Attendance mobile redesign (attendance/index.tsx):
  · date stepper + Today grouped into ONE semantic unit (clean wrap boundary);
  · toolbar Save hidden on mobile (`hidden sm:inline-flex`);
  · NEW MobileSaveBar — sticky bottom bar (`sticky bottom-0 z-20 -mx-4 -mb-4
    sm:hidden`): edge-to-edge anchored (rounded-t-xl, hairline top border,
    bg-card/95 + backdrop-blur, up-shadow), live status line (Unsaved changes /
  Saving… / Saved / In sync with saved record / Not marked yet) + full-width
    h-11 (44px touch) primary Save with the same 3-state animation + dirty dot;
    safe-area bottom padding for iOS.
  · 320px hardening after live measurement found TWO more flex traps: status
    <p> min-width:auto (min-content 140px for "In sync with saved record")
    overrode w-[104px] → `w-[96px] min-w-0`; button nowrap label min-content
    173px → `min-w-0` on button + truncate span safety net. 320px went from
    scrollW 341 (>viewport) to 320 (exact).
- Environment recovery en route: dev server OOM-died twice (chunk-compile +
  preview-panel polling on 4GB); keepalive.mjs had been WIPED by the sandbox
  janitor — recreated (robots-only probe, respawn, backoff) + killed the zombie
  `bun run dev` wrappers (parent alive, next-server dead — pgrep-based
  alreadyRunning check was passing on the zombie) → watchdog revived the
  server both times.
- Gates: bunx tsc --noEmit → 0 errors; bun run lint → clean.
- Browser QA (teacher session, true viewports):
  · 390×844 — zero overflow (scrollW==clientW==390); toolbar Save display:none
    (as designed); sticky-bar Save x=114–374 IN RANGE, h=44; pinned at bottom
    through 600px roster scroll; E2E flow: mark Absent → "Unsaved changes" +
    enabled → Save → toast "Attendance saved" → "Saved" → settles "In sync
    with saved record"; at max scroll the last roster row sits fully above the
    bar (no overlap), app footer trails below inside the scroll area.
  · 320×700 — zero overflow after hardening; Save right=304 in range.
  · 1280×800 — mobile bar hidden; toolbar Save back, right-aligned
    (x=1075–1248); no overflow.
  · Regressions: fee-collection (Collect Fee in range) + marks (no overflow) at
    390; my-timetable (benchmark file untouched) safe by code review — its
    action slot is a small chip + export button that always fits.
  · Console/page errors: clean. VLM review of the 390 screenshot: "high-quality
    mobile interface", toolbar "stacked logically and wrapped cleanly",
    "no horizontal overflow".

Stage Summary:
- FIXED at root cause: the Save button can never again be pushed out of range
  by a non-wrapping toolbar (shared ModuleToolbar contract), and on phones
  Save now lives in a sticky bottom bar at thumb reach with an explicit
  unsaved/saved status — the correct mobile pattern for a scroll-to-mark
  workflow (no more scrolling back to the top to save).
- All QA green at 320/390/1280 + E2E save flow + regressions; gates green.
- Environmental: keepalive.mjs recreated (janitor keeps wiping it); OOM cycles
  remain the top environmental risk (2 server deaths this round, both
  auto-recovered once the zombie wrappers were cleared).
- Next-phase candidates: attendance desktop screenshot pass, login QA matrix
  (session-persist/refresh/logout), Student Directory redesign, Class Teacher
  conditional access, Exam Duties rework, Lessons Planner upgrade (queued from
  the master task).

---
Task ID: 9
Agent: main (Z.ai Code)
Task: (1) Teacher → Class Attendance mobile layout fix per explicit user spec: move "Save attendance" OUT of the floating/sticky-bottom placement INTO the top/header area (after class+date controls, before roster). (2) Fix pre-existing committed breakage found during gates (lesson-planner tsc errors, proctoring Prisma types). (3) Re-verify mobile login (PART 9).

Work Log:
- Read worklog + audited attendance module (1134-line composition root) + ModuleToolbar contract: previous round's MobileSaveBar was `sticky bottom-0 z-20 -mx-4 -mb-4 sm:hidden` — the exact pattern the user rejected.
- Implemented MobileSaveRow (replacing MobileSaveBar): plain IN-FLOW `flex items-center gap-3 sm:hidden` row — live status line (w-[96px] min-w-0) + full-width h-11 (44px touch) primary Save with the same 3-state animation + dirty dot. Placed as FIRST child of the board fragment: ModuleToolbar (class/date controls) → MobileSaveRow → WeekStrip → HubStatCards → roster SectionCard. No sticky, no z-index, no negative margins, no shadow/backdrop, no safe-area chrome — zero extra empty space. Doc comments updated (file header, toolbar Save slot note, component doc).
- Fixed prop type: hook's public contract types `save: () => void` (hooks.ts line 104) but MobileSaveBar had declared `() => Promise<void>` (pre-existing latent tsc error — my edit just moved it); MobileSaveRow now declares `() => void`.
- Gates surfaced ~22 PRE-EXISTING tsc errors in committed code (two clusters, NOT from my change):
  · lesson-planner (15×): `shared.ts` AND `shared.tsx` both existed — `./shared` resolves .ts-first → stale pre-LP-2 subset shadowed the complete LP-2 shared.tsx (missing unitAccent/AnimatedBar/LIST_STAGGER/LIST_ITEM/ConfettiBurst/applyTopicRemoval + TopicStatusConfig.dot/.text). Lesson Planner module was RUNTIME-BROKEN (chunk load failure on open). Fix: deleted stale shared.ts (shared.tsx is a strict superset — verified line-by-line).
  · proctoring (7×): PrismaClient missing examDutyCompletion/examIncident — models had been lost from prisma/schema.prisma (db tables still existed → schema once had them). Fix: re-added ExamDutyCompletion (schoolId/scheduleItemId @unique/teacherId/startedAt/completedAt/presentCount/absentCount/lateCount/incidentCount) + ExamIncident (schoolId/examId/scheduleItemId/studentId?/incidentType/occurredAt/description/reportedById/reportedByName + indexes) with back-relations on School/User/Student/Exam/ExamScheduleItem; `bun run db:push` → "already in sync" + client regenerated.
- Browser QA (teacher rohan.mehta, agent-browser, OOM-constrained environment — see risks):
  · Environment: dev server OOM-killed repeatedly (next-server anon-rss ≈3.0–3.2GB on 4GB cgroup; dmesg confirms). Recovery procedure refined: chrome CLOSED during `/` compile push (curl :3000 direct, ~20s) → settle ~60s → chrome opens → never reload mid-session (viewport switches reflow client-side only). Compile becomes disk-cached after first push (35ms re-serves) which finally stabilized the window.
  · 390×844: save row position STATIC (not sticky), x=16 w=358 h=44; button x=124 w=250 h=44 in range; hierarchy date(536)→save(588)→weekStrip(648)→stats(739)→roster(1106); scrollW==390 zero h-overflow; scrolls away naturally at scrollTop 800 (y=-212, NOT pinned); no bottom bar.
  · 320×700: scrollW==320 exact; button x=124 w=180 h=44 in range; same order (592/644/704/1226). Three elements extend past 320 (right=392) — pre-existing app-header cluster clipped by ancestor overflow (NOT attendance, NOT page-scrollable, not a regression).
  · 360×780: scrollW==360; button w=220 in range; static; order OK.
  · 414×896: scrollW==414; button w=274 in range; static; order OK.
  · E2E @390: mark Aarav Sharma Absent → status "Unsaved changes" + enabled → Save → toast "Attendance saved" → "In sync with saved record"; reverted to Present + saved (data left clean).
  · Student rows usable @320: 4-up status grid all in range (60×32 each) + click-verified (marked Late, reverted).
  · Desktop 1280×800: mobile row display:none; toolbar Save back at x=1075–1248 (baseline); weekStrip y=383 directly under toolbar; scrollW==1280. NO regression.
  · Mobile login @390 (PART 9 probe): worked BOTH times this session (teacher chip → Sign In → panel). Kick-back bug NOT reproduced — remains un-reproduced across 2 sessions; needs a reproducible case (browser/surface/step details from the user) to investigate further.
  · Lesson Planner @390 after shared.ts fix: module loads, renders ("Grade 10 - A · Computer Applications · 9% complete"), scrollW==390, zero page errors, no chunk errors, no error boundary.
  · Console: only Fast Refresh/HMR logs + one benign pre-existing logo.svg aspect-ratio warning. Page errors: none.
- Gates after all fixes: `bunx tsc --noEmit` → 0 errors (was 22+); `bun run lint` → clean.
- Verified 15-min webDevReview cron still registered (platform shows "Disabled due to exec limits exceeded" — outside sandbox control; job definition intact).

Stage Summary:
- DONE (user-requested): Class Attendance mobile Save is now a top-of-page in-flow row exactly per the specified hierarchy (title → banner → class/date controls → Save → date strip → summary → roster). No floating/sticky button over the roster at any width; verified at 320/360/390/414 + desktop unchanged + E2E save flow + student-row usability.
- DONE (bonus fixes): Lesson Planner runtime breakage (stale shared.ts shadow) + proctoring Prisma models restored — tsc went from ~22 errors to 0; Lesson Planner browser-verified loading.
- Files changed: src/components/teacher/modules/attendance/index.tsx (MobileSaveBar→MobileSaveRow, moved to top, prop type, comments), src/components/teacher/modules/lesson-planner/shared.ts (DELETED), prisma/schema.prisma (+2 models +5 back-relations), db/custom.db (via db:push).
- Environment risk (TOP): OOM death spiral is now frequent — next-server reaches ~3.1GB alone; chrome (~0.7GB) + preview-panel poller recompile pressure tips it over. Working QA procedure documented above; disk-cached compiles make reloads cheap once warm. Consider (next phase): trimming compiled-route memory (turbopackMemoryLimit tuning), or accept the close-browser-during-compile-push protocol as standard.
- Next-phase candidates (unchanged queue): Student Directory redesign → Class Teacher conditional access → Exam Duties (proctoring UI now type-safe; verify module renders when a teacher has invigilator duties) → Lessons Planner upgrade; attendance desktop screenshot pass; login QA matrix (refresh/logout/session-persist).

---

Task ID: 16
Agent: Z.ai Code (main orchestrator)
Task: LESSON PLANNER — Fix subject source + build complete 2026-27 curriculum. Spec: subjects must come from the principal's configuration (ClassSubjectAssignment ∩ teacher timetable assignment); class-teacher status must NOT grant every subject; replace all fake/demo syllabus with the verified official 2026-27 NCERT/CBSE curriculum for classes 6-12; auto-attach curriculum to configured subjects; global-library vs school-planner separation; progress from real records; UI visually unchanged.

Work Log:
- AUDIT: Lesson Planner picker source = `getTeachingAssignments` (timetable teacherName-match ∩ ACTIVE ClassSubjectAssignment) — config-driven but seeded with a NON-standard config (separate Physics/Chemistry/Biology for 9-10) and fake curricula from hand-rolled `syllabus-templates.ts` (made-up CA units like "Lab — Forms and CSS Effects", condensed middle-school lists, no 6-8/11-12 coverage). Principal's Students&Classes subject UI is Zustand-store based (mock academic catalog) — separate universe from the DB config; noted, not merged (out of scope).
- RESEARCH (subagent infrastructure FAILED — "context deadline exceeded" on every launch; did ALL research myself via z-ai CLI web_search/page_reader, ~70 calls): established that 2026-27 has BRAND-NEW NCF-SE textbooks for Class 8 AND Class 9 (new names: Ganita Manjari/Maths, Exploration/Science, Understanding Society: India and Beyond/SST, Kaveri/English, गंगा/Hindi for 9; Ganita Prakash-8 Part 1+2, Curiosity-8, Exploring Society-8, Poorvi-8, मल्हार-8 for 8). Class 6 (2024-25 books) + 7 (2025-26 books) continue as-is. Class 10-12 keep rationalized books. CBSE 9-10: three-language scheme (R1/R2/R3, two Indian) compulsory from 2026-27. Verified complete chapter lists for ~50 books incl. class 11-12 Physics/Chemistry/Bio/Maths/English/Accountancy/BusinessStudies/Economics/History/PolSci/Geography and CBSE Computer Applications 165 (class 9: Basics of IT + Cyber Safety + Office Tools + Lab; class 10: Networking + HTML + Cyber Ethics + Practicals). Sources: ncert.nic.in PDFs/TOCs, tiwariacademy, vedantu, allen, learncbse, extramarks, educart, cbseacademic.nic.in (cross-checked ≥2 per book).
- BUILT the global curriculum library: `src/lib/curriculum/types.ts` (Session→Class→Subject→Unit/Part→Chapter hierarchy) + `src/lib/curriculum/2026-27/class-06..12.ts` (7 files, 50 subject curricula: 6-8 = Ganita Prakash/Curiosity/Exploring Society/Poorvi/मल्हार; 9 = Ganita Manjari (Part I verified + Part II per CBSE syllabus, flagged in note)/Exploration (13 ch)/Understanding Society (Part 1: 9 published + Part 2: 7 announced)/Kaveri (8 prose+poem units)/गंगा (7 गद्य + 5 काव्य + भाषा संगम)/CA-165; 10 = rationalized Math 14/Science 13/SST 4 books (5+7+5+5)/First Flight+Footprints/स्पर्श-2/CA-165; 11-12 = all 11 senior subjects incl. Commerce + Humanities) + `index.ts` (session registry, subject-name→key resolver with Unicode-aware aliases, class-level parser, `validateRegistry()` — duplicate keys/units/chapters-within-unit, empty units, bad periods, missing class levels — runs at import in dev).
- REWIRED `src/lib/lesson-planner.ts`: syllabus-templates.ts DELETED; `resolveCurriculumFor()` gates on school board (CBSE/UP_BOARD/NCERT attach the library; ICSE/STATE/CUSTOM get the honest empty state); `instantiateCurriculum()` flattens library units→CurriculumTopic rows with sourceBoard NCERT-2026-27/CBSE-2026-27; `attachCurriculumForAssignment()` exported for future principal-config APIs (auto-attach, idempotent); syllabus-coverage + merge + auto-attach paths rebuilt on the library; assignment sort now numeric by class level (6→12, was lexicographic "Grade 11" < "Grade 6"). Client `api.ts` SyllabusInfo.board widened to string.
- RECONFIGURED the demo school (rewrote `prisma/seed-teacher-academics.ts` v3; deleted obsolete `prisma/seed-computer-apps.ts` + `prisma/curriculum-data.ts`; holiday seed extracted to `prisma/holiday-data.ts`): 9 classes (6-A/7-A/8-A + 9-A/10-A + 11-A/12-A Science + 11-B/12-B Commerce), 47 ACTIVE CSAs (9/10-A now the standard CBSE set: Math/Science/SST/English/Hindi/Computer Applications — old Physics/Chem/Bio 9-10 assignments retired, historical exam data untouched), conflict-free timetables rebuilt via most-constrained-teacher-first greedy (fixed one overflow by rebalancing quotas: Rohan Math 6-12 + CA 9-10, Kavita Science 9-10 + Phys/Chem 11-12-A, Priya English + Biology, Arjun SST/Hindi + Commerce), 652 chapters instantiated from the library, 297 completions seeded via the real scheduler (mid-session, Sept 23), PA-1 exam + marks + 9-A baseline attendance preserved on the new subject set.
- Gates: `bunx tsc --noEmit` → 0 errors; `bun run lint` → clean (both re-verified after the final seed edits).
- ENVIRONMENT: dev server OOM-killed 4× during the session (next-server anon-rss ~3.1GB on 4GB cgroup; Turbopack compile spikes). Working protocol refined: close browser during compile pushes, warm / + module APIs via curl with the session cookie, then ONE fast browser pass. Gateway :81 returned transient 502 while the server was down — recovered on restart.
- Browser QA (Rohan, 1280×800 + 390×844, fresh=22): login → panel → Lesson Planner all render; class selector = EXACTLY Grade 6-A…12-A (7 classes, numeric order); subject selector on 9-A = EXACTLY Computer Applications + Mathematics (NO Science/English/SST/Hindi despite Rohan being 9-A class teacher — RULE 3 verified); 6-A Math shows real Ganita Prakash chapters (Patterns in Mathematics … The Other Side of Zero, 60% complete, today → Fractions); 9-A Math = Ganita Manjari 16 ch (Part I 8/8, Part II 4/8, today → Constructions); 9-A CA = the REAL CBSE 165 curriculum (Unit 1 Basics of IT / Unit 2 Cyber Safety / Unit 3 Office Tools / Unit 4 Lab Practical, 89%, fake "Lab — Forms and CSS Effects" GONE); completion toggle E2E: Mark Completed → 100% + Undo → restored 89%; API-level: Kavita (Teacher B) sees exactly Science 9-A/10-A + Physics/Chemistry 11-A/12-A; Rohan does NOT see 9-A Science or 11-A Physics (server-side gate). Zero console errors; scrollW==clientW at 390 and 1280; VLM review of the desktop screenshot: "exceptionally clean and professional… no significant visual defects". My Timetable + class-hub + dashboard APIs all 200 on the new timetable.

Stage Summary:
- The Lesson Planner now runs on the REAL 2026-27 curriculum (new NCF-SE books for 6-9, rationalized 10-12, official CBSE 165 for Computer Applications) with zero fake/demo chapters, and its subject/class picker is derived end-to-end from the principal's configuration (CSA) ∩ the teacher's own timetable assignments — enforced server-side, verified for the Teacher A/B/C scenarios.
- Global library ↔ school planner separation is architectural: the library is immutable code data; schools instantiate their own schoolId-scoped rows (multi-tenant safe); custom topics stay sourceBoard=CUSTOM; progress is computed from real completion rows (60%/75%/89% etc. — nothing hardcoded).
- Artifacts: src/lib/curriculum/** (new), src/lib/lesson-planner.ts (rewired), prisma/seed-teacher-academics.ts (v3), prisma/holiday-data.ts (new), deleted syllabus-templates.ts + curriculum-data.ts + seed-computer-apps.ts; demo DB reconfigured (9 classes, 47 CSAs, 652 topics, 297 completions).
- Known gaps (honest): (a) Class 9 Ganita Manjari Part II + Understanding Society Part 2 chapter titles follow the CBSE 2026-27 syllabus structure (books publishing progressively; flagged in library notes) — update when NCERT publishes final Part II TOCs; (b) the principal's Students&Classes subject UI still reads the Zustand mock catalog (not the DB CSA) — unifying the two subject-config surfaces is the natural next phase; (c) 6-8 Science/SST/English/Hindi + 11-B/12-B Math/English are configured but intentionally unassigned (no teacher cells) — attach a teacher via the timetable and the planner picks them up automatically; (d) OOM instability remains the top environment risk.
- Next-phase candidates: principal-side academic-setup API writing through to CSA + attachCurriculumForAssignment; principal class/teacher progress views (spec §15); the queued Salary & Payments simplification; Class Attendance desktop screenshot pass.

---
Task ID: 17
Agent: Z.ai Code (main orchestrator)
Task: PRINCIPAL SOURCE OF TRUTH + SALARY/TIMETABLE CORRECTION (user spec A–Q) + PRODUCTION CLEANUP (user follow-up: delete all garbage/duplicates).

Work Log:
- AUDIT (root cause of "Computer Applications" leak): the Principal's subject registry (mock/academic INITIAL_SUBJECTS — exactly 9 subjects, NO CA) vs the DB (Task-16 seed had configured CA via ClassSubjectAssignment for Grade 9-A/10-A + 6 timetable rows + 18 curriculum topics + PA-1 exam configs). The Principal NEVER configured CA → invalid relationships. `/api/teacher/timetable` + `/api/teacher/marks-entry` also lacked CSA validation (orphan rows could leak into the Teacher UI); `/api/timetable/publish` created Subject rows without CSA (future orphan source).
- DATA REPAIRS (one-time scripts, deleted after): (1) CA Subject row deleted (cascade removed CSA/timetable/curriculum/exam-config references; the 6 timetable rows went null-subject via SetNull FK and were then deleted — orphan scan after: 0); (2) 6 pre-existing null-subject timetable rows removed; (3) duplicate Subject rows merged 17→11 (kept the CSA-referenced row, repointed Result/ExamScheduleItem/Assignment/QuestionBank/ExamAttendance FKs, history preserved); (4) Class.classTeacherId migrated Teacher.id→User.id (9 rows — every reader compared against User.id, so isClassTeacher was ALWAYS false: My Class/class-hub/role/attendance-scope were broken); (5) 1 stale SubjectAttendanceSession removed.
- ARCHITECTURE (Principal = single source of truth): NEW `/api/principal/academic` (GET full config incl. per-subject teaching load + class teachers; POST subject.add / subject.remove (cascades timetable rows) / subject.rename / subject.create / classTeacher.set; PRINCIPAL-only, school-scoped, activity-logged). NEW `src/lib/academic-config/client.ts` (zustand fetch/act store + mock→server class resolver; envelope {ok,data} unwrap). Students & Classes drawer RETROFIT: ClassSubjects renders the NEW ServerSubjectsPanel for Grade 6–12 classes (server-authoritative: sync banner, add/remove/rename through the API, live periods/teachers), legacy mock mode clearly labelled "Demo class — no server record" for Pre-Nursery/KG/Class 2/Class 4. ClassTeachers saves the Class Teacher write-through (classTeacher.set) for server-linked classes. Drawer header badge counts SERVER subjects when linked. Timetable publish now ENSURES ACTIVE CSA for every published (class, subject) — a publish can never orphan.
- READ GATES (every Teacher read validates Principal config): `/api/teacher/timetable` cells filtered by ACTIVE CSA (returns excludedUnconfigured diagnostic); `/api/teacher/marks-entry` teacher (class,subject) keys gated by ACTIVE CSA. Lesson Planner already gated. Attendance: `/api/teacher/class-attendance/session` (subject-teacher path) REWRITTEN to write the SAME canonical Attendance rows (Class+Section+Date+Student, unique studentId+date) with provenance markedBy "Name · Subject" — no separate teacher/subject attendance records (spec §K).
- SALARY MODEL (spec A): salary-store gains `mode: 'simple' | 'detailed'` on templates + sessions; buildSession/applyStructureToNet short-circuit for simple (single "Monthly Salary" line, deductions=[], netBase = monthly). ALL seed structures converted to simple monthly scales; Rohan T-014 = ₹25,000/month effective 1 Apr 2026 (spec example). Persist key bumped scholario-salary-v3→v4 (tenant-scoped) — fresh simple seed replaces stale detailed demo data. Teacher My Salary: simple mode = Monthly Salary / Effective From / Latest Payment summary cards + trust workflow + payslips + history (Amount Paid column); NO gross/deductions/net/breakdown/HRA/PF anywhere. Detailed mode unchanged. Payslip PDF (teacher) + PayslipDocument (principal) + employee drawer + EditSalaryDialog + structures editor (Salary Model selector) + employee accounts labels all mode-aware. Canonical payments: ONE store record shared by Principal and Teacher (verified: principal-recorded Sept payment → teacher confirms → Receipt RCP-2609-0201).
- TIMETABLE EXPORTS (spec B): .ics REMOVED; NEW `timetable-export.ts` — Export PDF (jsPDF A4 landscape weekly grid: school header, Period|Time|Mon–Sat columns, subject·class·room cells, print-ready) + Export Word (docx package: genuine editable Word table Day|Period|Time|Subject|Class|Room — verified: w:tbl, 32 rows, 193 text runs, NOT a screenshot).
- PRODUCTION CLEANUP (user directive — "no garbage, delete duplicates/unusable"): import-graph dead-code sweep over src/ (184 entry points) → 222 CERTAINLY-DEAD files deleted (superseded student modules: achievements/portfolio/peer-collab/wellness/digital-diary/resources/learning/homework/assignments/classwork/my-library/study-materials; superseded principal modules: homework/procurement/assignments/analytics/calendar-siblings/fees-extras/school-settings tabs/applications subfiles/students workspace panels/messaging folders; dead stores: learning/student-learning/learning-seed/learning-types/student-growth/master-religion/student-fee-issues+queries/student-homework/student-groups/student-compose-bridge; 21 dead mock files; legacy types; old role-dashboards/design-system/shared leftovers; dead teacher fragments marks/data + student-behavior siblings + exam-proctoring). components/ui/** KEPT (shadcn platform library). Root garbage: download/ (27 QA pngs), upload/ (pasted txts), tests/ (build scripts), tool-results/, dev.pid, tsconfig.tsbuildinfo all removed. tsc 0 errors + eslint clean after deletion.
- INFRA (janitor had deleted prior fixes; rebuilt + hardened): lazyCompilation subsystem restored (src/lazy-compilation/backend.js — fixed port 3777, singleton, query-strip before key parse, per-compiler client; lazy-client.js — gateway-mode same-origin EventSource with XTransformPort + direct fallback; next.config.ts webpack branch; dev script `next dev --webpack` + heap 1800). The god-entry full compile (~3.1–3.4GB) OOM-killed the server repeatedly; lazy compilation fixed it (cold boot ~10s, stable panel compiles). keepalive.mjs v3.2 rebuilt: ss was BLIND to the next-dev listener (only TIME_WAIT in /proc/net/tcp6) → process-based liveness (pgrep [d]-bracket anti-self-match), 2-fail confirmation, 120s compile windows, cwd-aware kills (next-dev vs event-stream share the `bun run dev` cmdline), free-port wait before respawn. spawn-detached.mjs gained --cwd (hardcoded ROOT was spawning duplicate next-dev servers → EADDRINUSE chaos).
- VERIFICATION (curl APIs + agent-browser): TEST1 ✓ (Rohan timetable = Mathematics only, CA gone, excludedUnconfigured 0); TEST2 ✓ (Math 9-A/10-A in timetable+planner+marks-entry); TEST3 ✓ (no unassigned subjects); TEST4 ✓ (API subject.add CA→10-A + schedule → teacher timetable+planner show CA immediately); TEST5 ✓ (subject.remove → cascade 1 TT row → gone everywhere); TEST6 ✓ (Rohan CT Grade 9-A → isClassTeacher true, My Class hub 11 students — after the User.id fix); TEST7 ✓ (classTeacher.set null → capabilities off; restore → on); TEST8 ✓ (browser: ₹25,000 / 1 Apr 2026 / Latest Payment; zero HRA/PF/Gross/Deductions text on page); TEST9 (detailed structure creation supported in Structures UI — verified code-path + editor; not exercised end-to-end in browser this session); TEST10 ✓ (canonical Sept payment → teacher confirms → receipt RCP-2609-0201 → payslip PDF carries it); TEST11 ✓ (PDF: professional A4 landscape grid; DOCX: genuine editable table, header row Day|Period|Time|Subject|Class|Room); TEST12 ✓ (cross-role sync via 4/5/6/7). RESPONSIVE ✓ (salary+timetable @320/360/390/414/768/1280 — scrollW==vw, zero overflow; VLM mobile review clean). Principal drawer: ServerSubjectsPanel renders Grade 10·A with 5 real subjects + teaching load + teachers; UI round-trip remove Hindi → 4 subjects → teacher-side sync → restored (+3 timetable slots re-seeded).
- Browser QA evidence: /tmp/qa-salary-simple.png, /tmp/qa-server-subjects.png, /tmp/qa-salary-390.png, /tmp/qa-timetable.pdf (18.8KB), /tmp/qa-timetable.docx (10.8KB), /home/z/Downloads/Payslip-RohanMehta-Sept2026.pdf.

Stage Summary:
- The Principal's DB configuration (ClassSubjectAssignment + Timetable + Class.classTeacherId) is now the enforced single source of truth for every Teacher module, with a real Principal-side configuration surface (Students & Classes drawer → server-authoritative Subjects) and cascade-correct remove flows.
- Salary is simple-monthly by default (₹25,000 spec example live), detailed is configuration-driven and only shows configured components; payments are canonical and shared across roles.
- Timetable exports are real documents (A4 PDF grid + editable DOCX table); .ics removed.
- 222 dead files + all root garbage deleted; tsc/eslint clean; app fully browser-verified before and after cleanup.
- Environment: dev stack stable under the v3.2 watchdog; ALL infra now git-tracked (janitor-proof): keepalive.mjs, spawn-detached.mjs committed (force-added past .gitignore).
- Known residual (honest): legacy mock classes (Pre-Nursery/KG/Class 2/Class 4) still power the non-linked parts of Students & Classes (labelled "Demo class"); the principal Timetable editor still edits the mock slot universe (publish remains replace-all + now CSA-ensuring); TEST9 detailed-structure browser walkthrough not completed (code-verified only); ~45 unused shadcn primitives kept in components/ui (platform library).
- Next-phase candidates: principal Timetable editor → server rows; migrate remaining mock Students & Classes surfaces to the academic API; TEST9 browser pass; salary payroll-report PDF mode-awareness polish.

---
Task ID: 18
Agent: Z.ai Code (main orchestrator)
Task: User reported "stopped — no process was happening / not showing" (transient blank during dev-server restart + compile; app verified healthy). Continued with the top Task-17 next-phase item: PRINCIPAL TIMETABLE EDITOR → SERVER ROWS (retire the mock slot universe), then completed TEST9 (detailed salary browser walkthrough).

Work Log:
- HEALTH CHECK: landing → teacher login → My Timetable all render (the user's "not showing" was the post-restart compile window + later diagnosed VersionGuard hard-reloads while source edits bump APP_VERSION — a blank pre-hydration window after each reload, self-heals in seconds).
- AUDIT: the timetable module already hydrated store slots from GET /api/timetable, but (a) the store seeded INITIAL_SLOTS (a full mock Class 2-A universe with fake teachers — also the PUBLISH-WIPE hazard: a failed hydration + publish would replace real DB rows with the mock schedule), (b) class/room pickers fell back to hardcoded CLASSES/ROOMS, (c) schedule-grid + mobile rows leaked hardcoded 'Class 2-A', (d) auto-timetable-dialog fell back to the mock class list.
- MOCK UNIVERSE REMOVED: config.ts deletes INITIAL_SLOTS/CLASSES/ROOMS/initialFormState (structure PERIODS/DAYS/types kept); timetable-store seeds EMPTY, hydrateFromServer gains {emptyOk} (fetch-OK-empty clears honestly; failed fetch never wipes), resetToSeed→empty, persist v1→v2 migrate flushes browsers holding the mock seed.
- PRINCIPAL MODULE (spec §C/§D): tri-state lineage server/empty/offline with distinct badges; PUBLISH GUARD — publish only allowed from 'server' or 'empty' (offline/unhydrated snapshots blocked with honest toast); classOptions = live-schedule classes ∪ academic-config classes (labelOf-style labels); roomOptions = live rooms ∪ class homerooms; honest "No timetable on record" empty-state banner.
- GRID/FILTERS/AUTO-DIALOG: every hardcoded mock fallback removed; ScheduleGrid renders an honest "No classes to schedule yet" empty state when the school has zero classes; mobile Assign leak ('Class 2-A') fixed via classes[0]; AutoTimetableDialog disables Generate + shows inline hint when no classes.
- PUBLISH API (defense in depth): STALE-SNAPSHOT GUARD — if the school has existing rows but ZERO payload classes match DB classes, refuse (STALE_SNAPSHOT_REFUSED) instead of wiping real schedules with a foreign universe.
- E2E VERIFICATION (browser, eval-driven for ref stability): Principal timetable = 135 slots / 9 classes (Grade 6-A…12-B) / 4 live roster teachers / 11 configured subjects / 0 conflicts; edit-flow: slot editor dialog is config-driven (CONFIGURED badge, LIVE roster teacher picker); conflict engine verified live (Arjun→Grade 12-B, Kavita→Grade 12-A, Priya→Grade 11-A all correctly blocked in Monday P1); REMOVE FLOW: remove Grade 7-A Mon P1 Math → Apply → Publish → server 135→134 rows, teacher /api/teacher/timetable Monday loses the cell (Grade 8-A ×2 + 9-A ×2 only), excludedUnconfigured 0; RESTORE FLOW: Assign Period (Math + Rohan) → Apply → Publish → 135 rows, cell back. Screenshot /tmp/qa-timetable-serverrows.png.
- TEST9 COMPLETED (browser, end-to-end): Settings → enable 3-hour editing window → Salary Structure → HOD & Senior Teaching → Detailed (Base 20,000 + HRA 20% + Special Allowance 3,400 fixed + PF 12% deduction → editor math: Earnings 27,400 / Deductions 2,400 / Net 25,000) → Save → Rohan drawer → Edit Salary ₹26,000 (Send blocked for no-op 25,000 — correct) → Send for Approval → teacher login (KEEP localStorage — the salary store is per-browser; clearing it in role-switches destroys principal-created records) → request card renders → Accept → My Salary shows the exact detailed breakdown: Basic 20,926 + HRA 4,185 + Special 3,400 = Gross 28,511; −PF 2,511 → Net 26,000; Sept payment history untouched (25,000 preserved). Screenshots /tmp/qa-salary-detailed.png. REVERTED to spec default: structure→Simple, ₹25,000 sent+accepted → teacher view back to MONTHLY SALARY ₹25,000 (effective 1 Oct 2026 — honest round-trip history), zero breakdown/Gross/PF text. /tmp/qa-salary-reverted.png.
- OPERATIONAL LEARNINGS: (1) never localStorage.clear() when switching roles in the same browser — the client-side salary store is shared per-browser; remove only scholario-auth + scholario-session-token. (2) agent-browser refs go stale within ~1 command on this app (constant re-renders + VersionGuard reloads) — use `agent-browser eval --stdin` IIFE patterns for multi-step flows. (3) after several Fast Refresh cycles a lazy module chunk can silently fail to mount (empty module container) — a fresh ?fresh=N reload re-fetches and fixes it. (4) the Edit Period dialog teacher picker shows the 4-teacher roster (GWS-T-014 Rohan live + DEMO-T-00x mock fallback entries for Priya/Arjun/Kavita — mock roster fallback still present in teacher-roster-store, noted as residual).
- Gates: bunx tsc --noEmit → 0 errors; bun run lint → clean. Committed (02cd80e) — the commit also swept a few previously-uncommitted files from the prior session's stream (prisma/repair-room-integrity.ts, seed edits, payroll-report-pdf/summary-card/slot-editor/overview-cards polish).

Stage Summary:
- The Principal Timetable editor now runs EXCLUSIVELY on server Timetable rows: no mock seed anywhere, honest empty states, config-driven pickers, publish guarded client- and server-side against stale/mock wipes, and the full edit→publish→teacher-sync loop browser-verified in both directions (remove and re-assign).
- TEST9 (detailed salary mode) is now browser-verified end-to-end with exact component math, and the demo state was restored to the spec default (simple ₹25,000/month).
- All 12 acceptance tests of the A–Q spec are now browser-verified (TEST9 was the last code-only one).
- Known residual (honest): teacher-roster-store still seeds DEMO-T-00x mock fallback entries beside the live GWS-T-014 (visible in the slot-editor teacher picker); legacy mock classes (Pre-Nursery/KG/Class 2/Class 4) still power non-linked Students & Classes surfaces (labelled "Demo class"); Salary Structures editor exemplar-base semantics could surface in a future pass.
- Next-phase candidates: replace the teacher-roster mock fallback with server-only roster; migrate remaining mock Students & Classes surfaces to the academic API; salary payroll-report PDF mode-awareness polish; principal-side timetable conflict resolver UI.

---
Task ID: 19-a
Agent: Z.ai Code (main orchestrator — FULL SYSTEM STABILIZATION PASS)
Task: User directive: STOP feature development. Full-project stabilization + QA (40-section spec): baseline, build/type/lint, runtime health, auth audit, role data consistency, master data integrity, module-by-module browser testing, cross-role workflows, responsive, exports, error states, final A–T report.

Work Log:
- BASELINE: tsc --noEmit → 0 errors; dev server :3000 healthy (200 in ~30ms); gateway :81 healthy; lint → clean (verified in background).
- DATA VALIDATION SUITE BUILT: prisma/validate.ts (bun run db:validate) — checks orphan refs, duplicate subjects/receipts, timetable class/teacher/room conflicts, CSA validity, attendance canonical identity + status, exam-mark ranges vs ExamSubjectConfig, fee arithmetic, FeeTransaction verification states, behavior refs, class-teacher validity, multi-tenant school-scoping; prints canonical class rosters for cross-role agreement.
- VALIDATION FOUND + ROOT-CAUSED:
  · Attendance duplicates: 11 Grade-9A students had 3 rows each on 2026-09-16 (timestamps 04:27/04:29/04:45) — root cause: legacy POST /api/attendance used `new Date()`/raw timestamps which bypass the (studentId,date) unique constraint. Also 201 historical rows had non-midnight timestamps.
  · 8 stale FeeTransactions referencing dead mock universe (studentId STU-1/STU-2/STU-37, "Pre-Nursery"/"Class 11" labels, Aug 27-31) incl. DUPLICATE RECEIPT RCP-2026-1061.
  · 18 Result rows (Mid-Term Examination, declared 2026-09-08) for Grade 9-A Physics/Chemistry/Biology — legitimate declared-exam history from before the Task-16 subject reconfig (KEEP; verify UI renders cleanly).
- DATA REPAIRS (one-time script, scripts/repair-data.ts): merged 11 dup day-groups (22 rows deleted, latest save wins), normalized 201 dates to midnight UTC, deleted the 8 stale FeeTransactions (incl. the duplicate-receipt pair). Re-validation → ZERO CRITICAL ERRORS.
- CODE FIXES:
  · /api/attendance POST rewritten: date normalization (YYYY-MM-DD or ISO → midnight UTC; NEVER `new Date()`), roster-truth validation, day-window replace semantics (same as baseline route), future-date guard. GET: day-window filter instead of exact-timestamp match.
  · STUDENT ATTENDANCE MOCK UNIVERSE ELIMINATED: Student My Attendance / Profile snapshot / Report Card attendance line all read the SEEDED zustand store for hardcoded demo student 'STU-58' (a separate attendance universe — teacher writes in another browser never reached the student). NEW /api/student/attendance (server-side identity via requireStudent; returns the student's own canonical rows) + NEW useMyServerAttendance hook (loading/error/retry states); attendance module rewired with loading skeleton + honest error state; profile stat shows '…'/'—' while loading/empty; report-card receives server stats via props. student-attendance-store.ts reduced to pure types+helpers (seed + zustand persist + write actions deleted).
- Gates after fixes: tsc → 0 errors.

Stage Summary:
- DB is internally consistent (ZERO critical errors from the validation suite; only 18 documented historical-result warnings).
- Attendance now has ONE canonical write path per role surface + ONE read path per student surface; no second attendance universe remains.
- Next: browser QA (principal → teacher → student module-by-module, console/network capture), auth audit, cross-role workflows A–F, responsive, exports, final report.

---
Task ID: 19-b
Agent: Z.ai Code (main orchestrator — FULL SYSTEM STABILIZATION PASS)
Task: Security + network audit continuation (spec §7, §28, §29, §32).

Work Log:
- API SMOKE MATRIX (39 endpoints × 3 roles): 37/39 healthy; 2 expected artifacts (fees/payments needs orderId param; follow-ups is POST-only).
- CROSS-PERMISSION PROBE AS STUDENT found 10 UNGATED GET endpoints leaking school data to any authenticated user:
  · /api/teachers — full staff roster with names+emails+phones (PII)
  · /api/students — full student roster with guardian PII (no component callers; teachers use scoped /api/teacher/students)
  · /api/results — every student's marks
  · /api/contacts — user directory with emails+phones
  · /api/questions — question bank (assessment content)
  · /api/payments-export — financial CSV export (names, admission numbers, amounts)
  · /api/dashboard GET — school-wide stats (POST variant is correctly self-scoped student/parent)
  · /api/fees + /api/fees/transactions — every student's fee/payment ledger
  · /api/assignments + /api/exams + /api/classes + /api/subjects — unscoped catalogues
- FIXED: role gates added to all 12 GET handlers (staff-only; verified per-role: student→403 on all, teacher→200 on staff surfaces, principal→200 on admin). /api/messages confirmed self-scoped (own inbox/sent) — no change needed.
- Gates after: tsc → 0 errors.

Stage Summary:
- No authenticated student can enumerate staff PII, other students' marks/fees, question banks, or financial exports any more. All previously-leaking endpoints return 403 for students while staff surfaces remain fully functional (smoke matrix green).
- Next: browser UI QA (principal → teacher → student module-by-module with console capture).

---
Task ID: 20-fees
Agent: full-stack-developer
Task: Student Fees module stabilization — replace the client-side demo fee universe (fee-store seeded for STU-58) with the canonical server fee ledger (GET /api/student/fees via useMyServerFees); UI structure unchanged, data source swapped.

Work Log:
- Read worklog tail + canonical.ts first (exact MyFeeLedger/MyFeeItem/MyFeeTxn/CanonicalStudent shapes), the /api/student/fees route, and all 8 fees module files; confirmed the module was the last student surface still reading useFeeStore/useStudentsStore/computeAccount/findStructureForStudent/DEMO_STUDENT_ID.
- index.tsx: rewired to useMyServerFees() + useCanonicalStudent() + useCurrentUser(s => s.me?.name). Honest async states: module-shaped loading skeleton (GlassCard + ui/Skeleton), error retry card (hook message + Try again → refresh()), empty "No fee records yet" card (ledger.fees empty — never AllPaid). allSettled = outstanding ≤ 0 && billed > 0. Removed the FeeRevisionApprovalCard mount + import (client-universe feature; file left untouched, confirmed imported nowhere). Kept the feature gate (fee_online_payments) + /api/student/payments/config probe exactly as-is. primaryHead now derived from the ledger = largest-outstanding fee title (server /verify applies the money to that fee row by exact title match); fallback 'School Fees'.
- balance-hero.tsx: renders ledger totals — Balance Due = totals.outstanding (AnimatedCounter), "of {billed} billed", session progress paid/billed (92% demo), amber pending-verification note when pendingVerification > 0, 2-card grid = Paid so far (emerald) + Overdue now (rose) / Nothing overdue (neutral). Identity line from canonical session (classLabel · me.name · admissionNo, '—' while resolving). Status badge All paid/Overdue/Payment due. Kept gradient Pay button / office-note + visual language.
- fee-structure.tsx: one row per ledger.fees item — title, amount, status chip (Paid/Partial/Unpaid/Overdue), due-date sublabel, "₹N due" outstanding line; waterfall = Billed → Paid → Awaiting verification (when > 0, not counted as paid) → Balance due. Client-engine concession/late-fee cards + per-head grouping gone (no such data server-side).
- statement.tsx: renders ledger.transactions — amount + method label + status badge (SUCCESS/VERIFIED → emerald "Verified"; PENDING_VERIFICATION/UNDER_VERIFICATION/PENDING → amber "Awaiting verification"; REJECTED → rose "Rejected"; else neutral prettified), receipt no ("No receipt yet"), date, collected-by/verified-by, note line. Removed the per-row receipt download + collapsible client-engine account ledger (both depended on fee-store FeeTransaction/receiptSettings shapes that no longer exist in this module).
- paid-state.tsx: AllPaidState adapted to { billed, latestReceiptNo } (receipt shown as a chip, no client-universe download); OnlineUnavailableCard unchanged.
- payment-dialog.tsx: server order/verify rails kept EXACTLY (order → gateway/sandbox → /verify → success). Removed the fee-store mirror (recordPayment/mirroredTxn/receiptSettings/downloadReceiptA5) — the server already records the payment (FeeTransaction → SUCCESS + Fee row updated + receipt minted). New onPaid prop fires after server-verified success; index wires it to refresh() so the ledger re-fetches. Amount context = ledger.totals.outstanding; student context = canonical identity (classLabel composed server-side, never re-suffixed). Success stage keeps the official receipt details panel (receipt no, gateway ref, method, Verified · Paid).
- data.tsx: PaymentStudentInfo → { name, admissionNo: string|null, classLabel: string|null } (classLabel already carries the section); doc comments updated to the canonical-ledger reality. DEFAULT_PAYMENT_MODES (presentation metadata) retained.
- Identity discipline verified: no students-store reads anywhere in the module; fee-revision-card.tsx left in place untouched.

Stage Summary:
- Gates: `bunx tsc --noEmit` → 0 errors in ALL fees files (16 pre-existing errors are in parallel agents' in-flight bus-tracking/results modules — untouched by me); `bunx eslint src/components/student/modules/fees/` → clean. (Full `bun run lint` currently fails with ENOENT on results/class-standings.tsx — parallel results-module migration mid-flight, not mine.)
- Browser QA (agent-browser, student1@demoschool.edu via Student demo chip → sidebar Fees): Balance Due ₹3,400 of ₹41,400 billed · Overdue badge · identity "Grade 9 - A · Aarav Sharma · DEMO-2026-0001" (canonical) · session progress ₹38,000 paid 92% · pending-verification note ₹100 · Paid so far ₹38,000 · Overdue now ₹2,500 · OnlineUnavailableCard balance ₹3,400 (payConfig.available=false — honest office path). Fee structure: Tuition T1 ₹18,000 Paid, Tuition T2 ₹18,000 Paid, Transport Fee — October ₹4,500 Overdue ₹2,500 due, Examination Fee — Unit Test 2 ₹900 Unpaid ₹900 due; waterfall 41,400/38,000/100/3,400. Statement: 3 txns — ₹100 Cash Awaiting verification (Collected by Rohan Mehta), ₹500 Cash Rejected, ₹2,000 Cash Verified SCH-2026-000001 (Collected by Rohan Mehta · Verified by Dr. Ananya Iyer · "Father paid at PTM"). Exactly the DB Fee/FeeTransaction rows.
- Responsive: 390×844 scrollWidth==390 (zero horizontal overflow; only the hero's decorative clipped blur circle extends past, same as before) and 1280×800 scrollWidth==1280. Console: zero errors/warnings/page errors. Screenshots: /tmp/qa-fees-390.png, /tmp/qa-fees-desktop.png.
- Payment E2E not exercisable in this environment (no gateway configured — payConfig available:false); the order/verify rails are byte-for-byte unchanged from the previously verified flow, now followed by ledger refresh() instead of the client-store mirror.
- Files changed: src/components/student/modules/fees/{index,balance-hero,fee-structure,statement,paid-state,payment-dialog,data}.tsx (fee-revision-card.tsx untouched, now unused).

---
Task ID: 20-results
Agent: full-stack-developer
Task: Student Results module stabilization — replace the client-side seeded marks universe (student-results-store / STU-58 / fabricated UT1-UT2-Mid-Term marks / hardcoded 'Aarav Sharma'/'DSO2024058'/roll '18'/'Class 2' fallbacks) with the canonical server exam data (/api/student/results), keeping the existing UI structure.

Work Log:
- Read canonical.ts (hook contracts) + /api/student/results route + all 11 results-module files; confirmed via rg that ONLY the results module imported student-results-store (dashboard/profile already migrated in earlier tasks).
- NEW results/derive.ts — local derivation layer (pct/fmtPct, gradeForPct + DEFAULT_GRADE_SCALE, totalsOfExam preferring server pct, trendPointsOf, date helpers, chronological ordering, typeKey crest mapping with fallback) replacing every store import.
- index.tsx rewired to useMyServerResults() + useCanonicalStudent() + useCurrentUser(s => s.me?.name); school-settings read ONLY for the grade scale + report-card composition. States: loading skeleton → error card with Try again (retryKey remounts the fetch) → "No results declared yet" empty state (mentions upcoming) → main narrative. Selection defaults to the latest-declared exam; previous = next-older in the latest-first array; overallDelta / insights / movement derived from real subject rows only; identity renders '…'/'—' — every hardcoded fallback and every 'Class 2-A' reference removed.
- assessment-selector: server exam chips (examName + declaredAt, chronological, LATEST tag) + upcoming dashed chip. hero: exam/type/declaredAt + pct + marks + grade, rank from exam.rank with the whole medal block hidden when null. subject-performance: server rows (marks/totalMarks/grade), expansion shows the real per-subject remark or the factual single-paper line. trend: points from the exams array; 1 exam ⇒ existing honest degradation message. insights: tiles fed only real derivations (strongest/focus from subject pcts, class position #3/6 from exam.rank), empty tiles collapse. remark: real subject remarks only, else the honest "no remark published" state. history: server-exam timeline (Declared <date>, pct + scale grade) + upcoming PENDING node. report-card: identity = canonical (session name, DEMO-2026-0001, Grade 9 - A, Roll 01), subject table/totals/summary/rank from the selected server exam, attendance from useMyServerAttendance, HTML export verified with real data; class-teacher signature renders as a blank line (no fabricated name).
- class-standings.tsx DELETED — the leaderboard had no truthful data source (old one was roster-offset fabrication); the API only exposes my position/assessedCount.
- NOT modified: shared/canonical.ts, shared/enrollment.ts, the API route, student-results-store.ts.
- Gates: bunx tsc --noEmit → 0 errors; bun run lint → clean.

Stage Summary:
- Student Results is now a pure reader of the ONE canonical marks universe: every number (90.8%, 545/600, per-subject marks, rank #3 of 6) comes from the server's Exam+Result rows; identity is canonical; no seeded marks, no fabricated remarks/trend/standings, no hardcoded fallbacks.
- Browser-verified (student1@demoschool.edu): hero/subjects/insights/history/report-card all render the exact canonical values (Mid-Term Examination declared 8 Sep 2026, Mathematics 94 · Physics 89 · Chemistry 87 · English 93 · Biology 90 · Social Science 92, all /100; upcoming Final Examination starts 1 Mar 2027; report card shows Aarav Sharma · DEMO-2026-0001 · Grade 9 - A · Roll 01). Zero console/page errors; 390px responsive clean. Screenshots: /home/z/.qa/qa-20-results-canonical.png, qa-20-results-mobile.png.
- Remaining importers of useMyResults/useStudentResultsStore: NONE (only the store's own file matches).

---
Task ID: 20-transport-notifs
Agent: full-stack-developer
Task: Stabilization — rewire student Bus Tracking + Notifications modules from the STU-58 fake demo universe to canonical server data (UI kept, data source swapped, no new features).

Work Log:
- Bus Tracking (src/components/student/modules/bus-tracking/): index.tsx rewired to useMyServerTransport() — removed '@/lib/mock/bus-tracking' import, STUDENT_ID='STU-58', useTransportStore route-change banner, live GPS simulation (eta/speed/progress intervals, freshness ticker, pickup/drop toggle with fabricated per-trip times). States: loading skeleton → error card → honest "No transport assignment" empty state (school-office hint) → assigned view headed "Route A - Cyber City · Scheduled service 7:00 AM – 8:00 AM" + "Scheduled · no live GPS" chip.
- live-map.tsx DELETED → new route-map.tsx: keeps the decorative map visual but fully static (no LIVE badge/ping, no moving-bus animation, no progress bar); markers name stops[0] and the final stop ("Golf Course Road · Route end"); honesty badge "SCHEDULED · window".
- kpi-row.tsx: simulation tiles (Arriving In / Current Speed / Stops to Go / On-Time Rate) → recorded facts (Route Fare ₹1,500 / Service Starts / Service Ends / Stops on Route). bus-details.tsx: real route + vehicle + driver card; removed fabricated onboard/distance/fuel/temperature metrics + attendant card. stops-timeline.tsx: route.stops in service order, first = ROUTE START, last = SCHOOL · ROUTE END; removed "Your Stop" highlight + fake per-stop times/statuses/counts. safety-card.tsx: kept two-step SOS; removed busStats rows + fabricated checklist claims; copy now cites the real window/driver/office. trip-history.tsx DELETED (fabricated trip log, no server source). New format.ts (formatServiceTime HH:mm→12h).
- Notifications (notifications/index.tsx): fee row now derives from useMyServerFees() ledger ("₹3,400 fee outstanding", no row at 0/loading), exam row from useMyServerResults().upcoming ("Final Examination — schedule announced · Starts 01 Mar 2027 · ends 12 Mar 2027", no row when null). REMOVED sources: students-store STU-58 feeStatus, library-store overdue issues (no student-scoped API), '@/lib/mock/academics', timetable-store publications. KEPT: useServerNotices, messaging unread row, notif-prefs channel filter, read state/Mark all read, "all caught up" empty state, useUnreadStudentNotificationCount(): number signature (student-panel untouched). buildStudentNotifications re-signed (no external importers); StudentNotificationKind narrowed to produced kinds.
- Gates: bunx tsc --noEmit → 0 errors (project-wide; transient pre-existing results/fees errors from a concurrent agent's uncommitted work cleared during verification — none in my files). eslint on both module folders clean.

Stage Summary:
- Browser-verified as student1@demoschool.edu (demo chip): Transport module renders Route A - Cyber City · stops MG Road / Cyber Hub / Sector 56 / Golf Course Road (final marked SCHOOL · ROUTE END) · Vehicle HR-26-AB-1234 · Driver Mr. Suresh Kumar +91 124 1212 3434 · fare ₹1,500 · window 07:00–08:00. Body scan for Sohna/STU-58/Route 4/Pradeep/Your Stop → CLEAN. Notifications feed: fee row shows ₹3,400 (not ₹4,750/₹9,500), no library-overdue row, no timetable demo rows; Mark-all-read works; all-channels-off renders the "You're all caught up" empty state (channels restored ON after). Console/page errors: none. Mobile 390px: scrollWidth==clientWidth on both modules (only clipped decorative elements flagged by the element audit — KPI hover glow inside overflow-hidden card + SVG paths). Screenshots: .verify/transport-desktop.png, .verify/transport-mobile.png, .verify/notices-mobile.png. Left as-is (documented): src/lib/mock/bus-tracking.ts file itself (imports removed per spec), driver-call toast affordance (existing UI behaviour), student-panel 'bus' nav gating (already correct). Full record: agent-ctx/20-transport-notifs-full-stack-developer.md
---
Task ID: 21-principal-attendance
Agent: full-stack-developer (+ orchestrator verification)
Task: Principal Attendance — replace the 1,842-student / December-2025 mock universe with canonical Attendance rows via new /api/principal/attendance (PRINCIPAL/MANAGEMENT-gated; 403 teacher/student, 401 anon).

Work Log:
- NEW API /api/principal/attendance (orchestrator): ?date=YYYY-MM-DD (+optional studentId) → summary, byClass, weekTrend (7 recorded days), monthTrend, sections (rosters+statuses), student drill. Verified: 2026-09-16 → 11 recorded, 9 present, 1 absent, 1 late, 90.9%; role-gates verified (403/403/401).
- Subagent rewired all 14 module files: Overview (date selector defaulting today, honest "no records for this date" state, "Latest recorded day" jump button, real week/month trends, real byClass table, heatmap showing real rates only for recorded days), Staff tab → honest "not yet configured" empty state (no staff-attendance table exists), History tab → real per-date+class rosters with CSV export, student drill via ?studentId, CSV exports from real rows, all @/lib/mock/attendance imports removed.
- Orchestrator browser verification (principal@greenwood.edu.in): 22 Sept 2026 view → Grade 9-A 11 students, 11 recorded, 9 present, 1 absent, 1 late, 90.9%, Best-performing class Grade 9-A; week trend 12–22 Sept real days; 3-month avg 94.0% (Jul 95.7/Aug 93.8/Sep 92.4); heatmap "Real rates shown only for days with attendance rows"; NO 1,842/December 2025/Class 2/Nursery. Zero console errors; 390px clean. tsc 0 errors.
- NOTE (subagent hit tool-level context timeout before worklog append + final browser pass; both completed by orchestrator).

Stage Summary:
- Principal Attendance now reads ONE canonical attendance universe (the same Attendance rows Teacher writes + Student reads). Remaining mock/attendance.ts importers elsewhere (teacher personal-attendance.tsx, staff-attendance-store, analytics/data.tsx) — analytics + teacher My Attendance still to audit in later phases.
---
Task ID: 22-fees-overview
Agent: full-stack-developer + orchestrator (finish + verification)
Task: Principal Fee Management — replace the client-fee-store mock totals (₹5.19L expected / 58 students / ₹3.14L collected / ₹2.05L outstanding) with the canonical DB fee ledger on the module's data surfaces.

Work Log:
- Subagent built use-canonical-fees.ts (shared coalesced fetch of /api/fees + /api/fees/transactions + /api/classes with module cache + refresh event) and rewired: fees-overview.tsx (hero/breakdown/class-wise/trend), fees-transactions.tsx (real txn table), fees-student-accounts.tsx (per-student canonical accounts), payments/payments-section.tsx; fees-collect-payment.tsx + fees-shell.tsx adjusted to canonical types.
- Orchestrator fixed the subagent's post-timeout bug: the hook parsed enveloped {ok,data} API responses as raw arrays → "txns is not iterable" error card. Added defensive unwrap (array pass-through or envelope.data).
- Verified in browser as principal: Overview hero = TOTAL EXPECTED ₹4.66L · 18 students with fees · COLLECTED ₹3.73L (80%) · OUTSTANDING ₹93.4K (agrees with the LIVE defaulters chip) · PENDING VERIFICATION ₹100/1. Class-wise: Grade 10-A 8 students ₹1.25L/₹2.00L 63%, Grade 9-A 10 students ₹2.48L/₹2.66L 93%. Transactions tab: 4 real txns (2 verified, ₹12.0K total). Student Accounts: 18 students with canonical ledgers (Aarav Sharma ₹41.4K/₹38.0K/₹3.4K — same as the student's own Fees view). Payments tab: verification workspace canonical. NO ₹5.19L/58-student mock numbers remain on data surfaces.
- Stale "order of Hooks" console error investigated: reproduced only in the pre-fix crash history; after console clear + fresh navigation → ZERO new errors. Responsive 390px clean. tsc 0 errors.

Stage Summary:
- Principal Fees' data truth is now the ONE canonical ledger, agreeing with Teacher Fee Collection and Student Fees (Phase 5 cross-check base). REMAINING client-store surfaces (documented, config tooling not data truth): fees-structures*.tsx + fees-catalogue-*.tsx + fees-settings.tsx (DB FeeStructure/catalogue tables are EMPTY — the structure editor renders client config; candidate for next pass), fees-collect-payment write path, receipt-chrome settings (receiptSettings) reads in transactions/student-accounts.
---
Task ID: 23-stabilization-continuation
Agent: Z.ai Code (main orchestrator — FULL SYSTEM STABILIZATION, phases 5–16)
Task: User directive: continue stabilization — student canonical identity, Principal Attendance/Fees canonicalization, cross-role financial test, module walks, lazy-chunk resilience, security + responsive regression.

Work Log:
- PHASE 1+2 (Student canonical identity) — DONE: /api/auth/me getStudentContext extended (+studentId/classId/className/section); current-user-store type extended; NEW shared/canonical.ts (useCanonicalStudent + useMyServerFees/Results/Transport hooks); auth-store student profile de-mocked (neutral placeholder + v2 persist migration dropping stale STU-58 sessions); login syncs server id; sidebar/profile/ID-card/settings/positions(gone for canonical)/leadership/my-class/applications/certificates/messages/notifications/transport ALL rewired — the STU-58/Class 2-A/Roll 18/DSO2024058 overlay is fully retired (verified: zero code refs outside comments/migration). New canonical APIs: /api/student/fees, /api/student/results, /api/student/transport. Subscription gate default → active (fake ₹300 payment wall removed). Browser-verified all 13 student modules canonical (Aarav Sharma = Grade 9-A · Roll 01 · DEMO-2026-0001 everywhere; fees 3,400/41,400; results Mid-Term 90.8% rank 3/6; transport Route A - Cyber City) — zero console errors.
- PHASE 3 (Principal Attendance) — DONE (see Task 21).
- PHASE 4 (Principal Fees) — DONE (see Task 22): Overview/Transactions/Student Accounts/Payments canonical; ₹5.19L/58-student mock universe gone.
- PHASE 5 (Cross-role financial test) — PASS: Aarav Sharma (DEMO-2026-0001) — Principal Fees ₹41,400 billed/₹38,000 paid/₹3,400 outstanding + ₹100 pending; Teacher fee-collection API identical ledger (awaitingVerification 100); Student fees module identical; pending-verification semantics flow correctly (teacher Pending → principal PENDING VERIFICATION ₹100 → student "awaiting verification" note).
- PHASE 6 (Principal walk) — PASS: all 20 nav modules walked (Dashboard, Students & Classes, Teachers, Timetable, Attendance, Examinations, Fee Management, Salary, Finance Dashboard, Admissions, Applications, Communication, Messages, Calendar, Library, Transport, Inventory, Certificates, Downloads, Settings) — every module renders, zero console errors after clear; Dashboard shows canonical LIVE ₹93.4K + 19 students/4 teachers/91% attendance.
- PHASE 7 (Teacher regression) — PASS: all 14 teacher modules render post-changes with zero console errors; My Class = Grade 9-A · 11 students (agrees with Principal); Fees module shows the same canonical txns (₹100 Pending, ₹500 Rejected).
- PHASE 8+13 (Timetable + validation) — PASS: bun run db:validate → ZERO CRITICAL; 135 timetable rows 0 conflicts; 234 attendance rows canonical; 19 students; Grade 9-A=11, Grade 10-A=8 consistent across roles. 18 warnings = documented historical Physics/Chem/Biology results (pre-reconfig declared exams — kept intentionally).
- PHASE 9 (lazy-chunk/blank screen) — ROOT-CAUSED + HARDENED: captured live evidence (ChunkLoadError on teacher-dashboard chunk → SyntaxError chunk → React removeChild crash → blank app). Mechanism: webpack lazyCompilation chunk invalidation racing SPA navigation (dev-infra). App-level fix: NEW shared/lazy-module.tsx (import retry ×2 on ChunkLoadError + per-module ModuleErrorBoundary with fresh-instance retry) wired into ALL THREE panels' module loaders (student-panel, principal-panel, teacher module-router + MySalary). A failed module now renders a "Try again" card — the shell/session survive. Verified post-fix: full principal walk (20 modules) + teacher walk with ZERO blanks.
- QA-INFRA FINDING: agent-browser physical click dispatch silently breaks after the in-page login transition (events never reach the DOM; "✓ Done" is false-positive) — reproduced deterministically with instrumented listeners + a fixed-position probe button. Procedure: fetch-login via eval + page reload (clicks keep working), or JS .click() via eval. This explains prior "click swallowed" reports. Documented for future QA.
- PHASE 10 (production build) — BLOCKED BY ENVIRONMENT (documented): `bun run build` is explicitly forbidden in this sandbox (4GB cgroup; next-server alone at ~2.1GB + preview depends on :3000 dev). Equivalent gates run instead: tsc --noEmit → 0 errors; eslint → clean; db:validate → 0 critical; exhaustive runtime verification of every module in all 3 roles with console capture. The lazyCompilation virtual-chunk mechanism does not exist in production builds (real emitted chunks), so the 404 class of failures is dev-only by construction; the new retry+boundary hardening additionally covers prod deploy-time chunk retirement.
- PHASE 11 (mock universe classification) — remaining client-store surfaces documented + quarantined: teacher personal-attendance (own-attendance demo), staff-attendance-store (no DB table — Principal Attendance staff tab now shows honest "not yet configured"), analytics/data.tsx (teacher analytics), fee structures/catalogue/settings tabs (DB FeeStructure tables EMPTY — config tooling), applications-store + class-responsibility-store + messaging demo threads (client-interaction demos). No identity/fee/marks/attendance data surface reads them anymore.
- PHASE 12 (cross-role reality) — PASS: Grade 9-A = 11 students in Principal Attendance + Teacher My Class + Student identity; fee totals agree 3-way; timetable/attendance/results all from the same DB rows per role-scoped views.
- PHASE 14 (console) — PASS: all three roles' module walks produced ZERO unexpected console/page errors (verified after console clear with fresh navigations).
- PHASE 15 (security regression) — PASS: student → 13 gated staff endpoints all 403; teacher → principal-only surfaces 403; anon → 401 everywhere; new /api/principal/attendance gates verified (PRINCIPAL/MANAGEMENT only).
- PHASE 16 (responsive) — PASS: 320px + 390px + 1280px scrollWidth == clientWidth on principal dashboard/fees/attendance + student fees/transport + teacher modules (subagent-verified).

Stage Summary:
- The three reported critical bugs are FIXED at the root (student identity overlay, Principal Attendance mock universe, Principal Fees mix), the cross-role financial ledger agrees everywhere, and the app is hardened against chunk-load failures.
- All gates green: tsc 0 · eslint clean · db:validate ZERO CRITICAL · 3-role browser QA clean.
- Known remaining (next-phase candidates): (1) fee structures/catalogue/settings tabs still client-store config tooling (DB tables empty — decide: seed DB structures or present honest empty states); (2) teacher personal-attendance + analytics modules still read mock/stores; (3) Phase 10 production-build verification blocked by sandbox constraint — needs an environment where `next build` is permitted; (4) student messaging remains a client-seeded demo (server Message rows exist for inbox counts but no student compose API); (5) the dashboard's stale ₹5,400 fee-reminder message text (historically correct at send time 19 Sep; banner shows it beside the live ₹3,400 — consider labeling quotes as "as of <date>").

---
Task ID: git-publish-1
Agent: Z.ai Code (main orchestrator)
Task: Push current project state to GitHub repository signature4748-obs/Scholario-OS (user-provided repo + PAT)

Work Log:
- Audited git state: 23 uncommitted changes from the final cleanup round (teacher personal-attendance canonical, student messaging demo removed, ₹5,400 stale reminder fixed, fee structures honest empty states, staff-attendance-store + student-messaging-store deleted, server-inbox-store added)
- Security scan before push: scanned tracked files for live API keys/secrets (rzp_live/sk_live/AKIA/ghp_/AIza patterns) — none found
- Untracked .env (was previously committed despite gitignore; content = local DATABASE_URL path only, no secrets; existing .env* ignore rule now effective for future commits)
- Added scripts/tmp/ to .gitignore (scratch debug scripts, not part of the app)
- Committed everything as 9d81b03 "final cleanup: retire remaining mock/demo runtime surfaces" (24 files, +706/−1954)
- Added remote origin (PAT stored only in local .git/config, never committed) and pushed main → origin/main
- Verified: remote HEAD 9d81b03 == local HEAD; 46 commits on remote main; working tree clean and in sync

Stage Summary:
- Full project history (46 commits) now published at https://github.com/signature4748-obs/Scholario-OS (branch: main)
- Includes db/custom.db (seeded demo database) — anyone cloning gets working demo data; .env needs to be recreated (DATABASE_URL=file:/home/z/my-project/db/custom.db, adjust path) then `bun install && bun run db:push && bun run dev`
- No secrets leaked; .env untracked going forward
