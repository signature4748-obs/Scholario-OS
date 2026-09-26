'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  LayoutDashboard, User, CalendarDays, CalendarCheck, Award,
  IndianRupee, Megaphone, Bus, GraduationCap,
  ClipboardList, ShieldCheck, Crown, MessageCircle, Settings, ScrollText,
} from 'lucide-react'
import { AppShell, type NavGroup } from '@/components/shell/app-shell'
import { lazyModule } from '@/components/shared/lazy-module'
import { useUnreadStudentNotificationCount } from './modules/notifications'
import { StudentSubscriptionActivation } from './StudentSubscriptionActivation'
import { getStudentSubscription } from '@/lib/platform-subscription'
import { useStudentsStore } from '@/lib/store/students-store'
import { useServerInbox } from '@/lib/store/server-inbox-store'
import { POSITION_DEFS, filterActivePositions } from '@/lib/student-positions'
import { useAcademicSession } from '@/lib/academic-session'
import { useMyServerTransport, useCanonicalStudent } from './modules/shared/canonical'
import { hydrateNotifPrefsFromServer } from '@/lib/store/student-notif-prefs-store'
import { useServerNotices } from '@/lib/store/server-notices-store'
import { useCurrentUser } from '@/lib/store/current-user-store'

// Every module is a separate lazily-loaded chunk: navigating compiles just
// that module (small memory spikes) instead of one giant student bundle.
// Chunk-resilient lazy loader: import retry + per-module error boundary
// (stabilization §22/§29 — a failed chunk must never blank the app).
const lazy = (loader: () => Promise<{ [key: string]: any }>, pick: string) =>
  lazyModule(loader, pick)

const StudentDashboard = lazy(() => import('./modules/dashboard'), 'StudentDashboard')
const ProfileModule = lazy(() => import('./modules/profile'), 'ProfileModule')
const AttendanceModule = lazy(() => import('./modules/attendance'), 'AttendanceModule')
const LearningModule = lazy(() => import('./modules/learning'), 'LearningModule')
const NoticesModule = lazy(() => import('./modules/notices'), 'NoticesModule')
const ResultsModule = lazy(() => import('./modules/results'), 'ResultsModule')
const FeesModule = lazy(() => import('./modules/fees'), 'FeesModule')
const StudentApplicationsModule = lazy(() => import('./modules/applications'), 'StudentApplicationsModule')
const MyCertificatesModule = lazy(() => import('./modules/my-certificates'), 'MyCertificatesModule')
const TimetableModule = lazy(() => import('./modules/timetable'), 'TimetableModule')
const BusTrackingModule = lazy(() => import('./modules/bus-tracking'), 'BusTrackingModule')
const MyClassModule = lazy(() => import('./modules/my-class'), 'MyClassModule')
const StudentMessagesModule = lazy(() => import('./modules/messages'), 'StudentMessagesModule')
const StudentSettingsModule = lazy(() => import('./modules/settings'), 'StudentSettingsModule')

/**
 * STUDENT WORKSPACE NAVIGATION (Learning Experience 2.0 IA — spec §3).
 *
 * Structure mirrors how a student thinks about their school life:
 *   HOME → who am I, what's happening today
 *   SCHOOL → the official record: timetable, attendance, results
 *   LEARNING → THE academic hub (resources, flashcards, planner, groups)
 *   COMMUNITY → people & announcements: messages, notices
 *   RECORDS → the paperwork: fees, certificates, transport, applications
 *   ACCOUNT → settings
 *
 * Removed from the STUDENT workspace (per spec §1-§2/§55/§77 — clean
 * removal, no dead routes): Classwork (Homework/Assignments — the teacher
 * workspace keeps its own classwork experience and the backend stays) and
 * the separate Study Materials destination (the repository now surfaces
 * inside Learning). Also long-gone: My Progress, My Wellbeing, My Library.
 *
 * Every module is real (no placeholder/dead entries). Two entries are
 * permission-derived, never hardcoded:
 *   · Class Leadership (My Class group) — ONLY while the student holds
 *     an ACTIVE position in the live academic session (resolved through
 *     filterActivePositions — the single activity resolver).
 *   · Transport — ONLY for students with a transport assignment
 *     (useTransportAssignment: roster opt-in or an assigned route).
 *
 * BADGES — real derived counts only, never decorative numbers:
 *   · Messages  — unread conversations (messaging store)
 *   · Notices   — unread notifications (notification store)
 * No other module has a real "unread/pending count" concept → no badge.
 */
