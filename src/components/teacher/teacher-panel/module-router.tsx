'use client'

import dynamic from 'next/dynamic'
import { ModuleLoading } from '@/components/shared/module-loading'

// Every module is a separate lazily-loaded chunk: navigating compiles just
// that module (small memory spikes) instead of one giant teacher bundle.
const lazy = (loader: () => Promise<{ [key: string]: any }>, pick: string) =>
  dynamic(() => loader().then((m) => m[pick] as React.ComponentType<any>), {
    loading: ModuleLoading,
  })

const TeacherDashboard = lazy(() => import('../modules/dashboard'), 'TeacherDashboard')
const PersonalAttendance = lazy(() => import('../modules/personal-attendance'), 'PersonalAttendance')
const MyTimetableModule = lazy(() => import('../modules/my-timetable'), 'MyTimetableModule')
const AttendanceModule = lazy(() => import('../modules/attendance'), 'AttendanceModule')
const LessonPlannerModule = lazy(() => import('../modules/lesson-planner'), 'LessonPlannerModule')
const MarksEntryModule = lazy(() => import('../modules/marks'), 'MarksEntryModule')
const ExamProctoringModule = lazy(() => import('../modules/exam-proctoring'), 'ExamProctoringModule')
const StudentsModule = lazy(() => import('../modules/students'), 'StudentsModule')
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
      {active === 'proctoring' && <ExamProctoringModule />}
      {active === 'students' && <StudentsModule />}
      {active === 'app-reviews' && <ApplicationReviewsModule />}
      {active === 'behavior' && <StudentBehaviorModule onNavigate={onNavigate} />}
      {active === 'analytics' && <TeacherAnalyticsModule onNavigate={onNavigate} />}
      {active === 'settings' && <TeacherSettingsModule />}
      {active === 'communication' && <CommunicationModule onNavigate={onNavigate} />}
    </>
  )
}
