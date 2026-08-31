import React from 'react'
import { NavLink } from 'react-router-dom'
import { BatIcon } from './StatIcons'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/players', label: 'Players', icon: UsersIcon },
  { to: '/cricket/match/new', label: 'New', icon: PlusIcon },
  { to: '/cricket/history', label: 'History', icon: HistoryIcon },
  { to: '/cricket/stats', label: 'Stats', icon: ChartIcon },
  { to: '/cricket/matchups', label: 'Matchups', icon: MatchupIcon },
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
function MatchupIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="12" r="3" />
      <path d="M9.5 12h5" strokeLinecap="round" strokeDasharray="0.5 2.5" />
    </svg>
  )
}
function SettingsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-.9-2 3.4L6.6 11a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.75 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 pb-safe md:hidden">
      <div className="flex justify-around">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 px-3 min-w-[44px] min-h-[44px] justify-center ${isActive ? 'text-pitch' : 'text-gray-400'}`}
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
    <aside className="hidden md:flex md:flex-col w-56 lg:w-64 shrink-0 border-r border-gray-200 bg-white h-screen sticky top-0 px-3 py-5">
      <div className="flex items-center gap-2 px-3 mb-1">
        <div className="w-7 h-7 rounded-full bg-pitch text-white flex items-center justify-center">
          <BatIcon className="w-4 h-4" />
        </div>
        <span className="font-semibold text-gray-900 lg:inline hidden">Cricket Manager</span>
      </div>
      <p className="text-[9px] text-gray-400 tracking-wide px-3 mb-6 lg:block hidden">A Gokul Kanish Product</p>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-pitch-light text-pitch' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="lg:inline hidden">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-3">
        <NavLink to="/settings" aria-label="Settings" className="flex items-center gap-3 text-gray-400 hover:text-gray-600 px-0 py-2">
          <SettingsIcon className="w-5 h-5 shrink-0" />
          <span className="text-xs font-medium lg:inline hidden">Settings</span>
        </NavLink>
      </div>
    </aside>
  )
}
