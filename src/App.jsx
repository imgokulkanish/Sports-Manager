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
// Providers deliberately NOT lifted here:
//   - AdminProvider — stays per-sport (each of ShuttleRoutes/CricketRoutes
//     wraps its own subtree with its own existing AdminProvider/Admin.jsx),
//     since the brief didn't ask to unify admin/PIN behavior and the two
//     apps' admin gates aren't confirmed to be the same shape.
import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './theme' // moved from shuttle-manager/src/theme.jsx, unchanged
import { ToastProvider } from './shell/components/Toast' // moved from shuttle-manager/src/components/Toast.jsx, unchanged
import Sidebar from './shell/components/Sidebar'
import BottomNav from './shell/components/BottomNav'
import SportRouteSync from './shell/hooks/useSportRouteSync'
import PlayersShared from './shell/pages/PlayersShared'
import ExpensesShared from './shell/pages/ExpensesShared'

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
        <BrowserRouter>
          <SportRouteSync />
          <div className="md:flex min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
            <Sidebar />
            <main className="flex-1 min-w-0 pb-20 md:pb-0">
              <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading…</div>}>
                <Routes>
                  <Route path="/" element={<Navigate to="/shuttle" replace />} />
                  {/* The shared page is now ONLY the cross-sport identity
                      link — each sport's real roster (with its own stats)
                      lives at /shuttle/players and /cricket/players. Old
                      /players links redirect rather than 404 into Shuttle. */}
                  <Route path="/people" element={<PlayersShared />} />
                  <Route path="/players" element={<Navigate to="/people" replace />} />
                  <Route path="/expenses" element={<ExpensesShared />} />
                  <Route path="/shuttle/*" element={<ShuttleRoutes />} />
                  <Route path="/cricket/*" element={<CricketRoutes />} />
                  <Route path="*" element={<Navigate to="/shuttle" replace />} />
                </Routes>
              </Suspense>
            </main>
            <BottomNav />
          </div>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
