// components/PlayerDetailModal.jsx
import React, { useMemo, useState } from 'react'
import {
  bestPartner,
  worstPartner,
  nemesis,
  matchRecord,
  avgPoints,
  recentForm,
  attendanceRate,
  partnerRecords,
  opponentRecords,
  playerHighlights,
} from '../engine/statsEngine'
import ConfirmDialog from './ConfirmDialog'
import SampleTag from './SampleTag'
import Avatar from './Avatar'

const TAB_BTN = (active) =>
  `flex-1 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
    active
      ? 'bg-brand text-white border-brand'
      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
  }`

const SIDE_BTN = (active) =>
  `flex-1 text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-colors ${
    active
      ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'
      : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
  }`

const STAT_TILE = 'bg-gray-50 dark:bg-gray-800 rounded-lg p-3'

function StatTile({ label, value, sub, className = '' }) {
  return (
    <div className={`${STAT_TILE} ${className}`}>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// A record is only worth colouring once it leans one way: 60/40 either side
// of even, so a 5-4 stays neutral instead of being painted as a strength.
function recordTone(winRate) {
  if (winRate >= 0.6) return 'text-green-700 dark:text-green-400'
  if (winRate <= 0.4) return 'text-red-700 dark:text-red-400'
  return 'text-gray-900 dark:text-gray-100'
}

function barTone(winRate) {
  if (winRate >= 0.6) return 'bg-green-500 dark:bg-green-400'
  if (winRate <= 0.4) return 'bg-red-400 dark:bg-red-500'
  return 'bg-gray-300 dark:bg-gray-600'
}

function MatchupRow({ rec, playersById }) {
  // A partner or opponent who has since been deleted leaves their id behind in
  // the stats of everyone who played with them, so name the id rather than
  // rendering a blank row.
  const name = playersById[rec.id]?.name || 'Former player'
  const pct = Math.round(rec.winRate * 100)
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <Avatar id={rec.id} name={name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-900 dark:text-gray-100 truncate flex items-center gap-1.5">
          {name}
          <SampleTag matches={rec.matches} />
        </p>
        <div className="mt-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div className={`h-full rounded-full ${barTone(rec.winRate)}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${recordTone(rec.winRate)}`}>{pct}%</p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {rec.wins}W - {rec.losses}L
        </p>
      </div>
    </div>
  )
}

/**
 * The full head-to-head breakdown: every partner played with and every
 * opponent faced, with the win/loss record against each. The Overview tab
 * names only the single standout in each direction (best partner, nemesis);
 * this is the same data unfiltered, for "how do I actually do against X".
 *
 * Quick-play matches have one-player teams, so they contribute opponents but
 * no partners - a player who only ever plays quick matches will see an empty
 * "Played with" list, which is correct rather than missing data.
 */
function MatchupsTab({ partners, opponents, playersById }) {
  const [side, setSide] = useState('with')
  const rows = side === 'with' ? partners : opponents
  const totals = rows.reduce((acc, r) => ({ wins: acc.wins + r.wins, losses: acc.losses + r.losses }), { wins: 0, losses: 0 })

  return (
    <>
      <div className="flex gap-2 mb-3">
        <button onClick={() => setSide('with')} className={SIDE_BTN(side === 'with')}>
          Played with
        </button>
        <button onClick={() => setSide('against')} className={SIDE_BTN(side === 'against')}>
          Played against
        </button>
      </div>

      {rows.length > 0 && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">
          {rows.length} {rows.length === 1 ? 'player' : 'players'} - {totals.wins}W - {totals.losses}L{' '}
          {side === 'with' ? 'alongside them' : 'against them'} - best record first
        </p>
      )}

      <div className="flex flex-col">
        {rows.map((rec) => (
          <MatchupRow key={rec.id} rec={rec} playersById={playersById} />
        ))}
        {rows.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
            {side === 'with' ? 'No partners on record yet.' : 'No opponents on record yet.'}
          </p>
        )}
      </div>
    </>
  )
}

