'use client'

/**
 * TeacherKpiCards — the dashboard's four headline numbers in the shared
 * Marks Entry card language (HubStatCards recipe — white card, subtle
 * border, compact icon container, strong value, muted context). Every
 * number traces to a real row behind the aggregate API:
 *
 *   • Classes Today    — the teacher's own timetable cells for today
 *   • Lessons Today    — curriculum assignments with a topic scheduled today
 *   • Unread Messages  — parent + staff messages awaiting a read
 *   • Pending Actions  — behavior concerns + scheduled follow-ups + class
 *                        attendance baselines still open (the same rows the
 *                        Pending Actions queue and the attendance prompt
 *                        below render); a quiet "all caught up" only when
 *                        every source is genuinely zero.
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
  const lessonsToday = data.curriculum.filter((c) => c.todayTopic != null).length

  // Unmarked class-attendance baselines are pending work TOO — a class
  // teacher with an open baseline must never read "nothing needs attention"
  // while the attendance prompt below says "not marked yet".
  const unmarkedAttendance = data.attendance.filter((s) => !s.marked).length
  const pendingActions = data.hub.needsAttention + data.hub.openFollowUps + unmarkedAttendance

  const stats: HubStat[] = [
    {
      key: 'classes',
      label: 'Classes Today',
      value: periodsToday,
      context: `${data.today.weekday} · teaching periods`,
      icon: CalendarCheck,
      tone: 'amber',
    },
    {
      key: 'lessons',
      label: 'Lessons Today',
      value: lessonsToday,
      context:
        lessonsToday > 0 ? 'topics scheduled in Lesson Planner' : 'no topics scheduled today',
      icon: BookMarked,
      tone: 'emerald',
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
            unmarkedAttendance > 0 ? `${unmarkedAttendance} attendance open` : '',
          ].filter(Boolean).join(' · ')
        : 'nothing needs attention',
      icon: pendingActions > 0 ? AlarmClock : Inbox,
      tone: pendingActions > 0 ? 'violet' : 'emerald',
    },
  ]

  return <HubStatCards stats={stats} />
}
