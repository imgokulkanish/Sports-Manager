// pages/Settings.jsx
import React, { useState } from 'react'
import { firebaseStatus } from '../firebase'
import { useTheme } from '../theme'
import Footer from '../components/Footer'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../../shell/components/Toast'
import { useAdmin } from '../components/Admin'

const APP_VERSION = '1.0.0'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

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
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('shuttle-manager:'))
    keys.forEach((k) => localStorage.removeItem(k))
    // The admin flag lives under the same prefix, so drop the in-memory state
    // too - otherwise the buttons stay visible until the next reload.
    lock()
    setConfirmClear(false)
    showToast('Local cache cleared')
  }

  return (
    <div className="max-w-md mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Settings</h1>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-4">
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

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 mb-4">
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

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center text-sm font-bold shrink-0">
            GK
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Gokul Kanish</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Built for our badminton group.</p>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">Shuttle Manager v{APP_VERSION}</p>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-4">
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
          Unlocks deleting players and sessions. Not a security feature - it keeps those buttons out of the way on a shared phone, nothing
          more. Archiving a player stays available to everyone and keeps their history.
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
        Clear local cache
      </button>

      <ConfirmDialog
        open={confirmClear}
        title="Clear local cache?"
        message="Removes any locally cached session data used for offline scoring, and turns admin mode back off. Data already synced to Firebase is unaffected."
        confirmLabel="Clear"
        danger
        onConfirm={handleClearCache}
        onCancel={() => setConfirmClear(false)}
      />

      <Footer />
    </div>
  )
}
