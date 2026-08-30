import React, { useMemo, useState } from 'react'
import { useStats } from '../hooks/useStats'
import {
  buildMatchupMatrix,
  toughestMatchup,
  bestMatchup,
  nemesisBowler,
  favoriteWicket,
  expensiveMatchup,
  MIN_MATCHUP_MATCHES,
} from '../engine/statsEngine'
import { initials, avatarColor } from '../utils'
import Footer from '../components/Footer'
import { GridSkeleton } from '../components/Skeleton'
import MatchupDetailModal from '../components/MatchupDetailModal'

function EstimatedTag() {
  return <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 shrink-0">estimated</span>
}

function MatchupRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-[11px] text-gray-400 shrink-0">{label}</span>
      <span className="text-xs font-medium text-gray-800 text-right truncate">{children}</span>
    </div>
  )
}

function MatchupCard({ player, stat, matrix, nameOf, onClick }) {
  const toughest = toughestMatchup(matrix, player.id)
  const best = bestMatchup(matrix, player.id)
  const nemesis = nemesisBowler(matrix, player.id)
  const bowls = (stat?.totalOvers ?? 0) > 0
  const favWicket = bowls ? favoriteWicket(matrix, player.id) : null
  const expensive = bowls ? expensiveMatchup(matrix, player.id) : null

  // A card is "estimated" if any of the rows it's showing were built even
  // partly from Quick Mode data — same all-or-nothing flagging as the
  // matchup matrix itself (see buildMatchupMatrix in statsEngine.js).
  const isEstimated = [toughest, best, nemesis, favWicket, expensive].some((row) => row?.estimated)

  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-pitch hover:shadow-sm transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: avatarColor(player.id) }}
          >
            {initials(player.name)}
          </div>
          <p className="text-sm font-medium text-gray-900 truncate">{player.name}</p>
        </div>
        {isEstimated && <EstimatedTag />}
      </div>

      <div className="divide-y divide-gray-100">
        <MatchupRow label="Strongest against">
          {best ? `${nameOf(best.bowlerId)} · ${best.strikeRate.toFixed(0)} SR (${best.balls}b)` : '—'}
        </MatchupRow>
        <MatchupRow label="Toughest against">
          {toughest ? `${nameOf(toughest.bowlerId)} · ${toughest.strikeRate.toFixed(0)} SR (${toughest.balls}b)` : '—'}
        </MatchupRow>
        <MatchupRow label="Dismissed most by">
          {nemesis ? `${nameOf(nemesis.bowlerId)} · ${nemesis.wickets}×` : '—'}
        </MatchupRow>
        {bowls && (
          <>
            <MatchupRow label="Best wicket-taking matchup">
              {favWicket ? `${nameOf(favWicket.batsmanId)} · ${favWicket.wickets}×` : '—'}
            </MatchupRow>
            <MatchupRow label="Concedes fastest to">
              {expensive ? `${nameOf(expensive.batsmanId)} · ${expensive.strikeRate.toFixed(0)} SR (${expensive.balls}b)` : '—'}
            </MatchupRow>
          </>
        )}
      </div>
    </button>
  )
}

export default function Matchups() {
  const { players, matches, statsById, loading } = useStats()
  const [selected, setSelected] = useState(null)

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])
  const matrix = useMemo(() => buildMatchupMatrix(matches), [matches])
  const nameOf = (id) => playersById[id]?.name || id

  // Matchup insights need a real sample per pair to mean anything — a
  // higher bar than the Dashboard's small-sample tagging, same reasoning as
  // the Stats page's full leaderboards but tracked as its own constant.
  const eligible = useMemo(
    () => players.filter((p) => (statsById[p.id]?.matchesPlayed ?? 0) >= MIN_MATCHUP_MATCHES),
    [players, statsById],
  )

  if (loading) {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <GridSkeleton items={6} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Matchups</h1>
      <p className="text-[11px] text-gray-400 mb-4">
        Batsman-vs-bowler head-to-head. Requires at least {MIN_MATCHUP_MATCHES} matches played.
      </p>

      {eligible.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">
          Not enough data yet — matchups need at least {MIN_MATCHUP_MATCHES} matches played per player.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {eligible.map((p) => (
            <MatchupCard
              key={p.id}
              player={p}
              stat={statsById[p.id]}
              matrix={matrix}
              nameOf={nameOf}
              onClick={() => setSelected(p)}
            />
          ))}
        </div>
      )}

      <MatchupDetailModal player={selected} matrix={matrix} nameOf={nameOf} onClose={() => setSelected(null)} />
      <Footer />
    </div>
  )
}
