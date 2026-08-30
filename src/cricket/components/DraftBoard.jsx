import React from 'react'
import { initials, avatarColor } from '../utils'

export default function DraftBoard({ pool, captainAId, captainBId, teamA, teamB, currentPicker, onPick, onRemove, playersById }) {
  const picked = new Set([...teamA, ...teamB])
  const remaining = pool.filter((id) => !picked.has(id))

  const TeamColumn = ({ label, ids, captainId, isTurn, teamKey }) => (
    <div className={`flex-1 rounded-lg border p-3 ${isTurn ? 'border-pitch bg-pitch-light' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs font-medium text-gray-500 mb-2">
        {label} {isTurn && <span className="text-pitch">— picking</span>}
      </p>
      <div className="flex flex-col gap-1.5">
        {ids.map((id) => (
          <div key={id} className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[9px] font-semibold shrink-0" style={{ background: avatarColor(id) }}>
              {initials(playersById[id]?.name || '?')}
            </div>
            <span className="text-gray-900 truncate flex-1">{playersById[id]?.name}</span>
            {id === captainId && <span className="text-[9px] text-pitch bg-pitch-light border border-pitch-border rounded-full px-1.5 shrink-0">C</span>}
            {onRemove && id !== captainId && (
              <button
                onClick={() => onRemove(id, teamKey)}
                aria-label={`Remove ${playersById[id]?.name || 'player'}`}
                className="text-gray-300 hover:text-red-600 text-xs shrink-0 w-5 h-5 flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {ids.length === 0 && <p className="text-xs text-gray-400">No players yet</p>}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <TeamColumn label="Team A" ids={teamA} captainId={captainAId} isTurn={currentPicker === 'A'} teamKey="A" />
        <TeamColumn label="Team B" ids={teamB} captainId={captainBId} isTurn={currentPicker === 'B'} teamKey="B" />
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-2">
          Available ({remaining.length}) {currentPicker && `— ${currentPicker === 'A' ? 'Team A' : 'Team B'} picks next`}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {remaining.map((id) => (
            <button
              key={id}
              onClick={() => onPick(id)}
              disabled={!currentPicker}
              className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 text-left bg-white hover:border-pitch disabled:opacity-50 min-h-[44px]"
            >
              <div className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[9px] font-semibold shrink-0" style={{ background: avatarColor(id) }}>
                {initials(playersById[id]?.name || '?')}
              </div>
              <span className="text-sm text-gray-900 truncate">{playersById[id]?.name}</span>
            </button>
          ))}
          {remaining.length === 0 && <p className="text-xs text-gray-400 col-span-full text-center py-4">Draft complete.</p>}
        </div>
      </div>
    </div>
  )
}
