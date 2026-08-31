// BottomNav.jsx (shell)
//
// MOBILE NAV IS THE ONE PART OF THIS SKELETON THAT NEEDS A REAL DECISION,
// NOT JUST A PORT — flagging clearly rather than quietly picking for you.
//
// Cricket Manager's own notes say its bottom nav is already "full at six
// items" on mobile with Home/Players/New match/History/Stats/Matchups. Once
// Players moves to the shared section, Cricket's sport-specific nav drops to
// five (Home, New match, History, Stats, Matchups) — but the shell still
// needs to fit the sport switcher AND the two shared items (Players,
// Expenses) somewhere on a 375px screen, and a flat bottom nav can't hold
// nine things.
//
// What this file does about it (one reasonable option, not the only one):
//   - Bottom nav shows the current sport's items, plus a trailing "More" tab.
//   - "More" opens a bottom sheet with the sport switcher + shared items.
// That keeps Cricket back at 6 taps total (5 sport + More) and Shuttle at 5
// (4 sport + More), so neither regresses past what Cricket already shipped.
//
// Alternatives worth considering instead, if this doesn't feel right:
//   - A slim sport-switcher strip pinned above the bottom nav (costs
//     vertical space on every screen, on every scroll).
//   - Long-press or swipe on the bottom nav to reveal the switcher (less
//     discoverable, no visible affordance).
// Happy to swap this for either — flagging so the choice is explicit, not
// buried in a component you didn't ask to review line-by-line.
import React, { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useShellStore, SPORTS } from '../store/useShellStore'
import { SHARED_NAV_ITEMS, SPORT_META, navItemsFor } from '../config/navConfig'
import Icon from './icons'

function TabLink({ item, accent }) {
  return (
    <NavLink
      to={item.path}
      end={item.end ?? item.path.split('/').length <= 2}
      className={({ isActive }) =>
        [
          'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium',
          isActive ? '' : 'text-gray-500 dark:text-gray-400',
        ].join(' ')
      }
      style={({ isActive }) => (isActive ? { color: accent } : undefined)}
    >
      <Icon name={item.icon} size={22} />
      {item.mobileLabel || item.label}
    </NavLink>
  )
}

function MoreSheet({ onClose, navItems }) {
  const navigate = useNavigate()
  const currentSport = useShellStore((s) => s.currentSport)
  const setSport = useShellStore((s) => s.setSport)

  // Same as the desktop sidebar: the store alone only swaps the tab bar, the
  // navigate is what actually takes you to the other sport.
  const switchSport = (sport) => {
    setSport(sport)
    navigate(`/${sport}`)
    onClose()
  }

  // Items this section has that didn't fit the tab bar (Players and Box
  // Cricket, today) — without this they'd be unreachable on a phone. Comes
  // from the parent so the sheet matches whatever the tab bar is showing,
  // including Box Cricket's own list.
  const overflow = navItems.filter((item) => item.bottomNav === false)

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <button
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white dark:bg-gray-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Sport
        </p>
        <div className="flex gap-2 mb-5">
          {Object.values(SPORTS).map((sport) => {
            const meta = SPORT_META[sport]
            const isActive = sport === currentSport
            return (
              <button
                key={sport}
                onClick={() => switchSport(sport)}
                className={[
                  'flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium',
                  isActive
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
                ].join(' ')}
                style={isActive ? { backgroundColor: meta.accent } : undefined}
              >
                <span>{meta.emoji}</span> {meta.label}
              </button>
            )
          })}
        </div>

        {overflow.length > 0 && (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {SPORT_META[currentSport].label}
            </p>
            <div className="flex flex-col gap-1 mb-5">
              {overflow.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </>
        )}

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Shared
        </p>
        <div className="flex flex-col gap-1">
          {SHARED_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function BottomNav() {
  const { pathname } = useLocation()
  const currentSport = useShellStore((s) => s.currentSport)
  const [moreOpen, setMoreOpen] = useState(false)
  const accent = SPORT_META[currentSport].accent
  // Box Cricket swaps the whole tab bar rather than adding a seventh tab —
  // see navConfig.js.
  const navItems = navItemsFor(pathname, currentSport)
  const items = navItems.filter((item) => item.bottomNav !== false)

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pb-safe">
        {items.map((item) => (
          <TabLink key={item.path} item={item} accent={accent} />
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-gray-500 dark:text-gray-400"
        >
          <Icon name="menu" size={22} />
          More
        </button>
      </nav>
      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} navItems={navItems} />}
    </>
  )
}
