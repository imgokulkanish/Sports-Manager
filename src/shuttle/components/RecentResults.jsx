// components/RecentResults.jsx
import React, { useState } from 'react'
import { matchFormatLabel } from '../engine/scheduleEngine'

const PREVIEW = 5

/**
 * Rounds already in the book, newest first, for the live session screen.
 *
 * Court-side this answers the question the leaderboard can't: "who did we
 * just beat, and how close was it". Every result is listed, newest first by
 * when it was entered: the courts run as separate queues, so a match from a
 * later round can land before one from an earlier round. `court` is the court
 * it was actually played on.
 *
 * Collapsed to the five most recent by default. A full evening is a dozen-odd
 * rounds and the list sits above nothing but the footer, so the rest is one
 * tap away rather than a scroll.
 */
export default function RecentResults({ rows, isMultiCourt, playersById }) {
  const [expanded, setExpanded] = useState(false)
  if (!rows.length) return null

  const shown = expanded ? rows : rows.slice(0, PREVIEW)
  const name = (pid) => playersById[pid]?.name || pid

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Recent results</p>
        {rows.length > PREVIEW && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-gray-400 dark:text-gray-500 underline hover:text-gray-600 dark:hover:text-gray-300"
          >
            {expanded ? 'Show less' : `Show all ${rows.length}`}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {shown.map(({ index, match, court, scored, roundNumber }) => {
          const winners = scored.winner === 1 ? match.team1 : match.team2
          const losers = scored.winner === 1 ? match.team2 : match.team1
          // Points are stored per team, not per winner - older sessions were
          // winner-only, so the score line has to survive them being absent.
          const pts = scored.points
          const line = pts
            ? `${Math.max(pts.team1, pts.team2)}-${Math.min(pts.team1, pts.team2)}`
            : null
          return (
            <div
              key={index}
              className="flex items-start gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm"
            >
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-4 text-center shrink-0 mt-0.5">
                {roundNumber}
              </span>
              <span className="flex-1 min-w-0 text-gray-900 dark:text-gray-100 truncate">
                {isMultiCourt && (
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mr-1.5">
                    C{court}
                    {matchFormatLabel(match) === 'Singles' ? ' · S' : matchFormatLabel(match) ? ' · 2v1' : ''}
                  </span>
                )}
                <span className="font-medium">{winners.map(name).join(' & ')}</span>
                <span className="text-gray-400 dark:text-gray-500 mx-1.5">beat</span>
                {losers.map(name).join(' & ')}
              </span>
              {line && (
                <span className="text-xs font-semibold text-brand dark:text-emerald-400 shrink-0 mt-0.5">{line}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
