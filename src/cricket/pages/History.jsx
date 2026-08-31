import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStats } from '../hooks/useStats'
import { useTournaments } from '../hooks/useTournaments'
import { deleteMatchById } from '../hooks/useMatch'
import { StatusBadge } from '../components/StatsBadge'
import Footer from '../components/Footer'
import { ListSkeleton } from '../components/Skeleton'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../../shell/components/Toast'
import { useAdmin } from '../../shell/components/Admin'
import { matchResultHeadline } from '../engine/scoringEngine'
import { useMatchVariant, sixIsOut as matchSixIsOut } from '../context/MatchVariant'

// Tournaments are folded in here as a tab rather than getting their own nav
// item — they're past events, which is exactly what History is for, and the
// mobile bottom nav is already full at six items.
const TABS = [
  { key: 'matches', label: 'Matches' },
  { key: 'tournaments', label: 'Tournaments' },
]

export default function History() {
  const variant = useMatchVariant()
  const { players, allMatches, loading } = useStats()
  // Box Cricket has no tournaments of its own — a tournament envelope points
  // at full-cricket match docs — so the tab and its listener are both off.
  const { tournaments, loading: tournamentsLoading } = useTournaments(variant.supportsTournaments)
  const { showToast } = useToast()
  const { isAdmin } = useAdmin()
  // Holds the match pending deletion, so the confirm dialog can name it —
  // deleting from a list is easier to misfire than from the match's own page.
  const [pendingDelete, setPendingDelete] = useState(null)
  const [tab, setTab] = useState('matches')
  const [playerFilter, setPlayerFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])

  const filtered = useMemo(() => {
    return allMatches
      .filter((m) => m.status === 'completed')
      .filter((m) => !playerFilter || [...(m.teamA?.playerIds || []), ...(m.teamB?.playerIds || [])].includes(playerFilter))
      .filter((m) => !fromDate || new Date(m.date) >= new Date(fromDate))
      .filter((m) => !toDate || new Date(m.date) <= new Date(toDate))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [allMatches, playerFilter, fromDate, toDate])

  // Round counts come from the matches themselves — a tournament stores no
  // copy of its match list.
  const roundCounts = useMemo(() => {
    const counts = {}
    allMatches.forEach((m) => {
      if (!m.isTournament || !m.tournamentId) return
      counts[m.tournamentId] = (counts[m.tournamentId] || 0) + 1
    })
    return counts
  }, [allMatches])

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteMatchById(pendingDelete.id, variant.collection)
      setPendingDelete(null)
      showToast('Match deleted')
    } catch (error) {
      console.error('deleteMatch failed', error)
      showToast(error?.message || 'Could not delete the match. Please try again.', 'error')
    }
  }

  if (loading || tournamentsLoading) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <ListSkeleton rows={5} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-lg font-semibold text-gray-900 mb-3">
        {variant.supportsTournaments ? 'History' : `${variant.label} history`}
      </h1>

      {variant.supportsTournaments && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg border py-2 text-sm font-medium ${tab === t.key ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-200 text-gray-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'matches' || !variant.supportsTournaments ? (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs text-gray-500">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="text-xs text-gray-500">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
            </div>
          </div>

          <select value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)} className="w-full mb-4 border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All players</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="flex flex-col gap-2">
            {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No matches found.</p>}
            {filtered.map((m) => (
              <div key={m.id} className="bg-white border border-gray-200 rounded-lg p-3">
                <Link to={`${variant.basePath}/match/${m.id}`} className="block">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900">{new Date(m.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Tournament rounds sit in the same list as everything
                          else — they're ordinary matches — just flagged. */}
                      {m.isTournament && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-pitch-light text-pitch border border-pitch-border truncate max-w-[9rem]">
                          {m.tournamentStage || 'Tournament'}
                        </span>
                      )}
                      {/* Box matches are only ever mixed with each other, but
                          the two six rules produce very different scorecards,
                          so the list says which one this row was played under. */}
                      {matchSixIsOut(m) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700 border border-red-200 shrink-0">
                          6 = out
                        </span>
                      )}
                      <StatusBadge status={m.status} />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate" title={matchResultHeadline(m) || `${m.teamA?.name} vs ${m.teamB?.name}`}>
                    {matchResultHeadline(m) || `${m.teamA?.name} vs ${m.teamB?.name}`}
                    {m.manOfTheMatch ? ` · MOTM ${playersById[m.manOfTheMatch]?.name}` : ''}
                  </p>
                </Link>
                {/* Outside the Link so tapping Delete doesn't also navigate. */}
                {isAdmin && (
                  <button onClick={() => setPendingDelete(m)} className="mt-2 text-[11px] font-medium text-red-600 underline underline-offset-2">
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <Link to="/cricket/tournament/new" className="block bg-pitch text-white text-center text-xs font-semibold rounded-lg py-2.5 mb-4">
            New Tournament
          </Link>
          <div className="flex flex-col gap-2">
            {tournaments.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No tournaments yet.</p>}
            {tournaments.map((t) => (
              <Link key={t.id} to={`/cricket/tournament/${t.id}`} className="bg-white border border-gray-200 rounded-lg p-3 block">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      t.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {t.status === 'active' ? 'Active' : 'Completed'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">
                  {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {roundCounts[t.id] || 0} round
                  {(roundCounts[t.id] || 0) === 1 ? '' : 's'} · {(t.squadPlayerIds || []).length} in squad
                </p>
              </Link>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this match?"
        message={
          pendingDelete
            ? `${new Date(pendingDelete.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} — ${
                matchResultHeadline(pendingDelete) || `${pendingDelete.teamA?.name} vs ${pendingDelete.teamB?.name}`
              }. This permanently removes the match and its ball-by-ball record; every player's stats will be recalculated without it. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <Footer />
    </div>
  )
}
