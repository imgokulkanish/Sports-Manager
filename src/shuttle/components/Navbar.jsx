// components/Navbar.jsx
import React from 'react'
import { NavLink } from 'react-router-dom'
import { ShuttlecockIcon } from './icons'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/players', label: 'Players', icon: UsersIcon },
  { to: '/shuttle/session/new', label: 'New', icon: PlusIcon },
  { to: '/shuttle/quick', label: 'Quick', icon: BoltIcon },
  { to: '/shuttle/history', label: 'History', icon: HistoryIcon },
  { to: '/shuttle/stats', label: 'Stats', icon: ChartIcon },
  // Sidebar only. The bottom bar is already full at six: each item needs
  // ~44-63px (min-w-[44px] plus px-3 and the label), which totals ~320px, and
  // adding "Expenses" pushes it to ~388px - past a 360px Android and a 320px
  // SE. The desktop sidebar stacks vertically and has room. On mobile you
  // reach expenses from the Dashboard's "Who's paying this week?" card, which
  // is where the decision actually gets made.
  { to: '/expenses', label: 'Expenses', icon: WalletIcon, sidebarOnly: true },
]

function HomeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function UsersIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" strokeLinecap="round" />
      <circle cx="17" cy="8.5" r="2.5" />
      <path d="M15.5 14.2c2.7.4 4.5 2.5 4.5 5.8" strokeLinecap="round" />
    </svg>
  )
}
function PlusIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  )
}
function WalletIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2" strokeLinecap="round" />
      <path d="M3 7.5v9A2.5 2.5 0 0 0 5.5 19H19a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5.5A2.5 2.5 0 0 1 3 7.5Z" strokeLinejoin="round" />
      <circle cx="16" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
function BoltIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function HistoryIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
      <path d="M3 4v4h4M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ChartIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe md:hidden">
      <div className="flex justify-around">
        {NAV_ITEMS.filter((item) => !item.sidebarOnly).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 px-3 min-w-[44px] min-h-[44px] justify-center transition-colors active:scale-95 ${
                isActive ? 'text-brand' : 'text-gray-400 dark:text-gray-500'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-56 lg:w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-screen sticky top-0 px-3 py-5">
      <div className="flex items-center gap-2 px-3 mb-6">
        <ShuttlecockIcon className="w-5 h-5 text-brand shrink-0" />
        <div className="lg:block hidden">
          <span className="font-semibold text-gray-900 dark:text-gray-100 block leading-tight">Shuttle Manager</span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">A Gokul Kanish Product</span>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-light dark:bg-brand/15 text-brand'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="lg:inline hidden">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-3">
        <NavLink to="/settings" className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
          Settings
        </NavLink>
      </div>
    </aside>
  )
}
