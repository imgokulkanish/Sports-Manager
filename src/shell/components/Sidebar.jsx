// Sidebar.jsx (shell)
//
// Desktop nav (md: and up). Structure, top to bottom:
//   1. Sport switcher (Shuttle / Cricket) — always visible, changes
//      `currentSport` in the shell store and swaps section 2's contents.
//   2. Sport-specific nav for whichever sport is active.
//   3. Shared nav (Players, Expenses) — always visible, never swaps.
//
// This is a NEW component, not a port of either app's existing Sidebar —
// each app's original Sidebar (inside components/Navbar.jsx) only ever had
// to render one sport's items, so there's no existing "swap nav below a
// switcher" logic to reuse. Visual styling (spacing, active-state treatment)
// is a fresh pass matching each app's existing tokens (brand/pitch), not a
// copy of either original file, since I don't have either Navbar.jsx source
// to port from — paste them if you'd like the visual details matched more
// closely than what's here.
import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useShellStore, SPORTS } from '../store/useShellStore'
import { SHARED_NAV_ITEMS, SPORT_META, navItemsFor } from '../config/navConfig'
import Icon from './icons'

function SportButton({ sport, isActive, onClick }) {
  const meta = SPORT_META[sport]
  return (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      className={[
        'flex-1 flex flex-col items-center gap-1 rounded-xl py-2.5 text-sm font-medium transition-all active:scale-[0.98]',
        isActive
          ? 'text-white shadow-sm'
          : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
      ].join(' ')}
      style={isActive ? { backgroundColor: meta.accent } : undefined}
    >
      <span className="text-lg leading-none">{meta.emoji}</span>
      {meta.label}
    </button>
  )
}

function NavItem({ item, accent }) {
  return (
    <NavLink
      to={item.path}
      end={item.end ?? item.path.split('/').length <= 2}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-gray-100 dark:bg-gray-800'
            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/60',
        ].join(' ')
      }
      style={({ isActive }) => (isActive ? { color: accent } : undefined)}
    >
      <Icon name={item.icon} />
      {item.label}
    </NavLink>
  )
}

export default function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const currentSport = useShellStore((s) => s.currentSport)
  const setSport = useShellStore((s) => s.setSport)
  const accent = SPORT_META[currentSport].accent
  // Usually the selected sport's items; Box Cricket is the one section that
  // swaps them from the URL instead — see navConfig.js.
  const navItems = navItemsFor(pathname, currentSport)

  // Switching sport has to move the router too, not just the store — picking
  // Cricket while sitting on /shuttle used to swap the nav list underneath you
  // while the Shuttle dashboard stayed on screen. Land on the sport's home.
  const switchSport = (sport) => {
    setSport(sport)
    navigate(`/${sport}`)
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 min-h-screen p-4">
      {/* 0. Brand — ported from Shuttle Manager's own Sidebar, which carried
          the app name + "A Gokul Kanish Product" above its nav. The name is
          the SHELL's (Sports Manager, per index.html/manifest), not either
          sport's, since the switcher right below it is what picks a sport. */}
      <div className="px-1 mb-5">
        <span className="block font-semibold leading-tight text-gray-900 dark:text-gray-100">Sports Manager</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">A Gokul Kanish Product</span>
      </div>

      {/* 1. Sport switcher */}
      <div className="flex gap-2 p-1 rounded-2xl bg-gray-50 dark:bg-gray-800/50 mb-6">
        {Object.values(SPORTS).map((sport) => (
          <SportButton
            key={sport}
            sport={sport}
            isActive={sport === currentSport}
            onClick={() => switchSport(sport)}
          />
        ))}
      </div>

      {/* 2. Sport-specific nav — swaps when the switcher above changes */}
      <nav className="flex flex-col gap-1 mb-6">
        {navItems.map((item) => (
          <NavItem key={item.path} item={item} accent={accent} />
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
        {/* 3. Shared nav — never swaps regardless of selected sport */}
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Shared
        </p>
        <nav className="flex flex-col gap-1">
          {SHARED_NAV_ITEMS.map((item) => (
            <NavItem key={item.path} item={item} accent="#6B7280" />
          ))}
        </nav>
      </div>
    </aside>
  )
}
