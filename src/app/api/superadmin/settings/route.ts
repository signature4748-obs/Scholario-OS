import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withUser, api } from '@/lib/api'

export const runtime = 'nodejs'

// GET platform settings (Super Admin only — §17 authorization: platform
// surfaces are never readable by school roles; the login page's demo-
// school visibility comes from the public /api/schools endpoint instead)
export async function GET() {
  return withUser(
    async () => {
      const setting = await db.platformSetting.findUnique({ where: { id: 'global' } })
      if (!setting) {
        await db.platformSetting.upsert({
          where: { id: 'global' },
          update: {},
          create: { id: 'global', showDemoSchool: true },
        })
        return { showDemoSchool: true }
      }
      return {
        showDemoSchool: setting.showDemoSchool,
      }
    },
    { roles: ['SUPER_ADMIN'] },
  )
}

// UPDATE platform settings (Super Admin only)
export async function POST(req: NextRequest) {
  return withUser(
    async () => {
      const body = await req.json().catch(() => ({}))
      const showDemoSchool = typeof body.showDemoSchool === 'boolean' ? body.showDemoSchool : true

      const setting = await db.platformSetting.upsert({
        where: { id: 'global' },
        update: { showDemoSchool },
        create: { id: 'global', showDemoSchool },
      })

      return {
        showDemoSchool: setting.showDemoSchool,
      }
    },
    { roles: ['SUPER_ADMIN'] }
  )
}
