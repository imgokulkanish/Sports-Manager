// SportPicker.jsx (shell)
//
// What renders at "/" — which is where the app opens from the home screen
// icon, the PWA start_url, and the catch-all route.
//
// FIRST RUN ONLY, on purpose. "/" used to be a hard <Navigate to="/shuttle">,
// which meant a brand-new Cricket user landed in Shuttle Manager with no clue
// there was anything else. The fix is to ask once — not on every launch. A
// per-launch gate would put a screen in front of every single open to serve a
// choice that changes maybe once a week, and the shell store already persists
// the answer (see store/useShellStore.js). So:
//
//   - never chosen  -> ask, once
//   - chosen before -> straight through to that sport, no interruption
//
// Deep links are untouched by any of this: /cricket/history and a refresh on
// it never route through "/", so they never see this screen. Day-to-day
// switching lives in the header chip (components/SportChip.jsx), the Sidebar,
// and the More sheet.
import React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useShellStore, SPORTS } from '../store/useShellStore'
import { SPORT_META } from '../config/navConfig'

const BLURB = {
  [SPORTS.SHUTTLE]: 'Weekly badminton sessions',
  [SPORTS.CRICKET]: 'Matches, tournaments & box cricket',
}

function SportCard({ sport, onPick }) {
  const meta = SPORT_META[sport]
  return (
    <button
      type="button"
      onClick={() => onPick(sport)}
      className="flex w-full items-center gap-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 text-left transition-transform active:scale-[0.98]"
    >
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
        style={{ backgroundColor: `${meta.accent}1A` }}
      >
        {meta.emoji}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-gray-900 dark:text-gray-100">{meta.label}</span>
        <span className="block text-xs text-gray-400 dark:text-gray-500">{BLURB[sport]}</span>
      </span>
    </button>
  )
}

export default function SportPicker() {
  const navigate = useNavigate()
  const currentSport = useShellStore((s) => s.currentSport)
  const hasChosenSport = useShellStore((s) => s.hasChosenSport)
  const setSport = useShellStore((s) => s.setSport)

  // The returning-user path — the overwhelmingly common one. `replace` so the
  // back button leaves the app instead of bouncing off this redirect.
  if (hasChosenSport) return <Navigate to={`/${currentSport}`} replace />

  const pick = (sport) => {
    setSport(sport)
    navigate(`/${sport}`, { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col justify-center max-w-md mx-auto px-5 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Sports Manager</h1>
        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Which sport are you here for?</p>
      </div>

      <div className="flex flex-col gap-3">
        {Object.values(SPORTS).map((sport) => (
          <SportCard key={sport} sport={sport} onPick={pick} />
        ))}
      </div>

      {/* Says up front that this isn't a screen they'll keep seeing, and
          where the control lives afterwards. */}
      <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        You can switch any time from the header.
      </p>
    </div>
  )
}
