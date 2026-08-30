import React from 'react'
import { initials, avatarColor } from '../utils'
import { MIN_RELIABLE_MATCHES } from '../engine/statsEngine'

/**
 * @param {boolean} [showSampleWarning] - the "small sample" tag only means
 *   something on all-time boards, where a short track record sits next to
 *   long ones. On a board already scoped to one event (a single day's
 *   tournament) every row is a small sample by definition, so the tag is
 *   noise — and it crowds out the player's name on a phone.
 */
export default function Leaderboard({ rows, renderValue, highlightTop = true, showSampleWarning = true }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div
          key={row.playerId || i}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border ${
            highlightTop && i === 0 ? 'bg-pitch-light border-pitch-border' : i % 2 === 1 ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
          }`}
        >
          <span className="text-xs font-medium text-gray-400 w-4 text-center">{i + 1}</span>
          <div className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[9px] font-semibold shrink-0" style={{ background: avatarColor(row.playerId) }}>
            {initials(row.name)}
          </div>
          <span className="text-sm text-gray-900 flex-1 truncate">{row.name}</span>
          {showSampleWarning && row.matchesPlayed < MIN_RELIABLE_MATCHES && (
            <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">small sample</span>
          )}
          <span className="text-sm font-semibold text-pitch">{renderValue(row)}</span>
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Not enough data yet.</p>}
    </div>
  )
}
