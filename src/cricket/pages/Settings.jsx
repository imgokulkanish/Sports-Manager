import React, { useState } from 'react'
import { firebaseStatus } from '../firebase'
import Footer from '../components/Footer'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../../shell/components/Toast'
import { useAdmin } from '../components/Admin'

const APP_VERSION = '1.0.0'

export default function Settings() {
  const [confirmClear, setConfirmClear] = useState(false)
  const { showToast } = useToast()
  const status = firebaseStatus()
  const { isAdmin, unlock, lock, configured } = useAdmin()
  const [pin, setPin] = useState('')

  const handleUnlock = () => {
    if (unlock(pin.trim())) {
      setPin('')
      showToast('Admin mode on — edit and delete are now available')
    } else {
      setPin('')
      showToast('Wrong PIN', 'error')
    }
  }

  const handleClearCache = () => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('cricket-manager:'))
    keys.forEach((k) => localStorage.removeItem(k))
    setConfirmClear(false)
    showToast('Local cache cleared')
  }

  return (
    <div className="max-w-md mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Settings</h1>

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 mb-4">
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-600">App version</span>
          <span className="text-sm text-gray-900 font-medium">{APP_VERSION}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-600">Data storage</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.configured ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
            {status.configured ? 'Firebase' : 'Local storage (dev mode)'}
          </span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-600">Developer</span>
          <span className="text-sm text-gray-900">Gokul Kanish</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-900">Admin mode</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isAdmin ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {isAdmin ? 'On' : 'Off'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Unlocks deleting matches and editing player names and roles. Not a security feature — it keeps those buttons out of the way on a shared
          phone, nothing more.
        </p>

        {!configured ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No PIN configured on this build. Set <span className="font-mono">VITE_ADMIN_PIN</span> in your environment and rebuild to enable admin mode.
          </p>
        ) : isAdmin ? (
          <button onClick={lock} className="w-full border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700">
            Turn off admin mode
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              placeholder="Enter PIN"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={handleUnlock} disabled={!pin.trim()} className="bg-pitch text-white text-sm font-medium rounded-lg px-4 disabled:bg-gray-300 disabled:text-gray-400">
              Unlock
            </button>
          </div>
        )}
      </div>

      <button onClick={() => setConfirmClear(true)} className="w-full border border-red-300 text-red-600 rounded-lg py-2.5 text-sm font-medium">
        {status.configured ? 'Clear local cache' : 'Reset all local data'}
      </button>

      <ConfirmDialog
        open={confirmClear}
        title={status.configured ? 'Clear local cache?' : 'Reset all local data?'}
        message={
          status.configured
            ? 'Removes any locally cached match data used for offline scoring, and turns admin mode back off. Data already synced to Firebase is unaffected.'
            : "You're running in local-storage dev mode — this permanently deletes every player and match stored in this browser. This cannot be undone."
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
