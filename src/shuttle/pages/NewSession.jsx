// pages/NewSession.jsx
import React, { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useSessions } from '../hooks/useSession'
import {
  generateSchedule,
  regenerateSchedule,
  applySessionOverrides,
  defaultMatchesPerPlayer,
  roundsForMatchesPerPlayer,
  courtPlanFromMinutes,
  courtPlanForMatchesPerPlayer,
  clampCourtPlan,
  summarizeCourtPlan,
  DEFAULT_MINUTES_PER_MATCH,
} from '../engine/scheduleEngine'
import ScheduleTable from '../components/ScheduleTable'
import Footer from '../components/Footer'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import { PeopleIcon } from '../components/icons'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { BTN_SOLID, BTN_OUTLINE } from '../styles'

const INPUT = 'w-full mt-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800/60 disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed'
const LABEL = 'text-xs text-gray-500 dark:text-gray-400'

export default function NewSession() {
  const { players, loading } = usePlayers()
  const { createSession } = useSessions()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [courtCost, setCourtCost] = useState('')
  const [waterCost, setWaterCost] = useState('')
  const [umpire, setUmpire] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [sittingOut, setSittingOut] = useState([])
  const [warmupRest, setWarmupRest] = useState([])
  // { playerId: maxMatches } - a personal ceiling for someone easing back from
  // injury. Their spare matches go to the rest of the group, not to a shorter
  // session, since the court time is already booked.
  const [matchCaps, setMatchCaps] = useState({})
  const [avoidPairs, setAvoidPairs] = useState([])
  const [avoidA, setAvoidA] = useState('')
  const [avoidB, setAvoidB] = useState('')
  const [avoidType, setAvoidType] = useState('partner')
  const [matchesPerPlayer, setMatchesPerPlayer] = useState('')
  // Second-court planning. Off by default, so a normal one-court session is
  // set up exactly as before. When on, the booking (how long you have the
  // hall, how long the extra court is yours, how long a match runs) decides
  // the round count instead of matches-per-player.
  const [extraCourt, setExtraCourt] = useState(false)
  const [totalMinutes, setTotalMinutes] = useState('120')
  const [extraCourtMinutes, setExtraCourtMinutes] = useState('60')
  const [minutesPerMatch, setMinutesPerMatch] = useState(String(DEFAULT_MINUTES_PER_MATCH))
  const [result, setResult] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [confirmStart, setConfirmStart] = useState(false)

  const activePlayers = useMemo(() => players.filter((p) => p.isActive), [players])
  const selectedPlayers = useMemo(
    () => activePlayers.filter((p) => selectedIds.includes(p.id)),
    [activePlayers, selectedIds],
  )
  const playingPlayers = useMemo(
    () => selectedPlayers.filter((p) => !sittingOut.includes(p.id)),
    [selectedPlayers, sittingOut],
  )
  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])

  const totalCost = (parseFloat(courtCost) || 0) + (parseFloat(waterCost) || 0)
  const perPerson = selectedIds.length ? totalCost / selectedIds.length : 0

  const perMatchMins = parseInt(minutesPerMatch, 10) || DEFAULT_MINUTES_PER_MATCH
  const targetMatches = matchesPerPlayer ? Math.min(30, Math.max(1, parseInt(matchesPerPlayer, 10) || 0)) : null

  // The court plan, clamped to what the group can staff (a court needs 4
  // players, so 10 players cap out at 2 courts). Two ways to arrive at one:
  // fill the booked time, or hit a target matches-per-player. The second
  // court covers the same opening stretch either way - only the total length
  // moves - so switching between them never reshuffles which rounds have two
  // courts.
  const courtsBySlot = useMemo(() => {
    if (!extraCourt || playingPlayers.length < 4) return null
    const extraSlots = Math.floor((parseInt(extraCourtMinutes, 10) || 0) / perMatchMins)
    const plan = targetMatches
      ? courtPlanForMatchesPerPlayer(playingPlayers.length, targetMatches, extraSlots)
      : courtPlanFromMinutes(parseInt(totalMinutes, 10) || 0, parseInt(extraCourtMinutes, 10) || 0, perMatchMins)
    return clampCourtPlan(plan, playingPlayers.length)
  }, [extraCourt, totalMinutes, extraCourtMinutes, perMatchMins, targetMatches, playingPlayers.length])

  const planSummary = useMemo(
    () => (courtsBySlot ? summarizeCourtPlan(courtsBySlot, playingPlayers.length) : null),
    [courtsBySlot, playingPlayers.length],
  )
  // What the booked time alone would give, used for the "leave blank" hint and
  // the placeholder, so the hint doesn't change as you type a target.
  const timePlanSummary = useMemo(() => {
    if (!extraCourt || playingPlayers.length < 4) return null
    const plan = clampCourtPlan(
      courtPlanFromMinutes(parseInt(totalMinutes, 10) || 0, parseInt(extraCourtMinutes, 10) || 0, perMatchMins),
      playingPlayers.length,
    )
    return summarizeCourtPlan(plan, playingPlayers.length)
  }, [extraCourt, totalMinutes, extraCourtMinutes, perMatchMins, playingPlayers.length])

  // What an unlimited player gets this session, whichever way the length was
  // decided - the basis for the default cap and the "everyone else" hint.
  const effectiveMatchesPerPlayer =
    playingPlayers.length < 4
      ? 0
      : extraCourt && planSummary
        ? planSummary.matchesPerPlayer
        : targetMatches || defaultMatchesPerPlayer(playingPlayers.length)
  const totalRoundsPlanned =
    extraCourt && planSummary
      ? planSummary.slots
      : roundsForMatchesPerPlayer(playingPlayers.length || 4, effectiveMatchesPerPlayer || 1)
  const maxCapValue = Math.max(1, totalRoundsPlanned)
  const cappedPlayers = playingPlayers.filter((p) => matchCaps[p.id] != null)

  const estimatedMinutes = planSummary ? planSummary.slots * perMatchMins : 0
  const overrunMinutes = Math.max(0, estimatedMinutes - (parseInt(totalMinutes, 10) || 0))
  const twoCourtRounds = courtsBySlot ? courtsBySlot.filter((c) => c > 1).length : 0
  // Round 1 has the most players on court, so it sets the warm-up rest ceiling.
  const round1OnCourt = 4 * (courtsBySlot ? courtsBySlot[0] : 1)
  const maxWarmupRest = Math.max(0, playingPlayers.length - round1OnCourt)
  const tooManyWarmupRest = warmupRest.length > maxWarmupRest

  const dropCap = (id) =>
    setMatchCaps((prev) => {
      if (prev[id] == null) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setSittingOut((prev) => prev.filter((x) => x !== id))
    setWarmupRest((prev) => prev.filter((x) => x !== id))
    setAvoidPairs((prev) => prev.filter((p) => p.a !== id && p.b !== id))
    dropCap(id)
  }

  const toggleSittingOut = (id) => {
    setSittingOut((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setWarmupRest((prev) => prev.filter((x) => x !== id))
    dropCap(id)
  }

  // Defaults to about half the session's matches - an obvious starting point
  // to adjust rather than a number worth agonising over.
  const addCap = (id) =>
    setMatchCaps((prev) => ({ ...prev, [id]: Math.max(1, Math.floor(effectiveMatchesPerPlayer / 2)) }))

  const setCap = (id, value) =>
    setMatchCaps((prev) => ({ ...prev, [id]: Math.max(0, Math.min(maxCapValue, value)) }))

  const toggleWarmupRest = (id) => {
    setWarmupRest((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const addAvoidPair = () => {
    if (!avoidA || !avoidB || avoidA === avoidB) return
    const samePeople = (r) => (r.a === avoidA && r.b === avoidB) || (r.a === avoidB && r.b === avoidA)
    // "must partner" and "never partners" for the same two can't both hold -
    // the engine would just report the required pair as unmet every time.
    const opposite = avoidType === 'mustPartner' ? 'partner' : avoidType === 'partner' ? 'mustPartner' : null
    if (opposite && avoidPairs.some((r) => r.type === opposite && samePeople(r))) {
      showToast('That contradicts a rule you already added for those two', 'error')
      return
    }
    setAvoidPairs((prev) => {
      if (prev.some((r) => r.type === avoidType && samePeople(r))) return prev
      return [...prev, { a: avoidA, b: avoidB, type: avoidType }]
    })
    setAvoidA('')
    setAvoidB('')
  }

  const removeAvoidPair = (index) => {
    setAvoidPairs((prev) => prev.filter((_, i) => i !== index))
  }

  // avoidPairs holds all three rule types. Only the two "never" rules are
  // player constraints; "must partner" is a session goal the engine chases,
  // so it must NOT reach applySessionOverrides - anything not typed
  // 'opponent' there lands in forbiddenPartners, which would invert it.
  const forbidPairs = useMemo(() => avoidPairs.filter((r) => r.type !== 'mustPartner'), [avoidPairs])
  const requiredPairs = useMemo(
    () => avoidPairs.filter((r) => r.type === 'mustPartner').map(({ a, b }) => ({ a, b })),
    [avoidPairs],
  )

  const buildEffectivePlayers = () =>
    applySessionOverrides(selectedPlayers, { sittingOutIds: sittingOut, avoidPairs: forbidPairs })

  const handleGenerate = () => {
    if (playingPlayers.length < 4) {
      showToast('Need at least 4 players not sitting out', 'error')
      return
    }
    if (tooManyWarmupRest) {
      showToast('Not enough players left for round 1 if all of these rest', 'error')
      return
    }
    const mpp = matchesPerPlayer ? Math.min(30, Math.max(1, parseInt(matchesPerPlayer, 10) || 0)) : undefined
    setGenerating(true)
    setTimeout(() => {
      const effectivePlayers = buildEffectivePlayers()
      const res = generateSchedule(effectivePlayers, {}, {
        // courtsBySlot already folds in the matches-per-player target when one
        // is set, so it wins outright rather than being combined with mpp.
        ...(courtsBySlot ? { courtsBySlot } : mpp ? { matchesPerPlayer: mpp } : {}),
        warmupRestIds: warmupRest,
        matchCaps,
        requiredPairs,
      })
      setGenerating(false)
      if (!res) {
        showToast('Could not generate a valid schedule with these players/constraints', 'error')
        return
      }
      res.schedule = res.schedule.map((round) => ({ ...round, resting: [...round.resting, ...sittingOut] }))
      setResult(res)
      setStep(2)
      showToast('Schedule generated')
    }, 30) // yields to paint a loading state before the sync computation
  }

  const handleRegenerate = () => {
    setGenerating(true)
    setTimeout(() => {
      const effectivePlayers = buildEffectivePlayers()
      // Reuse the exact plan the first generation settled on, so regenerating
      // can't silently drop the second court or a custom round count.
      const res = regenerateSchedule(effectivePlayers, {}, {
        courtsBySlot: result.courtsBySlot,
        warmupRestIds: warmupRest,
        matchCaps,
        requiredPairs,
      })
      setGenerating(false)
      if (!res) {
        showToast('Could not generate a new schedule', 'error')
        return
      }
      res.schedule = res.schedule.map((round) => ({ ...round, resting: [...round.resting, ...sittingOut] }))
      setResult(res)
      showToast('Schedule regenerated')
    }, 30)
  }

  const handleStart = async () => {
    setConfirmStart(false)
    try {
      const sessionId = await createSession({
        date,
        courtCost: parseFloat(courtCost) || 0,
        waterCost: parseFloat(waterCost) || 0,
        umpire,
        playerIds: selectedIds,
        schedule: result.schedule,
        courtsBySlot: result.courtsBySlot,
      })
      showToast('Session started')
      navigate(`/shuttle/session/${sessionId}/live`)
    } catch (err) {
      console.error('Failed to start session:', err)
      showToast(err?.message || 'Could not start session, please try again', 'error')
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
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">New Session</h1>
      <div className="flex gap-1 mb-4">
        <div className={`flex-1 h-1 rounded transition-colors ${step >= 1 ? 'bg-brand' : 'bg-gray-200 dark:bg-gray-800'}`} />
        <div className={`flex-1 h-1 rounded transition-colors ${step >= 2 ? 'bg-brand' : 'bg-gray-200 dark:bg-gray-800'}`} />
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Umpire</label>
              <input
                type="text"
                value={umpire}
                onChange={(e) => setUmpire(e.target.value)}
                placeholder="Name"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Court cost (SAR)</label>
              <input
                type="number"
                value={courtCost}
                onChange={(e) => setCourtCost(e.target.value)}
                placeholder="0"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Water cost (SAR)</label>
              <input
                type="number"
                value={waterCost}
                onChange={(e) => setWaterCost(e.target.value)}
                placeholder="0"
                className={INPUT}
              />
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 rounded-lg px-3 py-2 flex justify-between items-center">
              <span className="text-xs text-green-800 dark:text-green-300">SAR {totalCost.toFixed(2)} total</span>
              <span className="text-sm font-semibold text-green-800 dark:text-green-300">SAR {perPerson.toFixed(2)} / person</span>
            </div>
          )}

          <div>
            <p className={`${LABEL} mb-2`}>Select players ({selectedIds.length} selected, minimum 4)</p>
            {activePlayers.length === 0 ? (
              <EmptyState
                icon={<PeopleIcon className="w-6 h-6" />}
                title="No active players yet"
                message="Add players from the Players tab before creating a session."
                action={
                  <Link
                    to="/players"
                    className="bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-4 py-2 transition-all active:scale-[0.98] inline-block"
                  >
                    Go to Players
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {activePlayers.map((p) => {
                  const selected = selectedIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleSelect(p.id)}
                      className={`flex items-center gap-2.5 border-2 rounded-lg px-3 py-2 text-left min-h-[44px] transition-all active:scale-[0.98] ${
                        selected
                          ? 'border-brand bg-brand-light dark:bg-brand/15'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar id={p.id} name={p.name} size="sm" />
                        {selected && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-brand border-2 border-white dark:border-gray-900 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="4">
                              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-sm truncate ${
                          selected ? 'text-brand dark:text-emerald-400 font-medium' : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {p.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {selectedIds.length >= 4 && (
            <>
              <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extraCourt}
                    onChange={(e) => setExtraCourt(e.target.checked)}
                    className="w-4 h-4 accent-brand shrink-0"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Booked a second court
                  </span>
                </label>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 ml-6">
                  Two matches run at the same time while both courts are yours.
                </p>

                {extraCourt && (
                  <>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div>
                        <label className={LABEL}>Total mins</label>
                        <input
                          type="number"
                          min={10}
                          step={10}
                          value={totalMinutes}
                          onChange={(e) => setTotalMinutes(e.target.value)}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>2nd court mins</label>
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={extraCourtMinutes}
                          onChange={(e) => setExtraCourtMinutes(e.target.value)}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Mins / match</label>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={minutesPerMatch}
                          onChange={(e) => setMinutesPerMatch(e.target.value)}
                          className={INPUT}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className={LABEL}>Matches per player</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={matchesPerPlayer}
                  onChange={(e) => setMatchesPerPlayer(e.target.value)}
                  placeholder={
                    playingPlayers.length > 0
                      ? String(
                          extraCourt && planSummary
                            ? timePlanSummary?.matchesPerPlayer ?? planSummary.matchesPerPlayer
                            : defaultMatchesPerPlayer(playingPlayers.length),
                        )
                      : '-'
                  }
                  disabled={playingPlayers.length === 0}
                  className={INPUT}
                />
                {playingPlayers.length > 0 &&
                  (extraCourt ? (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                      {targetMatches
                        ? `${planSummary?.slots} rounds across both courts to give everyone ~${targetMatches}.`
                        : `Leave blank to fill the booked time (${timePlanSummary?.matchesPerPlayer ?? '-'} each). Set a number to aim for that instead.`}
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                      Default is {defaultMatchesPerPlayer(playingPlayers.length)} matches/player (
                      {roundsForMatchesPerPlayer(playingPlayers.length, defaultMatchesPerPlayer(playingPlayers.length))} rounds).
                      {matchesPerPlayer &&
                        ` This will use ~${roundsForMatchesPerPlayer(playingPlayers.length, parseInt(matchesPerPlayer, 10) || 1)} rounds.`}
                    </p>
                  ))}
              </div>

              {planSummary && (
                <div className="mt-3 bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-green-700 dark:text-green-400/80 mb-0.5">
                    ≈{estimatedMinutes} min of play
                    {overrunMinutes > 0
                      ? ` — ${overrunMinutes} min past your ${totalMinutes} min booking`
                      : ''}
                  </p>
                  <p className="text-xs text-green-800 dark:text-green-300">
                    <span className="font-semibold">{planSummary.slots} rounds</span> ·{' '}
                    {planSummary.totalMatches} matches ·{' '}
                    <span className="font-semibold">
                      {planSummary.matchesPerPlayer}
                      {planSummary.playersWithOneExtra > 0 ? `-${planSummary.matchesPerPlayer + 1}` : ''} matches
                    </span>{' '}
                    each
                  </p>
                  <p className="text-[11px] text-green-700 dark:text-green-400/80 mt-0.5">
                    {twoCourtRounds > 0 ? (
                      <>
                        Rounds 1-{twoCourtRounds} on 2 courts ({playingPlayers.length - 8} resting), then 1 court (
                        {playingPlayers.length - 4} resting).
                      </>
                    ) : playingPlayers.length < 8 ? (
                      <>
                        {playingPlayers.length} players can only fill 1 court — running as a normal
                        single-court session.
                      </>
                    ) : (
                      <>No second-court time set — running as a normal single-court session.</>
                    )}
                  </p>
                </div>
              )}

              <div>
                <p className={`${LABEL} mb-2`}>Sitting out this session (optional)</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPlayers.map((p) => {
                    const out = sittingOut.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleSittingOut(p.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          out
                            ? 'bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-600 text-gray-700 dark:text-gray-300 line-through'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className={`${LABEL} mb-2`}>Playing fewer matches? (optional)</p>
                <div className="flex flex-wrap gap-1.5">
                  {playingPlayers.map((p) => {
                    const limited = matchCaps[p.id] != null
                    return (
                      <button
                        key={p.id}
                        onClick={() => (limited ? dropCap(p.id) : addCap(p.id))}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          limited
                            ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {p.name}
                      </button>
                    )
                  })}
                </div>

                {cappedPlayers.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-2">
                    {cappedPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 border border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/10 rounded-lg px-2.5 py-1.5"
                      >
                        <Avatar id={p.id} name={p.name} size="xs" />
                        <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">{p.name}</span>
                        <input
                          type="number"
                          min={0}
                          max={maxCapValue}
                          value={matchCaps[p.id]}
                          onChange={(e) => setCap(p.id, parseInt(e.target.value, 10) || 0)}
                          aria-label={`Maximum matches for ${p.name}`}
                          className="w-14 text-center border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-1.5 py-1 text-sm"
                        />
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0">max</span>
                        <button
                          onClick={() => dropCap(p.id)}
                          aria-label={`Remove match limit for ${p.name}`}
                          className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 text-lg leading-none px-1 shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      The session stays the same length, so their spare matches go to everyone else — the rest of
                      the group will play a bit more than {effectiveMatchesPerPlayer}.
                    </p>
                  </div>
                )}
                {cappedPlayers.length === 0 && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                    Coming back from an injury? Tap a name to cap how many matches they play.
                  </p>
                )}
              </div>

              <div>
                <p className={`${LABEL} mb-2`}>Needs to warm up? Rest them in Round 1 (optional)</p>
                <div className="flex flex-wrap gap-1.5">
                  {playingPlayers.map((p) => {
                    const resting = warmupRest.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleWarmupRest(p.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          resting
                            ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {p.name}
                      </button>
                    )
                  })}
                </div>
                {tooManyWarmupRest && (
                  <p className="text-[11px] text-red-500 dark:text-red-400 mt-1">
                    Too many resting - round 1 needs {round1OnCourt} players on court, so at most{' '}
                    {maxWarmupRest} can sit it out.
                  </p>
                )}
              </div>

              <div>
                <p className={`${LABEL} mb-2`}>Pairing rules this session (optional)</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={avoidA}
                    onChange={(e) => setAvoidA(e.target.value)}
                    className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-2 py-1.5 text-xs"
                  >
                    <option value="">Player A</option>
                    {selectedPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={avoidType}
                    onChange={(e) => setAvoidType(e.target.value)}
                    className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-2 py-1.5 text-xs"
                  >
                    <option value="partner">never partners</option>
                    <option value="opponent">never opponents</option>
                    <option value="mustPartner">must partner</option>
                  </select>
                  <select
                    value={avoidB}
                    onChange={(e) => setAvoidB(e.target.value)}
                    className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-2 py-1.5 text-xs"
                  >
                    <option value="">Player B</option>
                    {selectedPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addAvoidPair}
                    disabled={!avoidA || !avoidB || avoidA === avoidB}
                    className={`text-xs font-medium text-brand dark:text-emerald-400 border border-brand-border dark:border-brand/30 bg-brand-light dark:bg-brand/15 rounded-lg px-3 py-1.5 ${BTN_OUTLINE}`}
                  >
                    Add
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                  "Must partner" guarantees them at least one match as a pair — they still play with and against
                  everyone else the rest of the session.
                </p>
                {avoidPairs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {avoidPairs.map((pair, i) => {
                      const must = pair.type === 'mustPartner'
                      return (
                        <span
                          key={i}
                          className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                            must
                              ? 'border-brand-border dark:border-brand/40 bg-brand-light dark:bg-brand/15 text-green-800 dark:text-emerald-300'
                              : 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          <span className="opacity-60">{must ? 'must pair' : 'never'}</span>
                          {playersById[pair.a]?.name} {pair.type === 'opponent' ? 'vs' : '&'}{' '}
                          {playersById[pair.b]?.name}
                          <button
                            onClick={() => removeAvoidPair(i)}
                            aria-label="Remove rule"
                            className={must ? 'text-brand hover:text-green-900 dark:hover:text-emerald-200' : 'text-amber-500 hover:text-amber-800 dark:hover:text-amber-200'}
                          >
                            ×
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          <button
            onClick={handleGenerate}
            disabled={playingPlayers.length < 4 || tooManyWarmupRest || generating}
            className={`bg-brand text-white rounded-lg py-3 text-sm font-semibold ${BTN_SOLID}`}
          >
            {generating ? 'Generating…' : 'Generate Schedule'}
          </button>
        </div>
      )}

      {step === 2 && result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {result.totalSlots} rounds
              {result.totalMatches !== result.totalSlots ? ` · ${result.totalMatches} matches` : ''} ·{' '}
              {playingPlayers.length} playing
              {sittingOut.length > 0 ? ` · ${sittingOut.length} sitting out` : ''}
            </p>
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className={`text-xs font-medium text-brand dark:text-emerald-400 border border-brand-border dark:border-brand/30 bg-brand-light dark:bg-brand/15 rounded-lg px-3 py-1.5 ${BTN_OUTLINE}`}
            >
              {generating ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>

          {result.warnings?.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Constraint notes</p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <ScheduleTable schedule={result.schedule} playersById={playersById} />

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg py-3 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Back
            </button>
            <button
              onClick={() => setConfirmStart(true)}
              className="flex-1 bg-brand hover:bg-brand-dark text-white rounded-lg py-3 text-sm font-semibold transition-all active:scale-[0.98]"
            >
              Start Session
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmStart}
        title="Start this session?"
        message="This saves the schedule and moves you to live scoring."
        confirmLabel="Start"
        onConfirm={handleStart}
        onCancel={() => setConfirmStart(false)}
      />

      <Footer />
    </div>
  )
}
