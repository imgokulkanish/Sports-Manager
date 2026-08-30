import React, { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStats } from '../hooks/useStats'
import { useTournament, tournamentMatches } from '../hooks/useTournaments'
import {
  computePlayerStats,
  battingLeaderboard,
  bowlingLeaderboard,
  mvpLeaderboard,
  strikeRateLeaderboard,
  battingAverageLeaderboard,
  bowlingAverageLeaderboard,
  economyLeaderboard,
} from '../engine/statsEngine'
import { exportTournamentSummaryPDF } from '../engine/pdfExport'
import { matchResultHeadline, liveScoreHeadline } from '../engine/scoringEngine'
import { StatusBadge } from '../components/StatsBadge'
import Leaderboard from '../components/Leaderboard'
import Footer from '../components/Footer'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { formatOversDisplay, initials, avatarColor } from '../utils'
import { BatIcon, BallIcon, TrophyIcon, StopwatchIcon, TargetIcon, ShieldIcon, CrosshairIcon } from '../components/StatIcons'

// Top 5 on screen keeps each board glanceable at the ground; the PDF below
// carries the full list for everyone who played, so nothing is lost by
// cutting the on-screen boards short.
const TOP_N = 5

// Same reasoning as minMatches: 1 below — MIN_STRIKE_RATE_RUNS (25) is sized
// for a season's batting, and over a single day's rounds it would empty the
// strike rate board entirely. Low enough to let a real innings through, high
// enough that a 1-ball six doesn't top the board.
const TOURNAMENT_MIN_SR_RUNS = 10

function roundSubtitle(m) {
  const fallback = `${m.teamA?.name} vs ${m.teamB?.name}`
  if (m.status === 'completed') return matchResultHeadline(m) || fallback
  if (m.status === 'live') return liveScoreHeadline(m) || fallback
  return fallback
}

/**
 * The day's own screen. Everything here is a FILTERED VIEW over the same
 * `cricketMatches` data the rest of the app reads — the leaderboards below
 * are the existing statsEngine functions handed only this tournament's
 * matches, so nothing is computed twice or stored twice.
 */