function OverviewTab({ player, stat, best, worstPair, worst, winRate, playersById }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className={STAT_TILE}>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Win rate</p>
          <p className="text-lg font-semibold text-brand dark:text-emerald-400 flex items-center gap-1.5">
            {winRate}%
            <SampleTag matches={stat?.totalMatches} />
          </p>
        </div>
        <div className={STAT_TILE}>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Matches / Sessions</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {stat?.totalMatches ?? 0} / {stat?.totalSessions ?? 0}
          </p>
        </div>
      </div>

      {/* Partners on top (who they play WITH), nemesis below (who they play
          AGAINST). The toughest pairing is amber rather than red so it doesn't
          read as a second nemesis - and it's named for the pair, not the
          person, since a partnership going badly is nobody's fault alone.
          Both tiles stay empty until there's a real standout to name; see
          bestPartner/worstPartner for what disqualifies one. */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 rounded-lg p-3">
          <p className="text-[10px] text-green-700 dark:text-green-400">Best partner</p>
          <p className="text-sm font-medium text-green-900 dark:text-green-200 flex items-center gap-1.5">
            {best ? playersById[best.partnerId]?.name || best.partnerId : '—'}
            {best && <SampleTag matches={best.matches} />}
          </p>
          {best ? (
            <p className="text-[10px] text-green-600 dark:text-green-400">{Math.round(best.winRate * 100)}% together</p>
          ) : (
            <p className="text-[10px] text-green-600/70 dark:text-green-400/70">No standout yet</p>
          )}
        </div>
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-lg p-3">
          <p className="text-[10px] text-amber-700 dark:text-amber-400">Toughest pairing</p>
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
            {worstPair ? playersById[worstPair.partnerId]?.name || worstPair.partnerId : '—'}
            {worstPair && <SampleTag matches={worstPair.matches} />}
          </p>
          {worstPair ? (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">{Math.round(worstPair.winRate * 100)}% together</p>
          ) : (
            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">No standout yet</p>
          )}
        </div>
      </div>

      <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg p-3 mb-4">
        <p className="text-[10px] text-red-700 dark:text-red-400">Nemesis</p>
        <p className="text-sm font-medium text-red-900 dark:text-red-200 flex items-center gap-1.5">
          {worst ? playersById[worst.opponentId]?.name || worst.opponentId : '—'}
          {worst && <SampleTag matches={worst.matches} />}
        </p>
        {worst && <p className="text-[10px] text-red-600 dark:text-red-400">{Math.round(worst.lossRate * 100)}% losses vs</p>}
      </div>

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Session attendance</p>
      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
        {(stat?.sessionHistory || [])
          .slice()
          .reverse()
          .map((h) => (
            <div
              key={h.sessionId}
              className="flex justify-between text-xs text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 py-1"
            >
              <span>{new Date(h.date).toLocaleDateString()}</span>
              <span>
                {h.wins}/{h.matches} won
              </span>
            </div>
          ))}
        {(!stat || stat.sessionHistory.length === 0) && (
          <p className="text-xs text-gray-400 dark:text-gray-500">No sessions played yet.</p>
        )}
      </div>
    </>
  )
}

