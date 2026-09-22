import React from 'react'
import { initials, avatarColor } from '../utils'
import { MIN_CAPTAINCY_MATCHES } from '../engine/statsEngine'

// A captaincy record is a handful of numbers that only mean anything
// together — "12 matches" and "58% wins" read very differently apart — so
// this is a table rather than the single-value Leaderboard used by every
// other Stats tab.

const pct = (value) => (value === null || value === undefined ? '—' : `${value.toFixed(0)}%`)

function Tile({ label, row, value }) {
  if (!row) return null
  return (
    <div className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white">
      <p className="text-[11px] text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[9px] font-semibold shrink-0"
          style={{ background: avatarColor(row.playerId) }}
        >
          {initials(row.name)}
        </div>
        <span className="text-sm font-semibold text-gray-900 truncate flex-1">{row.name}</span>
        <span className="text-sm font-semibold text-pitch shrink-0">{value(row)}</span>
      </div>
    </div>
  )
}

/**
 * @param {Array} rows - captaincyLeaderboard() output (most matches first).
 * @param {Array} winPctRows - captaincyWinPctLeaderboard() output; its top
 *   row fills the "best win rate" tile, which needs the minimum-matches
 *   cut-off the raw counts don't.
 */
export default function CaptaincyBoard({ rows, winPctRows = [] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No one has captained a completed match yet.</p>
  }

  const mostMatches = rows[0]
  // rows is sorted by matches, not wins — the most-capped captain isn't
  // necessarily the most successful one.
  const mostWins = rows.reduce((best, r) => (r.wins > best.wins ? r : best))
  const bestWinPct = winPctRows[0]
  // Every tile below would otherwise point at the same lone captain.
  const showTiles = rows.length > 1

  return (
    <div className="flex flex-col gap-3">
      {showTiles && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Tile label="Most matches captained" row={mostMatches} value={(r) => `${r.matchesCaptained} led`} />
          <Tile label="Most wins" row={mostWins} value={(r) => `${r.wins} won`} />
          <Tile
            label={`Best win rate (min ${MIN_CAPTAINCY_MATCHES} matches)`}
            row={bestWinPct}
            value={(r) => `${pct(r.winPct)} (${r.wins}/${r.matchesCaptained})`}
          />
        </div>
      )}

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                {/* Name stays pinned while the numbers scroll on a phone. */}
                <th className="sticky left-0 bg-gray-50 text-left font-medium px-3 py-2 border-r border-gray-200">Captain</th>
                <th title="Matches captained" className="text-right font-medium px-2.5 py-2">Led</th>
                <th title="Won" className="text-right font-medium px-2.5 py-2">W</th>
                <th title="Lost" className="text-right font-medium px-2.5 py-2">L</th>
                <th title="Tied" className="text-right font-medium px-2.5 py-2">T</th>
                <th title="No result — the match ended before a second innings" className="text-right font-medium px-2.5 py-2">NR</th>
                <th title="Wins as a share of decided matches" className="text-right font-medium px-2.5 py-2">Win%</th>
                <th title="Longest run of wins as captain" className="text-right font-medium px-2.5 py-2 whitespace-nowrap">Best run</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.playerId} className={`border-t border-gray-100 ${i === 0 ? 'bg-pitch-light' : ''}`}>
                  <td className={`sticky left-0 font-semibold text-gray-900 px-3 py-2 whitespace-nowrap border-r border-gray-200 ${i === 0 ? 'bg-pitch-light' : 'bg-white'}`}>
                    {r.name}
                  </td>
                  <td className="text-right px-2.5 py-2 font-semibold text-gray-900">{r.matchesCaptained}</td>
                  <td className="text-right px-2.5 py-2 text-gray-600">{r.wins}</td>
                  <td className="text-right px-2.5 py-2 text-gray-600">{r.losses}</td>
                  <td className="text-right px-2.5 py-2 text-gray-600">{r.ties}</td>
                  <td className="text-right px-2.5 py-2 text-gray-600">{r.noResults}</td>
                  <td className="text-right px-2.5 py-2 font-semibold text-pitch">
                    {r.matchesCaptained >= MIN_CAPTAINCY_MATCHES ? pct(r.winPct) : <span className="font-normal text-gray-400" title={`Needs ${MIN_CAPTAINCY_MATCHES} matches`}>—</span>}
                  </td>
                  <td className="text-right px-2.5 py-2 text-gray-600">{r.bestWinStreak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
