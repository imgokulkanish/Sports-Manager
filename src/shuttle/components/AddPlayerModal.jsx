// components/AddPlayerModal.jsx
//
// Someone turns up after the session has started and wants in properly - not
// as a one-match stand-in (that's RoundAdjustModal's job) but as a member for
// the rest of the evening. They join the roster, share the court cost, and
// every round that hasn't started yet is redrawn around the bigger group.
//
// Rounds already played keep their results untouched; only the pending ones
// move. See pendingSlots in the schedule engine for exactly where that line
// falls on a two-court round.
import React, { useState } from 'react'
import Avatar from './Avatar'
import { BTN_OUTLINE, BTN_SOLID } from '../styles'

export default function AddPlayerModal({
  open,
  onClose,
  candidates = [],
  pendingRounds,
  onAdd,
  onCreatePlayer,
  busy = false,
}) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  if (!open) return null

  const close = () => {
    setNewName('')
    onClose()
  }

  const add = async (playerId) => {
    const ok = await onAdd(playerId)
    if (ok) close()
  }

  const createAndAdd = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const id = await onCreatePlayer(name)
      if (id) await add(id)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 md:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[88vh] overflow-y-auto p-5 shadow-xl animate-[fadein_0.15s_ease-out]">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Add a player</h3>
          <button
            onClick={close}
            className="text-xs text-gray-400 dark:text-gray-500 underline hover:text-gray-600 dark:hover:text-gray-300"
          >
            Close
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {pendingRounds > 0 ? (
            <>
              They join for the rest of the session. The {pendingRounds} round
              {pendingRounds === 1 ? '' : 's'} still to play will be redrawn around them — rounds already played keep
              their results, and the cost splits one more way.
            </>
          ) : (
            <>There are no rounds left to redraw, so nobody can be added now.</>
          )}
        </p>

        {pendingRounds > 0 && (
          <>
            {candidates.length > 0 ? (
              <div className="flex flex-col gap-1.5 mb-4 max-h-64 overflow-y-auto">
                {candidates.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={busy}
                    onClick={() => add(p.id)}
                    className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 hover:border-brand dark:hover:border-brand ${BTN_OUTLINE}`}
                  >
                    <Avatar id={p.id} name={p.name} size="xs" />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.guest && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">currently a guest</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                Everyone on the roster is already in this session.
              </p>
            )}

            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createAndAdd()}
                placeholder="Or add a new player by name"
                className="flex-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={createAndAdd}
                disabled={busy || creating || !newName.trim()}
                className={`bg-brand text-white rounded-lg px-4 text-sm font-semibold ${BTN_SOLID}`}
              >
                {creating ? 'Adding…' : 'Add'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