function DetailedTab({ stat, record, points, form, attendance, achievements }) {
  const hasMatches = (stat?.totalMatches || 0) > 0

  if (!hasMatches) {
    return <p className="text-xs text-gray-400 dark:text-gray-500">No matches played yet - detailed stats will show up after their first session.</p>
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <StatTile label="Matches" value={stat.totalMatches} />
        <StatTile label="Won" value={record.wins} className="!bg-green-50 dark:!bg-green-500/10" />
        <StatTile label="Lost" value={record.losses} className="!bg-red-50 dark:!bg-red-500/10" />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <StatTile label="Current win streak" value={stat.currentWinStreak} sub={`Best: ${stat.bestWinStreak}`} />
        <StatTile label="Current losing streak" value={stat.currentLossStreak} sub={`Worst: ${stat.worstLossStreak}`} />
      </div>

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Points per match</p>
      {points ? (
        <div className="grid grid-cols-3 gap-2 mb-1">
          <StatTile label="Avg scored" value={points.for.toFixed(1)} />
          <StatTile label="Avg conceded" value={points.against.toFixed(1)} />
          <StatTile
            label="Diff"
            value={`${points.diff > 0 ? '+' : ''}${points.diff.toFixed(1)}`}
            className={points.diff > 0 ? '!text-green-700 dark:!text-green-400' : points.diff < 0 ? '!text-red-700 dark:!text-red-400' : ''}
          />
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">No per-point scores recorded yet.</p>
      )}
      {points && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-4 flex items-center gap-1.5">
          Best win margin: +{stat.bestWinMargin}
          <SampleTag matches={points.matches} />
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        <StatTile label="Sessions won" value={achievements?.sessionWins ?? 0} />
        <StatTile label="Session MVP" value={achievements?.mvpCount ?? 0} />
      </div>

      {attendance && (
        <div className={`${STAT_TILE} mb-4`}>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Attendance</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{Math.round(attendance.rate * 100)}%</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
            {attendance.attended} of {attendance.eligible} sessions since joining
          </p>
        </div>
      )}

      {form.length > 0 && (
        <>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Recent form</p>
          <div className="flex gap-1.5 mb-1">
            {form
              .slice()
              .reverse()
              .map((won, i) => (
                <span
                  key={i}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                    won
                      ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                  }`}
                  title={won ? 'Win' : 'Loss'}
                >
                  {won ? 'W' : 'L'}
                </span>
              ))}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Most recent first</p>
        </>
      )}
    </>
  )
}

export default function PlayerDetailModal({ player, stat, playersById, sessions, achievements, statsById, players, achievementsById, canManage, onClose, onToggleActive, onDelete, onEdit }) {
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState('overview')

  const best = useMemo(() => (stat ? bestPartner(stat) : null), [stat])
  const worstPair = useMemo(() => (stat ? worstPartner(stat) : null), [stat])
  const worst = useMemo(() => (stat ? nemesis(stat) : null), [stat])
  const winRatePct = stat?.totalMatches ? Math.round((stat.totalWins / stat.totalMatches) * 100) : 0
  const record = useMemo(() => matchRecord(stat), [stat])
  const points = useMemo(() => avgPoints(stat), [stat])
  const form = useMemo(() => recentForm(stat, 5), [stat])
  const attendance = useMemo(() => (player && sessions ? attendanceRate(player, sessions) : null), [player, sessions])
  const partners = useMemo(() => partnerRecords(stat), [stat])
  const opponents = useMemo(() => opponentRecords(stat), [stat])
  const highlights = useMemo(
    () => (player && statsById ? playerHighlights(player.id, { statsById, players, sessions, achievementsById }) : []),
    [player, statsById, players, sessions, achievementsById],
  )

  if (!player) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[85vh] overflow-y-auto animate-[fadein_0.15s_ease-out]">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="min-w-0 truncate text-base font-semibold text-gray-900 dark:text-gray-100">{player.name}</h3>
          <button
            onClick={onClose}
            className="shrink-0 text-gray-400 dark:text-gray-500 text-sm hover:text-gray-600 dark:hover:text-gray-300"
          >
            Close
          </button>
        </div>

        {highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {highlights.map((h) => (
              <span
                key={h.label}
                className={`text-[11px] font-medium rounded-full px-2.5 py-1 border ${
                  h.rank === 1
                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
                    : 'bg-green-50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20 text-green-800 dark:text-green-300'
                }`}
              >
                {h.rank === 1 ? '🏆 ' : ''}No. {h.rank} in {h.label}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('overview')} className={TAB_BTN(tab === 'overview')}>
            Overview
          </button>
          <button onClick={() => setTab('detailed')} className={TAB_BTN(tab === 'detailed')}>
            Detailed
          </button>
          <button onClick={() => setTab('matchups')} className={TAB_BTN(tab === 'matchups')}>
            Matchups
          </button>
        </div>

        {tab === 'overview' && (
          <OverviewTab player={player} stat={stat} best={best} worstPair={worstPair} worst={worst} winRate={winRatePct} playersById={playersById} />
        )}
        {tab === 'detailed' && (
          <DetailedTab stat={stat} record={record} points={points} form={form} attendance={attendance} achievements={achievements} />
        )}
        {tab === 'matchups' && <MatchupsTab partners={partners} opponents={opponents} playersById={playersById} />}

        <div className="flex gap-2 mt-5">
          {/* Renaming and deleting are admin-only - see shell/components/Admin.jsx
              for what that does and doesn't protect. A rename is safe in itself
              (sessions store ids, never names, so it flows through every past
              result and leaderboard) but it's still not something a teammate
              scrolling the app should be able to do by accident. Archive stays
              open to everyone. */}
          {canManage && (
            <button
              onClick={() => onEdit?.(player)}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => setConfirmArchive(true)}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {player.isActive ? 'Archive' : 'Unarchive'}
          </button>
          {canManage && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex-1 rounded-lg border border-red-300 dark:border-red-500/40 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 transition-colors active:scale-[0.98] hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title={player.isActive ? 'Archive player?' : 'Unarchive player?'}
        message={
          player.isActive
            ? 'Archived players are hidden from new session selection but their history is kept.'
            : 'This player will be selectable again for new sessions.'
        }
        confirmLabel={player.isActive ? 'Archive' : 'Unarchive'}
        onConfirm={() => {
          onToggleActive(player.id, !player.isActive)
          setConfirmArchive(false)
        }}
        onCancel={() => setConfirmArchive(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete player?"
        message={
          stat?.totalMatches
            ? `This permanently removes ${player.name}. Their ${stat.totalMatches} recorded ${
                stat.totalMatches === 1 ? 'match' : 'matches'
              } will disappear from all stats and leaderboards, because past sessions store their id, not their name. Archive instead to keep the history.`
            : 'This permanently removes the player. Archive instead if you might want them back later.'
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          onDelete(player.id)
          setConfirmDelete(false)
          onClose()
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
