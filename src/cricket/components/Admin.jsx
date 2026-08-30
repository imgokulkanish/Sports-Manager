import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

// ADMIN MODE — a lock, not a security boundary.
//
// Read this before trusting it with anything: the PIN ships inside the
// client bundle (every VITE_* var does), and Firestore rules still allow
// any write from anyone with the URL. A determined person can bypass this
// in about ten seconds with devtools.
//
// What it IS good for, and why it exists: the destructive actions (delete a
// match, delete/rename a player) are one tap away on a shared phone at the
// ground. Hiding them behind a PIN means a teammate scrolling the app can't
// wipe a match by accident. That's the actual threat here.
//
// If this ever needs to be real, the change is Firebase Auth + rules keyed
// on request.auth.uid — not a better PIN.

const STORAGE_KEY = 'cricket-manager:admin'
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || ''

const AdminContext = createContext(null)

export function AdminProvider({ children }) {
  // Locked by default. If VITE_ADMIN_PIN is unset the gate can't be opened
  // at all — deliberately failing closed rather than leaving delete buttons
  // exposed on a build where someone forgot to set the variable.
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  // A build with no PIN configured must not honour a flag left in
  // localStorage from an earlier build that did have one.
  useEffect(() => {
    if (!ADMIN_PIN && isAdmin) setIsAdmin(false)
  }, [isAdmin])

  const unlock = useCallback((pin) => {
    if (!ADMIN_PIN || pin !== ADMIN_PIN) return false
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Private browsing / storage disabled — unlock still applies for this
      // session, it just won't survive a reload.
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

  return <AdminContext.Provider value={{ isAdmin, unlock, lock, configured: Boolean(ADMIN_PIN) }}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within an AdminProvider')
  return ctx
}
