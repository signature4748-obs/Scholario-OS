import { db } from '@/lib/db'
import { withUser, schoolScoped } from '@/lib/api'
import { classLabelOf } from '@/lib/teacher-hub'

export const runtime = 'nodejs'

/**
 * GET /api/teacher/role — the signed-in teacher's REAL appointment context.
 *
 * This is the single server truth the teacher panel uses to gate the Class
 * Teacher Hub: the group exists in the sidebar ONLY for teachers who are
 * actually appointed class teacher of a class (Class.classTeacherId =
 * User.id). Position permissions never grant it — appointment does.
 */
export async function GET() {
  return withUser(
    async (user) => {
      const schoolId = schoolScoped(user)
      const teacher = await db.teacher.findUnique({ where: { userId: user.id } })
      if (!teacher) throw new Error('NO_TEACHER_RECORD')

      const classes = await db.class.findMany({
        where: { schoolId, classTeacherId: user.id },
        select: {
          id: true,
          name: true,
          section: true,
          room: true,
          students: { where: { user: { status: 'ACTIVE' } }, select: { id: true } },
        },
        orderBy: { name: 'asc' },
      })

      return {
        teacher: {
          name: user.name ?? 'Teacher',
          employeeId: teacher.employeeId,
        },
        isClassTeacher: classes.length > 0,
        classTeacherOf: classes.map((c) => ({
          id: c.id,
          label: classLabelOf(c),
          room: c.room,
          studentCount: c.students.length,
        })),
      }
    },
    { roles: ['TEACHER'] }
  )
}
