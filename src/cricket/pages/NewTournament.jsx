import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useTournaments } from '../hooks/useTournaments'
import Footer from '../components/Footer'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

// Suggested names — free text, just a shortcut for the common case.
const NAME_SUGGESTIONS = ['Corporate Cup', 'Knockout Tournament']

/**
 * Creating a tournament is only "who's with us today" — there's no captain
 * draft, because every tournament match is our full squad vs an external
 * opponent we keep no roster for. The per-match "who's actually playing this
 * round" tweak lives in the Add Tournament Match form.
 */
export default function NewTournament() {
  const { players, loading, addPlayer } = usePlayers()
  const { createTournament } = useTournaments()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [squadIds, setSquadIds] = useState([])
  const [guestName, setGuestName] = useState('')
  const [confirmCreate, setConfirmCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  const activePlayers = useMemo(() => players.filter((p) => p.isActive), [players])

  const toggleSelect = (id) => {
    setSquadIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleAddGuest = async () => {
    if (!guestName.trim()) return
    const ref = await addPlayer({ name: guestName.trim() })
    setSquadIds((prev) => [...prev, ref.id])
    showToast(`${guestName.trim()} added as guest`)
    setGuestName('')
  }

  const handleCreate = async () => {
    try {
      setCreating(true)
      const tournamentId = await createTournament({ name: name.trim(), date, squadPlayerIds: squadIds })
      if (!tournamentId) {
        showToast('Could not create tournament. Please try again.', 'error')
        return
      }
      setConfirmCreate(false)
      showToast('Tournament created')
      navigate(`/cricket/tournament/${tournamentId}`)
    } catch (error) {
      console.error('createTournament failed', error)
      showToast(error?.message || 'Failed to create tournament. Please try again.', 'error')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <ListSkeleton rows={5} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-lg font-semibold text-gray-900 mb-1">New Tournament</h1>
      <p className="text-xs text-gray-500 mb-4">Pick the squad for the day. Opponents are added per match — we don't track their players.</p>

      <div className="flex flex-col gap-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Tournament name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Saturday Corporate Cup"
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {NAME_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setName(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-gray-200 text-gray-600"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Squad for the day ({squadIds.length} selected, minimum 2)</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
            {activePlayers.map((p) => {
              const selected = squadIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 text-left min-h-[44px] ${selected ? 'border-pitch bg-pitch-light' : 'border-gray-200 bg-white'}`}
                >
                  <span className={`w-3.5 h-3.5 rounded-sm border-2 shrink-0 ${selected ? 'bg-pitch border-pitch' : 'border-gray-300'}`} />
                  <span className="text-sm text-gray-900 truncate">{p.name}</span>
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Add a guest by name"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={handleAddGuest} className="border border-pitch-border bg-pitch-light text-pitch text-sm font-medium rounded-lg px-4">
              Add
            </button>
          </div>
        </div>

        <button
          onClick={() => setConfirmCreate(true)}
          disabled={!name.trim() || squadIds.length < 2 || creating}
          className="bg-pitch text-white rounded-lg py-3 text-sm font-semibold disabled:bg-gray-300 disabled:text-gray-400"
        >
          {creating ? 'Creating...' : 'Create Tournament'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmCreate}
        title="Create this tournament?"
        message="This saves the squad for the day. You can add each round's match — and adjust who's playing it — afterwards."
        confirmLabel={creating ? 'Creating...' : 'Create'}
        onConfirm={handleCreate}
        onCancel={() => !creating && setConfirmCreate(false)}
      />

      <Footer />
    </div>
  )
}
