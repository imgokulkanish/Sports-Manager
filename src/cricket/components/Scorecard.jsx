import React from 'react'
import { deriveInningsState } from '../engine/scoringEngine'
import { formatOversDisplay } from '../utils'

// `sixout` is Box Cricket's "a six is out" rule — see scoringEngine.js. It
// behaves as an ordinary bowler-credited dismissal, so the line reads
// "six out b Bowler" exactly like "c b Bowler" does.
const WICKET_LABELS = { bowled: 'b', caught: 'c', lbw: 'lbw', runout: 'run out', stumped: 'st', retired: 'retired out', sixout: 'six out', other: 'out' }

export default function Scorecard({ innings, playersById, teamLabel }) {
  if (!innings) return null
  const derived = deriveInningsState(innings)
  const name = (id) => playersById[id]?.name || id

  const battingRows = Object.entries(derived.batting).sort((a, b) => b[1].runs - a[1].runs)
  const bowlingRows = Object.entries(derived.bowling).sort((a, b) => b[1].wickets - a[1].wickets)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">{teamLabel}</p>
        <p className="text-sm font-semibold text-pitch">
          {derived.totalRuns}/{derived.totalWickets}{' '}
          <span className="text-xs text-gray-400 font-normal">({formatOversDisplay(derived.oversBowled)} ov)</span>
        </p>
      </div>
      {innings.scoringMode === 'quick' && (
        <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Quick mode — individual batting figures are estimated, not exact.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              <th className="text-left px-2.5 py-1.5 font-medium">Batsman</th>
              <th className="text-left px-2.5 py-1.5 font-medium">Dismissal</th>
              <th className="text-right px-2.5 py-1.5 font-medium">R</th>
              <th className="text-right px-2.5 py-1.5 font-medium">B</th>
              <th className="text-right px-2.5 py-1.5 font-medium">4s</th>
              <th className="text-right px-2.5 py-1.5 font-medium">6s</th>
            </tr>
          </thead>
          <tbody>
            {/* Empty in a tournament match when the opposition was batting —
                their individual figures are deliberately never recorded, so
                the team total above is the whole story for that innings. */}
            {battingRows.length === 0 && (
              <tr className="border-t border-gray-100">
                <td colSpan={6} className="px-2.5 py-2 text-gray-400">
                  No individual batting figures recorded.
                </td>
              </tr>
            )}
            {battingRows.map(([id, b]) => (
              <tr key={id} className="border-t border-gray-100">
                <td className="px-2.5 py-1.5 text-gray-900">{name(id)}</td>
                <td className="px-2.5 py-1.5 text-gray-400">
                  {b.isOut ? `${WICKET_LABELS[b.howOut] || 'out'}${b.bowlerId ? ' b ' + name(b.bowlerId) : ''}` : 'not out'}
                </td>
                <td className="px-2.5 py-1.5 text-right font-medium">{b.runs}</td>
                <td className="px-2.5 py-1.5 text-right text-gray-500">{b.balls}</td>
                <td className="px-2.5 py-1.5 text-right text-gray-500">{b.fours}</td>
                <td className="px-2.5 py-1.5 text-right text-gray-500">{b.sixes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              <th className="text-left px-2.5 py-1.5 font-medium">Bowler</th>
              <th className="text-right px-2.5 py-1.5 font-medium">O</th>
              <th className="text-right px-2.5 py-1.5 font-medium">M</th>
              <th className="text-right px-2.5 py-1.5 font-medium">R</th>
              <th className="text-right px-2.5 py-1.5 font-medium">W</th>
              <th className="text-right px-2.5 py-1.5 font-medium">Econ</th>
            </tr>
          </thead>
          <tbody>
            {bowlingRows.length === 0 && (
              <tr className="border-t border-gray-100">
                <td colSpan={6} className="px-2.5 py-2 text-gray-400">
                  No individual bowling figures recorded.
                </td>
              </tr>
            )}
            {bowlingRows.map(([id, b]) => (
              <tr key={id} className="border-t border-gray-100">
                <td className="px-2.5 py-1.5 text-gray-900">{name(id)}</td>
                <td className="px-2.5 py-1.5 text-right text-gray-500">{formatOversDisplay(b.overs)}</td>
                <td className="px-2.5 py-1.5 text-right text-gray-500">{b.maidens}</td>
                <td className="px-2.5 py-1.5 text-right text-gray-500">{b.runsConceded}</td>
                <td className="px-2.5 py-1.5 text-right font-medium">{b.wickets}</td>
                <td className="px-2.5 py-1.5 text-right text-gray-500">{b.overs > 0 ? (b.runsConceded / b.overs).toFixed(1) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