const navGroups: NavGroup[] = [
  {
    label: 'Home',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
      { key: 'profile', label: 'My Profile', icon: <User className="h-4.5 w-4.5" /> },
    ],
  },
  {
    label: 'School',
    items: [
      { key: 'timetable', label: 'Timetable', icon: <CalendarDays className="h-4.5 w-4.5" /> },
      { key: 'attendance', label: 'Attendance', icon: <CalendarCheck className="h-4.5 w-4.5" /> },
      { key: 'results', label: 'Results', icon: <Award className="h-4.5 w-4.5" /> },
    ],
  },
  {
    label: 'Learning',
    items: [
      { key: 'learning', label: 'Learning', icon: <GraduationCap className="h-4.5 w-4.5" /> },
    ],
  },
  {
    label: 'Community',
    items: [
      { key: 'messages', label: 'Messages', icon: <MessageCircle className="h-4.5 w-4.5" /> },
      { key: 'notices', label: 'Notices', icon: <Megaphone className="h-4.5 w-4.5" /> },
    ],
  },
  {
    label: 'Records',
    items: [
      { key: 'fees', label: 'Fees', icon: <IndianRupee className="h-4.5 w-4.5" /> },
      { key: 'my-certificates', label: 'Certificates', icon: <ScrollText className="h-4.5 w-4.5" /> },
      { key: 'bus', label: 'Transport', icon: <Bus className="h-4.5 w-4.5" /> },
      { key: 'applications', label: 'Applications', icon: <ClipboardList className="h-4.5 w-4.5" /> },
    ],
  },
  {
    label: 'Account',
    items: [
      { key: 'settings', label: 'Settings', icon: <Settings className="h-4.5 w-4.5" /> },
    ],
  },
]

/**
 * Legacy key remap — deep links across the app (dashboard cards, the
 * notification feed, the topbar bell, quick actions) still reference the
 * OLD module keys. One central map keeps every one of them working with
 * the consolidated navigation, and remembers which tab to open.
 *
 * SS-1 — settings deep-links: the command palette navigates to
 * settings-<section> pseudo-keys which land here (same mechanism the
 * Learning tabs use).
 */
const LEGACY_MODULE: Record<string, string> = {
  resources: 'learning',
  flashcards: 'learning',
  planner: 'learning',
  peer: 'learning',
  materials: 'learning',
  'study-materials': 'learning',
  notifications: 'notices',
  announcements: 'notices',
  calendar: 'notices',
  'settings-profile': 'settings',
  'settings-security': 'settings',
  'settings-devices': 'settings',
  'settings-notifications': 'settings',
  'settings-appearance': 'settings',
  'settings-accessibility': 'settings',
  'settings-learning': 'settings',
  'settings-privacy': 'settings',
  'settings-safety': 'settings',
  'settings-support': 'settings',
  'settings-about': 'settings',
}

/** Deep-link sub-tabs (e.g. dashboard "flashcards" → Learning · Flashcards). */
const LEGACY_TAB: Record<string, string> = {
  flashcards: 'flashcards',
  announcements: 'announcements',
  calendar: 'calendar',
  resources: 'overview',
  materials: 'overview',
  'study-materials': 'overview',
  planner: 'planner',
  peer: 'groups',
  notifications: 'notifications',
  'settings-profile': 'profile',
  'settings-security': 'security',
  'settings-devices': 'devices',
  'settings-notifications': 'notifications',
  'settings-appearance': 'appearance',
  'settings-accessibility': 'accessibility',
  'settings-learning': 'learning',
  'settings-privacy': 'privacy',
  'settings-safety': 'safety',
  'settings-support': 'support',
  'settings-about': 'about',
}

/** Live badge overrides — derived unread counts (never hardcoded). */
function withLiveBadges(items: NavGroup['items'], unreadNotifs: number, unreadMsgs: number) {
  return items.map((item) => {
    if (item.key === 'notices') return { ...item, badge: unreadNotifs > 0 ? unreadNotifs : undefined }
    if (item.key === 'messages') return { ...item, badge: unreadMsgs > 0 ? unreadMsgs : undefined }
    return item
  })
}

