import React from 'react'
import { initials, avatarColor, formatOversDisplay } from '../utils'
import { battingAverage, economyRate } from '../engine/statsEngine'
import { RoleBadge } from './StatsBadge'

export default function PlayerCard({ player, stat, onClick }) {
  const avg = stat ? battingAverage(stat) : null
  const econ = stat ? economyRate(stat) : null
  const isBowler = player.preferredRole === 'bowler'
  return (
    <button onClick={onClick} className="text-left bg-white border border-gray-200 rounded-lg p-3 hover:border-pitch hover:shadow-sm transition-colors">
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-full text-white flex items-center justify-center text-xs font-semibold mb-1.5"
          style={{ background: avatarColor(player.id) }}
        >
          {initials(player.name)}
        </div>
        {!player.isActive && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Archived</span>
        )}
      </div>
      <p className="text-sm font-medium text-gray-900">{player.name}</p>
      {player.preferredRole && (
        <div className="mt-1">
          <RoleBadge role={player.preferredRole} />
        </div>
      )}
      <p className="text-[11px] text-gray-500 mt-0.5">{stat?.matchesPlayed ?? 0} matches</p>
      {isBowler
        ? econ !== null && <p className="text-sm font-semibold text-pitch mt-1">Econ {econ.toFixed(1)}</p>
        : avg !== null && <p className="text-sm font-semibold text-pitch mt-1">Avg {avg.toFixed(1)}</p>}
      {stat?.totalWickets > 0 && (
        <p className="text-[11px] text-gray-500">
          {stat.totalWickets} wkts{isBowler ? ` · ${formatOversDisplay(stat.totalOvers)} ov` : ''}
        </p>
      )}
    </button>
  )
}
