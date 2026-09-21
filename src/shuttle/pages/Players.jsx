// pages/Players.jsx
import React, { useMemo, useState } from 'react'
import { usePlayers } from '../hooks/usePlayers'
import { useStats } from '../hooks/useStats'
import { sessionAchievements } from '../engine/statsEngine'
import PlayerCard from '../components/PlayerCard'
import PlayerFormModal from '../components/PlayerFormModal'
import PlayerDetailModal from '../components/PlayerDetailModal'
import Footer from '../components/Footer'
import EmptyState from '../components/EmptyState'
import { PeopleIcon } from '../components/icons'
import { GridSkeleton } from '../components/Skeleton'
import { useToast } from '../../shell/components/Toast'
import { useAdmin } from '../../shell/components/Admin'

export default function Players() {
  const { players, loading, addPlayer, updatePlayer, toggleActive, deletePlayer } = usePlayers()
  const { statsById, sessions } = useStats()
  const { showToast } = useToast()
  const { isAdmin } = useAdmin()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('active')
  const [sortByWinRate, setSortByWinRate] = useState(true)

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])
  const achievementsById = useMemo(() => sessionAchievements(sessions, players), [sessions, players])

  const visible = players.filter((p) => (filter === 'active' ? p.isActive : filter === 'archived' ? !p.isActive : true))

  if (sortByWinRate) {
    visible.sort((a, b) => {
      const statA = statsById[a.id]
      const statB = statsById[b.id]
      const rateA = statA?.totalMatches ? statA.totalWins / statA.totalMatches : -1
      const rateB = statB?.totalMatches ? statB.totalWins / statB.totalMatches : -1
      return rateB - rateA || a.name.localeCompare(b.name)
    })
  }

  const handleAdd = async (data) => {
    await addPlayer(data)
    setShowAdd(false)
    showToast(`${data.name} added`)
  }

  // Only the fields the form owns are written back - createdAt, isActive and
  // constraints.doubleWith (set elsewhere) are left alone.
  const handleEdit = async (data) => {
    if (!editing) return
    try {
      await updatePlayer(editing.id, {
        name: data.name,
        constraints: {
          ...(editing.constraints || {}),
          forbiddenPartners: data.forbiddenPartners,
          forbiddenOpponents: data.forbiddenOpponents,
          earlyMatchRequired: data.earlyMatchRequired,
        },
      })
      showToast(`${data.name} updated`)
      setEditing(null)
    } catch (error) {
      console.error('updatePlayer failed', error)
      showToast(error?.message || 'Could not save changes. Please try again.', 'error')
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Players</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-4 py-2 transition-all active:scale-[0.98]"
        >
          + Add Player
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex gap-2">
          {['active', 'archived', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                filter === f
                  ? 'bg-brand text-white border-brand'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortByWinRate((v) => !v)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            sortByWinRate
              ? 'bg-brand text-white border-brand'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          Sort by win %
        </button>
      </div>

      {loading ? (
        <GridSkeleton items={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<PeopleIcon className="w-6 h-6" />}
          title={filter === 'archived' ? 'No archived players' : 'No players here yet'}
          message={
            filter === 'archived'
              ? "Players you archive will show up here."
              : 'Add your regulars once and reuse them for every session.'
          }
          action={
            filter !== 'archived' && (
              <button
                onClick={() => setShowAdd(true)}
                className="bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-4 py-2 transition-all active:scale-[0.98]"
              >
                + Add Player
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visible.map((p) => (
            <PlayerCard key={p.id} player={p} stat={statsById[p.id]} onClick={() => setSelected(p)} />
          ))}
        </div>
      )}

      <PlayerFormModal open={showAdd} onClose={() => setShowAdd(false)} onSubmit={handleAdd} allPlayers={players} />
      <PlayerFormModal
        open={Boolean(editing)}
        player={editing}
        onClose={() => setEditing(null)}
        onSubmit={handleEdit}
        allPlayers={players}
      />
      <PlayerDetailModal
        key={selected?.id}
        player={selected}
        stat={selected ? statsById[selected.id] : null}
        playersById={playersById}
        sessions={sessions}
        achievements={selected ? achievementsById[selected.id] : null}
        statsById={statsById}
        players={players}
        achievementsById={achievementsById}
        canManage={isAdmin}
        onClose={() => setSelected(null)}
        onEdit={(player) => {
          // Close the detail sheet first - otherwise the two full-screen
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
