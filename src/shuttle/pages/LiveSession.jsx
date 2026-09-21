// pages/LiveSession.jsx
import React, { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { usePlayers } from '../hooks/usePlayers'
import {
  groupBySlot,
  orderedMatches,
  pendingSlots,
  isTwoVsOneMatch,
  matchFormatLabel,
  resolveOnCourt,
  startedMatches,
  queuedSlots,
  playedCourt,
} from '../engine/scheduleEngine'
import {
  sessionLeaderboard,
  deciderCandidates,
  tiedAtTopCount,
  formatDiff,
  remainingMatchCounts,
} from '../engine/statsEngine'
import { useAdmin } from '../../shell/components/Admin'
import RoundCard from '../components/RoundCard'
import Avatar from '../components/Avatar'
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
    swapPlayers,
    playOnCourt,
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
  // 2 vs 1 handicap: the one-player side of a 2 vs 1 wins on reaching this.
  // Sessions without the setting play every match to the normal score.
  const soloTarget = session?.soloTarget > 0 && session.soloTarget < winningScore ? session.soloTarget : winningScore
  const sideTarget = (match, team) =>
    isTwoVsOneMatch(match) && match[team].length === 1 ? soloTarget : winningScore

  // The schedule is planned in time slots ("rounds"), one match per court
  // booked for the slot. Play doesn't wait for a whole round, though: each
  // court runs as a queue and takes the next match its players are free for
  // as soon as it is done (see resolveOnCourt).
  const slots = useMemo(() => groupBySlot(schedule), [schedule])
  const totalRounds = slots.length
  const roundOf = useMemo(() => {
    const bySlot = new Map(slots.map((s, i) => [s.slot, i + 1]))
    return (index) => bySlot.get(schedule[index]?.slot ?? index)
  }, [slots, schedule])

  const onCourt = useMemo(
    () => resolveOnCourt(schedule, scores, session?.onCourt || {}),
    [schedule, scores, session?.onCourt],
  )
  const courts = useMemo(() => Object.keys(onCourt).map(Number).sort((a, b) => a - b), [onCourt])
  const isMultiCourt = courts.length > 1
  const liveIndices = useMemo(() => courts.map((c) => onCourt[c]).filter(Number.isInteger), [courts, onCourt])
  const busyIds = useMemo(
    () => new Set(liveIndices.flatMap((i) => [...schedule[i].team1, ...schedule[i].team2])),
    [liveIndices, schedule],
  )

  const totalMatches = schedule.length
  const matchesPlayed = useMemo(() => schedule.filter((_, i) => scores[i]).length, [schedule, scores])
  const isFinished = matchesPlayed >= totalMatches

  // The most recent result, whichever court it came from. Courts no longer
  // finish in schedule order, so it's read off when the result was entered;
  // older entries without a time fall back to the highest index.
  const lastScoredIndex = useMemo(() => {
    let best = -1
    let bestAt = -1
    Object.keys(scores).forEach((key) => {
      const i = Number(key)
      if (Number.isNaN(i) || !scores[key]) return
      const at = scores[key].at || 0
      if (at > bestAt || (at === bestAt && i > best)) {
        best = i
        bestAt = at
      }
    })
    return best
  }, [scores])

  // Every result so far, newest first.
  const recentResults = useMemo(() => {
    const position = new Map(orderedMatches(schedule).map(({ index }, i) => [index, i]))
    return schedule
      .map((match, index) => ({ index, match, scored: scores[index] }))
      .filter((row) => row.scored)
      .sort((a, b) => (b.scored.at || 0) - (a.scored.at || 0) || position.get(b.index) - position.get(a.index))
      .map((row) => ({
        ...row,
        court: playedCourt(schedule, row.index, row.scored),
        roundNumber: roundOf(row.index),
      }))
  }, [schedule, scores, roundOf])

  // Rounds still to come, cut down to the matches not yet played or on court.
  // Dragging one reorders the queue the free courts draw from.
  const laterSlots = useMemo(() => queuedSlots(schedule, scores, onCourt), [schedule, scores, onCourt])
  const laterMatches = useMemo(
    () => laterSlots.flatMap(({ matches, roundNumber }) => matches.map((m) => ({ ...m, roundNumber }))),
    [laterSlots],
  )
  // The match a free court is holding out for, and who it's waiting on.
  const nextQueued = laterMatches[0] || null
  const waitingOn = useMemo(
    () => (nextQueued ? [...nextQueued.match.team1, ...nextQueued.match.team2].filter((id) => busyIds.has(id)) : []),
    [nextQueued, busyIds],
  )

  // Who is off court right now - members only; a guest is only here for the
  // match they were brought in for.
  const benchIds = useMemo(
    () => (session?.playerIds || []).filter((id) => !busyIds.has(id)),
    [session?.playerIds, busyIds],
  )
  const liveSlot = useMemo(
    () => ({
      matches: courts
        .filter((c) => Number.isInteger(onCourt[c]))
        .map((c) => ({ index: onCourt[c], match: schedule[onCourt[c]], court: c })),
    }),
    [courts, onCourt, schedule],
  )

  // Matches each player still has ahead of them, for the leaderboard's "left"
  // figure. Read off the schedule itself, so a substitution or a late addition
  // moves it the way the rounds actually moved.
  const matchesLeft = useMemo(() => remainingMatchCounts(session), [session])

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

  // Rounds that can still be redrawn around a late arrival: every round with
  // nothing in it played or started.
  const pendingRoundCount = useMemo(() => {
    const pending = pendingSlots(schedule, scores, startedMatches(schedule, scores, session?.onCourt))
    return pending ? pending.courtsBySlot.length : 0
  }, [schedule, scores, session?.onCourt])

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

  // Undoes the most recent result, whichever court it came from, and puts
  // that match back on its court.
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
        showToast('That player is already on court', 'error')
        return false
      }
      const outName = playersById[outId]?.name || outId
      const inName = playersById[inId]?.name || inId
      showToast(`${inName} is in for ${outName} this match`)
      return true
    } catch {
      showToast('Saved locally — will sync when back online', 'info')
      return true
    } finally {
      setAdjustBusy(false)
    }
  }

  const handleSwapPlayers = async (matchIndex, idA, idB) => {
    setAdjustBusy(true)
    try {
      const done = await swapPlayers(matchIndex, idA, idB)
      if (!done) {
        showToast('Those two are already on the same team', 'error')
        return false
      }
      showToast(`${playersById[idA]?.name || idA} and ${playersById[idB]?.name || idB} switched sides`)
      return true
    } catch {
      showToast('Saved locally — will sync when back online', 'info')
      return true
    } finally {
      setAdjustBusy(false)
    }
  }

  // Put a different match on a court: the one due there is short a player, or
  // the court has played its booked matches and the group wants to carry on.
  const handlePlayOnCourt = async (court, matchIndex) => {
    setAdjustBusy(true)
    try {
      const done = await playOnCourt(court, matchIndex)
      if (!done) {
        showToast('Someone in that match is already on court', 'error')
        return false
      }
      showToast(
        isMultiCourt
          ? `Court ${court} is playing the round ${roundOf(matchIndex)} match now`
          : `Round ${roundOf(matchIndex)} moved up — the other match comes later`,
      )
      return true
    } catch {
      showToast('Saved locally — will sync when back online', 'info')
      return true
    } finally {
      setAdjustBusy(false)
    }
  }

  // Drag-to-reorder from the "Up next" list. Results and on-court matches are
  // keyed by index, so moving a round can't strand either.
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
    <div className={`${isMultiCourt ? 'max-w-5xl 2xl:max-w-7xl' : 'max-w-5xl'} mx-auto p-4 pb-24 md:pb-8 md:grid md:grid-cols-[1fr_280px] md:gap-6`}>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Live Session</h1>
          {lastScoredIndex >= 0 && !isFinished && (
            <button onClick={handleUndo} className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200">
              Undo last result
            </button>
          )}
        </div>

        <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all"
            style={{ width: `${(matchesPlayed / Math.max(1, totalMatches)) * 100}%` }}
          />
        </div>

        {!isFinished ? (
          <div className="flex flex-col gap-3">
            {/* Side by side once there is room for two score pads; stacked on a
                phone. The bench is shared, so it's listed once under both. */}
            <div className={isMultiCourt ? 'grid gap-4 2xl:grid-cols-2 items-start' : 'flex flex-col gap-3'}>
              {courts.map((court) => {
                const index = onCourt[court]
                if (!Number.isInteger(index)) {
                  // Nothing left for this court, or nothing it may start yet.
                  if (!nextQueued) return null
                  const blocked = waitingOn.length > 0
                  return (
                    <div
                      key={`court-${court}`}
                      className="bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3"
                    >
                      <p className="text-base font-semibold text-gray-700 dark:text-gray-300">Court {court} is free</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {blocked
                          ? `Next match waits for ${waitingOn.map((id) => playersById[id]?.name || id).join(' & ')} to finish`
                          : 'Its booked matches are done'}
                      </p>
                      {!blocked && (
                        <button
                          type="button"
                          disabled={adjustBusy}
                          onClick={() => handlePlayOnCourt(court, nextQueued.index)}
                          className="text-xs text-brand dark:text-emerald-400 underline mt-1 disabled:opacity-50"
                        >
                          Play the next match here anyway
                        </button>
                      )}
                    </div>
                  )
                }
                const match = schedule[index]
                const round = roundOf(index)
                // Pulled forward past a match from an earlier round that is
                // still waiting on someone - worth saying, or the round
                // numbers on the two courts look like a mistake.
                const early = laterMatches.some((m) => m.roundNumber < round)
                return (
                  <RoundCard
                    key={index}
                    court={isMultiCourt ? court : null}
                    note={isMultiCourt && early ? 'Started early' : null}
                    roundNumber={round}
                    totalRounds={totalRounds}
                    courtLabel={matchFormatLabel(match)}
                    team1Players={match.team1.map((pid) => ({ id: pid, name: playersById[pid]?.name || pid }))}
                    team2Players={match.team2.map((pid) => ({ id: pid, name: playersById[pid]?.name || pid }))}
                    restingPlayers={
                      isMultiCourt ? [] : benchIds.map((pid) => ({ id: pid, name: playersById[pid]?.name || pid }))
                    }
                    onWin={(team, points) => handleWin(index, team, points)}
                    disabled={savingIndex === index}
                    targetScore={winningScore}
                    team1Target={sideTarget(match, 'team1')}
                    team2Target={sideTarget(match, 'team2')}
                  />
                )
              })}
            </div>

            {isMultiCourt && benchIds.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">Resting</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {benchIds.map((pid) => (
                    <span key={pid} className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <Avatar id={pid} name={playersById[pid]?.name || pid} size="xs" />
                      {playersById[pid]?.name || pid}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Somebody stuck in traffic, or a drop-in wanting a game - both
                are fixed here rather than by regenerating the schedule. */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => setAdjusting(true)}
                className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200"
              >
                Player missing or switching sides? Adjust {isMultiCourt ? 'these matches' : 'this match'}
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
                      ({laterMatches.length} match{laterMatches.length === 1 ? '' : 'es'} left)
                    </span>
                  </p>
                  {laterSlots.length > 1 && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">Drag to reorder</p>
                  )}
                </div>
                {isMultiCourt && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-1 mb-2">
                    A free court takes the first match whose players are all off court.
                  </p>
                )}
                <UpNextList
                  rows={laterSlots}
                  isMultiCourt={isMultiCourt}
                  playersById={playersById}
                  onMove={handleMoveRound}
                  disabled={movingRound}
                />
              </div>
            )}

            <RecentResults rows={recentResults} isMultiCourt={isMultiCourt} playersById={playersById} />

            {matchesPlayed > 0 && (
              <button
                onClick={() => setConfirmComplete(true)}
                className="text-xs text-gray-400 dark:text-gray-500 underline text-center hover:text-gray-600 dark:hover:text-gray-300"
              >
                End session now ({matchesPlayed} of {totalMatches} matches played)
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
              Undo last result
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
        slot={liveSlot.matches.length ? liveSlot : null}
        multiCourt={isMultiCourt}
        playersById={playersById}
        benchIds={benchIds}
        laterMatches={laterMatches}
        outsideCandidates={outsideCandidates}
        onSubstitute={handleSubstitute}
        onSwapPlayers={handleSwapPlayers}
        onPlayInstead={handlePlayOnCourt}
        onAddGuest={handleAddGuest}
        busy={adjustBusy}
      />

      <ConfirmDialog
        open={confirmComplete}
        title={isFinished ? 'Complete this session?' : 'End session early?'}
        message={
          isFinished
            ? 'This finalizes the scores and updates player stats.'
            : `${matchesPlayed} of ${totalMatches} matches have been played. Stats will be saved for those matches — the remaining ${
                totalMatches - matchesPlayed
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
          matchesPlayed > 0
            ? `This permanently deletes the session along with the ${matchesPlayed} match${
                matchesPlayed > 1 ? 'es' : ''
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
