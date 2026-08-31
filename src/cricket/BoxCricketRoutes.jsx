// BoxCricketRoutes.jsx
//
// Box Cricket mounted at /cricket/box. Every page here is the SAME component
// full cricket uses — the only thing that changes is the MatchVariantProvider
// wrapped around them, which swaps the Firestore collection the match hooks
// read/write and the route prefix the pages' own links are built from. See
// context/MatchVariant.jsx.
//
// Because the collection is what differs, "box records don't count toward
// cricket stats" isn't a filter anyone has to remember to apply — the stats
// engine is handed a different set of matches to begin with, and there is no
// code path where the two lists meet.
//
// WHAT'S DELIBERATELY MISSING vs CricketRoutes:
//   - Tournaments. A tournament envelope (`cricketTournaments`) points at
//     `cricketMatches` documents; there is no box equivalent, and the pages
//     hide their tournament UI when `supportsTournaments` is false.
//   - Players and Settings. The roster is the same people either way, so box
//     links straight back to /cricket/players and /cricket/settings rather
//     than standing up a second copy of pages that would show identical data.
//   - Matchups. Head-to-heads need MIN_MATCHUP_MATCHES of history before they
//     mean anything; box starts from zero. Worth adding here once there's a
//     season of box matches behind it — it's the same one-line route.
import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { MatchVariantProvider } from './context/MatchVariant'
import Dashboard from './pages/Dashboard'
import NewMatch from './pages/NewMatch'
import LiveScoring from './pages/LiveScoring'
import MatchDetail from './pages/MatchDetail'
import History from './pages/History'
import Stats from './pages/Stats'

export default function BoxCricketRoutes() {
  return (
    <MatchVariantProvider variant="box">
      <Routes>
        <Route path="" element={<Dashboard />} />
        <Route path="match/new" element={<NewMatch />} />
        <Route path="match/:id/live" element={<LiveScoring />} />
        <Route path="match/:id" element={<MatchDetail />} />
        <Route path="history" element={<History />} />
        <Route path="stats" element={<Stats />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </MatchVariantProvider>
  )
}
