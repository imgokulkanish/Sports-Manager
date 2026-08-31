import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStats } from '../hooks/useStats'
import { useTournaments } from '../hooks/useTournaments'
import {
  mvpLeaderboard,
  battingLeaderboard,
  bowlingLeaderboard,
  strikeRateLeaderboard,
  battingAverageLeaderboard,
  bowlingAverageLeaderboard,
  economyLeaderboard,
  MIN_STATS_MATCHES,
  MIN_MVP_MATCHES,
} from '../engine/statsEngine'
import { matchResultHeadline, liveScoreHeadline } from '../engine/scoringEngine'
import { MetricCard, StatusBadge } from '../components/StatsBadge'
import Leaderboard from '../components/Leaderboard'
import Footer from '../components/Footer'
import { ListSkeleton } from '../components/Skeleton'
import { formatOversDisplay } from '../utils'
import { BatIcon, BallIcon, StopwatchIcon, TargetIcon, ShieldIcon, CrosshairIcon } from '../components/StatIcons'
import MvpInfoModal from '../components/MvpInfoModal'
import NextPayerCard from '../../shell/components/NextPayerCard'
import { useMatchVariant } from '../context/MatchVariant'

function CalendarIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  )
}
function PeopleIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" strokeLinecap="round" />
    </svg>
  )
}
function matchSubtitle(m) {
  const fallback = `${m.teamA?.name} vs ${m.teamB?.name}`
  if (m.status === 'completed') return matchResultHeadline(m) || fallback
  if (m.status === 'live') return liveScoreHeadline(m) || fallback
  return fallback
}

function TrophyIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" strokeLinecap="round" />
      <path d="M12 12v4M9 20h6M10 16h4v4h-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Dashboard() {
  const variant = useMatchVariant()
  const { basePath } = variant
  const { players, matches, statsById, loading } = useStats()
  // Tournaments belong to full cricket only — a tournament envelope points at
  // `cricketMatches` docs, so Box Cricket skips the listener entirely.
  const { tournaments } = useTournaments(variant.supportsTournaments)
  const [showMvpInfo, setShowMvpInfo] = useState(false)

  // On the day of an event the tournament screen is the one you actually
  // want — surface it here so it isn't buried under History. Most recent
  // active one wins (tournaments are already sorted date-desc).
  const activeTournament = useMemo(() => tournaments.find((t) => t.status === 'active') || null, [tournaments])
  const activeRounds = useMemo(
    () => (activeTournament ? matches.filter((m) => m.isTournament && m.tournamentId === activeTournament.id) : []),
    [matches, activeTournament],
  )

  const totalMatches = matches.filter((m) => m.status === 'completed').length
  const totalPlayers = players.filter((p) => p.isActive).length

  // MVP average swings hard on a single big game, so it needs the same
  // track record (MIN_MVP_MATCHES) as the other leaderboards below before
  // ranking someone here — the full, unfiltered season totals live on the
  // Stats page.
  const mvpRows = useMemo(() => mvpLeaderboard(statsById, { minMatches: MIN_MVP_MATCHES }).slice(0, 5), [statsById])
  const mvpTop = mvpRows[0] || null
  // Same fairness filter as MVP (MIN_STATS_MATCHES) — top 5 only, to keep
  // this a daily-glance summary rather than a duplicate of the Stats page's
  // full leaderboards.
  // Economy is already sorted ascending inside economyLeaderboard (lowest
  // conceded first), so slicing the first 5 here is correctly "best 5",
  // not "worst 5" — no re-sort needed.
  const dashboardSections = useMemo(
    () => [
      {
        key: 'batting',
        label: 'Batting',
        icon: BatIcon,
        rows: battingLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 5),
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
        rows: bowlingLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 5),
        renderValue: (r) => (
          <>
            {r.totalWickets} wkts <span className="text-[10px] font-normal text-gray-400">({formatOversDisplay(r.totalOvers)} ov)</span>
          </>
        ),
      },
      {
        key: 'strikeRate',
        label: 'Strike Rate',
        icon: StopwatchIcon,
        rows: strikeRateLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 5),
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
        rows: battingAverageLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 5),
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
        rows: bowlingAverageLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 5),
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
        rows: economyLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 5),
        renderValue: (r) => (
          <>
            {r.economy.toFixed(1)} econ <span className="text-[10px] font-normal text-gray-400">({formatOversDisplay(r.totalOvers)} ov)</span>
          </>
        ),
      },
    ],
    [statsById],
  )

  const recentMatches = useMemo(() => [...matches].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4), [matches])

  if (loading) {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <ListSkeleton rows={4} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {variant.key === 'box' ? 'Box Cricket' : 'Cricket Manager'}
          </h1>
          {/* Says the quiet part out loud on every visit: these two ledgers
              never mix. See context/MatchVariant.jsx for how that's enforced. */}
          {variant.key === 'box' && (
            <p className="text-[11px] text-gray-400">Separate records — not counted in cricket stats</p>
          )}
        </div>
        <Link to="/settings" aria-label="Settings" className="text-gray-400 text-xl">
          ⚙
        </Link>
      </div>

      {activeTournament && (
        <Link
          to={`/cricket/tournament/${activeTournament.id}`}
          className="flex items-center gap-3 bg-pitch-light border border-pitch-border rounded-lg px-3 py-2.5 mb-4"
        >
          <span className="w-8 h-8 rounded-full bg-pitch text-white flex items-center justify-center shrink-0">
            <TrophyIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-pitch-dark truncate">{activeTournament.name}</p>
            <p className="text-[11px] text-pitch-dark/70">
              Tournament in progress · {activeRounds.length} round{activeRounds.length === 1 ? '' : 's'} so far
            </p>
          </div>
          <span className="text-xs font-semibold text-pitch shrink-0">Open →</span>
        </Link>
      )}

      {/* Discovery: Box Cricket rides in the More sheet on a phone and low in
          the sidebar on desktop, so the cricket home surfaces it directly
          rather than relying on someone finding the nav item. */}
      {variant.supportsTournaments && (
        <Link to="/cricket/box" className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2.5 mb-4">
          <span className="w-8 h-8 rounded-full bg-pitch-light text-pitch flex items-center justify-center shrink-0 text-base">🧱</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">Box Cricket</p>
            <p className="text-[11px] text-gray-400">Own matches, own stats — kept out of the numbers below</p>
          </div>
          <span className="text-xs font-semibold text-pitch shrink-0">Open →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 mb-5">
        <MetricCard label="Total matches" value={totalMatches} icon={<CalendarIcon />} />
        <MetricCard label="Total players" value={totalPlayers} icon={<PeopleIcon />} />
        <MetricCard label="Top MVP avg" value={mvpTop?.name || '—'} sub={mvpTop ? `${mvpTop.avgPoints.toFixed(0)} avg pts/match` : `min ${MIN_MVP_MATCHES} matches`} icon={<TrophyIcon />} accent="pitch" />
        <div />
      </div>

      {/* Expenses are one joint pot across both sports, so the rotation's
          answer is the same here as on Shuttle's dashboard — same component,
          same shared data. Box cricket draws on that same pot, so repeating
          the card one level deeper would only be the same answer twice. */}
      {variant.supportsTournaments && <NextPayerCard className="mb-5" />}

      {/* 2x2 on a phone, one row on desktop — four items at text-xs across a
          phone would be too cramped to tap. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        <Link to={`${basePath}/match/new`} className="bg-pitch text-white text-center text-xs font-semibold rounded-lg py-2.5">
          New Match
        </Link>
        {/* Full cricket's second slot is tournaments; box cricket has none, so
            it points at its own stats rather than leaving a gap. */}
        {variant.supportsTournaments ? (
          <Link
            to={activeTournament ? `/cricket/tournament/${activeTournament.id}/match/new` : '/cricket/tournament/new'}
            className="border border-pitch-border bg-pitch-light text-center text-xs font-semibold text-pitch rounded-lg py-2.5"
          >
            {activeTournament ? 'Add Round' : 'New Tournament'}
          </Link>
        ) : (
          <Link to={`${basePath}/stats`} className="border border-pitch-border bg-pitch-light text-center text-xs font-semibold text-pitch rounded-lg py-2.5">
            Box Stats
          </Link>
        )}
        <Link to="/cricket/players" className="border border-gray-300 text-center text-xs font-medium text-gray-700 rounded-lg py-2.5">
          View Players
        </Link>
        <Link to={`${basePath}/history`} className="border border-gray-300 text-center text-xs font-medium text-gray-700 rounded-lg py-2.5">
          History
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Recent matches</p>
          <div className="flex flex-col gap-2">
            {recentMatches.length === 0 && <p className="text-sm text-gray-400">No matches yet.</p>}
            {recentMatches.map((m) => (
              <Link key={m.id} to={m.status === 'completed' ? `${basePath}/match/${m.id}` : `${basePath}/match/${m.id}/live`} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(m.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate" title={matchSubtitle(m)}>
                    {matchSubtitle(m)}
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <p className="text-xs font-medium text-gray-500">MVP leaderboard — avg pts/match (top 5, min {MIN_MVP_MATCHES} matches)</p>
            <button
              onClick={() => setShowMvpInfo(true)}
              aria-label="How MVP points are calculated"
              className="w-4 h-4 rounded-full border border-gray-300 text-gray-400 text-[10px] leading-none flex items-center justify-center shrink-0 hover:border-pitch hover:text-pitch"
            >
              i
            </button>
          </div>
          <Leaderboard
            rows={mvpRows}
            renderValue={(r) => (
              <>
                {r.avgPoints.toFixed(0)} avg pts <span className="text-[10px] font-normal text-gray-400">({r.totalPoints} total)</span>
              </>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
        {dashboardSections.map((section) => (
          <div key={section.key} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-full bg-pitch-light text-pitch flex items-center justify-center shrink-0">
                <section.icon className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-semibold text-gray-800">{section.label} (top 5)</p>
            </div>
            <Leaderboard rows={section.rows} renderValue={section.renderValue} />
          </div>
        ))}
      </div>

      <Footer />
      <MvpInfoModal open={showMvpInfo} onClose={() => setShowMvpInfo(false)} />
    </div>
  )
}
