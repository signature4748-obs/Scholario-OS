'use client'

import { lazyModule } from '@/components/shared/lazy-module'

// Every module is a separate lazily-loaded chunk: navigating compiles just
// that module (small memory spikes) instead of one giant teacher bundle.
// Chunk-resilient: import retry + per-module error boundary (§22/§29).
const lazy = (loader: () => Promise<{ [key: string]: any }>, pick: string) =>
  lazyModule(loader, pick)

const TeacherDashboard = lazy(() => import('../modules/dashboard'), 'TeacherDashboard')
const PersonalAttendance = lazy(() => import('../modules/personal-attendance'), 'PersonalAttendance')
const MyTimetableModule = lazy(() => import('../modules/my-timetable'), 'MyTimetableModule')
const AttendanceModule = lazy(() => import('../modules/attendance'), 'AttendanceModule')
const LessonPlannerModule = lazy(() => import('../modules/lesson-planner'), 'LessonPlannerModule')
const MarksEntryModule = lazy(() => import('../modules/marks'), 'MarksEntryModule')
const StudentsModule = lazy(() => import('../modules/students'), 'StudentsModule')
const ClassHubModule = lazy(() => import('../modules/class-hub'), 'ClassHubModule')
const FeeCollectionModule = lazy(() => import('../modules/fee-collection'), 'FeeCollectionModule')
const ApplicationReviewsModule = lazy(() => import('../modules/applications'), 'ApplicationReviewsModule')
const StudentBehaviorModule = lazy(() => import('../modules/student-behavior'), 'StudentBehaviorModule')
const TeacherAnalyticsModule = lazy(() => import('../modules/analytics'), 'TeacherAnalyticsModule')
const TeacherSettingsModule = lazy(() => import('../modules/settings'), 'TeacherSettingsModule')
const CommunicationModule = lazy(() => import('../modules/communication'), 'CommunicationModule')

interface ModuleRouterProps {
  active: string
  onNavigate: (key: string) => void
}

export function ModuleRouter({ active, onNavigate }: ModuleRouterProps) {
  return (
    <>
      {active === 'dashboard' && <TeacherDashboard onNavigate={onNavigate} />}
      {active === 'my-attendance' && <PersonalAttendance />}
      {active === 'my-timetable' && <MyTimetableModule />}
      {active === 'attendance' && <AttendanceModule />}
      {active === 'lesson-planner' && <LessonPlannerModule />}
      {active === 'marks' && <MarksEntryModule />}
      {active === 'students' && <StudentsModule />}
      {active === 'class-hub' && <ClassHubModule onNavigate={onNavigate} />}
      {active === 'fee-collection' && <FeeCollectionModule />}
      {active === 'app-reviews' && <ApplicationReviewsModule />}
      {active === 'behavior' && <StudentBehaviorModule onNavigate={onNavigate} />}
      {active === 'analytics' && <TeacherAnalyticsModule onNavigate={onNavigate} />}
      {active === 'settings' && <TeacherSettingsModule />}
      {active === 'communication' && <CommunicationModule onNavigate={onNavigate} />}
    </>
  )
}
