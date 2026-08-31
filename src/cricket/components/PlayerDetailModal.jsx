import React, { useState } from 'react'
import { battingAverage, strikeRate, bowlingAverage, economyRate, avgMVPPoints, totalMVPPoints, MIN_RELIABLE_MATCHES, MIN_MVP_MATCHES } from '../engine/statsEngine'
import { formatOversDisplay } from '../utils'
import ConfirmDialog from './ConfirmDialog'

function SmallSampleTag({ n, threshold = MIN_RELIABLE_MATCHES }) {
  if (n >= threshold) return null
  return <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 ml-1">small sample</span>
}

export default function PlayerDetailModal({ player, stat, onClose, onToggleActive, onDelete, onEdit, canManage = false }) {
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!player) return null

  const avg = stat ? battingAverage(stat) : null
  const sr = stat ? strikeRate(stat) : null
  const bowlAvg = stat ? bowlingAverage(stat) : null
  const econ = stat ? economyRate(stat) : null
  const mvpAvg = avgMVPPoints(stat)
  const mvpTotal = totalMVPPoints(stat)

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">{player.name}</h3>
          <button onClick={onClose} className="text-gray-400 text-sm">Close</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-400">Matches played</p>
            <p className="text-sm font-semibold text-gray-900">{stat?.matchesPlayed ?? 0}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-400">Innings batted</p>
            <p className="text-sm font-semibold text-gray-900">{stat?.inningsBatted ?? 0}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-400">Innings bowled</p>
            <p className="text-sm font-semibold text-gray-900">{stat?.inningsBowled ?? 0}</p>
          </div>
        </div>

        <p className="text-xs font-medium text-gray-500 mb-2">Batting</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-400">Runs</p>
            <p className="text-sm font-semibold text-gray-900">{stat?.totalRuns ?? 0}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-400">Average</p>
            <p className="text-sm font-semibold text-gray-900">{avg !== null ? avg.toFixed(1) : '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-400">Strike rate</p>
            <p className="text-sm font-semibold text-gray-900">{sr !== null ? sr.toFixed(0) : '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-400">Highest</p>
            <p className="text-sm font-semibold text-gray-900">{stat?.highestScore ?? 0}</p>
          </div>
        </div>

        <p className="text-xs font-medium text-gray-500 mb-2">Bowling</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-400">Overs</p>
            <p className="text-sm font-semibold text-gray-900">{formatOversDisplay(stat?.totalOvers)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-400">Wickets</p>
            <p className="text-sm font-semibold text-gray-900">{stat?.totalWickets ?? 0}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-400">Economy</p>
            <p className="text-sm font-semibold text-gray-900">{econ !== null ? econ.toFixed(1) : '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-400">Best</p>
            <p className="text-sm font-semibold text-gray-900">
              {stat?.bestBowling ? `${stat.bestBowling.wickets}/${stat.bestBowling.runs}` : '—'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-5">
          <div className="bg-pitch-light border border-pitch-border rounded-lg px-3 py-2 flex justify-between items-center">
            <span className="text-xs text-pitch-dark">MVP avg pts</span>
            <span className="text-sm font-semibold text-pitch-dark">
              {mvpAvg.toFixed(0)} avg <span className="text-xs font-normal">({mvpTotal} total)</span> <SmallSampleTag n={stat?.matchesPlayed ?? 0} threshold={MIN_MVP_MATCHES} />
            </span>
          </div>
          <div className="bg-pitch-light border border-pitch-border rounded-lg px-3 py-2 flex justify-between items-center">
            <span className="text-xs text-pitch-dark">Man of the Match</span>
            <span className="text-sm font-semibold text-pitch-dark">
              {stat?.motmCount ?? 0}× <SmallSampleTag n={stat?.matchesPlayed ?? 0} />
            </span>
          </div>
        </div>

        {/* Renaming, archiving and deleting are admin-only — see
            shell/components/Admin.jsx for what that does and doesn't protect. */}
        {canManage && (
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => onEdit?.(player)} className="rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700">
              Edit
            </button>
            <button onClick={() => setConfirmArchive(true)} className="rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700">
              {player.isActive ? 'Archive' : 'Unarchive'}
            </button>
            <button onClick={() => setConfirmDelete(true)} className="rounded-lg border border-red-300 py-2.5 text-sm font-medium text-red-600">
              Delete
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title={player.isActive ? 'Archive player?' : 'Unarchive player?'}
        message={player.isActive ? 'Archived players are hidden from new match selection but their history is kept.' : 'This player becomes selectable again.'}
        confirmLabel={player.isActive ? 'Archive' : 'Unarchive'}
        onConfirm={() => {
          onToggleActive(player.id, !player.isActive)
          setConfirmArchive(false)
        }}
        onCancel={() => setConfirmArchive(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete player?"
        message="This permanently removes the player from the roster."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          onDelete(player.id)
          setConfirmDelete(false)
          onClose()
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
