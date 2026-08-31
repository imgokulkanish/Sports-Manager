// CricketRoutes.jsx
//
// Real page imports, wired in.
//
// Players is routed here again (as /cricket/players). It briefly wasn't:
// the shell's shared /players page could only LINK a person's two
// identities, and every per-player cricket stat — batting/bowling cards,
// role filters, the detail modal, add/edit/archive — only exists on this
// page. Cricket's stats and Shuttle's share no fields, so one merged
// roster page had nothing to show. Expenses stays shared (one joint pot).
import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { AdminProvider } from './components/Admin'
import { MatchVariantProvider } from './context/MatchVariant'
import Dashboard from './pages/Dashboard'
import NewMatch from './pages/NewMatch'
import Players from './pages/Players'
import LiveScoring from './pages/LiveScoring'
import MatchDetail from './pages/MatchDetail'
import History from './pages/History'
import Stats from './pages/Stats'
import Matchups from './pages/Matchups'
import Settings from './pages/Settings'
import NewTournament from './pages/NewTournament'
import NewTournamentMatch from './pages/NewTournamentMatch'
import TournamentDetail from './pages/TournamentDetail'
// Box Cricket reuses these same pages under a different match collection and
// route prefix — see BoxCricketRoutes.jsx / context/MatchVariant.jsx. Lazy
// so the box tree isn't in the bundle for people who never open it.
const BoxCricketRoutes = React.lazy(() => import('./BoxCricketRoutes'))

export default function CricketRoutes() {
  return (
    <AdminProvider>
      {/* Everything below /cricket that ISN'T /cricket/box is full cricket.
          The provider makes that explicit rather than relying on the pages'
          default, so the two trees read symmetrically. */}
      <MatchVariantProvider variant="standard">
      <Routes>
        {/* Ahead of the catch-all so /cricket/box doesn't fall through to the
            cricket Dashboard. React Router ranks by specificity, but the
            ordering is kept obvious for anyone adding routes later. */}
        <Route
          path="box/*"
          element={
            <React.Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading…</div>}>
              <BoxCricketRoutes />
            </React.Suspense>
          }
        />
        <Route path="" element={<Dashboard />} />
        <Route path="match/new" element={<NewMatch />} />
        <Route path="players" element={<Players />} />
        <Route path="match/:id/live" element={<LiveScoring />} />
        <Route path="match/:id" element={<MatchDetail />} />
        <Route path="tournament/new" element={<NewTournament />} />
        <Route path="tournament/match/new" element={<NewTournamentMatch />} />
        <Route path="tournament/:tid/match/new" element={<NewTournamentMatch />} />
        <Route path="tournament/:id" element={<TournamentDetail />} />
        <Route path="history" element={<History />} />
        <Route path="stats" element={<Stats />} />
        <Route path="matchups" element={<Matchups />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
      </MatchVariantProvider>
    </AdminProvider>
  )
}
