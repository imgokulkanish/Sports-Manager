import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatch'
import DraftBoard from '../components/DraftBoard'
import Footer from '../components/Footer'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

export default function NewMatch() {
  const { players, loading, addPlayer } = usePlayers()
  const { matches, createMatch } = useMatches()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [venue, setVenue] = useState('')
  const [oversPerInnings, setOversPerInnings] = useState(8)
  const [maxOversPerBowler, setMaxOversPerBowler] = useState(3)
  const [poolIds, setPoolIds] = useState([])
  const [guestName, setGuestName] = useState('')

  // Draft state
  const [captainAId, setCaptainAId] = useState('')
  const [captainBId, setCaptainBId] = useState('')
  const [teamA, setTeamA] = useState([])
  const [teamB, setTeamB] = useState([])
  const [currentPicker, setCurrentPicker] = useState('A')
  const [draftStartsBy, setDraftStartsBy] = useState('A')
  const [teamAName, setTeamAName] = useState('Team A')
  const [teamBName, setTeamBName] = useState('Team B')

  // Toss + mode
  const [tossWonBy, setTossWonBy] = useState('A')
  const [tossDecision, setTossDecision] = useState('bat')
  // Quick mode is hidden for now (item 6) — Full is the only mode reachable
  // from this form, but the engine/UI still fully supports Quick for
  // existing matches, so this default is the only change needed here.
  const [scoringMode] = useState('full')
  const [confirmStart, setConfirmStart] = useState(false)
  const [startingMatch, setStartingMatch] = useState(false)
  const [teamsFromLastMatch, setTeamsFromLastMatch] = useState(false)

  const activePlayers = useMemo(() => players.filter((p) => p.isActive), [players])
  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])
  const lastMatch = matches[0] || null

  const toggleSelect = (id) => {
    setPoolIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleAddGuest = async () => {
    if (!guestName.trim()) return
    const ref = await addPlayer({ name: guestName.trim() })
    setPoolIds((prev) => [...prev, ref.id])
    setGuestName('')
    showToast(`${guestName.trim()} added as guest`)
  }

  const startDraft = () => {
    if (!captainAId || !captainBId || captainAId === captainBId) {
      showToast('Pick two different captains', 'error')
      return
    }
    const tossWinner = Math.random() < 0.5 ? 'A' : 'B'
    setTeamA([captainAId])
    setTeamB([captainBId])
    setDraftStartsBy(tossWinner)
    setCurrentPicker(tossWinner)
    setTeamsFromLastMatch(false)
    showToast(`${tossWinner === 'A' ? teamAName : teamBName} won the draft toss and will pick first`)
    setStep(3)
  }

  // Shortcut for "same group as last time" — prefills pool/names/captains/
  // rosters from the most recent match and skips straight past the draft
  // step, since the teams are already decided. Archived players get quietly
  // dropped from the roster (flagged via toast) rather than silently
  // carried over into an inactive slot.
  const useLastMatchTeams = () => {
    if (!lastMatch) return
    const activeIds = new Set(activePlayers.map((p) => p.id))
    const filterActive = (ids) => ids.filter((id) => activeIds.has(id))
    const nameOf = (id) => playersById[id]?.name || 'Unknown player'
    const excluded = [...lastMatch.teamA.playerIds, ...lastMatch.teamB.playerIds].filter((id) => !activeIds.has(id))

    const newTeamA = filterActive(lastMatch.teamA.playerIds)
    const newTeamB = filterActive(lastMatch.teamB.playerIds)
    const newCaptainA = activeIds.has(lastMatch.teamA.captainId) ? lastMatch.teamA.captainId : ''
    const newCaptainB = activeIds.has(lastMatch.teamB.captainId) ? lastMatch.teamB.captainId : ''

    setPoolIds([...newTeamA, ...newTeamB])
    setTeamAName(lastMatch.teamA.name || 'Team A')
    setTeamBName(lastMatch.teamB.name || 'Team B')
    setCaptainAId(newCaptainA)
    setCaptainBId(newCaptainB)
    setTeamA(newTeamA)
    setTeamB(newTeamB)
    setCurrentPicker(null)
    setTeamsFromLastMatch(true)

    if (excluded.length) {
      showToast(`Excluded archived player${excluded.length > 1 ? 's' : ''}: ${excluded.map(nameOf).join(', ')}`, 'error')
    } else {
      showToast('Loaded teams from last match')
    }
    if (!newCaptainA || !newCaptainB) {
      showToast('A captain from last match is archived — pick a new one before starting', 'error')
    }
    setStep(3)
  }

  const remainingAfterCaptains = useMemo(
    () => poolIds.filter((id) => id !== captainAId && id !== captainBId && !teamA.includes(id) && !teamB.includes(id)),
    [poolIds, captainAId, captainBId, teamA, teamB],
  )

  const handlePick = (id) => {
    if (poolIds.length % 2 === 1 && remainingAfterCaptains.length === 1) {
      setTeamA((prev) => (prev.includes(id) ? prev : [...prev, id]))
      setTeamB((prev) => (prev.includes(id) ? prev : [...prev, id]))
      setCurrentPicker(null)
      showToast(`${playersById[id]?.name || 'Last player'} will play for both teams`)
      return
    }

    if (currentPicker === 'A') {
      setTeamA((prev) => [...prev, id])
      setCurrentPicker(remainingAfterCaptains.length > 1 ? 'B' : null)
    } else {
      setTeamB((prev) => [...prev, id])
      setCurrentPicker(remainingAfterCaptains.length > 1 ? 'A' : null)
    }
  }

  // Correction tool for a mis-pick — returns a drafted player to the
  // Available pool. Deliberately doesn't touch currentPicker (whoever's
  // turn it was stays their turn); if the draft had already finished
  // (currentPicker null), removing one player reopens exactly one slot, so
  // the team just short a player becomes the picker again. The shared
  // "plays for both teams" pick (odd pool size) can show the same id in
  // both arrays — remove it from both so it goes back to being one pick.
  const handleRemove = (id, fromTeam) => {
    const inBoth = teamA.includes(id) && teamB.includes(id)
    if (inBoth) {
      setTeamA((prev) => prev.filter((x) => x !== id))
      setTeamB((prev) => prev.filter((x) => x !== id))
    } else if (fromTeam === 'A') {
      setTeamA((prev) => prev.filter((x) => x !== id))
    } else {
      setTeamB((prev) => prev.filter((x) => x !== id))
    }
    if (currentPicker === null) setCurrentPicker(fromTeam)
    showToast(`${playersById[id]?.name || 'Player'} returned to Available`)
  }

  const handleStart = async () => {
    let timedOut = false
    const guardTimer = setTimeout(() => {
      timedOut = true
      setStartingMatch(false)
      setConfirmStart(false)
      showToast('Start is taking too long. Please try again.', 'error')
    }, 6000)

    try {
      setStartingMatch(true)
      const matchId = await createMatch({
        date,
        venue,
        oversPerInnings: Number(oversPerInnings),
        maxOversPerBowler: Number(maxOversPerBowler) || null,
        playersPool: poolIds,
        scoringMode,
        teamA: { name: teamAName, captainId: captainAId, playerIds: teamA.filter(Boolean), umpireId: null },
        teamB: { name: teamBName, captainId: captainBId, playerIds: teamB.filter(Boolean), umpireId: null },
        toss: { wonBy: tossWonBy, decision: tossDecision },
      })

      if (timedOut) return

      if (!matchId) {
        showToast('Could not create match. Please try again.', 'error')
        return
      }

      const livePath = `/cricket/match/${matchId}/live`
      setConfirmStart(false)
      showToast(`Match created (${matchId.slice(0, 6)}). Opening live scoring...`)
      navigate(livePath)
    } catch (error) {
      if (timedOut) return
      console.error('createMatch failed', error)
      showToast(error?.message || 'Failed to start match. Please try again.', 'error')
    } finally {
      clearTimeout(guardTimer)
      setStartingMatch(false)
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
      <h1 className="text-lg font-semibold text-gray-900 mb-1">New Match</h1>
      <div className="flex gap-1 mb-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`flex-1 h-1 rounded ${step >= s ? 'bg-pitch' : 'bg-gray-200'}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          {lastMatch && (
            <button
              type="button"
              onClick={useLastMatchTeams}
              className="rounded-lg border border-pitch-border bg-pitch-light px-3 py-2.5 text-left"
            >
              <span className="text-sm font-medium text-pitch-dark">Use same teams as last match</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                {lastMatch.teamA?.name} vs {lastMatch.teamB?.name} ·{' '}
                {new Date(lastMatch.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </span>
            </button>
          )}
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Venue</label>
              <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Turf name" className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Overs per innings</label>
              <input type="number" value={oversPerInnings} onChange={(e) => setOversPerInnings(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Max overs / bowler</label>
              <input type="number" value={maxOversPerBowler} onChange={(e) => setMaxOversPerBowler(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">Who showed up? ({poolIds.length} selected, minimum 4)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
              {activePlayers.map((p) => {
                const selected = poolIds.includes(p.id)
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
            onClick={() => setStep(2)}
            disabled={poolIds.length < 4}
            className="bg-pitch text-white rounded-lg py-3 text-sm font-semibold disabled:bg-gray-300 disabled:text-gray-400"
          >
            Next: Pick Captains
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Team A name</label>
              <input value={teamAName} onChange={(e) => setTeamAName(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2" />
              <label className="text-xs text-gray-500">Captain A</label>
              <select value={captainAId} onChange={(e) => setCaptainAId(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Select</option>
                {poolIds.map((id) => (
                  <option key={id} value={id} disabled={id === captainBId}>
                    {playersById[id]?.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Team B name</label>
              <input value={teamBName} onChange={(e) => setTeamBName(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2" />
              <label className="text-xs text-gray-500">Captain B</label>
              <select value={captainBId} onChange={(e) => setCaptainBId(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Select</option>
                {poolIds.map((id) => (
                  <option key={id} value={id} disabled={id === captainAId}>
                    {playersById[id]?.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 rounded-lg py-3 text-sm font-medium text-gray-700">
              Back
            </button>
            <button onClick={startDraft} className="flex-1 bg-pitch text-white rounded-lg py-3 text-sm font-semibold">
              Start Draft
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-pitch-border bg-pitch-light px-3 py-2">
            <p className="text-xs text-gray-600">
              {teamsFromLastMatch ? (
                <>Teams loaded from last match.</>
              ) : (
                <>
                  Draft toss winner: <span className="font-semibold text-pitch">{draftStartsBy === 'A' ? teamAName : teamBName}</span>{' '}
                  {teamA.length + teamB.length >= poolIds.length ? '(picked first)' : '(picks first)'}
                </>
              )}
            </p>
          </div>
          <DraftBoard
            pool={poolIds}
            captainAId={captainAId}
            captainBId={captainBId}
            teamA={teamA}
            teamB={teamB}
            currentPicker={currentPicker}
            onPick={handlePick}
            onRemove={handleRemove}
            playersById={playersById}
          />

          {teamA.length > 0 && teamB.length > 0 && (
            <>
              {remainingAfterCaptains.length > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {remainingAfterCaptains.length} player{remainingAfterCaptains.length === 1 ? '' : 's'} still undrafted — they won't be in this match unless picked before starting.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Toss won by</label>
                  <select value={tossWonBy} onChange={(e) => setTossWonBy(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="A">{teamAName}</option>
                    <option value="B">{teamBName}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Decision</label>
                  <select value={tossDecision} onChange={(e) => setTossDecision(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="bat">Bat first</option>
                    <option value="bowl">Bowl first</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="flex-1 border border-gray-300 rounded-lg py-3 text-sm font-medium text-gray-700">
                  Back
                </button>
                <button
                  onClick={() => setConfirmStart(true)}
                  disabled={startingMatch}
                  className="flex-1 bg-pitch text-white rounded-lg py-3 text-sm font-semibold disabled:bg-gray-300 disabled:text-gray-500"
                >
                  {startingMatch ? 'Starting...' : 'Start Match'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmStart}
        title="Start this match?"
        message="This saves the teams and toss result and moves you to live scoring."
        confirmLabel={startingMatch ? 'Starting...' : 'Start'}
        onConfirm={handleStart}
        onCancel={() => !startingMatch && setConfirmStart(false)}
      />

      <Footer />
    </div>
  )
}
