import React, { useState } from 'react'
import { usePlayers } from '../hooks/usePlayers'
import { useStats } from '../hooks/useStats'
import PlayerCard from '../components/PlayerCard'
import PlayerFormModal from '../components/PlayerFormModal'
import PlayerDetailModal from '../components/PlayerDetailModal'
import Footer from '../components/Footer'
import { GridSkeleton } from '../components/Skeleton'
import { useToast } from '../../shell/components/Toast'
import { useAdmin } from '../components/Admin'

export default function Players() {
  const { players, loading, addPlayer, updatePlayer, toggleActive, deletePlayer } = usePlayers()
  const { statsById } = useStats()
  const { showToast } = useToast()
  const { isAdmin } = useAdmin()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('active')
  const [roleFilter, setRoleFilter] = useState('all')

  const visible = players
    .filter((p) => (filter === 'active' ? p.isActive : filter === 'archived' ? !p.isActive : true))
    .filter((p) => (roleFilter === 'all' ? true : p.preferredRole === roleFilter))

  const handleSubmit = async (data) => {
    await addPlayer(data)
    showToast(`${data.name} added`)
    setShowAdd(false)
  }

  // PlayerFormModal has had an edit mode since it was written; this is the
  // first caller to use it. Only name and preferredRole are editable —
  // stats are derived from matches, never stored on the player.
  const handleEditSubmit = async (data) => {
    if (!editing) return
    try {
      await updatePlayer(editing.id, { name: data.name, preferredRole: data.preferredRole })
      showToast(`${data.name} updated`)
      setEditing(null)
      setSelected(null)
    } catch (error) {
      console.error('updatePlayer failed', error)
      showToast(error?.message || 'Could not save changes. Please try again.', 'error')
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Players</h1>
        <button onClick={() => setShowAdd(true)} className="bg-pitch text-white text-sm font-medium rounded-lg px-4 py-2">
          + Add Player
        </button>
      </div>

      <div className="flex gap-2 mb-2">
        {['active', 'archived', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize ${filter === f ? 'bg-pitch text-white border-pitch' : 'border-gray-200 text-gray-600'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'batsman', 'bowler', 'allrounder', 'wicketkeeper'].map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize ${
              roleFilter === r ? 'bg-pitch-light border-pitch-border text-pitch' : 'border-gray-200 text-gray-600'
            }`}
          >
            {r === 'all' ? 'All roles' : r}
          </button>
        ))}
      </div>

      {loading ? (
        <GridSkeleton items={6} />
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">No players here yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visible.map((p) => (
            <PlayerCard key={p.id} player={p} stat={statsById[p.id]} onClick={() => setSelected(p)} />
          ))}
        </div>
      )}

      <PlayerFormModal open={showAdd} onClose={() => setShowAdd(false)} onSubmit={handleSubmit} />
      <PlayerFormModal open={Boolean(editing)} player={editing} onClose={() => setEditing(null)} onSubmit={handleEditSubmit} />
      <PlayerDetailModal
        player={selected}
        stat={selected ? statsById[selected.id] : null}
        canManage={isAdmin}
        onClose={() => setSelected(null)}
        onEdit={(player) => {
          // Close the detail sheet first — otherwise the two full-screen
          // modals stack on top of each other.
          setSelected(null)
          setEditing(player)
        }}
        onToggleActive={(id, active) => {
          toggleActive(id, active)
          showToast(active ? 'Player unarchived' : 'Player archived')
        }}
        onDelete={(id) => {
          deletePlayer(id)
          showToast('Player deleted')
        }}
      />
      <Footer />
    </div>
  )
}
