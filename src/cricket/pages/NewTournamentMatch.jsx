import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useMatches } from '../hooks/useMatch'
import { useTournaments } from '../hooks/useTournaments'
import Footer from '../components/Footer'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../../shell/components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

// Common stage labels as a shortcut — but `tournamentStage` is free text, so
// "Custom" lets you type anything. Qualification is uncertain by nature;
// deliberately not modeled as a rigid bracket.
const STAGE_OPTIONS = ['Group vs Corporate', 'Group vs Finance', 'Quarterfinal', 'Semifinal', 'Final']
const CUSTOM_STAGE = '__custom__'

/**
 * Creates an ordinary match document with the tournament fields set, so it
 * lands in the same `cricketMatches` collection as everything else and feeds
 * the app-wide stats automatically.
 *
 * teamA is our squad; teamB is the external opponent — name only, no roster,
 * no captain, and no draft step at all. Nothing about their players is ever
 * written.
 */
export default function NewTournamentMatch() {
  const { tid } = useParams()
  const navigate = useNavigate()
  const { players, loading: playersLoading } = usePlayers()
  const { createMatch } = useMatches()
  const { tournaments, loading: tournamentsLoading } = useTournaments()
  const { showToast } = useToast()

  const [tournamentId, setTournamentId] = useState(tid || '')
  const [stageChoice, setStageChoice] = useState(STAGE_OPTIONS[0])
  const [customStage, setCustomStage] = useState('')
  const [opponentName, setOpponentName] = useState('')
  const [ourTeamName, setOurTeamName] = useState('Us')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [oversPerInnings, setOversPerInnings] = useState(8)
  const [maxOversPerBowler, setMaxOversPerBowler] = useState(3)
  // Full mode is the default here — ball-by-ball is the point of tournament
  // day — but Quick stays available for a round that has to be rushed.
  const [scoringMode, setScoringMode] = useState('full')
  const [wonToss, setWonToss] = useState(true)
  const [tossDecision, setTossDecision] = useState('bat')
  const [playingIds, setPlayingIds] = useState([])
  const [confirmStart, setConfirmStart] = useState(false)
  const [startingMatch, setStartingMatch] = useState(false)

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])
  const tournament = useMemo(() => tournaments.find((t) => t.id === tournamentId) || null, [tournaments, tournamentId])
  const squadIds = useMemo(() => (tournament?.squadPlayerIds || []).filter((id) => playersById[id]), [tournament, playersById])
  const stage = stageChoice === CUSTOM_STAGE ? customStage.trim() : stageChoice

  // Default to the whole squad playing; re-seeds if the tournament is switched.
  useEffect(() => {
    setPlayingIds(squadIds)
  }, [squadIds])

  // Default the date to the tournament's own date — every round is the same day.
  useEffect(() => {
    if (tournament?.date) setDate(new Date(tournament.date).toISOString().slice(0, 10))
  }, [tournament?.date])

  const togglePlaying = (id) => {
    setPlayingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
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
      const opponent = opponentName.trim()
      const matchId = await createMatch({
        date,
        venue: '',
        oversPerInnings: Number(oversPerInnings),
        maxOversPerBowler: Number(maxOversPerBowler) || null,
        playersPool: playingIds,
        scoringMode,
        isTournament: true,
        tournamentId,
        tournamentStage: stage,
        opponentName: opponent,
        teamA: { name: ourTeamName.trim() || 'Us', captainId: null, playerIds: playingIds, umpireId: null },
        // External opponent: a LABEL only. No player ids, no captain, no
        // roster — nothing about their players is stored. playerCount is
        // just "how many a side" so wickets-in-hand / all-out maths work.
        teamB: { name: opponent, captainId: null, playerIds: [], umpireId: null, isExternal: true, playerCount: playingIds.length },
        // Toss is recorded in the existing A/B shape so LiveScoring's
        // first-batting logic works unchanged.
        toss: { wonBy: wonToss ? 'A' : 'B', decision: tossDecision },
      })

      if (timedOut) return
      if (!matchId) {
        showToast('Could not create match. Please try again.', 'error')
        return
      }

      setConfirmStart(false)
      showToast('Tournament match created. Opening live scoring...')
      navigate(`/cricket/match/${matchId}/live`)
    } catch (error) {
      if (timedOut) return
      console.error('createMatch failed', error)
      showToast(error?.message || 'Failed to start match. Please try again.', 'error')
    } finally {
      clearTimeout(guardTimer)
      setStartingMatch(false)
    }
  }

  if (playersLoading || tournamentsLoading) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <ListSkeleton rows={5} />
      </div>
    )
  }

  const canStart = Boolean(tournamentId && stage && opponentName.trim() && playingIds.length >= 2)

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Add Tournament Match</h1>
      <p className="text-xs text-gray-500 mb-4">Our squad vs an external opponent. No draft — their players aren't tracked.</p>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-gray-500">Tournament</label>
          <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Select a tournament</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                {t.status === 'completed' ? ' (completed)' : ''}
              </option>
            ))}
          </select>
          <Link to="/cricket/tournament/new" className="inline-block mt-1.5 text-xs text-pitch underline underline-offset-2">
            + Start a new tournament instead
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Stage</label>
            <select value={stageChoice} onChange={(e) => setStageChoice(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {STAGE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value={CUSTOM_STAGE}>Something else…</option>
            </select>
            {stageChoice === CUSTOM_STAGE && (
              <input
                value={customStage}
                onChange={(e) => setCustomStage(e.target.value)}
                placeholder="e.g. Group vs Logistics"
                className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500">Opponent team name</label>
            <input
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="e.g. Corporate Team"
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">Just a label — we never record their players.</p>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">Our team name (shown on the scorecard)</label>
          <input value={ourTeamName} onChange={(e) => setOurTeamName(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Toss</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => setWonToss(true)}
                className={`rounded-lg border py-2.5 text-sm font-medium ${wonToss ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-200 text-gray-600'}`}
              >
                We won
              </button>
              <button
                onClick={() => setWonToss(false)}
                className={`rounded-lg border py-2.5 text-sm font-medium ${!wonToss ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-200 text-gray-600'}`}
              >
                They won
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">{wonToss ? 'We chose to' : 'They chose to'}</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => setTossDecision('bat')}
                className={`rounded-lg border py-2.5 text-sm font-medium ${tossDecision === 'bat' ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-200 text-gray-600'}`}
              >
                Bat first
              </button>
              <button
                onClick={() => setTossDecision('bowl')}
                className={`rounded-lg border py-2.5 text-sm font-medium ${tossDecision === 'bowl' ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-200 text-gray-600'}`}
              >
                Bowl first
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">Scoring mode</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={() => setScoringMode('full')}
              className={`rounded-lg border py-2.5 text-sm font-medium ${scoringMode === 'full' ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-200 text-gray-600'}`}
            >
              Full (ball-by-ball)
            </button>
            <button
              onClick={() => setScoringMode('quick')}
              className={`rounded-lg border py-2.5 text-sm font-medium ${scoringMode === 'quick' ? 'bg-pitch-light border-pitch text-pitch' : 'border-gray-200 text-gray-600'}`}
            >
              Quick (per over)
            </button>
          </div>
        </div>

        {tournamentId && (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Playing this round ({playingIds.length} of {squadIds.length} in the squad)
            </p>
            {squadIds.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                This tournament's squad is empty (or everyone in it has been removed from the roster).
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {squadIds.map((id) => {
                  const selected = playingIds.includes(id)
                  return (
                    <button
                      key={id}
                      onClick={() => togglePlaying(id)}
                      className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 text-left min-h-[44px] ${selected ? 'border-pitch bg-pitch-light' : 'border-gray-200 bg-white'}`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-sm border-2 shrink-0 ${selected ? 'bg-pitch border-pitch' : 'border-gray-300'}`} />
                      <span className="text-sm text-gray-900 truncate">{playersById[id]?.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setConfirmStart(true)}
          disabled={!canStart || startingMatch}
          className="bg-pitch text-white rounded-lg py-3 text-sm font-semibold disabled:bg-gray-300 disabled:text-gray-400"
        >
          {startingMatch ? 'Starting...' : 'Start Match'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmStart}
        title="Start this match?"
        message={`${stage || 'This round'} vs ${opponentName.trim() || 'the opponent'} — this saves the match and moves you to live scoring.`}
        confirmLabel={startingMatch ? 'Starting...' : 'Start'}
        onConfirm={handleStart}
        onCancel={() => !startingMatch && setConfirmStart(false)}
      />

      <Footer />
    </div>
  )
}
