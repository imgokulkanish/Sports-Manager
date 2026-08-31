// shell/pages/Settings.jsx  —  routed at /settings
//
// ONE Settings page for the whole app. This replaces shuttle/pages/Settings.jsx
// and cricket/pages/Settings.jsx, which were two near-identical pages that
// quietly disagreed with each other:
//
//   - Theme only existed on the Shuttle one, even though ThemeProvider is
//     shell-level and the setting has always applied to both sports. Sitting
//     in Cricket there was no way to reach it at all.
//   - Admin mode appeared twice and unlocked separately (two localStorage
//     keys), so the same PIN had to be entered twice to get delete buttons in
//     both sports — and neither unlock reached the shared /expenses page.
//   - "Clear local cache" each swept only its own key prefix, so clearing from
//     one sport left the other sport's cache sitting there.
//   - Firebase status was read from two shims that both re-export the SAME
//     src/firebase.js, so the two "Data source"/"Data storage" rows could
//     never actually differ. One row is the honest version.
//
// Everything left here is genuinely app-wide, which is why there's nothing to
// split back out per sport. /shuttle/settings and /cricket/settings redirect
// here rather than 404.
import React, { useState } from 'react'
import { firebaseStatus } from '../../firebase'
import { useTheme } from '../../theme'
import Footer from '../components/Footer'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { useAdmin } from '../components/Admin'

const APP_VERSION = '1.0.0'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

// Both sports' caches plus the shell's own keys. The per-sport pages each
// swept one prefix; a single button has to sweep all of them or it's lying
// about what it just did.
const CACHE_PREFIXES = ['shuttle-manager:', 'cricket-manager:', 'sportsmanager:', 'shell:']
// ...except the theme, which lives under the sportsmanager: prefix but is a
// preference, not a cache. Wiping it would flip someone back to light mode as
// a side effect of clearing data, which isn't what the button says it does.
const CACHE_KEEP = ['sportsmanager:theme']

const CARD = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg'

export default function Settings() {
  const [confirmClear, setConfirmClear] = useState(false)
  const { showToast } = useToast()
  const { preference, setThemePreference } = useTheme()
  const { isAdmin, unlock, lock, configured: adminConfigured } = useAdmin()
  const [pin, setPin] = useState('')
  const status = firebaseStatus()

  const handleUnlock = () => {
    if (unlock(pin.trim())) {
      setPin('')
      showToast('Admin mode on - delete is now available')
    } else {
      setPin('')
      showToast('Wrong PIN', 'error')
    }
  }

  const handleClearCache = () => {
    const keys = Object.keys(localStorage).filter(
      (k) => CACHE_PREFIXES.some((p) => k.startsWith(p)) && !CACHE_KEEP.includes(k),
    )
    keys.forEach((k) => localStorage.removeItem(k))
    // The admin flag lives under one of those prefixes, so drop the in-memory
    // state too - otherwise the buttons stay visible until the next reload.
    lock()
    setConfirmClear(false)
    showToast('Local cache cleared')
  }

  return (
    <div className="max-w-md mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Settings</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">These apply to badminton and cricket alike.</p>

      <div className={`${CARD} p-4 mb-4`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Appearance</p>
        <div className="grid grid-cols-3 gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setThemePreference(opt.value)}
              className={`text-xs font-medium rounded-md py-2 transition-colors ${
                preference === opt.value
                  ? 'bg-white dark:bg-gray-700 text-brand dark:text-emerald-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
          "System" follows your device's light/dark setting automatically.
        </p>
      </div>

      <div className={`${CARD} divide-y divide-gray-100 dark:divide-gray-800 mb-4`}>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">App version</span>
          <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">{APP_VERSION}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">Data source</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              status.configured
                ? 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300'
                : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
            }`}
          >
            {status.configured ? 'Firebase' : 'Local storage (no Firebase)'}
          </span>
        </div>
      </div>

      <div className={`${CARD} p-4 mb-4`}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center text-sm font-bold shrink-0">
            GK
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Gokul Kanish</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Built for our badminton and cricket group.</p>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">Sports Manager v{APP_VERSION}</p>
      </div>

      <div className={`${CARD} p-4 mb-4`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Admin mode</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isAdmin
                ? 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            {isAdmin ? 'On' : 'Off'}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          One unlock, both sports. Covers deleting players, sessions and matches, editing cricket names and roles, deleting expense
          entries and unlinking people. Not a security feature - it keeps those buttons out of the way on a shared phone, nothing more.
          Archiving a player stays available to everyone and keeps their history.
        </p>

        {!adminConfigured ? (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2">
            No PIN configured on this build. Set <span className="font-mono">VITE_ADMIN_PIN</span> in your environment and rebuild to enable
            admin mode.
          </p>
        ) : isAdmin ? (
          <button
            onClick={() => {
              lock()
              showToast('Admin mode off')
            }}
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Turn off admin mode
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              placeholder="Enter PIN"
              className="flex-1 min-w-0 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            <button
              onClick={handleUnlock}
              disabled={!pin.trim()}
              className="bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-4 transition-all active:scale-[0.98] disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:hover:bg-gray-200 dark:disabled:hover:bg-gray-800 disabled:active:scale-100"
            >
              Unlock
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setConfirmClear(true)}
        className="w-full border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 rounded-lg py-2.5 text-sm font-medium transition-colors active:scale-[0.98] hover:bg-red-50 dark:hover:bg-red-500/10"
      >
        {status.configured ? 'Clear local cache' : 'Reset all local data'}
      </button>

      <ConfirmDialog
        open={confirmClear}
        title={status.configured ? 'Clear local cache?' : 'Reset all local data?'}
        message={
          status.configured
            ? 'Removes any locally cached badminton and cricket data used for offline scoring, and turns admin mode back off. Your theme choice, and anything already synced to Firebase, are unaffected.'
            : "You're running in local-storage dev mode - this permanently deletes every player, session and match stored in this browser. This cannot be undone."
        }
        confirmLabel="Clear"
        danger
        onConfirm={handleClearCache}
        onCancel={() => setConfirmClear(false)}
      />

      <Footer />
    </div>
  )
}
