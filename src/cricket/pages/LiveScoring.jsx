import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useMatch, deleteMatchById } from '../hooks/useMatch'
import { usePlayers } from '../hooks/usePlayers'
import {
  deriveInningsState,
  legalBallCountFromOvers,
  suggestNextContext,
  computeMatchResult,
  isInningsComplete,
  squadSizeOf,
  OPPONENT_ID,
} from '../engine/scoringEngine'
import { suggestMOTM } from '../engine/mvpEngine'
import { formatOversDisplay } from '../utils'
import ScoreInputPad from '../components/ScoreInputPad'
import Footer from '../components/Footer'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../../shell/components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAdmin } from '../components/Admin'
import { useMatchVariant, sixIsOut as matchSixIsOut } from '../context/MatchVariant'

const WICKET_TYPES = ['bowled', 'caught', 'lbw', 'runout', 'stumped', 'other']
// Box Cricket's "a six is out" adds one more way to get out. It's only
// offered on matches that were created with the rule on — see
// context/MatchVariant.jsx — so a full-cricket scorer never sees it.
const SIX_OUT_TYPE = 'sixout'
const WICKET_TYPE_LABELS = { sixout: 'six out (hit out of the box)' }

export default function LiveScoring() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { match, loading, updateMatch, startInnings1, startInnings2, addBall, undoLastBall, addOverSummary, undoLastOver, addRetirement, completeMatch } = useMatch(id)
  const { players, addPlayer } = usePlayers()
  const { showToast } = useToast()
  const { isAdmin } = useAdmin()
  const variant = useMatchVariant()
  const { basePath } = variant

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])

  const [openerStriker, setOpenerStriker] = useState('')
  const [openerNonStriker, setOpenerNonStriker] = useState('')
  const [openingBowler, setOpeningBowler] = useState('')
  const [pendingBatsman, setPendingBatsman] = useState('')
  const [pendingBowler, setPendingBowler] = useState('')
  const [wicketModalOpen, setWicketModalOpen] = useState(false)
  const [wicketType, setWicketType] = useState('bowled')
  const [wicketOutId, setWicketOutId] = useState('')
  const [wicketFielderId, setWicketFielderId] = useState('')
  // Set when the wicket modal was opened from the Wide/No ball + "also a
  // wicket" combo (item 3) — carries the extra-ball context (wide/no-ball,
  // plus its extra run) through into the wicket ball that gets logged.
  const [wicketExtra, setWicketExtra] = useState(null) // { extraType, extraRuns } | null
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [motmId, setMotmId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [forceEnd, setForceEnd] = useState(false)
  const [confirmForceEnd, setConfirmForceEnd] = useState(false)
  const [confirmDeleteMatch, setConfirmDeleteMatch] = useState(false)
  const [retireModalOpen, setRetireModalOpen] = useState(false)
  const [retireOutId, setRetireOutId] = useState('')
  const [needsQuickReplacement, setNeedsQuickReplacement] = useState(false)
  const [quickReplacementId, setQuickReplacementId] = useState('')
  const [addPlayerModalOpen, setAddPlayerModalOpen] = useState(false)
  const [addPlayerMode, setAddPlayerMode] = useState('existing')
  const [addPlayerSelectedId, setAddPlayerSelectedId] = useState('')
  const [addPlayerGuestName, setAddPlayerGuestName] = useState('')
  const [addPlayerTeam, setAddPlayerTeam] = useState('A')
  const [movePlayerModalOpen, setMovePlayerModalOpen] = useState(false)
  const [movePlayerSelectedId, setMovePlayerSelectedId] = useState('')

  // Quick mode form state
  const [qBowler, setQBowler] = useState('')
  const [qRuns, setQRuns] = useState('')
  const [qWickets, setQWickets] = useState('0')
  const [qBatsmen, setQBatsmen] = useState([])
  const [manualNewBatsman, setManualNewBatsman] = useState(null)
  const [manualNewBowler, setManualNewBowler] = useState(null)

  // "Change" picker (item 3) — ad-hoc striker/non-striker/bowler correction,
  // available any time (not just the forced new-batsman/new-over flows).
  // Overrides win over the derived context until the next ball is logged,
  // at which point the ball log itself carries the correction forward and
  // the override is cleared (same lifecycle as manualNewBatsman/Bowler).
  const [changeModalOpen, setChangeModalOpen] = useState(false)
  const [changeStriker, setChangeStriker] = useState('')
  const [changeNonStriker, setChangeNonStriker] = useState('')
  const [changeBowler, setChangeBowler] = useState('')
  const [overrideStriker, setOverrideStriker] = useState(null)
  const [overrideNonStriker, setOverrideNonStriker] = useState(null)
  const [overrideBowler, setOverrideBowler] = useState(null)

  // Run-out strike choice (item 6) — which of the incoming/surviving
  // batsman takes strike for the next ball, since (unlike other dismissals)
  // it depends on runs completed before the throw, which only the scorer
  // knows.
  const [runoutStrikerChoice, setRunoutStrikerChoice] = useState(null)

  const clearManualOverrides = () => {
    setManualNewBatsman(null)
    setManualNewBowler(null)
    setOverrideStriker(null)
    setOverrideNonStriker(null)
    setOverrideBowler(null)
    setRunoutStrikerChoice(null)
  }

  useEffect(() => {
    if (match?.status === 'completed') navigate(`${basePath}/match/${id}`, { replace: true })
  }, [match?.status, id, navigate, basePath])

  if (loading || !match || match.status === 'completed') {
    return (
      <div className="p-4 max-w-md mx-auto">
        <ListSkeleton rows={4} />
      </div>
    )
  }

  const teamOf = (key) => (key === 'A' ? match.teamA : match.teamB)
  const inningsBattingTeam = (innings) => teamOf(innings.battingTeam)
  const inningsBowlingTeam = (innings) => teamOf(innings.battingTeam === 'A' ? 'B' : 'A')

  // TOURNAMENT MATCHES — one side is an external opponent with no roster, so
  // whichever innings they're batting in has no batsmen to pick from, and
  // whichever innings they're bowling in has no bowlers to pick from. Every
  // picker below is driven off these two flags; everything else (the score
  // pad, the ball log, undo, wickets, the phase machine) is the existing
  // code path unchanged. Ball entries use OPPONENT_ID for the un-tracked
  // side — see scoringEngine.js.
  const isExternal = (team) => Boolean(team?.isExternal)
  const isTournamentMatch = Boolean(match.isTournament)

  // Read off the MATCH, not the variant: the rule was chosen when the match
  // was created, so a match played under one setting keeps scoring that way
  // even if the default later changes.
  const sixOutRule = matchSixIsOut(match)
  const wicketTypeOptions = sixOutRule ? [...WICKET_TYPES, SIX_OUT_TYPE] : WICKET_TYPES

  const firstBattingTeam = match.toss.decision === 'bat' ? match.toss.wonBy : match.toss.wonBy === 'A' ? 'B' : 'A'

  // --- Determine current phase --------------------------------------------
  let phase = 'setup-innings1'
  let activeInningsKey = 'innings1'
  if (match.innings1) {
    const squadSize1 = squadSizeOf(inningsBattingTeam(match.innings1))
    const done1 = isInningsComplete(match.innings1, match.oversPerInnings, squadSize1)
    if (!done1) {
      phase = 'scoring'
      activeInningsKey = 'innings1'
    } else if (!match.innings2) {
      phase = 'start-innings2'
    } else if (match.innings2.scoringMode === 'full' && !match.innings2.openers) {
      phase = 'setup-innings2'
    } else {
      const squadSize2 = squadSizeOf(inningsBattingTeam(match.innings2))
      const d2 = deriveInningsState(match.innings2)
      const d1 = deriveInningsState(match.innings1)
      const targetReached = d2.totalRuns > d1.totalRuns
      const done2 = isInningsComplete(match.innings2, match.oversPerInnings, squadSize2) || targetReached
      if (!done2) {
        phase = 'scoring'
        activeInningsKey = 'innings2'
      } else {
        phase = 'complete-match'
      }
    }
  }
  if (forceEnd && phase !== 'setup-innings1') phase = 'complete-match'

  const innings = match[activeInningsKey]
  const derived = innings ? deriveInningsState(innings) : null
  const battingTeam = innings ? inningsBattingTeam(innings) : null
  const bowlingTeam = innings ? inningsBowlingTeam(innings) : null
  // "They're batting" / "they're bowling" for the innings on screen.
  const battingIsExternal = isExternal(battingTeam)
  const bowlingIsExternal = isExternal(bowlingTeam)

  // Include the opening bowler alongside the openers so suggestNextContext's
  // zero-balls base case has it too — matters when the very first ball-log
  // entry is a retirement, which recurses back down to that base case.
  const openersWithBowler = innings?.openers ? { ...innings.openers, bowlerId: innings.openingBowlerId } : innings?.openers

  const rawContext =
    innings?.scoringMode === 'full'
      ? innings.balls.length
        ? suggestNextContext(innings.balls, openersWithBowler)
        : { strikerId: innings.openers?.strikerId, nonStrikerId: innings.openers?.nonStrikerId, bowlerId: innings.openingBowlerId }
      : null

  // Merge in manual picks (new batsman after a wicket, new bowler after an
  // over) — these reset automatically once the ball log changes, since
  // rawContext is recomputed fresh from it.
  const mergedContext = rawContext
    ? {
        ...rawContext,
        strikerId: manualNewBatsman || overrideStriker || rawContext.strikerId,
        nonStrikerId: overrideNonStriker || rawContext.nonStrikerId,
        // A wicket on the over's last ball can leave the non-striker end
        // vacant instead of the striker end (see suggestNextContext) — that
        // case is resolved via overrideNonStriker alone (no manualNewBatsman
        // or overrideStriker involved), so it must clear this flag too.
        needsNewBatsman: rawContext.needsNewBatsman && !manualNewBatsman && !overrideStriker && !overrideNonStriker,
        bowlerId: manualNewBowler || overrideBowler || rawContext.bowlerId,
        needsNewOver: rawContext.needsNewOver && !manualNewBowler && !overrideBowler,
      }
    : null

  // Pin the un-tracked side to the sentinel and clear the prompt that would
  // ask us to pick from a roster we don't have. suggestNextContext's own
  // strike-rotation and end-swap maths still runs above — it just shuffles
  // 'opponent' around with itself, which is a no-op — so `needsNewOver`
  // (when we're bowling) stays correct and is left alone.
  const context = mergedContext
    ? {
        ...mergedContext,
        ...(battingIsExternal ? { strikerId: OPPONENT_ID, nonStrikerId: OPPONENT_ID, needsNewBatsman: false } : {}),
        ...(bowlingIsExternal ? { bowlerId: OPPONENT_ID, needsNewOver: false } : {}),
      }
    : null

  // --- Handlers --------------------------------------------------------------
  // Opening setup for one innings, skipping whichever picker has no roster
  // behind it in a tournament match. Returns null (having toasted) if a
  // picker that WAS shown hasn't been answered.
  const buildOpeningContext = (battingTeamKey) => {
    const batExternal = isExternal(teamOf(battingTeamKey))
    const bowlExternal = isExternal(teamOf(battingTeamKey === 'A' ? 'B' : 'A'))
    if (!batExternal && (!openerStriker || !openerNonStriker || openerStriker === openerNonStriker)) {
      showToast('Pick two different openers', 'error')
      return null
    }
    if (!bowlExternal && !openingBowler) {
      showToast('Pick an opening bowler', 'error')
      return null
    }
    return {
      openers: batExternal ? { strikerId: OPPONENT_ID, nonStrikerId: OPPONENT_ID } : { strikerId: openerStriker, nonStrikerId: openerNonStriker },
      openingBowlerId: bowlExternal ? OPPONENT_ID : openingBowler,
    }
  }

  const handleSetupInnings1 = async () => {
    const opening = buildOpeningContext(firstBattingTeam)
    if (!opening) return
    await startInnings1({
      battingTeam: firstBattingTeam,
      scoringMode: match.scoringMode,
      ...opening,
    })
  }

  const buildBallBase = () => {
    const legalSoFar = legalBallCountFromOvers(derived.oversBowled)
    return { over: Math.floor(legalSoFar / 6), ballInOver: (legalSoFar % 6) + 1 }
  }

  // Guards against double-submits (fast taps firing a second write before the
  // first one's state update lands) while never leaving the UI stuck: if the
  // storage backend is ever slow (e.g. a real Firestore project instead of
  // the local dev store), a timeout always releases the lock and surfaces
  // what happened instead of leaving buttons disabled forever.
  const runGuarded = async (fn) => {
    if (submitting) return
    setSubmitting(true)
    let timedOut = false
    const guardTimer = setTimeout(() => {
      timedOut = true
      setSubmitting(false)
      showToast('That took too long to save — check your connection. It may still go through; verify before retrying.', 'error')
    }, 6000)
    try {
      await fn()
    } catch (error) {
      console.error('Scoring action failed', error)
      if (!timedOut) showToast(error?.message || 'Failed to save. Please try again.', 'error')
    } finally {
      clearTimeout(guardTimer)
      if (!timedOut) setSubmitting(false)
    }
  }

  const handleRun = (runs) => {
    if (context.needsNewBatsman || context.needsNewOver) return
    runGuarded(async () => {
      const ball = {
        ...buildBallBase(),
        batsmanId: context.strikerId,
        nonStrikerId: context.nonStrikerId,
        bowlerId: context.bowlerId,
        runs,
        extraType: null,
        extraRuns: 0,
        isWicket: false,
      }
      await addBall(activeInningsKey, ball)
      clearManualOverrides()
    })
  }

  // `extra` is set when opened from the Wide/No ball "also a wicket" combo
  // in ScoreInputPad — a batsman can still be run out or stumped off a wide
  // or no ball, even though it isn't a normal wicket-taking delivery.
  // `presetType` is set by Box Cricket's six-out button, which already knows
  // how the batsman got out; the modal still opens so the scorer can correct
  // which batsman it was (a six can only come off the striker, but the
  // "Change" flow means the striker on screen isn't always right).
  const openWicketModal = (extra = null, presetType = null) => {
    setWicketOutId(context.strikerId)
    setWicketFielderId('')
    setWicketType(presetType || (extra ? 'runout' : 'bowled'))
    setWicketExtra(extra)
    setWicketModalOpen(true)
  }

  // BOX CRICKET — clearing the cage is a dismissal, not six runs. Logged as
  // an ordinary wicket ball with runs: 0, so every existing code path (team
  // total, over count, bowler figures, undo) handles it with no special
  // casing — see scoringEngine.js.
  const handleSixOut = () => {
    if (context.needsNewBatsman || context.needsNewOver) return
    openWicketModal(null, SIX_OUT_TYPE)
  }

  const submitWicket = () =>
    runGuarded(async () => {
      const ball = {
        ...buildBallBase(),
        batsmanId: context.strikerId,
        nonStrikerId: context.nonStrikerId,
        bowlerId: context.bowlerId,
        runs: 0,
        extraType: wicketExtra?.extraType || null,
        extraRuns: wicketExtra?.extraRuns || 0,
        isWicket: true,
        wicketType,
        outBatsmanId: wicketOutId,
        fielderId: ['caught', 'runout', 'stumped'].includes(wicketType) ? wicketFielderId || null : null,
      }
      await addBall(activeInningsKey, ball)
      setWicketModalOpen(false)
      setWicketExtra(null)
      clearManualOverrides()
    })

  // Wide/no ball log immediately (no modal) — the whole point is these are
  // the common case and should be a single tap. extraRuns comes from the
  // ScoreInputPad's inline +/- stepper for the rarer "they ran on it" case.
  const submitExtraBall = (extraType, runs) =>
    runGuarded(async () => {
      const ball = {
        ...buildBallBase(),
        batsmanId: context.strikerId,
        nonStrikerId: context.nonStrikerId,
        bowlerId: context.bowlerId,
        runs: 0,
        extraType,
        extraRuns: Number(runs) || 1,
        isWicket: false,
      }
      await addBall(activeInningsKey, ball)
      clearManualOverrides()
    })

  const handleWide = (runs) => submitExtraBall('wide', runs)
  const handleNoBall = (runs) => submitExtraBall('noball', runs)
  const handleWideWicket = (runs) => openWicketModal({ extraType: 'wide', extraRuns: Number(runs) || 1 })
  const handleNoBallWicket = (runs) => openWicketModal({ extraType: 'noball', extraRuns: Number(runs) || 1 })

  // Ad-hoc striker/non-striker/bowler correction (item 3) — available any
  // time in Full Mode, not just via the forced new-batsman/new-over flows.
  // Before the first ball of the innings, there's nothing in the ball log
  // yet for a future context computation to pick up, so we persist directly
  // to openers/openingBowlerId; otherwise we set a transient override that
  // the next logged ball bakes in (see clearManualOverrides).
  const openChangeModal = () => {
    setChangeStriker(context.strikerId || '')
    setChangeNonStriker(context.nonStrikerId || '')
    setChangeBowler(context.bowlerId || '')
    setChangeModalOpen(true)
  }

  const submitChange = () =>
    runGuarded(async () => {
      if (!changeStriker || !changeNonStriker || changeStriker === changeNonStriker) {
        showToast('Pick two different batsmen', 'error')
        return
      }
      // An external bowling side has no bowler to correct — the sentinel is
      // the only value that side ever takes.
      const nextBowler = bowlingIsExternal ? OPPONENT_ID : changeBowler
      if (!nextBowler) {
        showToast('Pick a bowler', 'error')
        return
      }
      const bowlerChangedMidOver = Boolean(innings.balls?.length) && nextBowler !== context.bowlerId && !context.needsNewOver
      if (!innings.balls?.length) {
        await updateMatch({
          [activeInningsKey]: {
            ...innings,
            openers: { strikerId: changeStriker, nonStrikerId: changeNonStriker },
            openingBowlerId: nextBowler,
          },
        })
      } else {
        setOverrideStriker(changeStriker)
        setOverrideNonStriker(changeNonStriker)
        setOverrideBowler(nextBowler)
      }
      setChangeModalOpen(false)
      if (bowlerChangedMidOver) {
        showToast('Bowler changed mid-over — mixed-bowler overs may look unusual in bowling figures', 'info')
      }
    })

  const openRetireModal = () => {
    setRetireOutId(innings.scoringMode === 'full' ? context?.strikerId || '' : '')
    setRetireModalOpen(true)
  }

  const submitRetirement = () =>
    runGuarded(async () => {
      if (!retireOutId) return
      if (innings.scoringMode === 'full') {
        await addBall(activeInningsKey, { isRetirement: true, runs: 0, bowlerId: null, wicketType: 'retired', outBatsmanId: retireOutId })
        clearManualOverrides()
      } else {
        await addRetirement(activeInningsKey, { playerId: retireOutId, atOver: Math.floor(derived.oversBowled) })
        setQBatsmen((prev) => prev.filter((pid) => pid !== retireOutId))
        const bench = battingTeam.playerIds.filter((pid) => pid !== retireOutId && !derived.batting[pid]?.isOut)
        setNeedsQuickReplacement(bench.length > 0)
      }
      setRetireModalOpen(false)
      setRetireOutId('')
    })

  const handleQuickSubmit = () => {
    // An external bowling side has no bowler to pick — the over is logged
    // against the sentinel so its runs/wickets still reach the team total.
    const bowlerId = bowlingIsExternal ? OPPONENT_ID : qBowler
    if (!bowlerId || qRuns === '') {
      showToast(bowlingIsExternal ? 'Enter runs conceded' : 'Pick a bowler and enter runs conceded', 'error')
      return
    }
    runGuarded(async () => {
      const legalSoFar = Math.floor(derived.oversBowled)
      await addOverSummary(activeInningsKey, {
        over: legalSoFar,
        bowlerId,
        runsConceded: Number(qRuns) || 0,
        wickets: Number(qWickets) || 0,
        // Likewise: no crease list for an un-tracked opposition batting side.
        batsmenAtCrease: battingIsExternal ? [] : qBatsmen,
      })
      setQRuns('')
      setQWickets('0')
      showToast('Over added')
    })
  }

  const openAddPlayerModal = () => {
    const teamASize = match.teamA.playerIds.length
    const teamBSize = match.teamB.playerIds.length
    // A tournament match has exactly one roster (ours, team A) — a late
    // arrival can only ever join that side.
    setAddPlayerTeam(isTournamentMatch ? 'A' : teamASize <= teamBSize ? 'A' : 'B')
    setAddPlayerMode('existing')
    setAddPlayerSelectedId('')
    setAddPlayerGuestName('')
    setAddPlayerModalOpen(true)
  }

  const submitAddPlayer = () =>
    runGuarded(async () => {
      let playerId = addPlayerSelectedId
      let displayName = playersById[addPlayerSelectedId]?.name
      if (addPlayerMode === 'guest') {
        const name = addPlayerGuestName.trim()
        if (!name) return
        const ref = await addPlayer({ name })
        playerId = ref.id
        displayName = name
      }
      if (!playerId) {
        showToast('Pick a player or enter a guest name', 'error')
        return
      }
      if (match.teamA.playerIds.includes(playerId) || match.teamB.playerIds.includes(playerId)) {
        showToast('That player is already in this match', 'error')
        return
      }
      const teamKey = addPlayerTeam === 'A' ? 'teamA' : 'teamB'
      const team = match[teamKey]
      await updateMatch({ [teamKey]: { ...team, playerIds: [...team.playerIds, playerId] } })
      setAddPlayerModalOpen(false)
      showToast(`${displayName || 'Player'} added to ${team.name}`)
    })

  // For correcting a mis-draft (e.g. a player picked for the wrong team) —
  // moves someone already in the match from their current team to the
  // other one. Captains are excluded from the picker rather than moved,
  // since moving one would orphan captainId; existing ball-log stats stay
  // attributed to whichever team they were credited to at the time, since
  // that's recorded per-ball, not derived from current roster membership.
  const openMovePlayerModal = () => {
    setMovePlayerSelectedId('')
    setMovePlayerModalOpen(true)
  }

  const submitMovePlayer = () =>
    runGuarded(async () => {
      if (!movePlayerSelectedId) return
      const inA = match.teamA.playerIds.includes(movePlayerSelectedId)
      const fromKey = inA ? 'teamA' : 'teamB'
      const toKey = inA ? 'teamB' : 'teamA'
      const fromTeam = match[fromKey]
      const toTeam = match[toKey]
      await updateMatch({
        [fromKey]: { ...fromTeam, playerIds: fromTeam.playerIds.filter((id) => id !== movePlayerSelectedId) },
        [toKey]: { ...toTeam, playerIds: [...toTeam.playerIds, movePlayerSelectedId] },
      })
      setMovePlayerModalOpen(false)
      showToast(`${playersById[movePlayerSelectedId]?.name || 'Player'} moved to ${toTeam.name}`)
    })

  const handleStartInnings2 = async () => {
    await startInnings2()
    setOpenerStriker('')
    setOpenerNonStriker('')
    setOpeningBowler('')
  }

  const handleSetupInnings2 = async () => {
    const opening = buildOpeningContext(match.innings2.battingTeam)
    if (!opening) return
    await updateMatch({
      innings2: { ...match.innings2, ...opening },
    })
  }

  const handleCompleteMatch = async () => {
    try {
      const result = computeMatchResult(match)
      const suggested = suggestMOTM(match)
      const finalMotmId = motmId || suggested?.playerId || null
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out saving the result — check your connection and try again.')), 8000))
      await Promise.race([completeMatch({ winner: result.winner, margin: result.margin, manOfTheMatch: finalMotmId }), timeout])
      setConfirmComplete(false)
      showToast('Match completed')
      navigate(`${basePath}/match/${id}`)
    } catch (error) {
      console.error('completeMatch failed', error)
      showToast(error?.message || 'Failed to complete match. Please try again.', 'error')
    }
  }

  const handleForceEnd = () => {
    setConfirmForceEnd(false)
    setForceEnd(true)
  }

  // For a match started by mistake (wrong opponent, wrong overs, duplicate
  // tap) — discards it outright rather than leaving a junk "live" row in
  // History. Admin-only, same as every other delete.
  const handleDeleteMatch = async () => {
    try {
      const isTournament = match.isTournament && match.tournamentId
      await deleteMatchById(id, variant.collection)
      setConfirmDeleteMatch(false)
      showToast('Match deleted')
      navigate(isTournament ? `/cricket/tournament/${match.tournamentId}` : `${basePath}/history`)
    } catch (error) {
      console.error('deleteMatch failed', error)
      showToast(error?.message || 'Could not delete the match. Please try again.', 'error')
    }
  }

  const DeleteMatchButton = () => {
    if (!isAdmin) return null
    return (
      <>
        <button onClick={() => setConfirmDeleteMatch(true)} className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2">
          Delete match
        </button>
        <ConfirmDialog
          open={confirmDeleteMatch}
          title="Delete this match?"
          message="Discards the match and everything scored so far. Use this for a match started by mistake — if it was a real match cut short, use 'End match now' instead so the runs still count. This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteMatch}
          onCancel={() => setConfirmDeleteMatch(false)}
        />
      </>
    )
  }

  const EndMatchButton = () => (
    <>
      <button onClick={() => setConfirmForceEnd(true)} className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2">
        End match now
      </button>
      <ConfirmDialog
        open={confirmForceEnd}
        title="End match now?"
        message="Use this if the match was cut short by time, rain, or another issue. It finalizes the result using the score entered so far and saves it to player stats — anything not yet scored won't count."
        confirmLabel="End match"
        danger
        onConfirm={handleForceEnd}
        onCancel={() => setConfirmForceEnd(false)}
      />
    </>
  )

  // --- Render ------------------------------------------------------------
  // Both setup screens are the same three pickers over a different innings —
  // and in a tournament match each picker is shown only if the side it picks
  // from is one of ours. A plain function rather than a nested component, so
  // the selects aren't remounted (and don't lose focus) on every render.
  const renderOpeningPickers = (battingTeamKey) => {
    const battingSide = teamOf(battingTeamKey)
    const bowlingSide = teamOf(battingTeamKey === 'A' ? 'B' : 'A')
    return (
      <>
        {isExternal(battingSide) ? (
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
            {battingSide.name} are batting — we don't track their players, so there are no openers to pick. Just log runs, wickets and overs against our bowlers.
          </p>
        ) : (
          <>
            <label className="text-xs text-gray-500">Striker</label>
            <select value={openerStriker} onChange={(e) => setOpenerStriker(e.target.value)} className="w-full mt-1 mb-3 border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select</option>
              {battingSide.playerIds.map((id) => (
                <option key={id} value={id} disabled={id === openerNonStriker}>
                  {playersById[id]?.name}
                </option>
              ))}
            </select>
            <label className="text-xs text-gray-500">Non-striker</label>
            <select value={openerNonStriker} onChange={(e) => setOpenerNonStriker(e.target.value)} className="w-full mt-1 mb-3 border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select</option>
              {battingSide.playerIds.map((id) => (
                <option key={id} value={id} disabled={id === openerStriker}>
                  {playersById[id]?.name}
                </option>
              ))}
            </select>
          </>
        )}
        {isExternal(bowlingSide) ? (
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4">
            {bowlingSide.name} are bowling — their bowlers aren't tracked, so there's no opening bowler to pick.
          </p>
        ) : (
          <>
            <label className="text-xs text-gray-500">Opening bowler</label>
            <select value={openingBowler} onChange={(e) => setOpeningBowler(e.target.value)} className="w-full mt-1 mb-4 border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select</option>
              {bowlingSide.playerIds.map((id) => (
                <option key={id} value={id}>
                  {playersById[id]?.name}
                </option>
              ))}
            </select>
          </>
        )}
      </>
    )
  }

  if (phase === 'setup-innings1') {
    return (
      <div className="max-w-md mx-auto p-4 pb-24 md:pb-8">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Set Openers</h1>
        <p className="text-xs text-gray-500 mb-4">{teamOf(firstBattingTeam).name} bats first</p>
        {renderOpeningPickers(firstBattingTeam)}
        <button onClick={handleSetupInnings1} className="w-full bg-pitch text-white rounded-lg py-3 text-sm font-semibold">
          Start Innings
        </button>
        <div className="text-center mt-3">
          <DeleteMatchButton />
        </div>
        <Footer />
      </div>
    )
  }

  if (phase === 'start-innings2') {
    const d1 = deriveInningsState(match.innings1)
    return (
      <div className="max-w-md mx-auto p-4 pb-24 md:pb-8 text-center">
        <div className="bg-pitch-light border border-pitch-border rounded-xl p-5 mb-4">
          <p className="text-2xl mb-1">🏏</p>
          <p className="text-sm font-medium text-pitch-dark">Innings 1 complete</p>
          <p className="text-xs text-pitch-dark/70 mt-1">
            {inningsBattingTeam(match.innings1).name}: {d1.totalRuns}/{d1.totalWickets} ({formatOversDisplay(d1.oversBowled)} ov)
          </p>
          <p className="text-xs text-pitch-dark/70">Target: {d1.totalRuns + 1}</p>
        </div>
        <button onClick={handleStartInnings2} className="w-full bg-pitch text-white rounded-lg py-3 text-sm font-semibold">
          Start Innings 2
        </button>
        <div className="mt-3 flex justify-center gap-4">
          <EndMatchButton />
          <DeleteMatchButton />
        </div>
        <Footer />
      </div>
    )
  }

  if (phase === 'setup-innings2') {
    return (
      <div className="max-w-md mx-auto p-4 pb-24 md:pb-8">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Set Openers</h1>
        <p className="text-xs text-gray-500 mb-4">{inningsBattingTeam(match.innings2).name} bats now</p>
        {renderOpeningPickers(match.innings2.battingTeam)}
        <button onClick={handleSetupInnings2} className="w-full bg-pitch text-white rounded-lg py-3 text-sm font-semibold">
          Start Innings
        </button>
        <div className="text-center mt-3">
          <DeleteMatchButton />
        </div>
        <Footer />
      </div>
    )
  }

  if (phase === 'complete-match') {
    const suggested = suggestMOTM(match)
    const allPlayerIds = [...match.teamA.playerIds, ...match.teamB.playerIds]
    const result = computeMatchResult(match)
    return (
      <div className="max-w-md mx-auto p-4 pb-24 md:pb-8">
        <div className="bg-pitch-light border border-pitch-border rounded-xl p-5 mb-4 text-center">
          <p className="text-2xl mb-1">{result.winner === 'no-result' ? '⏱️' : '🏆'}</p>
          <p className="text-sm font-medium text-pitch-dark">
            {result.winner === 'tie' || result.winner === 'no-result' ? result.margin : `${teamOf(result.winner)?.name || 'Match'} ${result.margin}`}
          </p>
        </div>
        <label className="text-xs text-gray-500">Man of the Match</label>
        <select
          value={motmId || suggested?.playerId || ''}
          onChange={(e) => setMotmId(e.target.value)}
          className="w-full mt-1 mb-4 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {allPlayerIds.map((id) => (
            <option key={id} value={id}>
              {playersById[id]?.name}
            </option>
          ))}
        </select>
        <button onClick={() => setConfirmComplete(true)} className="w-full bg-pitch text-white rounded-lg py-3 text-sm font-semibold">
          Complete Match
        </button>
        <div className="text-center mt-3">
          <DeleteMatchButton />
        </div>
        <ConfirmDialog
          open={confirmComplete}
          title="Complete this match?"
          message="This finalizes the result and updates player stats."
          confirmLabel="Complete"
          onConfirm={handleCompleteMatch}
          onCancel={() => setConfirmComplete(false)}
        />
        <Footer />
      </div>
    )
  }

  // phase === 'scoring'
  const runRate = derived.oversBowled > 0 ? (derived.totalRuns / derived.oversBowled).toFixed(1) : '0.0'
  const target = activeInningsKey === 'innings2' ? deriveInningsState(match.innings1).totalRuns + 1 : null

  const lastCompletedOver = innings.balls?.length ? innings.balls[innings.balls.length - 1].over : null
  const lastOverBalls = lastCompletedOver != null ? innings.balls.filter((b) => b.over === lastCompletedOver) : []
  const lastOverRuns = lastOverBalls.reduce((sum, b) => sum + (b.runs || 0) + (b.extraRuns || 0), 0)
  const lastOverWickets = lastOverBalls.filter((b) => b.isWicket).length
  const lastOverBowlerId = lastOverBalls[0]?.bowlerId
  const lastWasRetirement = Boolean(innings.balls?.length && innings.balls[innings.balls.length - 1].isRetirement)
  const lastBallIsRunout = Boolean(
    innings.balls?.length && innings.balls[innings.balls.length - 1].isWicket && innings.balls[innings.balls.length - 1].wicketType === 'runout',
  )

  // Which end is actually vacant depends on where the wicket fell relative
  // to the over boundary (see suggestNextContext in scoringEngine.js) — a
  // wicket on the over's last ball swaps ends for the new over, so the
  // survivor isn't always sitting at nonStrikerId the way it used to be
  // assumed. Exactly one of strikerId/nonStrikerId is null while
  // needsNewBatsman is true; the other holds the survivor.
  const vacantIsStriker = context?.needsNewBatsman ? context.strikerId === null : true
  const survivorId = context?.strikerId ?? context?.nonStrikerId ?? null

  // Item 6 — for a run-out (and only a run-out), who ends up on strike for
  // the next ball depends on runs completed before the throw, which the app
  // can't infer. Default behavior (new batsman takes the vacant end) is
  // correct often enough for every other dismissal type, so this extra
  // choice only shows up here.
  const confirmIncomingBatsman = () => {
    if (!pendingBatsman) return
    if (lastBallIsRunout) {
      if (!runoutStrikerChoice) return
      if (runoutStrikerChoice === 'incoming') {
        if (vacantIsStriker) setManualNewBatsman(pendingBatsman)
        else setOverrideNonStriker(pendingBatsman)
      } else {
        setOverrideStriker(survivorId)
        setOverrideNonStriker(pendingBatsman)
      }
    } else if (vacantIsStriker) {
      setManualNewBatsman(pendingBatsman)
    } else {
      setOverrideNonStriker(pendingBatsman)
    }
    setPendingBatsman('')
    setRunoutStrikerChoice(null)
  }

  return (
    <div className="max-w-md mx-auto p-4 pb-24 md:pb-8">
      <div className="flex justify-between items-center mb-2">
        <div className="flex gap-3">
          <button onClick={openAddPlayerModal} className="text-xs text-pitch underline underline-offset-2">
            + Add player
          </button>
          {/* Nowhere to move anyone to in a tournament match — the other
              side is an external opponent with no roster. */}
          {!isTournamentMatch && (
            <button onClick={openMovePlayerModal} className="text-xs text-pitch underline underline-offset-2">
              Move player
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <DeleteMatchButton />
          <EndMatchButton />
        </div>
      </div>
      {isTournamentMatch && (
        <Link
          to={`/cricket/tournament/${match.tournamentId}`}
          className="block text-[11px] font-medium text-pitch bg-pitch-light border border-pitch-border rounded-lg px-3 py-1.5 mb-2 truncate"
        >
          {match.tournamentStage || 'Tournament'} · vs {match.opponentName || match.teamB?.name}
        </Link>
      )}
      {/* Box Cricket's headline rule, kept on screen for the whole innings —
          the scorer needs to know which way this match was set up before
          they tap the sixth key, not after. */}
      {variant.key === 'box' && (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 mb-2 ${sixOutRule ? 'bg-red-50 border-red-200' : 'bg-pitch-light border-pitch-border'}`}>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Box</span>
          <span className={`text-[11px] font-medium ${sixOutRule ? 'text-red-700' : 'text-pitch-dark'}`}>
            {sixOutRule ? 'A six is OUT' : 'Sixes allowed'}
          </span>
        </div>
      )}
      <div className="bg-pitch text-white rounded-xl p-4 mb-4">
        <p className="text-xs opacity-70">{battingTeam.name} batting</p>
        <p className="text-3xl font-semibold">
          {derived.totalRuns}/{derived.totalWickets}
        </p>
        <p className="text-xs opacity-70">
          {formatOversDisplay(derived.oversBowled)} / {match.oversPerInnings} ov · RR {runRate}
          {target && ` · need ${Math.max(0, target - derived.totalRuns)} from ${((match.oversPerInnings - derived.oversBowled) * 6).toFixed(0)} balls`}
        </p>
      </div>

      {innings.scoringMode === 'full' ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white border border-gray-200 rounded-lg p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-400">Striker</p>
                {!battingIsExternal && (
                  <button onClick={openChangeModal} disabled={submitting} className="text-[10px] text-pitch underline underline-offset-2 disabled:opacity-40">
                    Change
                  </button>
                )}
              </div>
              {battingIsExternal ? (
                <>
                  <p className="font-medium text-gray-900 truncate">{battingTeam.name}</p>
                  <p className="text-[11px] text-gray-400">batsmen not tracked</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-900">{context.strikerId ? playersById[context.strikerId]?.name : '—'}</p>
                  <p className="text-[11px] text-gray-500">{derived.batting[context.strikerId]?.runs ?? 0} ({derived.batting[context.strikerId]?.balls ?? 0})</p>
                </>
              )}
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-400">Bowler</p>
                {!bowlingIsExternal && (
                  <button onClick={openChangeModal} disabled={submitting} className="text-[10px] text-pitch underline underline-offset-2 disabled:opacity-40">
                    Change
                  </button>
                )}
              </div>
              {bowlingIsExternal ? (
                <>
                  <p className="font-medium text-gray-900 truncate">{bowlingTeam.name}</p>
                  <p className="text-[11px] text-gray-400">bowlers not tracked</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-900">{context.bowlerId ? playersById[context.bowlerId]?.name : '—'}</p>
                  <p className="text-[11px] text-gray-500">
                    {derived.bowling[context.bowlerId]?.wickets ?? 0}/{derived.bowling[context.bowlerId]?.runsConceded ?? 0}
                  </p>
                </>
              )}
            </div>
          </div>

          {context.needsNewBatsman ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-800 mb-2">{lastWasRetirement ? 'Retirement — who\'s coming in?' : "Wicket! Who's coming in?"}</p>
              <select
                value={pendingBatsman}
                onChange={(e) => {
                  setPendingBatsman(e.target.value)
                  setRunoutStrikerChoice(null)
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
              >
                <option value="">Select</option>
                {battingTeam.playerIds
                  .filter((pid) => !derived.batting[pid]?.isOut && pid !== context.strikerId && pid !== context.nonStrikerId)
                  .map((pid) => (
                    <option key={pid} value={pid}>
                      {playersById[pid]?.name}
                    </option>
                  ))}
              </select>
              {lastBallIsRunout && pendingBatsman && (
                <div className="mb-2">
                  <p className="text-xs font-medium text-amber-800 mb-1.5">Who's on strike for the next ball?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setRunoutStrikerChoice('survivor')}
                      className={`rounded-lg border py-2 text-xs font-medium ${runoutStrikerChoice === 'survivor' ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-300 text-gray-600'}`}
                    >
                      {playersById[survivorId]?.name} (survivor)
                    </button>
                    <button
                      onClick={() => setRunoutStrikerChoice('incoming')}
                      className={`rounded-lg border py-2 text-xs font-medium ${runoutStrikerChoice === 'incoming' ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-300 text-gray-600'}`}
                    >
                      {playersById[pendingBatsman]?.name} (new)
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={confirmIncomingBatsman}
                disabled={!pendingBatsman || (lastBallIsRunout && !runoutStrikerChoice)}
                className="w-full bg-pitch text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          ) : context.needsNewOver ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-800 mb-1">
                Over {lastCompletedOver != null ? lastCompletedOver + 1 : ''} complete — {lastOverRuns} run{lastOverRuns === 1 ? '' : 's'}
                {lastOverWickets > 0 && `, ${lastOverWickets} wicket${lastOverWickets === 1 ? '' : 's'}`}
              </p>
              <p className="text-xs font-medium text-amber-800 mb-2">
                Who bowls the next over?
                {match.maxOversPerBowler ? ` (max ${match.maxOversPerBowler} ov/bowler)` : ''}
              </p>
              <select value={pendingBowler} onChange={(e) => setPendingBowler(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2">
                <option value="">Select</option>
                {bowlingTeam.playerIds.map((pid) => {
                  const oversSoFar = derived.bowling[pid]?.overs || 0
                  const atLimit = Boolean(match.maxOversPerBowler) && oversSoFar >= match.maxOversPerBowler
                  const sameAsLastOver = pid === lastOverBowlerId
                  const allOthersBlocked = bowlingTeam.playerIds.every(
                    (p) => p === pid || p === lastOverBowlerId || (match.maxOversPerBowler && (derived.bowling[p]?.overs || 0) >= match.maxOversPerBowler),
                  )
                  const disabled = (sameAsLastOver || atLimit) && !allOthersBlocked
                  return (
                    <option key={pid} value={pid} disabled={disabled}>
                      {playersById[pid]?.name}
                      {sameAsLastOver ? ' (bowled last over)' : atLimit ? ' (overs limit reached)' : ''}
                    </option>
                  )
                })}
              </select>
              <button
                onClick={() => {
                  if (!pendingBowler) return
                  setManualNewBowler(pendingBowler)
                  setPendingBowler('')
                }}
                className="w-full bg-pitch text-white rounded-lg py-2 text-sm font-medium"
              >
                Confirm
              </button>
            </div>
          ) : (
            <ScoreInputPad
              onRun={handleRun}
              onWicket={() => openWicketModal()}
              onWide={handleWide}
              onNoBall={handleNoBall}
              onWideWicket={handleWideWicket}
              onNoBallWicket={handleNoBallWicket}
              onSixOut={handleSixOut}
              sixIsOut={sixOutRule}
              disabled={submitting}
            />
          )}

          {/* Retiring an opposition batsman is meaningless — we hold no
              figures for them, and a retirement is only ever recorded against
              a named player. Undo goes full width in that case. */}
          <div className={battingIsExternal ? '' : 'grid grid-cols-2 gap-2'}>
            {!battingIsExternal && (
              <button
                onClick={openRetireModal}
                disabled={submitting || !context.strikerId || !context.nonStrikerId || context.needsNewBatsman}
                className="border border-amber-300 text-amber-700 rounded-lg py-2.5 text-sm font-medium disabled:opacity-40"
              >
                Retire batsman
              </button>
            )}
            <button
              onClick={() => undoLastBall(activeInningsKey)}
              disabled={submitting || !innings.balls.length}
              className={`border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 disabled:opacity-40 ${battingIsExternal ? 'w-full' : ''}`}
            >
              Undo last ball
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-gray-500">Add over {Math.floor(derived.oversBowled) + 1}</p>
          {bowlingIsExternal ? (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              {bowlingTeam.name} are bowling — their bowler isn't tracked. Just enter the runs and wickets for the over.
            </p>
          ) : (
            <select value={qBowler} onChange={(e) => setQBowler(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Bowler</option>
              {bowlingTeam.playerIds.map((id) => (
                <option key={id} value={id}>
                  {playersById[id]?.name}
                </option>
              ))}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={qRuns} onChange={(e) => setQRuns(e.target.value)} placeholder="Runs conceded" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input type="number" value={qWickets} onChange={(e) => setQWickets(e.target.value)} placeholder="Wickets" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          {/* No crease picker for the opposition — there's no roster to pick
              from, and their runs still land in the team total either way. */}
          {!battingIsExternal && (
            <div>
              <p className="text-[11px] text-gray-400 mb-1">Batsmen at crease this over (optional, up to 2)</p>
              <div className="flex flex-wrap gap-1.5">
                {battingTeam.playerIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => setQBatsmen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev))}
                    className={`text-xs px-2.5 py-1 rounded-full border ${qBatsmen.includes(id) ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-200 text-gray-600'}`}
                  >
                    {playersById[id]?.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needsQuickReplacement && !battingIsExternal && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-800 mb-2">Who's replacing the retired batsman?</p>
              <select value={quickReplacementId} onChange={(e) => setQuickReplacementId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2">
                <option value="">Select</option>
                {battingTeam.playerIds
                  .filter((pid) => !derived.batting[pid]?.isOut && !qBatsmen.includes(pid))
                  .map((pid) => (
                    <option key={pid} value={pid}>
                      {playersById[pid]?.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={() => {
                  if (!quickReplacementId) return
                  setQBatsmen((prev) => (prev.length < 2 ? [...prev, quickReplacementId] : prev))
                  setNeedsQuickReplacement(false)
                  setQuickReplacementId('')
                }}
                className="w-full bg-pitch text-white rounded-lg py-2 text-sm font-medium"
              >
                Confirm
              </button>
            </div>
          )}

          <button onClick={handleQuickSubmit} disabled={submitting} className="bg-pitch text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-60">
            Add Over
          </button>
          <div className={battingIsExternal ? '' : 'grid grid-cols-2 gap-2'}>
            {!battingIsExternal && (
              <button
                onClick={openRetireModal}
                disabled={submitting || !battingTeam.playerIds.some((pid) => !derived.batting[pid]?.isOut)}
                className="border border-amber-300 text-amber-700 rounded-lg py-2.5 text-sm font-medium disabled:opacity-40"
              >
                Retire batsman
              </button>
            )}
            <button
              onClick={() => undoLastOver(activeInningsKey)}
              disabled={submitting || !innings.overs.length}
              className={`border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 disabled:opacity-40 ${battingIsExternal ? 'w-full' : ''}`}
            >
              Undo last over
            </button>
          </div>
        </div>
      )}

      {/* Wicket modal */}
      {wicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Wicket</h3>
            {wicketExtra && (
              <p className="text-xs text-amber-600 mb-2">
                On a {wicketExtra.extraType === 'wide' ? 'wide' : 'no ball'} — the {wicketExtra.extraType === 'wide' ? 'wide' : 'no-ball'} run{wicketExtra.extraRuns === 1 ? '' : 's'} still count{wicketExtra.extraRuns === 1 ? 's' : ''}.
              </p>
            )}
            <label className="text-xs text-gray-500">Type</label>
            <select value={wicketType} onChange={(e) => setWicketType(e.target.value)} className="w-full mt-1 mb-3 border border-gray-300 rounded-lg px-3 py-2 text-sm capitalize">
              {wicketTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {WICKET_TYPE_LABELS[t] || t}
                </option>
              ))}
            </select>
            {/* Which of THEIR batsmen is out doesn't exist as a question —
                the wicket still counts on the team total and, unless it's a
                run-out, against our bowler's figures. */}
            {battingIsExternal ? (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
                {battingTeam.name} batsman — not tracked individually.
              </p>
            ) : (
              <>
                <label className="text-xs text-gray-500">Batsman out</label>
                <select value={wicketOutId} onChange={(e) => setWicketOutId(e.target.value)} className="w-full mt-1 mb-3 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value={context.strikerId}>{playersById[context.strikerId]?.name} (striker)</option>
                  <option value={context.nonStrikerId}>{playersById[context.nonStrikerId]?.name} (non-striker)</option>
                </select>
              </>
            )}
            {/* Fielding credit only when the fielding side is ours. */}
            {['caught', 'runout', 'stumped'].includes(wicketType) && !bowlingIsExternal && (
              <>
                <label className="text-xs text-gray-500">Fielder (optional, can add later)</label>
                <select value={wicketFielderId} onChange={(e) => setWicketFielderId(e.target.value)} className="w-full mt-1 mb-3 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Skip for now</option>
                  {bowlingTeam.playerIds.map((id) => (
                    <option key={id} value={id}>
                      {playersById[id]?.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  setWicketModalOpen(false)
                  setWicketExtra(null)
                }}
                disabled={submitting}
                className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button onClick={submitWicket} disabled={submitting} className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60">
                Confirm Wicket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change striker/non-striker/bowler modal */}
      {changeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Change players</h3>
            <p className="text-xs text-gray-500 mb-3">Correct a wrong pick — before the first ball, or mid-match.</p>
            <label className="text-xs text-gray-500">Striker</label>
            <select value={changeStriker} onChange={(e) => setChangeStriker(e.target.value)} className="w-full mt-1 mb-3 border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select</option>
              {battingTeam.playerIds
                .filter((pid) => !derived.batting[pid]?.isOut)
                .map((pid) => (
                  <option key={pid} value={pid} disabled={pid === changeNonStriker}>
                    {playersById[pid]?.name}
                  </option>
                ))}
            </select>
            <label className="text-xs text-gray-500">Non-striker</label>
            <select value={changeNonStriker} onChange={(e) => setChangeNonStriker(e.target.value)} className="w-full mt-1 mb-2 border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select</option>
              {battingTeam.playerIds
                .filter((pid) => !derived.batting[pid]?.isOut)
                .map((pid) => (
                  <option key={pid} value={pid} disabled={pid === changeStriker}>
                    {playersById[pid]?.name}
                  </option>
                ))}
            </select>
            {/* The overwhelmingly common correction is "they crossed and I
                didn't log it" — one tap beats re-picking both dropdowns. */}
            <button
              type="button"
              onClick={() => {
                setChangeStriker(changeNonStriker)
                setChangeNonStriker(changeStriker)
              }}
              disabled={!changeStriker || !changeNonStriker}
              className="w-full mb-3 rounded-lg border border-pitch-border bg-pitch-light py-2 text-xs font-medium text-pitch disabled:opacity-40"
            >
              ⇅ Swap striker and non-striker
            </button>
            {!bowlingIsExternal && (
              <>
                <label className="text-xs text-gray-500">Bowler</label>
                <select value={changeBowler} onChange={(e) => setChangeBowler(e.target.value)} className="w-full mt-1 mb-4 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select</option>
                  {bowlingTeam.playerIds.map((pid) => (
                    <option key={pid} value={pid}>
                      {playersById[pid]?.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={() => setChangeModalOpen(false)} disabled={submitting} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={submitChange} disabled={submitting} className="flex-1 bg-pitch text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retire batsman modal */}
      {retireModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Retire batsman</h3>
            <p className="text-xs text-gray-500 mb-3">For a player who has to leave mid-innings (injury, etc.) — scored as retired out: counts as a wicket down and they can't come back in.</p>
            <label className="text-xs text-gray-500">Batsman retiring</label>
            <select value={retireOutId} onChange={(e) => setRetireOutId(e.target.value)} className="w-full mt-1 mb-3 border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select</option>
              {innings.scoringMode === 'full'
                ? [context.strikerId, context.nonStrikerId].filter(Boolean).map((pid) => (
                    <option key={pid} value={pid}>
                      {playersById[pid]?.name} {pid === context.strikerId ? '(striker)' : '(non-striker)'}
                    </option>
                  ))
                : battingTeam.playerIds
                    .filter((pid) => !derived.batting[pid]?.isOut)
                    .map((pid) => (
                      <option key={pid} value={pid}>
                        {playersById[pid]?.name}
                      </option>
                    ))}
            </select>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setRetireModalOpen(false)} disabled={submitting} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={submitRetirement} disabled={submitting || !retireOutId} className="flex-1 bg-amber-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60">
                Confirm Retirement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add player modal — for someone arriving mid-match */}
      {addPlayerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Add player</h3>
            <p className="text-xs text-gray-500 mb-3">For someone who shows up after the match has started.</p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setAddPlayerMode('existing')}
                className={`rounded-lg border py-2 text-sm font-medium ${addPlayerMode === 'existing' ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-200 text-gray-600'}`}
              >
                Existing player
              </button>
              <button
                onClick={() => setAddPlayerMode('guest')}
                className={`rounded-lg border py-2 text-sm font-medium ${addPlayerMode === 'guest' ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-200 text-gray-600'}`}
              >
                New guest
              </button>
            </div>

            {addPlayerMode === 'existing' ? (
              <>
                <label className="text-xs text-gray-500">Player</label>
                <select
                  value={addPlayerSelectedId}
                  onChange={(e) => setAddPlayerSelectedId(e.target.value)}
                  className="w-full mt-1 mb-3 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select</option>
                  {players
                    .filter((p) => p.isActive && !match.teamA.playerIds.includes(p.id) && !match.teamB.playerIds.includes(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </>
            ) : (
              <>
                <label className="text-xs text-gray-500">Guest name</label>
                <input
                  value={addPlayerGuestName}
                  onChange={(e) => setAddPlayerGuestName(e.target.value)}
                  placeholder="Player name"
                  className="w-full mt-1 mb-3 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </>
            )}

            {isTournamentMatch ? (
              <p className="text-xs text-gray-500 mb-4">
                Joining {match.teamA.name} ({match.teamA.playerIds.length}) — the only side with a roster in this match.
              </p>
            ) : (
              <>
                <label className="text-xs text-gray-500">Add to team</label>
                <div className="grid grid-cols-2 gap-2 mt-1 mb-4">
                  <button
                    onClick={() => setAddPlayerTeam('A')}
                    className={`rounded-lg border py-2 text-sm font-medium ${addPlayerTeam === 'A' ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-200 text-gray-600'}`}
                  >
                    {match.teamA.name} ({match.teamA.playerIds.length})
                  </button>
                  <button
                    onClick={() => setAddPlayerTeam('B')}
                    className={`rounded-lg border py-2 text-sm font-medium ${addPlayerTeam === 'B' ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-200 text-gray-600'}`}
                  >
                    {match.teamB.name} ({match.teamB.playerIds.length})
                  </button>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button onClick={() => setAddPlayerModalOpen(false)} disabled={submitting} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={submitAddPlayer} disabled={submitting} className="flex-1 bg-pitch text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move player modal — for correcting a mis-drafted team */}
      {movePlayerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Move player</h3>
            <p className="text-xs text-gray-500 mb-3">Moves someone to the other team — for fixing a mis-pick, not for trading mid-innings.</p>
            <label className="text-xs text-gray-500">Player</label>
            <select
              value={movePlayerSelectedId}
              onChange={(e) => setMovePlayerSelectedId(e.target.value)}
              className="w-full mt-1 mb-3 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select</option>
              {match.teamA.playerIds
                .filter((pid) => pid !== match.teamA.captainId)
                .map((pid) => (
                  <option key={pid} value={pid}>
                    {playersById[pid]?.name} ({match.teamA.name})
                  </option>
                ))}
              {match.teamB.playerIds
                .filter((pid) => pid !== match.teamB.captainId)
                .map((pid) => (
                  <option key={pid} value={pid}>
                    {playersById[pid]?.name} ({match.teamB.name})
                  </option>
                ))}
            </select>
            {movePlayerSelectedId && (
              <p className="text-xs text-gray-500 mb-3">
                Moving to{' '}
                <span className="font-medium text-gray-700">
                  {match.teamA.playerIds.includes(movePlayerSelectedId) ? match.teamB.name : match.teamA.name}
                </span>
                .
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setMovePlayerModalOpen(false)} disabled={submitting} className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 disabled:opacity-60">
                Cancel
              </button>
              <button
                onClick={submitMovePlayer}
                disabled={submitting || !movePlayerSelectedId}
                className="flex-1 bg-pitch text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
