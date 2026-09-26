'use client'

import { toast } from 'sonner'
import { useTeachersStore } from '@/lib/store/teachers-store'
import type { TeacherRecord } from '@/lib/store/teachers-store'
import { usePositionDialogs } from './dialogs/position-dialogs'

export function useTeacherHandlers(currentTeacher: TeacherRecord | undefined) {
  const {
    acceptPosition,
    rejectPosition,
    requestPositionClarification,
  } = useTeachersStore()

  const dialogs = usePositionDialogs()

  const handleAcceptAssignment = (paId: string, title: string) => {
    if (!currentTeacher) return
    acceptPosition(currentTeacher.id, paId)
    // Honest copy: accepting records the position and (when the assignment
    // carries a class) adds that class to this teacher's scope. It never
    // silently flips unrelated module permissions.
    toast.success(`Position "${title}" accepted`, {
      description: 'The responsibility is now on your record. The Principal has been notified.',
    })
  }

  const handleOpenDecline = (paId: string) => {
    dialogs.setSelectedAssignmentId(paId)
    dialogs.setDeclineReason('')
    dialogs.setDeclineDialogOpen(true)
  }

  const handleConfirmDecline = () => {
    if (!currentTeacher || !dialogs.selectedAssignmentId) return
    rejectPosition(currentTeacher.id, dialogs.selectedAssignmentId, dialogs.declineReason || 'Declined by teacher.')
    dialogs.setDeclineDialogOpen(false)
    toast.error('Position assignment declined', {
      description: 'The Principal has been notified in Activity Audit Logs.',
    })
  }

  const handleOpenClarification = (paId: string) => {
    dialogs.setSelectedAssignmentId(paId)
    dialogs.setClarifyQuery('')
    dialogs.setClarifyDialogOpen(true)
  }

  const handleConfirmClarification = () => {
    if (!currentTeacher || !dialogs.selectedAssignmentId) return
    requestPositionClarification(currentTeacher.id, dialogs.selectedAssignmentId, dialogs.clarifyQuery || 'Clarification requested.')
    dialogs.setClarifyDialogOpen(false)
    toast.info('Clarification request sent to Principal', {
      description: 'You will receive an update once reviewed.',
    })
  }

  return {
    dialogs,
    handleAcceptAssignment,
    handleOpenDecline,
    handleConfirmDecline,
    handleOpenClarification,
    handleConfirmClarification,
  }
}