export function StudentPanel() {
  const [active, setActive] = useState(initialActiveModule)
  // Deep-link tab target for the consolidated modules (see LEGACY_TAB).
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  // Remember the open module for this tab (see initialActiveModule) — a
  // lazy-chunk recovery reload then re-opens exactly where the student was.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(MODULE_MEMORY_KEY, active)
    } catch {
      /* storage disabled — nothing to remember */
    }
  }, [active])

  // Consume the ?module= deep-link once (strip it from the URL) so later
  // in-app navigation isn't shadowed by the stale param on the next
  // recovery reload — the per-tab memory takes over from here.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (url.searchParams.has('module')) {
      url.searchParams.delete('module')
      window.history.replaceState(null, '', url.toString())
    }
  }, [])
  // Canonical identity — the SERVER session decides who this student is
  // (user → Student row → classId/roll/admission). The client-side demo
  // roster id (STU-58) is retired; positions gate on the canonical id.
  const { student } = useCanonicalStudent()
  const studentId = student?.studentId ?? null

  // SS-1 — one server fetch on mount hydrates the student's persisted
  // preferences (notification channels + learning reminders) into the
  // client cache; every consumer (Notices feed, bell badge, dashboard
  // gates, Settings) reads the same store afterwards.
  // LR-1 — the same mount hydrates the REAL school announcements
  // (/api/student/notices) so the Notices module shows published rows,
  // never static demo content.
  useEffect(() => {
    void hydrateNotifPrefsFromServer()
    void useServerNotices.getState().refresh()
    // STABILIZATION — the canonical inbox (/api/messages) hydrates on
    // mount too: the Messages badge + bell "New messages" slice read
    // REAL Message rows, never fabricated demo threads.
    void useServerInbox.getState().refresh()
  }, [])

  // Live nav badges — ALL derived from real stores/data, zero constants.
  const unreadNotifs = useUnreadStudentNotificationCount()
  // Messages badge — canonical server inbox unread count (null while
  // loading → no badge, never a fabricated count).
  const inbox = useServerInbox((s) => s.messages)
  const unreadMsgs = inbox ? inbox.filter((m) => !m.read).length : 0
  // Session display name (User.name) for the subscription gate + shell.
  const me = useCurrentUser((s) => s.me)
  const studentName = me?.name || 'Student'

  // Class Captain / Monitor: the nav entry appears ONLY while THIS
  // student (canonical session id) holds an ACTIVE position in the LIVE
  // academic session — resolved through filterActivePositions (the
  // session-scoped activity resolver), never hardcoded. Ending the
  // assignment (or moving to a new session) removes it instantly.
  // (Raw array + useMemo — zustand v5 selectors must return stable refs.)
  const allPositions = useStudentsStore((s) => s.studentPositions)
  const sessionId = useAcademicSession().id
  const activePositions = useMemo(
    () => (studentId ? filterActivePositions(allPositions, studentId, sessionId) : []),
    [allPositions, studentId, sessionId],
  )
  const myClassGroup: NavGroup[] =
    activePositions.length > 0
      ? [
          {
            label: 'My Class',
            items: [
              {
                key: 'my-class',
                label: POSITION_DEFS[activePositions[0].key]?.short === 'Captain' ? 'Class Leadership' : 'My Responsibility',
                icon: <Crown className="h-4.5 w-4.5" />,
              },
            ],
          },
        ]
      : []

  // RB-1 — Transport is an opt-in service: students without a server
  // route assignment (Student.routeId → Route) never see the Transport
  // entry — not in the sidebar and not in ⌘K search (the palette is
  // nav-derived). The assignment comes from /api/student/transport.
  const { assigned: hasTransport } = useMyServerTransport()

  const groups: NavGroup[] = [
    // Home first, then the (conditional) Class Leadership responsibility —
    // it earns prominence while active and vanishes the moment it ends.
    {
      ...navGroups[0],
      items: withLiveBadges(navGroups[0].items, unreadNotifs, unreadMsgs),
    },
    ...myClassGroup,
    ...navGroups.slice(1).map((g) => ({
      ...g,
      items: withLiveBadges(
        // 'bus' is assignment-conditional (see useTransportAssignment above).
        g.items.filter((item) => item.key !== 'bus' || hasTransport),
        unreadNotifs,
        unreadMsgs,
      ),
    })),
  ]

  // Central navigation: resolves legacy keys → consolidated modules and
  // remembers the deep-linked tab. Sidebar clicks pass a plain (new) key
  // and reset the tab target to the module default / last-used tab.
  const navigate = (rawKey: string) => {
    setPendingTab(LEGACY_TAB[rawKey] ?? null)
    setActive(LEGACY_MODULE[rawKey] ?? rawKey)
  }

  const [subRecord, setSubRecord] = useState(() => getStudentSubscription(studentId ?? ''))
  const [forceFirstLoginFlow, setForceFirstLoginFlow] = useState(false)

  const isSubActive = subRecord.isActive && !forceFirstLoginFlow

  if (!isSubActive) {
    return (
      <StudentSubscriptionActivation
        studentId={studentId ?? ''}
        studentName={studentName}
        onActivated={() => {
          setSubRecord(getStudentSubscription(studentId ?? ''))
          setForceFirstLoginFlow(false)
        }}
      />
    )
  }

  return (
    <AppShell
      groups={groups}
      activeKey={active}
      onNavigate={navigate}
      role="student"
      roleLabel={student?.classLabel ? `Student · ${student.classLabel}` : 'Student'}
    >
      {active === 'dashboard' ? (
        <StudentDashboard onNavigate={navigate} />
      ) : active === 'profile' ? (
        <ProfileModule onNavigate={navigate} />
      ) : active === 'learning' ? (
        <LearningModule initialTab={pendingTab ?? undefined} onTabChange={setPendingTab} />
      ) : active === 'notices' ? (
        <NoticesModule initialTab={pendingTab ?? undefined} onTabChange={setPendingTab} onNavigate={navigate} />
      ) : active === 'my-class' ? (
        <MyClassModule />
      ) : active === 'settings' ? (
        <StudentSettingsModule initialSection={pendingTab ?? undefined} />
      ) : (
        renderStaticModule(active)
      )}
    </AppShell>
  )
}

