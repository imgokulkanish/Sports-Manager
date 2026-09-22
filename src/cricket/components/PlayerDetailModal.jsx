import React, { useMemo, useState } from 'react'
import { battingAverage, strikeRate, bowlingAverage, bowlingStrikeRate, avgMVPPoints, totalMVPPoints, captaincyWinPct, MIN_MVP_MATCHES, playerHighlights } from '../engine/statsEngine'
import ConfirmDialog from './ConfirmDialog'

const fixed = (value, digits) => (value === null || value === undefined ? '—' : value.toFixed(digits))

// Economy is worked out from balls rather than the stored overs total —
// summed "X.Y" overs aren't a real decimal (see computePlayerStats).
const economyFromBalls = (s) => (s.totalBallsBowled ? (s.totalRunsConceded / s.totalBallsBowled) * 6 : null)

// Column specs for the career tables, cricinfo-style: one row per format,
// each cell read straight off a computePlayerStats() record. `strong` marks
// the headline column (Runs / Wkts) the way a scorecard bolds it.
const BATTING_COLUMNS = [
  { label: 'Mat', title: 'Matches', value: (s) => s.matchesPlayed },
  { label: 'Inns', title: 'Innings', value: (s) => s.inningsBatted },
  { label: 'NO', title: 'Not outs', value: (s) => s.inningsBatted - s.timesOut },
  { label: 'Runs', value: (s) => s.totalRuns, strong: true },
  { label: 'HS', title: 'Highest score', value: (s) => `${s.highestScore}${s.highestScoreNotOut ? '*' : ''}` },
  { label: 'Ave', title: 'Batting average', value: (s) => fixed(battingAverage(s), 2) },
  { label: 'BF', title: 'Balls faced', value: (s) => s.totalBalls },
  { label: 'SR', title: 'Strike rate', value: (s) => fixed(strikeRate(s), 2) },
  { label: '50s', value: (s) => s.fifties },
  { label: '25s', title: 'Scores of 25–49', value: (s) => s.twentyFives },
  { label: '0s', title: 'Ducks', value: (s) => s.ducks },
  { label: '4s', value: (s) => s.fours },
  { label: '6s', value: (s) => s.sixes },
  { label: 'Ct', title: 'Catches', value: (s) => s.catches },
  { label: 'St', title: 'Stumpings', value: (s) => s.stumpings },
]

const BOWLING_COLUMNS = [
  { label: 'Mat', title: 'Matches', value: (s) => s.matchesPlayed },
  { label: 'Inns', title: 'Innings', value: (s) => s.inningsBowled },
  { label: 'Balls', value: (s) => s.totalBallsBowled },
  { label: 'Runs', value: (s) => s.totalRunsConceded },
  { label: 'Wkts', title: 'Wickets', value: (s) => s.totalWickets, strong: true },
  { label: 'BBI', title: 'Best bowling in an innings', value: (s) => (s.bestBowling ? `${s.bestBowling.wickets}/${s.bestBowling.runs}` : '—') },
  { label: 'Ave', title: 'Bowling average', value: (s) => fixed(bowlingAverage(s), 2) },
  { label: 'Econ', title: 'Economy', value: (s) => fixed(economyFromBalls(s), 2) },
  { label: 'SR', title: 'Balls per wicket', value: (s) => fixed(bowlingStrikeRate(s), 1) },
  { label: 'Mdns', title: 'Maidens', value: (s) => s.maidens },
  { label: '2w', title: '2 wickets in an innings', value: (s) => s.twoWicketHauls },
  { label: '3w', title: '3+ wickets in an innings', value: (s) => s.threeWicketHauls },
]

const IMPACT_COLUMNS = [
  { label: 'Mat', title: 'Matches', value: (s) => s.matchesPlayed },
  { label: 'MVP avg', title: 'Average MVP points per match', value: (s) => avgMVPPoints(s).toFixed(0), strong: true },
  { label: 'MVP total', value: (s) => totalMVPPoints(s) },
  { label: 'MOTM', title: 'Man of the Match', value: (s) => s.motmCount },
]

// Captaincy reads off computeCaptaincyStats() records, not the
// computePlayerStats() ones every table above uses — a captain's win/loss is
// the team's result filed under their name (see statsEngine.js).
const CAPTAINCY_COLUMNS = [
  { label: 'Led', title: 'Matches captained', value: (s) => s.matchesCaptained, strong: true },
  { label: 'W', title: 'Won', value: (s) => s.wins },
  { label: 'L', title: 'Lost', value: (s) => s.losses },
  { label: 'T', title: 'Tied', value: (s) => s.ties },
  { label: 'NR', title: 'No result — the match ended before a second innings', value: (s) => s.noResults },
  { label: 'Win%', title: 'Wins as a share of decided matches', value: (s) => (captaincyWinPct(s) === null ? '—' : `${captaincyWinPct(s).toFixed(0)}%`) },
  { label: 'Best run', title: 'Longest run of wins as captain', value: (s) => s.bestWinStreak },
]

