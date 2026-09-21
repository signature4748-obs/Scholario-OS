'use client'

// ============================================================
// Bearer session token — cookie-blocked embedding contexts
// ------------------------------------------------------------
// The preview panel renders this app inside a CROSS-SITE iframe.
// Browsers (Chrome / Firefox / Safari) refuse to store and send the
// SameSite=Lax `erp_session` cookie inside third-party frames, so a
// login that succeeds server-side (200 + Set-Cookie) was immediately
// followed by cookie-less 401s on every panel API call → the shared
// dead-session policy (401 → signOut) reset the client → the user was
// "kicked back to the login screen" on every Sign In.
//
// Fix: POST /api/auth/login also returns the session token. We persist
// it (per-origin localStorage) and a one-time fetch interceptor
// attaches it as `Authorization: Bearer <token>` to every same-origin
// /api/* request. Passive by design:
//   • no token stored → fetch is the untouched native one;
//   • a request that already carries Authorization is never modified;
//   • non-/api and cross-origin URLs are never touched;
//   • server-side the HttpOnly cookie still takes precedence
//     (lib/auth.ts getSessionToken) — first-party tabs are unchanged.
// ============================================================

const TOKEN_KEY = 'scholario-session-token'

export function saveSessionToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Storage unavailable (private mode quirks) — the cookie path may
    // still work; do not break the login flow over it.
  }
}

export function readSessionToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function clearSessionToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing to clear.
  }
}

let interceptorInstalled = false

export function installApiBearerInterceptor(): void {
  if (interceptorInstalled || typeof window === 'undefined') return
  interceptorInstalled = true

  const nativeFetch = window.fetch.bind(window)

  window.fetch = function scholarioAuthorizedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const token = readSessionToken()
    if (!token) return nativeFetch(input, init)

    let url = ''
    try {
      url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    } catch {
      return nativeFetch(input, init)
    }

    // Same-origin /api/* only — never attach the session token to
    // cross-origin requests or non-API URLs.
    const isSameOriginApi =
      url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`)
    if (!isSameOriginApi) return nativeFetch(input, init)

    // Merge header sets from both sources (Request-object inputs carry
    // their own headers; init headers override them, mirroring fetch).
    const merged = new Headers()
    if (input instanceof Request) {
      input.headers.forEach((v, k) => merged.set(k, v))
    }
    if (init?.headers) {
      new Headers(init.headers).forEach((v, k) => merged.set(k, v))
    }
    if (merged.has('authorization')) return nativeFetch(input, init)
    merged.set('authorization', `Bearer ${token}`)

    if (typeof input === 'string' || input instanceof URL) {
      return nativeFetch(input, { ...init, headers: merged })
    }
    try {
      return nativeFetch(new Request(input, { headers: merged }))
    } catch {
      return nativeFetch(input, init)
    }
  }
}
