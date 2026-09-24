'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'principal' | 'teacher' | 'student' | 'superadmin'

export interface SessionUser {
  role: Role
  name: string
  avatar: string
  id: string
  email: string
  teacherId?: string
  studentId?: string
}

interface AuthState {
  user: SessionUser | null
  isAuthenticated: boolean
  isAuthenticating: boolean
  hydrated: boolean
  setHydrated: () => void
  startAuth: () => void
  login: (role: Role, overrides?: Partial<SessionUser>) => void
  endAuth: () => void
  logout: () => void
  switchTo: (role: Role) => void
}

const roleProfiles: Record<Role, SessionUser> = {
  principal: {
    role: 'principal',
    name: 'Dr. Ananya Iyer',
    avatar: 'AI',
    id: 'EMP-001',
    email: 'principal@scholario.in',
    teacherId: 'T-014',
  },
  teacher: {
    role: 'teacher',
    name: 'Rohan Mehta',
    avatar: 'RM',
    id: 'EMP-014',
    email: 'rohan.mehta@scholario.in',
    teacherId: 'T-014',
  },
  student: {
    role: 'student',
    // Neutral placeholder — the REAL identity (name/email/id) is synced
    // from the server login response via `login(role, overrides)`. Never
    // a client-side demo roster id (the STU-58 overlay is retired).
    name: 'Student',
    avatar: '·',
    id: '',
    email: '',
  },
  superadmin: {
    role: 'superadmin',
    name: 'Arjun Malhotra',
    avatar: 'AM',
    id: 'SA-001',
    email: 'admin@scholario.cloud',
  },
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isAuthenticating: false,
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      startAuth: () => set({ isAuthenticating: true }),
      endAuth: () => set({ isAuthenticating: false }),
      // `overrides` lets the login flow sync the SERVER-authenticated
      // identity (name/email) into the store so the shell never shows a
      // stale mock profile next to a real session.
      login: (role, overrides) =>
        set({
          user: { ...roleProfiles[role], ...overrides, role },
          isAuthenticated: true,
          isAuthenticating: false,
        }),
      switchTo: (role) =>
        set({
          user: roleProfiles[role],
          isAuthenticated: true,
        }),
      logout: () =>
        set({ user: null, isAuthenticated: false, isAuthenticating: false }),
    }),
    {
      name: 'scholario-auth',
      // v1 — re-key student identity to the canonical STU-58 (fresh sessions
      // after the roster unification; stale persisted users are discarded).
      // v2 — STU-58 demo-overlay retirement: any persisted STUDENT session
      // still carrying the fabricated identity (id/email STU-58/greenwood)
      // is dropped — the user re-authenticates and gets the server identity.
      version: 2,
      migrate: (persisted) => {
        const state = persisted as AuthState | undefined
        if (state?.user?.role === 'student' && (state.user.id === 'STU-58' || !state.user.email)) {
          return { ...state, user: null, isAuthenticated: false, isAuthenticating: false } as unknown as AuthState
        }
        return state as unknown as AuthState
      },
      onRehydrateStorage: () => (state) => {
        useAuth.setState({ hydrated: true })
        if (state) state.setHydrated()
      },
    }
  )
)
