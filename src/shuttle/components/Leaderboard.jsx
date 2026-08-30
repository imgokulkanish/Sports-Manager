// components/Leaderboard.jsx
import React from 'react'
import Avatar from './Avatar'
import { isLowSample } from '../engine/statsEngine'

/**
 * The app's standard value pairing: the headline figure, then the sample it
 * rests on in brackets — "78% (18)" is a win rate off 18 matches, "1 win (5)"
 * is one session won out of five played.
 *
 * The bracket doubles as the small-sample warning when `warn` is set, taking
 * over the job SampleTag's "n=X" pill used to do on these rows. One element
 * rather than two: the pill sat right beside the bracket and printed the very
 * same number, so a thin record read as "n=0 … 0% (0)".
 */
export function ValueWithCount({ children, count, warn = false }) {
  if (count === undefined || count === null) return <>{children}</>
  return (
    <>
      {children}{' '}
      <span
        title={warn ? `Based on only ${count} match${count === 1 ? '' : 'es'} - small sample` : undefined}
        className={`text-xs font-normal ${
          warn ? 'text-amber-600 dark:text-amber-500' : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        ({count})
      </span>
    </>
  )
}

export default function Leaderboard({ rows, valueLabel = 'Win %', renderValue, highlightTop = true }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, i) => (
        <div
          key={row.playerId || row.id || i}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-shadow ${
            highlightTop && i === 0
              ? 'bg-brand-light dark:bg-brand/15 border-brand-border dark:border-brand/30 shadow-sm'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:shadow-sm'
          }`}
        >
          <span
            className={`text-xs font-medium w-4 text-center ${
              highlightTop && i === 0 ? 'text-brand dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {i + 1}
          </span>
          <Avatar id={row.playerId || row.id} name={row.name} size="xs" />
          <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">{row.name}</span>
          {/* Free-form chip, e.g. the "Guest 2/12" mark on a drop-in player. */}
          {row.tag && (
            <span
              title={row.tagTitle}
              className="text-[9px] font-semibold leading-none px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700 shrink-0"
            >
              {row.tag}
            </span>
          )}
          {row.record && <span className="text-xs text-gray-400 dark:text-gray-500">{row.record}</span>}
          <span className="text-sm font-semibold text-brand dark:text-emerald-400">
            {renderValue ? (
              renderValue(row)
            ) : (
              <ValueWithCount count={row.totalMatches} warn={isLowSample(row.totalMatches)}>
                {Math.round((row.winRate || 0) * 100)}%
              </ValueWithCount>
            )}
          </span>
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Not enough data yet.</p>}
    </div>
  )
}
