import React from 'react'
import { MVP_RULES } from '../engine/mvpEngine'

function pts(n) {
  return `${n > 0 ? '+' : ''}${n} pt${Math.abs(n) === 1 ? '' : 's'}`
}

const SECTIONS = [
  {
    label: 'Batting',
    rows: [
      { criteria: 'Per run scored', value: pts(MVP_RULES.RUN) },
      { criteria: 'Per boundary (4)', value: pts(MVP_RULES.FOUR_BONUS) },
      { criteria: 'Per six', value: pts(MVP_RULES.SIX_BONUS) },
      { criteria: `${MVP_RULES.HALF_CENTURY_THRESHOLD}+ runs in an innings`, value: pts(MVP_RULES.HALF_CENTURY_BONUS) },
    ],
  },
  {
    label: 'Bowling',
    rows: [
      { criteria: 'Per wicket', value: pts(MVP_RULES.WICKET) },
      { criteria: 'Per maiden over', value: pts(MVP_RULES.MAIDEN_BONUS) },
      { criteria: `Economy under ${MVP_RULES.GOOD_ECONOMY_THRESHOLD}`, value: pts(MVP_RULES.GOOD_ECONOMY_BONUS) },
      { criteria: `Economy over ${MVP_RULES.POOR_ECONOMY_THRESHOLD}`, value: pts(MVP_RULES.POOR_ECONOMY_PENALTY) },
    ],
  },
  {
    label: 'Fielding',
    rows: [
      { criteria: 'Per catch', value: pts(MVP_RULES.CATCH) },
      { criteria: 'Per run out', value: pts(MVP_RULES.RUNOUT) },
      { criteria: 'Per stumping', value: pts(MVP_RULES.STUMPING) },
    ],
  },
]

export default function MvpInfoModal({ open, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm p-5 shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-gray-900">How MVP points work</h3>
          <button onClick={onClose} className="text-gray-400 text-sm">Close</button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Each match, every player earns points for their batting, bowling, and fielding. The leaderboard ranks players by their average points per match.
        </p>

        <div className="flex flex-col gap-4">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="text-xs font-medium text-gray-500 mb-2">{section.label}</p>
              <div className="flex flex-col gap-1.5">
                {section.rows.map((row) => (
                  <div key={row.criteria} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-700">{row.criteria}</span>
                    <span className="text-xs font-semibold text-gray-900">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
