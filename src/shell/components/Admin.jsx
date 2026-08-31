// shell/components/Admin.jsx
//
// ADMIN MODE — a lock, not a security boundary.
//
// Read this before trusting it with anything: the PIN ships inside the client
// bundle (every VITE_* var does), and firestore.rules still allows any write
// from anyone with the URL. A determined person bypasses this in about ten
// seconds with devtools.
//
// What it IS good for, and why it exists: destructive actions (delete a
// player, a session, a match, an expense entry) sit one tap away on a phone
// that gets passed around courtside. A player doc that gets deleted takes its
// id with it, and every match stored under that id silently drops out of the
// stats — that already happened once and needed a manual Firestore remap to
// undo. Hiding Delete behind a PIN means a teammate scrolling the app can't
// trigger that by accident. That's the actual threat here.
//
// Archive is deliberately NOT gated: it is reversible, keeps history intact,
// and is the action almost everyone actually wants.
//
// If this ever needs to be real, the change is Firebase Auth + rules keyed on
// request.auth.uid — not a longer PIN.
//
// LIFTED TO THE SHELL. This replaces the two per-sport copies
// (shuttle/components/Admin.jsx and cricket/components/Admin.jsx), which were
// the same file twice with different storage keys. They were separate while
// the two apps were separate deployments; in one shell that meant unlocking
// twice, and it left the SHARED pages (/expenses, /people) with no admin
// context at all to gate their delete buttons against — which is what
// prompted the move.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'sportsmanager:admin'
// The two keys the per-sport providers used before this was lifted. Read once
// on boot so anyone already unlocked stays unlocked across the change, then
// cleared — otherwise "Clear local cache" would leave a legacy key behind
// that silently re-unlocks on the next reload.
const LEGACY_KEYS = ['shuttle-manager:admin', 'cricket-manager:admin']
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || ''

const AdminContext = createContext(null)

function readStoredUnlock() {
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return true
    const legacy = LEGACY_KEYS.some((k) => localStorage.getItem(k) === '1')
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
    if (legacy) localStorage.setItem(STORAGE_KEY, '1')
    return legacy
  } catch {
    return false
  }
}

export function AdminProvider({ children }) {
  // Locked by default. If VITE_ADMIN_PIN is unset the gate can't be opened at
  // all — deliberately failing closed rather than leaving Delete exposed on a
  // build where someone forgot to set the variable.
  const [isAdmin, setIsAdmin] = useState(readStoredUnlock)

  // A build with no PIN configured must not honour a flag left in localStorage
  // by an earlier build that did have one.
  useEffect(() => {
    if (!ADMIN_PIN && isAdmin) setIsAdmin(false)
  }, [isAdmin])

  const unlock = useCallback((pin) => {
    if (!ADMIN_PIN || pin !== ADMIN_PIN) return false
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Private browsing / storage disabled - the unlock still applies for
      // this session, it just won't survive a reload.
    }
    setIsAdmin(true)
    return true
  }, [])

  const lock = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    setIsAdmin(false)
  }, [])

  return (
    <AdminContext.Provider value={{ isAdmin, unlock, lock, configured: Boolean(ADMIN_PIN) }}>{children}</AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within an AdminProvider')
  return ctx
}
