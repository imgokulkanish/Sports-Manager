// components/PlayerFormModal.jsx
import React, { useState } from 'react'
import { BTN_SOLID } from '../styles'

export default function PlayerFormModal({ open, onClose, onSubmit, allPlayers = [] }) {
  const [name, setName] = useState('')
  const [forbiddenPartners, setForbiddenPartners] = useState([])
  const [forbiddenOpponents, setForbiddenOpponents] = useState([])
  const [earlyMatchRequired, setEarlyMatchRequired] = useState(false)

  if (!open) return null

  const toggle = (arr, setArr, id) => {
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  const reset = () => {
    setName('')
    setForbiddenPartners([])
    setForbiddenOpponents([])
    setEarlyMatchRequired(false)
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), forbiddenPartners, forbiddenOpponents, earlyMatchRequired })
    reset()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[85vh] overflow-y-auto animate-[fadein_0.15s_ease-out]">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Add Player</h3>

        <label className="text-xs text-gray-500 dark:text-gray-400">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mt-1 mb-4 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
          placeholder="Player name"
        />

        {allPlayers.length > 0 && (
          <>
            <label className="text-xs text-gray-500 dark:text-gray-400">Forbidden partners (never paired)</label>
            <div className="flex flex-wrap gap-1.5 mt-1 mb-4">
              {allPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggle(forbiddenPartners, setForbiddenPartners, p.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    forbiddenPartners.includes(p.id)
                      ? 'bg-red-50 dark:bg-red-500/15 border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <label className="text-xs text-gray-500 dark:text-gray-400">Forbidden opponents (never opposite team)</label>
            <div className="flex flex-wrap gap-1.5 mt-1 mb-4">
              {allPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggle(forbiddenOpponents, setForbiddenOpponents, p.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    forbiddenOpponents.includes(p.id)
                      ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="flex items-center gap-2 mb-5">
          <input
            type="checkbox"
            checked={earlyMatchRequired}
            onChange={(e) => setEarlyMatchRequired(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Must play in first 3 rounds</span>
        </label>

        <div className="flex gap-2">
          <button
            onClick={() => {
              reset()
              onClose()
            }}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className={`flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium text-white ${BTN_SOLID}`}
          >
            Add Player
          </button>
        </div>
      </div>
    </div>
  )
}
