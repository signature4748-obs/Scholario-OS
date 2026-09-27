'use client'

// ============================================================
// STABILIZATION — Server inbox store (canonical student messages)
// ------------------------------------------------------------
// The student Messages module + the bell/My-Feed "New messages"
// slice read REAL Message rows from GET /api/messages?box=inbox
// (recipientId = the session user — principal reminders, teacher
// notices, anything the school actually sent). This tiny store
// caches them so every surface sees ONE copy; StudentPanel
// hydrates it on mount next to the server-notices hydration, and
// the Messages module refreshes on mount for freshness.
//
// The former client-side `student-messaging-store` (fabricated
// Rohan/Kavita demo threads persisted in localStorage) is RETIRED
// — no invented conversations, ever. Compose is a staff-side
// capability in this backend (POST /api/messages is gated to
// PRINCIPAL/MANAGEMENT/TEACHER), so the student surface is an
// honest read-only inbox.
// ============================================================

import { create } from 'zustand'

export interface ServerInboxMessage {
  id: string
  subject: string
  body: string
  read: boolean
  createdAt: string
  sender: { id: string; name: string; role: string } | null
}

interface ServerInboxState {
  messages: ServerInboxMessage[] | null
  loading: boolean
  error: boolean
  refresh: () => Promise<void>
  /** Mark one message read (optimistic + server PATCH /api/messages). */
  markRead: (id: string) => Promise<void>
  /** Derived — unread inbox count (null while the inbox is loading). */
  unreadCount: () => number | null
}

async function fetchInbox(): Promise<ServerInboxMessage[]> {
  const r = await fetch('/api/messages?box=inbox', { cache: 'no-store', credentials: 'same-origin' })
  if (!r.ok) throw new Error('inbox unavailable')
  const j = await r.json()
  if (!j || typeof j !== 'object' || j.ok !== true || !Array.isArray(j.data)) {
    throw new Error('unexpected response')
  }
  return j.data as ServerInboxMessage[]
}

export const useServerInbox = create<ServerInboxState>((set, get) => ({
  messages: null,
  loading: false,
  error: false,

  refresh: async () => {
    if (get().loading) return
    set({ loading: true, error: false })
    try {
      const messages = await fetchInbox()
      set({ messages, loading: false })
    } catch {
      set({ error: true, loading: false })
    }
  },

  markRead: async (id) => {
    // Optimistic flip; the server acknowledgement is fire-and-forget but
    // failures roll the row back so the UI never claims a read that
    // wasn't persisted.
    const prev = get().messages
    set({
      messages: (prev ?? []).map((m) => (m.id === id ? { ...m, read: true } : m)),
    })
    try {
      const r = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id }),
      })
      if (!r.ok) throw new Error('patch failed')
    } catch {
      if (prev) set({ messages: prev })
    }
  },

  unreadCount: () => {
    const { messages } = get()
    if (!messages) return null
    return messages.filter((m) => !m.read).length
  },
}))
