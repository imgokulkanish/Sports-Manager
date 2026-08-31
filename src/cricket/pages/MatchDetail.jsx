import React, { useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useMatch, deleteMatchById } from '../hooks/useMatch'
import { usePlayers } from '../hooks/usePlayers'
import Scorecard from '../components/Scorecard'
import ExportButtons from '../components/ExportButtons'
import Footer from '../components/Footer'
import { ListSkeleton } from '../components/Skeleton'
import { StatusBadge } from '../components/StatsBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../../shell/components/Toast'
import { useAdmin } from '../components/Admin'
import { useMatchVariant, sixIsOut as matchSixIsOut } from '../context/MatchVariant'

export default function MatchDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { match, loading } = useMatch(id)
  const { players } = usePlayers()
  const { showToast } = useToast()
  const { isAdmin } = useAdmin()
  const variant = useMatchVariant()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])

  const handleDelete = async () => {
    try {
      await deleteMatchById(id, variant.collection)
      setConfirmDelete(false)
      showToast('Match deleted')
      navigate(match?.isTournament && match.tournamentId ? `/cricket/tournament/${match.tournamentId}` : `${variant.basePath}/history`)
    } catch (error) {
      console.error('deleteMatch failed', error)
      showToast(error?.message || 'Could not delete the match. Please try again.', 'error')
    }
  }

  if (loading || !match) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <ListSkeleton rows={5} />
      </div>
    )
  }

  const dateStr = new Date(match.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-gray-900">
          {match.teamA?.name} vs {match.teamB?.name}
        </h1>
        <StatusBadge status={match.status} />
      </div>
      <div className="mb-4">
        {match.isTournament && match.tournamentId && (
          <Link
            to={`/cricket/tournament/${match.tournamentId}`}
            className="inline-block text-[11px] font-medium text-pitch bg-pitch-light border border-pitch-border rounded-lg px-2.5 py-1 mb-2"
          >
            {match.tournamentStage || 'Tournament'} · back to tournament
          </Link>
        )}
        <p className="text-xs text-gray-500">
          {dateStr} {match.venue && `· ${match.venue}`} · Toss: {match.toss?.wonBy === 'A' ? match.teamA?.name : match.teamB?.name} chose to {match.toss?.decision}
        </p>
        {/* Which box rule this match was played under — a scorecard with no
            sixes on it reads very differently once you know they were outs. */}
        {variant.key === 'box' && (
          <p className="text-xs text-gray-500">
            Box rules: {matchSixIsOut(match) ? 'a six is out' : 'sixes allowed'}
          </p>
        )}
        {(match.teamA?.umpireId || match.teamB?.umpireId) && (
          <p className="text-xs text-gray-500">
            Umpires: {match.teamA?.umpireId ? playersById[match.teamA.umpireId]?.name : '—'} ({match.teamA?.name})
            {' · '}
            {match.teamB?.umpireId ? playersById[match.teamB.umpireId]?.name : '—'} ({match.teamB?.name})
          </p>
        )}
      </div>

      {match.status === 'completed' && match.result && (
        <div className="text-center bg-pitch-light border border-pitch-border rounded-xl p-4 mb-4">
          <p className="text-xl mb-1">🏆</p>
          <p className="text-sm font-medium text-pitch-dark">
            {match.result.winner === 'tie'
              ? 'Match tied'
              : match.result.winner === 'no-result'
              ? match.result.margin
              : `${match.result.winner === 'A' ? match.teamA?.name : match.teamB?.name} ${match.result.margin}`}
          </p>
          {match.manOfTheMatch && <p className="text-xs text-pitch-dark/70 mt-1">MOTM: {playersById[match.manOfTheMatch]?.name}</p>}
        </div>
      )}

      {match.status === 'completed' && (
        <div className="mb-4">
          <ExportButtons match={match} players={players} />
        </div>
      )}

      <div className="flex flex-col gap-5">
        {match.innings1 && <Scorecard innings={match.innings1} playersById={playersById} teamLabel={match.innings1.battingTeam === 'A' ? match.teamA?.name : match.teamB?.name} />}
        {match.innings2 && <Scorecard innings={match.innings2} playersById={playersById} teamLabel={match.innings2.battingTeam === 'A' ? match.teamA?.name : match.teamB?.name} />}
      </div>

      {match.status !== 'completed' && (
        <Link to={`${variant.basePath}/match/${id}/live`} className="block text-center bg-pitch text-white rounded-lg py-3 text-sm font-semibold mt-4">
          Continue Live Scoring
        </Link>
      )}

      {isAdmin && (
        <button onClick={() => setConfirmDelete(true)} className="w-full border border-red-300 text-red-600 rounded-lg py-2.5 text-sm font-medium mt-4">
          Delete match
        </button>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this match?"
        message="This permanently removes the match and its full ball-by-ball record. Every player's stats will be recalculated without it — runs, wickets and MVP points from this match will disappear from the leaderboards. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <Footer />
    </div>
  )
}
