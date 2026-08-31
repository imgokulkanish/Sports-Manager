// theme.jsx
//
// Moved from shuttle-manager/src/theme.jsx — otherwise identical, one
// change: STORAGE_KEY renamed from 'shuttle-manager:theme' to
// 'sportsmanager:theme' to match the rename in index.html's inline script (see
// that file's comment for why — it's a one-time, harmless reset of saved
// preference, not a data concern). Everything else, including the
// light-default-not-system-default reasoning in the header comment, is
// unchanged.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'sportsmanager:theme'
const DEFAULT_PREFERENCE = 'light'

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark)
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_PREFERENCE
    } catch {
      return DEFAULT_PREFERENCE
    }
  })

  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystemDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const isDark = preference === 'dark' || (preference === 'system' && systemDark)

  useEffect(() => {
    applyTheme(isDark)
  }, [isDark])

  const setThemePreference = (next) => {
    setPreference(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage unavailable - preference just won't persist across reloads
    }
  }

  const value = useMemo(() => ({ preference, isDark, setThemePreference }), [preference, isDark])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