export default function TournamentDetail() {
  const { id } = useParams()
  const { players, allMatches, loading: statsLoading } = useStats()
  const { tournament, loading: tournamentLoading, setStatus } = useTournament(id)
  const { showToast } = useToast()
  const [confirmStatus, setConfirmStatus] = useState(false)

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])
  const matches = useMemo(() => tournamentMatches(allMatches, id), [allMatches, id])

  // Same computePlayerStats the app-wide Stats page uses — just a narrower
  // slice of matches. minMatches is 1 here (not MIN_STATS_MATCHES): a single
  // day's tournament is a handful of rounds, so the usual small-sample bar
  // would empty every board.
  const scopedStats = useMemo(() => computePlayerStats(matches, players), [matches, players])

  // The same board set the Dashboard shows, scoped to this tournament and
  // rendered in the same order, so a name's position here means the same
  // thing it does on the home page. Economy and bowling average are already
  // sorted ascending (lowest first) inside their leaderboard functions, so
  // slicing the first TOP_N is "best 5", not "worst 5".
  const sections = useMemo(
    () => [
      {
        key: 'batting',
        label: 'Batting',
        icon: BatIcon,
        rows: battingLeaderboard(scopedStats, { minMatches: 1 }).slice(0, TOP_N),
        renderValue: (r) => (
          <>
            {r.totalRuns} runs <span className="text-[10px] font-normal text-gray-400">({r.inningsBatted} inn)</span>
          </>
        ),
      },
      {
        key: 'bowling',
        label: 'Bowling',
        icon: BallIcon,
        rows: bowlingLeaderboard(scopedStats, { minMatches: 1 }).slice(0, TOP_N),
        renderValue: (r) => (
          <>
            {r.totalWickets} wkts <span className="text-[10px] font-normal text-gray-400">({formatOversDisplay(r.totalOvers)} ov)</span>
          </>
        ),
      },
      {
        key: 'mvp',
        label: 'MVP',
        icon: TrophyIcon,
        rows: mvpLeaderboard(scopedStats, { minMatches: 1 }).slice(0, TOP_N),
        renderValue: (r) => (
          <>
            {r.avgPoints.toFixed(0)} avg pts <span className="text-[10px] font-normal text-gray-400">({r.totalPoints} total)</span>
          </>
        ),
      },
      {
        key: 'strikeRate',
        label: 'Strike Rate',
        icon: StopwatchIcon,
        rows: strikeRateLeaderboard(scopedStats, { minMatches: 1, minRuns: TOURNAMENT_MIN_SR_RUNS }).slice(0, TOP_N),
        renderValue: (r) => (
          <>
            {r.strikeRate.toFixed(0)} SR <span className="text-[10px] font-normal text-gray-400">({r.inningsBatted} inn)</span>
          </>
        ),
      },
      {
        key: 'average',
        label: 'Batting Average',
        icon: TargetIcon,
        rows: battingAverageLeaderboard(scopedStats, { minMatches: 1 }).slice(0, TOP_N),
        renderValue: (r) => (
          <>
            {r.average.toFixed(1)} avg <span className="text-[10px] font-normal text-gray-400">({r.inningsBatted} inn)</span>
          </>
        ),
      },
      {
        key: 'bowlingAverage',
        label: 'Bowling Average',
        icon: CrosshairIcon,
        rows: bowlingAverageLeaderboard(scopedStats, { minMatches: 1 }).slice(0, TOP_N),
        renderValue: (r) => (
          <>
            {r.average.toFixed(1)} avg <span className="text-[10px] font-normal text-gray-400">({formatOversDisplay(r.totalOvers)} ov)</span>
          </>
        ),
      },
      {
        key: 'economy',
        label: 'Economy',
        icon: ShieldIcon,
        rows: economyLeaderboard(scopedStats, { minMatches: 1 }).slice(0, TOP_N),
        renderValue: (r) => (
          <>
            {r.economy.toFixed(1)} econ <span className="text-[10px] font-normal text-gray-400">({formatOversDisplay(r.totalOvers)} ov)</span>
          </>
        ),
      },
    ],
    [scopedStats],
  )

  // The squad picked on the day, plus anyone who turned up late and was
  // added to a round directly from live scoring.
  const squadIds = useMemo(() => {
    const ids = new Set(tournament?.squadPlayerIds || [])
    matches.forEach((m) => (m.teamA?.playerIds || []).forEach((pid) => ids.add(pid)))
    return [...ids].filter((pid) => playersById[pid])
  }, [tournament, matches, playersById])

  const completedCount = matches.filter((m) => m.status === 'completed').length
  const wonCount = matches.filter((m) => m.status === 'completed' && m.result?.winner === 'A').length

  // Every player who played, not the top-5 cut shown on screen — see
  // exportTournamentSummaryPDF.
  const handleExportPDF = () => {
    try {
      exportTournamentSummaryPDF(tournament, matches, players, scopedStats)
    } catch (error) {
      console.error('exportTournamentSummaryPDF failed', error)
      showToast('Could not generate the PDF. Please try again.', 'error')
    }
  }

  const toggleStatus = async () => {
    const next = tournament.status === 'active' ? 'completed' : 'active'
    await setStatus(next)
    setConfirmStatus(false)
    showToast(next === 'completed' ? 'Tournament marked complete' : 'Tournament reopened')
  }

  if (statsLoading || tournamentLoading) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <ListSkeleton rows={5} />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="max-w-3xl mx-auto p-4 pb-24 md:pb-8">
        <p className="text-sm text-gray-500">Tournament not found.</p>
        <Link to="/cricket/history" className="text-sm text-pitch underline underline-offset-2">
          Back to History
        </Link>
        <Footer />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 md:pb-8">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h1 className="text-lg font-semibold text-gray-900">{tournament.name}</h1>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
            tournament.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}
        >
          {tournament.status === 'active' ? 'Active' : 'Completed'}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {new Date(tournament.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {matches.length} round
        {matches.length === 1 ? '' : 's'}
        {completedCount > 0 && ` · ${wonCount} of ${completedCount} won`}
      </p>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <Link to={`/cricket/tournament/${id}/match/new`} className="bg-pitch text-white text-center text-xs font-semibold rounded-lg py-2.5">
          Add Match
        </Link>
        <button onClick={handleExportPDF} className="border border-gray-300 text-center text-xs font-medium text-gray-700 rounded-lg py-2.5">
          PDF
        </button>
        <button onClick={() => setConfirmStatus(true)} className="border border-gray-300 text-center text-xs font-medium text-gray-700 rounded-lg py-2.5">
          {tournament.status === 'active' ? 'Mark complete' : 'Reopen'}
        </button>
      </div>

      <div className="mb-5">
        <p className="text-xs font-medium text-gray-500 mb-2">Squad ({squadIds.length})</p>
        <div className="flex flex-wrap gap-1.5">
          {squadIds.length === 0 && <p className="text-sm text-gray-400">No squad selected.</p>}
          {squadIds.map((pid) => (
            <span key={pid} className="flex items-center gap-1.5 border border-gray-200 bg-white rounded-full pl-1 pr-2.5 py-1">
              <span
                className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[8px] font-semibold shrink-0"
                style={{ background: avatarColor(pid) }}
              >
                {initials(playersById[pid]?.name)}
              </span>
              <span className="text-xs text-gray-700">{playersById[pid]?.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <p className="text-xs font-medium text-gray-500 mb-2">Rounds</p>
        <div className="flex flex-col gap-2">
          {matches.length === 0 && <p className="text-sm text-gray-400">No matches yet. Add the first round above.</p>}
          {matches.map((m) => (
            <Link
              key={m.id}
              to={m.status === 'completed' ? `/cricket/match/${m.id}` : `/cricket/match/${m.id}/live`}
              className="bg-white border border-gray-200 rounded-lg p-3 block"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {m.tournamentStage || 'Round'} <span className="text-gray-400 font-normal">vs {m.opponentName || m.teamB?.name}</span>
                </p>
                <StatusBadge status={m.status} />
              </div>
              <p className="text-[11px] text-gray-400 truncate" title={roundSubtitle(m)}>
                {roundSubtitle(m)}
                {m.manOfTheMatch ? ` · MOTM ${playersById[m.manOfTheMatch]?.name}` : ''}
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          This tournament only — top {TOP_N}
          {completedCount === 0 ? ' (nothing completed yet)' : ''}
        </p>
        {/* Full width on a phone — in a narrow column the name got truncated
            to an initial, which is the one thing a leaderboard has to show.
            Two columns from md up (~360px each, no narrower than the phone
            layout that already reads fine) so seven boards aren't seven
            screens of scrolling. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sections.map((section) => (
            <div key={section.key} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 rounded-full bg-pitch-light text-pitch flex items-center justify-center shrink-0">
                  <section.icon className="w-3.5 h-3.5" />
                </span>
                <p className="text-xs font-semibold text-gray-800">
                  {section.label} (top {TOP_N})
                </p>
              </div>
              <Leaderboard rows={section.rows} renderValue={section.renderValue} showSampleWarning={false} />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Top {TOP_N} on screen — the PDF above has every player who played. These are this tournament's matches only; the same performances also count toward the app-wide{' '}
          <Link to="/cricket/stats" className="text-pitch underline underline-offset-2">
            Stats
          </Link>{' '}
          leaderboards.
        </p>
      </div>

      <ConfirmDialog
        open={confirmStatus}
        title={tournament.status === 'active' ? 'Mark tournament complete?' : 'Reopen this tournament?'}
        message={
          tournament.status === 'active'
            ? "This just clears it off the dashboard — the matches and stats stay exactly as they are, and you can reopen it any time."
            : 'This brings it back as the active tournament on the dashboard.'
        }
        confirmLabel={tournament.status === 'active' ? 'Mark complete' : 'Reopen'}
        onConfirm={toggleStatus}
        onCancel={() => setConfirmStatus(false)}
      />

      <Footer />
    </div>
  )
}