function CareerTable({ title, columns, rows }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 px-3 py-2 border-b border-gray-200">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              {/* Format column stays pinned while the numbers scroll on a phone. */}
              <th className="sticky left-0 bg-gray-50 text-left font-medium px-3 py-2 border-r border-gray-200">Format</th>
              {columns.map((c) => (
                <th key={c.label} title={c.title} className="text-right font-medium px-2.5 py-2 whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, stat }) => (
              <tr key={label} className="border-t border-gray-100">
                <td className="sticky left-0 bg-white font-semibold text-gray-900 px-3 py-2 whitespace-nowrap border-r border-gray-200">{label}</td>
                {columns.map((c) => (
                  <td key={c.label} className={`text-right px-2.5 py-2 whitespace-nowrap ${c.strong ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                    {c.value(stat)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function PlayerDetailModal({ player, stat, boxStat, statsById, boxStatsById, captaincy, boxCaptaincy, captaincyById, boxCaptaincyById, onClose, onToggleActive, onDelete, onEdit, canManage = false }) {
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const highlights = useMemo(() => {
    if (!player) return []
    return [
      ...(statsById ? playerHighlights(statsById, player.id, { captaincyById }) : []),
      ...(boxStatsById ? playerHighlights(boxStatsById, player.id, { captaincyById: boxCaptaincyById }).map((h) => ({ ...h, format: 'Box' })) : []),
    ].sort((a, b) => a.rank - b.rank)
  }, [player, statsById, boxStatsById, captaincyById, boxCaptaincyById])
  if (!player) return null

  // Box records are kept apart from cricket everywhere else (see
  // context/MatchVariant.jsx), so they get their own row rather than being
  // summed in. A format the player has never played is left out entirely.
  const formats = [
    { label: 'Cricket', stat },
    { label: 'Box Cricket', stat: boxStat },
  ].filter((f) => f.stat?.matchesPlayed)
  const battedIn = formats.filter((f) => f.stat.inningsBatted)
  const bowledIn = formats.filter((f) => f.stat.inningsBowled)
  const smallSample = formats.some((f) => f.stat.matchesPlayed < MIN_MVP_MATCHES)
  // Most players have never captained, so this table only appears for the
  // ones who have — in whichever format they did it.
  const captainedIn = [
    { label: 'Cricket', stat: captaincy },
    { label: 'Box Cricket', stat: boxCaptaincy },
  ].filter((f) => f.stat?.matchesCaptained)

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-3xl p-5 shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            {player.name} <span className="font-normal text-gray-500">· Career stats</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 text-sm">Close</button>
        </div>

        {highlights.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {highlights.map((h) => (
              <span
                key={`${h.format || 'cricket'}-${h.label}`}
                className={`text-xs font-medium rounded-full px-3 py-1 border ${
                  h.rank === 1 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-pitch-light border-pitch-border text-pitch'
                }`}
              >
                {h.rank === 1 ? '🏆 ' : ''}No. {h.rank} in {h.label}
                {h.format ? ` · ${h.format}` : ''}
              </span>
            ))}
          </div>
        )}

        {formats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8 mb-4">No completed matches yet.</p>
        ) : (
          <>
            {battedIn.length > 0 && <CareerTable title="Batting & Fielding" columns={BATTING_COLUMNS} rows={battedIn} />}
            {bowledIn.length > 0 && <CareerTable title="Bowling" columns={BOWLING_COLUMNS} rows={bowledIn} />}
            <CareerTable title="Impact" columns={IMPACT_COLUMNS} rows={formats} />
            {captainedIn.length > 0 && <CareerTable title="Captaincy" columns={CAPTAINCY_COLUMNS} rows={captainedIn} />}
            {smallSample && (
              <p className="text-[11px] text-amber-700 -mt-2 mb-4">Fewer than {MIN_MVP_MATCHES} matches in a format — averages there are a small sample.</p>
            )}
          </>
        )}

        {/* Renaming, archiving and deleting are admin-only — see
            shell/components/Admin.jsx for what that does and doesn't protect. */}
        {canManage && (
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => onEdit?.(player)} className="rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700">
              Edit
            </button>
            <button onClick={() => setConfirmArchive(true)} className="rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700">
              {player.isActive ? 'Archive' : 'Unarchive'}
            </button>
            <button onClick={() => setConfirmDelete(true)} className="rounded-lg border border-red-300 py-2.5 text-sm font-medium text-red-600">
              Delete
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title={player.isActive ? 'Archive player?' : 'Unarchive player?'}
        message={player.isActive ? 'Archived players are hidden from new match selection but their history is kept.' : 'This player becomes selectable again.'}
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
        message="This permanently removes the player from the roster."
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
