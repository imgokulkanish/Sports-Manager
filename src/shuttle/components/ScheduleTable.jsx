// components/ScheduleTable.jsx
import React from 'react'
import Avatar from './Avatar'
import { orderedMatches, matchFormatLabel } from '../engine/scheduleEngine'

function TeamCell({ ids, playersById, highlight }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${
        highlight ? 'font-semibold text-brand dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100'
      }`}
    >
      {ids.map((id, i) => (
        <React.Fragment key={id}>
          {i > 0 && <span className="text-gray-400 dark:text-gray-500 font-normal">&</span>}
          <span className="inline-flex items-center gap-1">
            <Avatar id={id} name={playersById[id]?.name || id} size="xs" />
            {playersById[id]?.name || id}
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}

export default function ScheduleTable({ schedule, playersById, scores = {}, compact = false }) {
  const name = (id) => playersById[id]?.name || id
  // Two matches sharing a slot were played simultaneously on separate courts.
  // Number rows by slot so the round numbers match what the umpire called out,
  // and only spend a column on courts when there was more than one.
  const multiCourt = schedule.some((round) => (round.court ?? 1) > 1)
  // Rows go in playing order, which is only the array order until a round is
  // swapped live (see swapSlots). `index` stays the array position, because
  // that is what `scores` is keyed by.
  const rows = orderedMatches(schedule)
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs">
            <th className="text-left px-3 py-2 font-medium">Rd</th>
            {multiCourt && <th className="text-left px-3 py-2 font-medium">Ct</th>}
            <th className="text-left px-3 py-2 font-medium">Team 1</th>
            <th className="text-left px-3 py-2 font-medium">Team 2</th>
            {!compact && <th className="text-left px-3 py-2 font-medium">Resting</th>}
            {Object.keys(scores).length > 0 && <th className="text-left px-3 py-2 font-medium">Winner</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ index: i, match: round, slot, court }) => {
            const winner = scores[i]?.winner
            const points = scores[i]?.points
            return (
              <tr
                key={i}
                className="border-t border-gray-100 dark:border-gray-800 even:bg-gray-50/50 dark:even:bg-gray-900/50"
              >
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{slot + 1}</td>
                {multiCourt && (
                  <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                    {court}
                    {matchFormatLabel(round) ? ` · ${matchFormatLabel(round)}` : ''}
                  </td>
                )}
                <td className="px-3 py-2">
                  <TeamCell ids={round.team1} playersById={playersById} highlight={winner === 1} />
                </td>
                <td className="px-3 py-2">
                  <TeamCell ids={round.team2} playersById={playersById} highlight={winner === 2} />
                </td>
                {!compact && (
                  <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs">
                    {round.resting.map(name).join(', ') || '—'}
                  </td>
                )}
                {Object.keys(scores).length > 0 && (
                  <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                    {winner ? `Team ${winner}${points ? ` (${points.team1}-${points.team2})` : ''}` : '—'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