/** Flat registry for the single-component modules (no props needed). */
const staticModules: Record<string, React.ReactNode> = {
  timetable: <TimetableModule />,
  attendance: <AttendanceModule />,
  results: <ResultsModule />,
  messages: <StudentMessagesModule />,
  fees: <FeesModule />,
  'my-certificates': <MyCertificatesModule />,
  applications: <StudentApplicationsModule />,
  bus: <BusTrackingModule />,
}

/** Per-tab module memory (sessionStorage) — same pattern as the Teacher
 *  and Principal panels: a lazy-chunk recovery reload (stale chunk graph
 *  after a dev recompile / server restart) re-opens exactly where the
 *  student was instead of silently resetting them to the Dashboard.
 *  Permission-derived modules (my-class, bus) are accepted optimistically
 *  here; those modules render their own honest empty state if the
 *  position/assignment has since ended. */
const MODULE_MEMORY_KEY = 'scholario-student-module'
const STUDENT_MODULE_KEYS: ReadonlySet<string> = new Set([
  'dashboard', 'profile', 'learning', 'notices', 'my-class', 'settings',
  ...Object.keys(staticModules),
])

function initialActiveModule(): string {
  if (typeof window === 'undefined') return 'dashboard'
  // ?module=<key> deep-link (bookmarks, shared links) — validated against
  // the student registry; unknown keys fall through to the memory.
  const requested = new URLSearchParams(window.location.search).get('module')
  if (requested && STUDENT_MODULE_KEYS.has(requested)) return requested
  try {
    const remembered = window.sessionStorage.getItem(MODULE_MEMORY_KEY)
    if (remembered && STUDENT_MODULE_KEYS.has(remembered)) return remembered
  } catch {
    /* storage disabled (private mode) — honest fallback */
  }
  return 'dashboard'
}

function renderStaticModule(key: string) {
  const mod = staticModules[key]
  if (mod) return mod
  // Unknown key guard (should not happen — keeps the shell from blanking).
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">This section is not available.</p>
    </div>
  )
}
