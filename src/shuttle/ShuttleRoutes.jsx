// ShuttleRoutes.jsx
//
// Real page imports, wired in — this supersedes App.jsx's old routing.
//
// Players is routed here again (as /shuttle/players). It briefly wasn't:
// the shell's shared /players page could only LINK a person's two
// identities, and every per-player stat this app has — win %, achievements,
// the detail modal, add/archive — only exists on this page, against this
// sport's own sessions. Shuttle stats and cricket stats share no fields, so
// there was nothing for one merged roster page to show.
//
// Expenses stays out: that one really is cross-sport (one joint pot), and
// lives at the shell's /expenses. pages/Expenses.jsx still exists on disk,
// untouched and unrouted — kept rather than deleted so it can be diffed
// against the shared version.
import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import NewSession from './pages/NewSession'
import QuickMatch from './pages/QuickMatch'
import Players from './pages/Players'
import LiveSession from './pages/LiveSession'
import SessionDetail from './pages/SessionDetail'
import History from './pages/History'
import Stats from './pages/Stats'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-[fadein_0.18s_ease-out]">
      <Routes location={location}>
        <Route path="" element={<Dashboard />} />
        <Route path="session/new" element={<NewSession />} />
        <Route path="quick" element={<QuickMatch />} />
        <Route path="players" element={<Players />} />
        <Route path="session/:id/live" element={<LiveSession />} />
        <Route path="session/:id" element={<SessionDetail />} />
        <Route path="history" element={<History />} />
        <Route path="stats" element={<Stats />} />
        {/* Settings is one shell-level page now (/settings) rather than one
            per sport — the two were the same handful of rows, and the parts
            that mattered (theme, the admin PIN, "clear cache") were never
            sport-specific to begin with. Redirect rather than 404 so old
            links and bookmarks still land somewhere useful. */}
        <Route path="settings" element={<Navigate to="/settings" replace />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </div>
  )
}

export default function ShuttleRoutes() {
  // AdminProvider used to wrap this tree; it now wraps the whole app from
  // App.jsx, so one unlock covers both sports and the shared pages too.
  return <AnimatedRoutes />
}
