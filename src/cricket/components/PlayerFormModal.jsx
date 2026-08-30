import React, { useEffect, useState } from 'react'

const ROLES = ['batsman', 'bowler', 'allrounder', 'wicketkeeper']

export default function PlayerFormModal({ open, onClose, onSubmit, player = null }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState(null)
  const isEdit = Boolean(player)

  useEffect(() => {
    if (open) {
      setName(player?.name || '')
      setRole(player?.preferredRole || null)
    }
  }, [open, player])

  if (!open) return null

  const reset = () => {
    setName('')
    setRole(null)
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), preferredRole: role })
    reset()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900 mb-4">{isEdit ? 'Edit Player' : 'Add Player'}</h3>

        <label className="text-xs text-gray-500">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mt-1 mb-4 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Player name"
        />

        <label className="text-xs text-gray-500">Preferred role (optional)</label>
        <div className="flex flex-wrap gap-1.5 mt-1 mb-5">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRole(role === r ? null : r)}
              className={`text-xs px-2.5 py-1 rounded-full border capitalize ${
                role === r ? 'bg-pitch-light border-pitch-border text-pitch' : 'border-gray-200 text-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              reset()
              onClose()
            }}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1 rounded-lg bg-pitch py-2.5 text-sm font-medium text-white disabled:bg-gray-300 disabled:text-gray-400"
          >
            {isEdit ? 'Save Changes' : 'Add Player'}
          </button>
        </div>
      </div>
    </div>
  )
}
