// pages/LiveSession.jsx
import React, { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { usePlayers } from '../hooks/usePlayers'
import { groupBySlot, pendingSlots } from '../engine/scheduleEngine'
import {
  sessionLeaderboard,
  deciderCandidates,
  tiedAtTopCount,
  formatDiff,
  remainingMatchCounts,
} from '../engine/statsEngine'
import { useAdmin } from '../../shell/components/Admin'
import RoundCard from '../components/RoundCard'
import UpNextList from '../components/UpNextList'
import RecentResults from '../components/RecentResults'
import Leaderboard from '../components/Leaderboard'
import Footer from '../components/Footer'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../../shell/components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import RoundAdjustModal from '../components/RoundAdjustModal'
import DeciderCard from '../components/DeciderCard'
import AddPlayerModal from '../components/AddPlayerModal'

export default function LiveSession() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    session,
    loading,
    recordScore,
    undoLastScore,
    substitutePlayer,
    swapRounds,
    moveRound,
    addPlayerAndRedraw,
    addExtraRound,
    recordDecider,
    clearDecider,
    completeSession,
    deleteThisSession,
  } = useSession(id)
  const { players, addPlayer } = usePlayers()
  const { showToast } = useToast()
  const { isAdmin } = useAdmin()
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savingIndex, setSavingIndex] = useState(null)
  const [adjusting, setAdjusting] = useState(false)
  const [adjustBusy, setAdjustBusy] = useState(false)
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [playingDecider, setPlayingDecider] = useState(false)
  const [deciderBusy, setDeciderBusy] = useState(false)
  const [movingRound, setMovingRound] = useState(false)
  const [addingExtraRound, setAddingExtraRound] = useState(false)

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])

  const scores = session?.scores || {}
  const schedule = session?.schedule || []
  const winningScore = session?.winningScore === 11 ? 11 : 21

  // A "round" on screen is a time slot, which holds one match per court booked
  // for it. Single-court sessions (and every session created before second-court
  // support) give exactly one match per slot, so this reads as it always did.
  const slots = useMemo(() => groupBySlot(schedule), [schedule])
  const totalRounds = slots.length

  // The slot we're on is the first with any match still unscored - two courts
  // rarely finish together, so a slot stays current until both are in.
  const currentSlotIndex = useMemo(() => {
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].matches.some(({ index }) => !scores[index])) return i
    }
    return slots.length
  }, [slots, scores])

  const isFinished = currentSlotIndex >= totalRounds
  const roundsPlayed = Math.min(currentSlotIndex, totalRounds)
  const currentSlot = slots[currentSlotIndex]
  const isMultiCourt = useMemo(() => slots.some((s) => s.matches.length > 1), [slots])

  const lastScoredIndex = useMemo(() => {
    const scored = Object.keys(scores).map(Number).filter((i) => !Number.isNaN(i))
    return scored.length ? Math.max(...scored) : -1
  }, [scores])

  // Rounds already finished, newest first. Stops short of the round on court:
  // a two-court slot with one result in shows that result above as its own
  // card, and listing it here as well would read as two different games.
  const recentResults = useMemo(() => {
    const rows = []
    for (let i = 0; i < Math.min(currentSlotIndex, slots.length); i++) {
      for (const { index, match, court } of slots[i].matches) {
        if (!scores[index]) continue
        rows.push({ index, match, court, scored: scores[index], roundNumber: i + 1 })
      }
    }
    return rows.reverse()
  }, [slots, scores, currentSlotIndex])

  // Matches each player still has ahead of them, for the leaderboard's "left"
  // figure. Read off the schedule itself, so a substitution or a late addition
  // moves it the way the rounds actually moved.
  const matchesLeft = useMemo(() => remainingMatchCounts(session), [session])

  // Every round after this one. It feeds both the draggable "Up next" list and
  // the "play a later round now" swap: the whole remaining evening is listed,
  // not a five-round window, so the group can see who is sitting out late on
  // and drag a round the whole way up rather than one window at a time. All of
  // them are unscored by definition - currentSlotIndex is the first with any
  // match still open - so reordering them can't disturb a recorded result.
  const laterSlots = useMemo(() => slots.slice(currentSlotIndex + 1), [slots, currentSlotIndex])

  // Who can be called in from outside: any active player who isn't in the
  // session. Guests already substituted in stay on the list so they can be
  // given a second match.
  const outsideCandidates = useMemo(() => {
    const members = new Set(session?.playerIds || [])
    const guests = new Set(session?.guestIds || [])
    return players
      .filter((p) => p.isActive && !members.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, guest: guests.has(p.id) }))
  }, [players, session])

  // Rounds that can still be redrawn around a late arrival: everything from
  // the first round with no result in it yet.
  const pendingRoundCount = useMemo(() => {
    const pending = pendingSlots(schedule, scores)
    return pending ? pending.courtsBySlot.length : 0
  }, [schedule, scores])

  // Same tally the finished session and the PDF use, so a drop-in guest is
  // ranked (and marked) identically here and everywhere afterwards.
  const leaderboardRows = useMemo(
    () =>
      sessionLeaderboard(session).map((row) => ({
        ...row,
        name: playersById[row.playerId]?.name || row.playerId,
        // Won / lost / still to play, under the name. The points column says
        // who is ahead; this says how much of the evening that verdict rests
        // on, and who still has the rounds left to overturn it.
        record: `${row.wins}W ${row.losses}L - ${matchesLeft[row.playerId] || 0} left`,
        tag: row.guest ? `Guest ${row.matches}/${schedule.length}` : row.deciderWon ? 'Decider' : null,
        tagTitle: row.guest ? `Dropped in for ${row.matches} of this session's ${schedule.length} matches` : null,
      })),
    [session, playersById, schedule.length, matchesLeft],
  )

  // Two players level on match points at the end of the session. Left alone
  // the winner comes down to total rally points, which has been decided by a
  // single point before now - so the umpire is offered a singles decider.
  const tiedPair = useMemo(() => (isFinished ? deciderCandidates(session) : null), [isFinished, session])
  const tiedCount = useMemo(() => (isFinished ? tiedAtTopCount(session) : 0), [isFinished, session])
  // Whether a stored decider is actually in force. sessionLeaderboard ignores
  // one whose tie no longer stands, and the UI has to agree with it: otherwise
  // a stale record would both claim a result the table doesn't show and block
  // the prompt for the new tie.
  const deciderWinnerId = useMemo(() => leaderboardRows.find((r) => r.deciderWon)?.playerId || null, [leaderboardRows])
  const deciderPoints = session?.decider?.points || null

  const handleWin = async (matchIndex, team, points) => {
    if (savingIndex === matchIndex) return
    setSavingIndex(matchIndex)
    try {
      await recordScore(matchIndex, team, points)
    } catch {
      showToast('Saved locally — will sync when back online', 'info')
    } finally {
      // Only clear the flag if we're still tracking this same match - a
      // slow/offline write for an earlier match shouldn't leave the one
      // the umpire has since moved on to stuck looking disabled.
      setSavingIndex((i) => (i === matchIndex ? null : i))
    }
  }

  // Undoes the most recent result, whichever court it came from. On a
  // two-court round that means tapping twice to reopen the whole round.
  const handleUndo = async () => {
    if (lastScoredIndex < 0) return
    await undoLastScore(lastScoredIndex)
  }

  // A guest who isn't on the roster yet is created as a player first - their
  // matches have to hang off a real player record to reach the stats pages.
  const handleAddGuest = async (name) => {
    try {
      const created = await addPlayer({ name })
      return typeof created === 'string' ? created : created?.id || null
    } catch (err) {
      console.error('Failed to add guest player:', err)
      showToast('Could not add that player', 'error')
      return null
    }
  }

  const handleAddPlayer = async (playerId) => {
    setAdjustBusy(true)
    try {
      const res = await addPlayerAndRedraw(playerId, players)
      if (!res.ok) {
        const why = {
          'already-in': 'They are already in this session',
          'nothing-pending': 'No rounds left to redraw',
          'generate-failed': "Couldn't redraw the remaining rounds with that player added",
        }
        showToast(why[res.reason] || 'Could not add that player', 'error')
        return false
      }
      showToast(
        `${playersById[playerId]?.name || 'Player'} added — ${res.rounds} round${res.rounds === 1 ? '' : 's'} redrawn`,
      )
      return true
    } catch {
      showToast('Saved locally — will sync when back online', 'info')
      return true
    } finally {
      setAdjustBusy(false)
    }
  }

  const handleSubstitute = async (matchIndex, outId, inId) => {
    setAdjustBusy(true)
    try {
      const done = await substitutePlayer(matchIndex, outId, inId)
      if (!done) {
        showToast('That player is already on court this round', 'error')
        return false
      }
      const outName = playersById[outId]?.name || outId
      const inName = playersById[inId]?.name || inId
      showToast(`${inName} is in for ${outName} this round`)
      return true
    } catch {
      showToast('Saved locally — will sync when back online', 'info')
      return true
    } finally {
      setAdjustBusy(false)
    }
  }

  const handleSwapRounds = async (targetSlot) => {
    setAdjustBusy(true)
    try {
      await swapRounds(currentSlot.slot, targetSlot)
      showToast(`Round ${targetSlot + 1} moved up — the other one comes later`)
      return true
    } catch {
      showToast('Saved locally — will sync when back online', 'info')
      return true
    } finally {
      setAdjustBusy(false)
    }
  }

  // Drag-to-reorder from the "Up next" list. Every round in it is unscored -
  // it starts after the one on court - so there is no result to strand.
  // Locked while the write is in flight: the list is drawn from `session`, so
  // a second drag before the new order comes back would be computed against
  // the old one.
  const handleMoveRound = async (fromSlot, toSlot) => {
    if (movingRound) return
    setMovingRound(true)
    try {
      await moveRound(fromSlot, toSlot)
    } catch {
      showToast('Saved locally — will sync when back online', 'info')
    } finally {
      setMovingRound(false)
    }
  }

  const handleDeciderWin = async (winnerId, points) => {
    if (!tiedPair) return
    setDeciderBusy(true)
    try {
      // `points` arrives in [first, second] order, matching the pair below.
      await recordDecider(tiedPair.map((r) => r.playerId), winnerId, points)
      setPlayingDecider(false)
      showToast(`${playersById[winnerId]?.name || winnerId} wins the decider`)
    } catch {
      setPlayingDecider(false)
      showToast('Saved locally — will sync when back online', 'info')
    } finally {
      setDeciderBusy(false)
    }
  }

  const handleClearDecider = async () => {
    try {
      await clearDecider()
      showToast('Decider removed')
    } catch {
      showToast('Saved locally — will sync when back online', 'info')
    }
  }

  const handleAddExtraRound = async () => {
    setAddingExtraRound(true)
    try {
      const result = await addExtraRound(players)
      if (!result.ok) {
        showToast(result.reason === 'not-enough-players' ? 'Need at least 4 session players for another round' : 'Could not schedule another round', 'error')
        return
      }
      showToast(`${result.matches} extra match${result.matches === 1 ? '' : 'es'} scheduled`)
    } catch {
      showToast('Could not schedule another round', 'error')
    } finally {
      setAddingExtraRound(false)
    }
  }

  const handleComplete = async () => {
    setConfirmComplete(false)
    await completeSession()
    showToast('Session completed')
    navigate(`/shuttle/session/${id}`)
  }

  const handleDelete = async () => {
    setConfirmDelete(false)
    try {
      await deleteThisSession()
      showToast('Session deleted')
      navigate('/shuttle')
    } catch (err) {
      console.error('Failed to delete session:', err)
      showToast('Could not delete - check your connection and try again', 'error')
    }
  }

  if (loading || !session) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <ListSkeleton rows={4} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 pb-24 md:pb-8 md:grid md:grid-cols-[1fr_280px] md:gap-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Live Session</h1>
          {lastScoredIndex >= 0 && !isFinished && (
            <button onClick={handleUndo} className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200">
              Previous Round
            </button>
          )}
        </div>

        <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all"
            style={{ width: `${(roundsPlayed / Math.max(1, totalRounds)) * 100}%` }}
          />
        </div>

        {!isFinished ? (
          <div className="flex flex-col gap-3">
            {currentSlot.matches.map(({ index, match, court }) => {
              const scored = scores[index]
              if (scored) {
                // The other court is still playing. Keep this one visible as a
                // result so the umpire can see it landed (and undo a mis-tap).
                const winners = (scored.winner === 1 ? match.team1 : match.team2)
                  .map((pid) => playersById[pid]?.name || pid)
                  .join(' & ')
                return (
                  <div
                    key={index}
                    className="bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 rounded-xl px-4 py-3 flex items-center gap-3"
                  >
                    <span className="text-lg">✅</span>
                    <div className="flex-1 min-w-0">
                      {isMultiCourt && (
                        <p className="text-[11px] font-medium text-green-700 dark:text-green-400/80">Court {court}</p>
                      )}
                      <p className="text-sm font-medium text-green-800 dark:text-green-300 truncate">
                        {winners} won
                        {scored.points ? ` (${scored.points.team1}-${scored.points.team2})` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => undoLastScore(index)}
                      className="text-xs text-green-700 dark:text-green-400 underline shrink-0 hover:text-green-900 dark:hover:text-green-200"
                    >
                      Undo
                    </button>
                  </div>
                )
              }
              return (
                <RoundCard
                  key={index}
                  roundNumber={currentSlotIndex + 1}
                  totalRounds={totalRounds}
                  courtLabel={isMultiCourt ? `Court ${court}` : null}
                  team1Players={match.team1.map((pid) => ({ id: pid, name: playersById[pid]?.name || pid }))}
                  team2Players={match.team2.map((pid) => ({ id: pid, name: playersById[pid]?.name || pid }))}
                  restingPlayers={match.resting.map((pid) => ({ id: pid, name: playersById[pid]?.name || pid }))}
                  onWin={(team, points) => handleWin(index, team, points)}
                  disabled={savingIndex === index}
                  targetScore={winningScore}
                />
              )
            })}

            {/* Somebody stuck in traffic, or a drop-in wanting a game - both
                are fixed here rather than by regenerating the schedule. */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => setAdjusting(true)}
                className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200"
              >
                Player missing? Adjust this round
              </button>
              {pendingRoundCount > 0 && (
                <button
                  type="button"
                  onClick={() => setAddingPlayer(true)}
                  className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Someone joined? Add them in
                </button>
              )}
            </div>

            {laterSlots.length > 0 && (
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Up next{' '}
                    <span className="font-normal text-gray-400 dark:text-gray-500">
                      ({laterSlots.length} round{laterSlots.length === 1 ? '' : 's'} left)
                    </span>
                  </p>
                  {laterSlots.length > 1 && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">Drag to reorder</p>
                  )}
                </div>
                <UpNextList
                  rows={laterSlots}
                  startNumber={currentSlotIndex + 2}
                  isMultiCourt={isMultiCourt}
                  playersById={playersById}
                  onMove={handleMoveRound}
                  disabled={movingRound}
                />
              </div>
            )}

            <RecentResults rows={recentResults} isMultiCourt={isMultiCourt} playersById={playersById} />

            {roundsPlayed > 0 && (
              <button
                onClick={() => setConfirmComplete(true)}
                className="text-xs text-gray-400 dark:text-gray-500 underline text-center hover:text-gray-600 dark:hover:text-gray-300"
              >
                End session now ({roundsPlayed} of {totalRounds} rounds played)
              </button>
            )}

            {/* An in-progress session is otherwise a dead end: History only
                lists completed ones and the Dashboard links straight here, so
                without this there's no route to SessionDetail's Delete.
                Admin-only, same as every other delete - see shell/components/Admin.jsx. */}
            {isAdmin && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-red-400 dark:text-red-400/70 underline text-center hover:text-red-600 dark:hover:text-red-300"
              >
                Discard this session
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {playingDecider && tiedPair ? (
              <DeciderCard
                playerA={{ id: tiedPair[0].playerId, name: playersById[tiedPair[0].playerId]?.name || tiedPair[0].playerId }}
                playerB={{ id: tiedPair[1].playerId, name: playersById[tiedPair[1].playerId]?.name || tiedPair[1].playerId }}
                tiedOn={tiedPair[0].pts}
                onWin={handleDeciderWin}
                onCancel={() => setPlayingDecider(false)}
                disabled={deciderBusy}
                targetScore={winningScore}
              />
            ) : (
              <div className="bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 rounded-xl p-5 text-center">
                <p className="text-2xl mb-1">🏁</p>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">All rounds complete!</p>
              </div>
            )}

            {/* The tie prompt, and the result once it's been played. Offered,
                never forced - settling on rally points stays a valid finish. */}
            {tiedPair && !playingDecider && !deciderWinnerId && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
                  {tiedCount > 2 ? `${tiedCount}-way tie at the top` : 'Tie at the top'}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300/80 mb-3">
                  {playersById[tiedPair[0].playerId]?.name} and {playersById[tiedPair[1].playerId]?.name} both
                  finished on {tiedPair[0].pts} points.{' '}
                  {tiedCount > 2 && 'They lead the tie on points scored. '}
                  Play a singles decider, or leave it to be settled on point difference (
                  {formatDiff(tiedPair[0].diff)} vs {formatDiff(tiedPair[1].diff)}).
                </p>
                <button
                  onClick={() => setPlayingDecider(true)}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  Play singles decider
                </button>
              </div>
            )}

            {deciderWinnerId && !playingDecider && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-lg">🎾</span>
                <p className="text-sm text-amber-900 dark:text-amber-200 flex-1 min-w-0">
                  <span className="font-medium">{playersById[deciderWinnerId]?.name}</span> won the decider
                  {deciderPoints ? ` ${Math.max(...deciderPoints)}–${Math.min(...deciderPoints)}` : ''}
                </p>
                <button
                  onClick={handleClearDecider}
                  className="text-xs text-amber-700 dark:text-amber-400 underline shrink-0 hover:text-amber-900 dark:hover:text-amber-200"
                >
                  Undo
                </button>
              </div>
            )}
            <RecentResults rows={recentResults} isMultiCourt={isMultiCourt} playersById={playersById} />

            <button
              onClick={handleAddExtraRound}
              disabled={addingExtraRound}
              className="border border-gray-300 dark:border-gray-700 rounded-lg py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              {addingExtraRound ? 'Scheduling round...' : 'Schedule another round'}
            </button>
            <button
              onClick={handleUndo}
              className="border border-gray-300 dark:border-gray-700 rounded-lg py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Previous Round
            </button>
            <button
              onClick={() => setConfirmComplete(true)}
              className="bg-brand hover:bg-brand-dark text-white rounded-lg py-3 text-sm font-semibold transition-all active:scale-[0.98]"
            >
              Complete Session
            </button>
            {isAdmin && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-red-400 dark:text-red-400/70 underline text-center hover:text-red-600 dark:hover:text-red-300"
              >
                Discard this session
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 md:mt-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Live leaderboard</p>
        <Leaderboard
          rows={leaderboardRows}
          renderValue={(r) => (
            <>
              {r.pts} pts{' '}
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500">({formatDiff(r.diff)})</span>
            </>
          )}
        />
      </div>

      <AddPlayerModal
        open={addingPlayer}
        onClose={() => setAddingPlayer(false)}
        candidates={outsideCandidates}
        pendingRounds={pendingRoundCount}
        onAdd={handleAddPlayer}
        onCreatePlayer={handleAddGuest}
        busy={adjustBusy}
      />

      <RoundAdjustModal
        open={adjusting && !isFinished}
        onClose={() => setAdjusting(false)}
        roundNumber={currentSlotIndex + 1}
        totalRounds={totalRounds}
        slot={currentSlot}
        multiCourt={isMultiCourt}
        playersById={playersById}
        laterSlots={laterSlots}
        outsideCandidates={outsideCandidates}
        onSubstitute={handleSubstitute}
        onSwapRounds={handleSwapRounds}
        onAddGuest={handleAddGuest}
        busy={adjustBusy}
      />

      <ConfirmDialog
        open={confirmComplete}
        title={isFinished ? 'Complete this session?' : 'End session early?'}
        message={
          isFinished
            ? 'This finalizes the scores and updates player stats.'
            : `${roundsPlayed} of ${totalRounds} rounds have been played. Stats will be saved for those rounds — the remaining ${
                totalRounds - roundsPlayed
              } will be dropped. This can't be undone.`
        }
        confirmLabel={isFinished ? 'Complete' : 'End Session'}
        onConfirm={handleComplete}
        onCancel={() => setConfirmComplete(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Discard this session?"
        message={
          roundsPlayed > 0
            ? `This permanently deletes the session along with the ${roundsPlayed} round${
                roundsPlayed > 1 ? 's' : ''
              } already scored. Nothing is kept and player stats won't count any of it. This can't be undone.`
            : "This permanently deletes the session and its schedule. Nothing is kept. This can't be undone."
        }
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <Footer />
    </div>
  )
}
