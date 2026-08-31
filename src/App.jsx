// App.jsx (shell)
//
// This REPLACES Shuttle Manager's current top-level App.jsx as the app's
// entry shell. Cricket Manager's current App.jsx is retired the same way —
// both apps' actual page/route content moves into ShuttleRoutes.jsx /
// CricketRoutes.jsx (see those files' TODOs) rather than being rewritten.
//
// Providers kept from the existing apps, moved up to shell level since both
// are sport-agnostic as written:
//   - ThemeProvider — ported from Shuttle Manager's theme.jsx unchanged.
//     Cricket's pages have zero dark: classes today, so switching to Cricket
//     while dark mode is on will look "off" (light-only) until someone
//     retrofits dark: variants there — that's an existing gap this shell
//     surfaces rather than causes, flagging so it's not a surprise.
//   - ToastProvider — CONFIRMED: Shuttle's and Cricket's Toast.jsx were the
//     same useToast() shape, so Shuttle's became the one true instance here
//     and both sports' copies were deleted. They each called createContext()
//     themselves, and two contexts meant every page that toasts threw
//     "must be used within a ToastProvider" and white-screened. Pages now
//     import useToast from shell/components/Toast directly — deliberately
//     NOT via a per-sport re-export shim, since a file that only re-exports
//     gives react-refresh no component to anchor to and goes stale in dev.
//
//   - AdminProvider — LIFTED (it wasn't, originally). The two per-sport
//     providers turned out to be the same file twice under different
//     localStorage keys, which meant entering the same PIN twice, and left
//     the shared pages (/expenses, /people) with no admin context at all to
//     gate their destructive buttons against. One provider at shell level,
//     one unlock, one Settings page to toggle it from. See
//     shell/components/Admin.jsx.
import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './theme' // moved from shuttle-manager/src/theme.jsx, unchanged
import { ToastProvider } from './shell/components/Toast' // moved from shuttle-manager/src/components/Toast.jsx, unchanged
import { AdminProvider } from './shell/components/Admin'
import Sidebar from './shell/components/Sidebar'
import BottomNav from './shell/components/BottomNav'
import SportRouteSync from './shell/hooks/useSportRouteSync'
import PlayersShared from './shell/pages/PlayersShared'
import ExpensesShared from './shell/pages/ExpensesShared'
import Settings from './shell/pages/Settings'
import SportPicker from './shell/pages/SportPicker'

// Lazy-loaded so picking one sport doesn't pull the other sport's whole
// route tree (pages, engine modules, PDF export libs, etc.) into the
// initial bundle. Each of these is a NEW file that re-exports the existing
// app's routes — see the TODO block at the top of each for exactly what to
// move in from the original App.jsx.
const ShuttleRoutes = lazy(() => import('./shuttle/ShuttleRoutes'))
const CricketRoutes = lazy(() => import('./cricket/CricketRoutes'))

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AdminProvider>
        <BrowserRouter>
          <SportRouteSync />
          <div className="md:flex min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
            <Sidebar />
            <main className="flex-1 min-w-0 pb-20 md:pb-0">
              <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading…</div>}>
                <Routes>
                  {/* "/" is where the home-screen icon and the PWA
                      start_url land, so it decides the very first thing you
                      see. It used to hard-redirect into Shuttle, which meant
                      a new Cricket user was dropped into the wrong sport with
                      no sign the other one existed. SportPicker asks once on
                      first run and redirects straight through on every launch
                      after — see its header for why it's not a per-launch
                      gate. Deep links never route through here. */}
                  <Route path="/" element={<SportPicker />} />
                  {/* The shared page is now ONLY the cross-sport identity
                      link — each sport's real roster (with its own stats)
                      lives at /shuttle/players and /cricket/players. Old
                      /players links redirect rather than 404 into Shuttle. */}
                  <Route path="/people" element={<PlayersShared />} />
                  <Route path="/players" element={<Navigate to="/people" replace />} />
                  <Route path="/expenses" element={<ExpensesShared />} />
                  {/* One Settings page for the whole app — both sports' own
                      /settings routes redirect here. See its header for what
                      the two per-sport pages were disagreeing about. */}
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/shuttle/*" element={<ShuttleRoutes />} />
                  <Route path="/cricket/*" element={<CricketRoutes />} />
                  {/* Unknown paths go through "/" rather than straight to
                      Shuttle, so they land on the sport you actually use. */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </main>
            <BottomNav />
          </div>
        </BrowserRouter>
        </AdminProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
