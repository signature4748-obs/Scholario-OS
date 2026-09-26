'use client'

/**
 * TeacherKpiCards — the dashboard's four headline numbers in the shared
 * Marks Entry card language (HubStatCards recipe — white card, subtle
 * border, compact icon, strong value, muted context). Every number traces
 * to a real row behind the aggregate API:
 *
 *   • Classes Today    — the teacher's own timetable cells for today
 *                        (context: when the first one starts)
 *   • Lessons Today    — curriculum assignments with a topic scheduled
 *                        today (context + hairline completed/total bar)
 *   • Unread Messages  — parent + staff messages awaiting a read
 *   • Pending Actions  — behavior concerns + open follow-ups + draft
 *                        marks entries + class-attendance baselines still
 *                        open (the same rows the Pending Actions queue
 *                        renders); a quiet "all caught up" only when every
 *                        source is genuinely zero.
 */

import { AlarmClock, BookMarked, CalendarCheck, Inbox, MailOpen } from 'lucide-react'
import {
  HubStatCards,
  type HubStat,
} from '@/components/teacher/modules/shared/hub-stat-cards'
import type { TeacherDashboardData } from './types'

interface TeacherKpiCardsProps {
  data: TeacherDashboardData
}

export function TeacherKpiCards({ data }: TeacherKpiCardsProps) {
  const periodsToday = data.today.periods.length
  const lessonsToday = data.curriculum.filter((c) => c.todayTopic != null)
  const lessonsTodayCount = lessonsToday.length

  // Unmarked class-attendance baselines are pending work TOO — a class
  // teacher with an open baseline must never read "nothing needs attention"
  // while the attendance prompt below says "not marked yet".
  const unmarkedAttendance = data.attendance.filter((s) => !s.marked).length
  const pendingActions =
    data.hub.needsAttention + data.hub.openFollowUps + data.hub.marksPending + unmarkedAttendance

  const stats: HubStat[] = [
    {
      key: 'classes',
      label: 'Classes Today',
      value: periodsToday,
      // (the "when" detail lives in the hero's NextUp panel — no duplication)
      context: periodsToday > 0 ? 'teaching periods' : 'no teaching periods today',
      icon: CalendarCheck,
      tone: 'amber',
    },
    {
      key: 'lessons',
      label: 'Lessons Today',
      value: lessonsTodayCount,
      context: lessonsTodayCount > 0 ? 'topics in Lesson Planner' : 'no topics scheduled today',
      icon: BookMarked,
      tone: 'emerald',
      // hairline pace bar across ALL curriculum assignments (honest 0–1)
      progress:
        data.curriculum.length > 0
          ? data.curriculum.reduce((sum, c) => sum + c.progress.completed, 0) /
            Math.max(
              1,
              data.curriculum.reduce((sum, c) => sum + c.progress.total, 0),
            )
          : undefined,
    },
    {
      key: 'unread',
      label: 'Unread Messages',
      value: data.hub.unreadMessages,
      context: data.hub.unreadMessages > 0 ? 'awaiting your reply' : 'all caught up',
      icon: MailOpen,
      tone: 'sky',
    },
    {
      key: 'pending',
      label: 'Pending Actions',
      value: pendingActions,
      context: pendingActions > 0
        ? [
            data.hub.needsAttention > 0 ? `${data.hub.needsAttention} need attention` : '',
            data.hub.openFollowUps > 0 ? `${data.hub.openFollowUps} follow-ups` : '',
            data.hub.marksPending > 0 ? `${data.hub.marksPending} marks drafts` : '',
            unmarkedAttendance > 0 ? `${unmarkedAttendance} attendance open` : '',
          ].filter(Boolean).join(' · ')
        : 'nothing needs attention',
      icon: pendingActions > 0 ? AlarmClock : Inbox,
      tone: pendingActions > 0 ? 'amber' : 'emerald',
    },
  ]

  // 2×2 until xl — four across too early truncates the context lines
  // ("teaching periods · first at 8:30 AM") on tablet widths.
  return <HubStatCards stats={stats} className="sm:grid-cols-2 xl:grid-cols-4" />
}
