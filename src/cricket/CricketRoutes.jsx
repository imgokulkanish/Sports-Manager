// CricketRoutes.jsx
//
// Real page imports, wired in. Players route removed — shared now.
import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { AdminProvider } from './components/Admin'
import Dashboard from './pages/Dashboard'
import NewMatch from './pages/NewMatch'
import LiveScoring from './pages/LiveScoring'
import MatchDetail from './pages/MatchDetail'
import History from './pages/History'
import Stats from './pages/Stats'
import Matchups from './pages/Matchups'
import Settings from './pages/Settings'
import NewTournament from './pages/NewTournament'
import NewTournamentMatch from './pages/NewTournamentMatch'
import TournamentDetail from './pages/TournamentDetail'

export default function CricketRoutes() {
  return (
    <AdminProvider>
      <Routes>
        <Route path="" element={<Dashboard />} />
        <Route path="match/new" element={<NewMatch />} />
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
    </AdminProvider>
  )
}
