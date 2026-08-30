import React from 'react'
import { initials, avatarColor } from '../utils'

function EstimatedTag() {
  return <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1 py-0.5">est</span>
}

function MatchupTable({ rows, idKey, nameOf, emptyLabel }) {
  if (!rows.length) return <p className="text-sm text-gray-400 text-center py-4">{emptyLabel}</p>
  return (
    <div className="overflow-x-auto -mx-1 mb-2">
      <table className="w-full text-xs min-w-[420px]">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-100">
            <th className="py-1.5 px-1 font-medium">Player</th>
            <th className="py-1.5 px-1 font-medium text-right">Runs</th>
            <th className="py-1.5 px-1 font-medium text-right">Balls</th>
            <th className="py-1.5 px-1 font-medium text-right">SR</th>
            <th className="py-1.5 px-1 font-medium text-right">Wkts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[idKey]} className="border-b border-gray-50 last:border-0">
              <td className="py-1.5 px-1 text-gray-900">
                <div className="flex items-center gap-1">
                  <span className="truncate">{nameOf(row[idKey])}</span>
                  {row.estimated && <EstimatedTag />}
                </div>
              </td>
              <td className="py-1.5 px-1 text-right text-gray-700">{row.runs}</td>
              <td className="py-1.5 px-1 text-right text-gray-700">{row.balls}</td>
              <td className="py-1.5 px-1 text-right text-gray-700">{row.strikeRate !== null ? row.strikeRate.toFixed(0) : '—'}</td>
              <td className="py-1.5 px-1 text-right text-gray-700">{row.wickets}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Full head-to-head breakdown for one player: every bowler they've faced
 * (batting side), and — if they've bowled at all — every batsman they've
 * bowled to (the other side of the same matrix). */
export default function MatchupDetailModal({ player, matrix, nameOf, onClose }) {
  if (!player) return null

  const facing = Object.entries(matrix[player.id] || {})
    .map(([bowlerId, cell]) => ({ bowlerId, ...cell }))
    .sort((a, b) => b.balls - a.balls)

  const bowling = []
  Object.entries(matrix).forEach(([batsmanId, byBowler]) => {
    const cell = byBowler[player.id]
    if (cell) bowling.push({ batsmanId, ...cell })
  })
  bowling.sort((a, b) => b.balls - a.balls)

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg p-5 shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ background: avatarColor(player.id) }}
            >
              {initials(player.name)}
            </div>
            <h3 className="text-base font-semibold text-gray-900 truncate">{player.name}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 text-sm shrink-0">Close</button>
        </div>

        <p className="text-xs font-medium text-gray-500 mb-2">Facing (as batsman)</p>
        <MatchupTable rows={facing} idKey="bowlerId" nameOf={nameOf} emptyLabel="No balls faced yet." />

        {bowling.length > 0 && (
          <>
            <p className="text-xs font-medium text-gray-500 mb-2 mt-4">Bowling (as bowler)</p>
            <MatchupTable rows={bowling} idKey="batsmanId" nameOf={nameOf} emptyLabel="No balls bowled yet." />
          </>
        )}
      </div>
    </div>
  )
}
