'use client'

// ============================================================
// SS-1 — SIGN OUT (single, complete path)
// ------------------------------------------------------------
// Signing out must do BOTH jobs: revoke the server session (the
// erp_session cookie's Session row — /api/auth/logout) and clear the
// client demo profile (auth-store logout → back to the login screen).
// Previously the client logout left the server session alive for its
// full 7-day TTL; every sign-out surface now goes through here.
// ============================================================

import { useAuth } from '@/lib/store/auth-store'
import { useCurrentUser } from '@/lib/store/current-user-store'
import { useTeacherHubStore } from '@/lib/store/teacher-hub-store'
import { clearSessionToken } from '@/lib/auth-session-token'

// Several module hooks can observe the same dead session at once and
// all route through signOut() — share ONE server revocation + client
// reset instead of racing double POST /api/auth/logout and double
// store clears (both were visible in the dev log during the
// kick-back-on-login incident).
let signOutInFlight: Promise<void> | null = null

export async function signOut(): Promise<void> {
  if (signOutInFlight) return signOutInFlight
  signOutInFlight = (async () => {
    // Best-effort server revocation — never blocks the client reset.
    // In embedded contexts this request itself authenticates via the
    // Bearer token (fetch interceptor) so the right Session row dies.
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* the session/token are cleared client-side below regardless */
    }
    // Drop the bearer token only AFTER the logout request went out —
    // the interceptor needs it to identify the session to revoke.
    clearSessionToken()
    useCurrentUser.getState().clear()
    useAuth.getState().logout()
    // Teacher Hub live counts belong to the signed-in teacher — never let a
    // previous session's badge leak into the next user's sidebar.
    useTeacherHubStore.getState().clear()
  })().finally(() => {
    signOutInFlight = null
  })
  return signOutInFlight
}
