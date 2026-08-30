// components/PlayerCard.jsx
import React from 'react'
import Avatar from './Avatar'
import SampleTag from './SampleTag'

export default function PlayerCard({ player, stat, onClick }) {
  const winRate = stat && stat.totalMatches ? Math.round((stat.totalWins / stat.totalMatches) * 100) : null
  return (
    <button
      onClick={onClick}
      className="text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 transition-all hover:border-brand dark:hover:border-brand hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
    >
      <div className="flex items-start justify-between">
        <Avatar id={player.id} name={player.name} size="md" className="mb-1.5" />
        {!player.isActive && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            Archived
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{player.name}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{stat?.totalMatches ?? 0} matches</p>
      {winRate !== null && (
        <p className="text-sm font-semibold text-brand dark:text-emerald-400 mt-1 flex items-center gap-1.5">
          {winRate}%
          <SampleTag matches={stat?.totalMatches} />
        </p>
      )}
    </button>
  )
}
