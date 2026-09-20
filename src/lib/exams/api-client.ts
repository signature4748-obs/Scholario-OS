// Shared client-side fetch wrapper for exam APIs.
// Eliminates the 3 near-identical copies of api<T>() that existed in
// use-exams.ts, use-exams-extended.ts, use-exam-settings.ts.

export interface ApiError {
  message: string
  status?: number
  details?: unknown
}

export async function api<T>(
  url: string,
  options?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers: Record<string, string> = { ...((options?.headers as Record<string, string>) ?? {}) }
  let body = options?.body
  if (options?.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.json)
  }
  const res = await fetch(url, {
    ...options,
    headers,
    body,
    credentials: 'same-origin',
  })
  const text = await res.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = text
  }
  if (!res.ok) {
    let message = `Request failed: ${res.status} ${res.statusText}`
    if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>
      if (typeof obj.error === 'string') message = obj.error
      else if (typeof obj.message === 'string') message = obj.message
    } else if (typeof payload === 'string' && payload.trim().length > 0) {
      // Non-JSON error body (proxy/gateway HTML pages, plain text).
      // NEVER surface the raw body — a whole HTML page as an error
      // message destroys layouts. Keep it to a short single-line snippet.
      const snippet = payload.trim().replace(/\s+/g, ' ').slice(0, 120)
      message = `Request failed: ${res.status} ${res.statusText} — ${snippet}`
    }
    const err: ApiError = { message, status: res.status, details: payload }
    throw err
  }
  // Server responses are wrapped as { ok: true, data: T } by the withUser helper.
  // Unwrap the .data field when present. Non-JSON 2xx bodies (e.g. a gateway
  // placeholder served mid-restart) can't be unwrapped — treat them as errors
  // instead of crashing on the `in` check below.
  if (payload && typeof payload === 'object' && 'ok' in (payload as Record<string, unknown>)) {
    const obj = payload as { ok: boolean; data?: unknown; error?: string }
    if (obj.ok) return obj.data as T
    throw { message: obj.error ?? 'Unknown error', status: res.status } as ApiError
  }
  if (typeof payload === 'string' && payload.trim().startsWith('<')) {
    // HTML body on a 200 — the gateway answered for a dead/busy backend.
    throw {
      message: 'Service temporarily unavailable — please retry in a moment.',
      status: res.status,
    } as ApiError
  }
  return payload as T
}
