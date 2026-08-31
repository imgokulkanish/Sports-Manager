// SportChip.jsx (shell)
//
// The mobile answer to "how do I know the other sport exists?".
//
// Before this, the sport switcher lived ONLY inside the More sheet's bottom
// drawer (see BottomNav.jsx) — so on a phone nothing on screen said the app
// had two sports, and switching cost two taps behind a tab most people never
// open. This puts the current sport in the header of the screen you always
// land on, one tap from the other one.
//
// Deliberately NOT a launch-time sport picker on every open: the shell store
// already persists your last sport, so a per-launch gate would tax every
// single open for a choice that changes maybe once a week, and it would sit
// in front of deep links and refreshes too. The one-time version of that
// idea lives in shell/pages/SportPicker.jsx, for first run only.
//
// `md:hidden` because desktop already has the always-visible switcher at the
// top of the Sidebar — this would just be a second control saying the same
// thing.
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShellStore, SPORTS } from '../store/useShellStore'
import { SPORT_META } from '../config/navConfig'
import Icon from './icons'

export default function SportChip() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const navigate = useNavigate()
  const currentSport = useShellStore((s) => s.currentSport)
  const setSport = useShellStore((s) => s.setSport)
  const meta = SPORT_META[currentSport]

  // Dismiss on outside tap / Escape. pointerdown rather than click so the
  // menu closes on the press that starts elsewhere, matching how the More
  // sheet's scrim behaves.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Same two-step as the Sidebar and the More sheet: the store swaps the nav,
  // the navigate is what actually moves you off the sport you were looking at.
  const pick = (sport) => {
    setOpen(false)
    if (sport === currentSport) return
    setSport(sport)
    navigate(`/${sport}`)
  }

  return (
    <div ref={wrapRef} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Sport: ${meta.label}. Change sport`}
        className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-2.5 pr-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 active:scale-[0.97] transition-transform"
      >
        <span className="text-sm leading-none">{meta.emoji}</span>
        {meta.label}
        <Icon name="chevron-down" size={14} className="text-gray-400 dark:text-gray-500" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-40 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg"
        >
          {Object.values(SPORTS).map((sport) => {
            const m = SPORT_META[sport]
            const isActive = sport === currentSport
            return (
              <button
                key={sport}
                role="menuitem"
                onClick={() => pick(sport)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 active:bg-gray-50 dark:active:bg-gray-800"
              >
                <span>{m.emoji}</span>
                <span className="flex-1 text-left">{m.label}</span>
                {isActive && (
                  <span className="text-sm leading-none" style={{ color: m.accent }} aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
