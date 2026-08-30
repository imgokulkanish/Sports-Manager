// ShuttleRoutes.jsx
//
// Real page imports, wired in — this supersedes App.jsx's old routing.
// Players/Expenses routes are gone from here on purpose: those pages now
// live in the shell's shared section. Shuttle's own pages/Players.jsx and
// pages/Expenses.jsx files still exist on disk (untouched) but are no
// longer routed to from anywhere — harmless dead files, kept rather than
// deleted in case you want to diff against them later.
import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AdminProvider } from './components/Admin'
import Dashboard from './pages/Dashboard'
import NewSession from './pages/NewSession'
import QuickMatch from './pages/QuickMatch'
import LiveSession from './pages/LiveSession'
import SessionDetail from './pages/SessionDetail'
import History from './pages/History'
import Stats from './pages/Stats'
import Settings from './pages/Settings'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-[fadein_0.18s_ease-out]">
      <Routes location={location}>
        <Route path="" element={<Dashboard />} />
        <Route path="session/new" element={<NewSession />} />
        <Route path="quick" element={<QuickMatch />} />
        <Route path="session/:id/live" element={<LiveSession />} />
        <Route path="session/:id" element={<SessionDetail />} />
        <Route path="history" element={<History />} />
        <Route path="stats" element={<Stats />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </div>
  )
}

export default function ShuttleRoutes() {
  return (
    <AdminProvider>
      <AnimatedRoutes />
    </AdminProvider>
  )
}
