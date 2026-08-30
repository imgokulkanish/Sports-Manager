// pages/Dashboard.jsx
import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStats } from '../hooks/useStats'
import { useExpenses } from '../hooks/useExpenses'
import { suggestNextPayer } from '../engine/expenseEngine'
import {
  leaderboard,
  computePlayerStats,
  winRate,
  sessionWinCounts,
  isQuickPlay,
  MIN_RANKED_MATCHES,
} from '../engine/statsEngine'
import { MetricCard } from '../components/StatsBadge'
import Leaderboard, { ValueWithCount } from '../components/Leaderboard'
import Avatar from '../components/Avatar'
import SampleTag from '../components/SampleTag'
import Footer from '../components/Footer'
import { CalendarIcon, PeopleIcon, ActivityIcon, TrophyIcon } from '../components/icons'
import { ListSkeleton, MetricGridSkeleton, ButtonRowSkeleton } from '../components/Skeleton'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function AvatarStack({ players }) {
  const shown = players.slice(0, 3)
  const extra = players.length - shown.length
  return (
    <div className="flex -space-x-2 mr-2.5">
      {shown.map((p) => (
        <Avatar key={p.id} id={p.id} name={p.name} size="xs" className="border-2 border-white dark:border-gray-900" />
      ))}
      {extra > 0 && (
        <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-900 text-[9px] text-gray-500 dark:text-gray-400 flex items-center justify-center font-semibold">
          +{extra}
        </div>
      )}
    </div>
  )
}

/**
 * "Who's paying this week?" - the one expense decision the group remakes every
 * week, so it belongs on the surface they already open rather than behind a
 * nav item. Also the mobile route into /expenses, which isn't in the bottom
 * bar (see NAV_ITEMS in Navbar.jsx for why).
 */
function PayingThisWeek({ expenses, players, playersById }) {
  const suggestion = suggestNextPayer(expenses, players)
  const player = suggestion ? playersById[suggestion.playerId] : null
  return (
    <Link
      to="/expenses"
      className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 mb-5 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Who&apos;s paying next?</p>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">Expenses →</span>
      </div>
      <div className="bg-brand-light dark:bg-brand/15 rounded-lg px-3 py-2">
        {player ? (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar id={player.id} name={player.name} size="xs" />
            <span className="text-sm font-medium text-green-900 dark:text-green-200 truncate">{player.name}</span>
            <span className="text-[11px] text-green-700 dark:text-green-300/80 truncate ml-auto shrink-0">
              {suggestion.reason}
            </span>
          </div>
        ) : (
          <span className="text-sm font-medium text-green-900 dark:text-green-200">
            Pick anyone — nothing logged yet
          </span>
        )}
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const { expenses } = useExpenses()
  const { players, sessions, statsById, loading } = useStats()

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])

  const completedSessions = sessions.filter((s) => s.status === 'completed').length
  const upcomingSessions = sessions.filter((s) => s.status !== 'completed').length
  const totalPlayers = players.filter((p) => p.isActive).length

  // Snapshot of stats as of a week ago, used to show trend arrows on the
  // "most active" / "best win rate" cards without a separate stats history.
  const prevStatsById = useMemo(() => {
    const cutoff = Date.now() - WEEK_MS
    const olderSessions = sessions.filter((s) => new Date(s.date).getTime() < cutoff)
    return computePlayerStats(olderSessions, players)
  }, [sessions, players])

  const mostActive = useMemo(() => {
    const rows = Object.values(statsById).sort((a, b) => b.totalMatches - a.totalMatches)
    return rows[0] || null
  }, [statsById])

  const mostActiveTrend = useMemo(() => {
    if (!mostActive) return null
    const delta = mostActive.totalMatches - (prevStatsById[mostActive.playerId]?.totalMatches || 0)
    if (delta <= 0) return null
    return { direction: 'up', label: `+${delta} this wk` }
  }, [mostActive, prevStatsById])

  const bestWinRatePlayer = useMemo(() => {
    const rows = leaderboard(statsById, { minMatches: MIN_RANKED_MATCHES })
    return rows[0] || null
  }, [statsById])

  const bestWinRateTrend = useMemo(() => {
    if (!bestWinRatePlayer) return null
    const prevStat = prevStatsById[bestWinRatePlayer.playerId]
    if (!prevStat || !prevStat.totalMatches) return null
    const deltaPts = Math.round((bestWinRatePlayer.winRate - winRate(prevStat)) * 100)
    if (deltaPts === 0) return null
    return { direction: deltaPts > 0 ? 'up' : 'down', label: `${deltaPts > 0 ? '+' : ''}${deltaPts}pts this wk` }
  }, [bestWinRatePlayer, prevStatsById])

  // The metric card above is just the top of this list, so both read the same
  // threshold - otherwise the card can name someone the list doesn't show.
  const topFive = useMemo(
    () => leaderboard(statsById, { minMatches: MIN_RANKED_MATCHES }).slice(0, 5),
    [statsById],
  )
  const sessionWinRows = useMemo(() => sessionWinCounts(sessions, players.filter((p) => p.isActive)).slice(0, 5), [sessions, players])

  // Sessions only - quick play has no schedule to continue and nothing to
  // resume, so it would just be dead weight in a feed that links into rounds.
  const recentSessions = useMemo(
    () => sessions.filter((s) => !isQuickPlay(s)).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    [sessions],
  )

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 pb-24 md:pb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Shuttle Manager</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">Weekly badminton sessions</p>
          </div>
        </div>
        <div className="mb-5">
          <MetricGridSkeleton items={4} />
        </div>
        <div className="mb-5">
          <ButtonRowSkeleton items={3} />
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Recent sessions</p>
            <ListSkeleton rows={4} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Leaderboard</p>
            <ListSkeleton rows={4} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Shuttle Manager</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500">Weekly badminton sessions</p>
        </div>
        <Link
          to="/shuttle/settings"
          aria-label="Settings"
          className="text-gray-400 dark:text-gray-500 text-xl hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          ⚙
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <MetricCard
          label="Total sessions"
          value={completedSessions}
          sub={upcomingSessions > 0 ? `${upcomingSessions} upcoming` : undefined}
          icon={CalendarIcon}
          accent="gray"
        />
        <MetricCard label="Total players" value={totalPlayers} icon={PeopleIcon} accent="gray" />
        <MetricCard
          label="Most active"
          value={mostActive?.name || '—'}
          sub={mostActive ? `${mostActive.totalMatches} matches` : undefined}
          trend={mostActiveTrend}
          icon={ActivityIcon}
          accent="blue"
        />
        <MetricCard
          label="Best win rate"
          value={bestWinRatePlayer?.name || '—'}
          sub={bestWinRatePlayer ? `${Math.round(bestWinRatePlayer.winRate * 100)}%` : `min ${MIN_RANKED_MATCHES} matches`}
          trend={bestWinRateTrend}
          tag={bestWinRatePlayer && <SampleTag matches={bestWinRatePlayer.totalMatches} />}
          icon={TrophyIcon}
          accent="brand"
        />
      </div>

      <PayingThisWeek expenses={expenses} players={players} playersById={playersById} />

      <div className="grid grid-cols-3 gap-2 mb-5">
        <Link
          to="/shuttle/session/new"
          className="bg-brand hover:bg-brand-dark text-white text-center text-xs font-semibold rounded-lg py-2.5 transition-all active:scale-[0.98] hover:shadow-md"
        >
          New Session
        </Link>
        <Link
          to="/players"
          className="border border-gray-300 dark:border-gray-700 text-center text-xs font-medium text-gray-700 dark:text-gray-300 rounded-lg py-2.5 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          View Players
        </Link>
        <Link
          to="/shuttle/history"
          className="border border-gray-300 dark:border-gray-700 text-center text-xs font-medium text-gray-700 dark:text-gray-300 rounded-lg py-2.5 transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          History
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Recent sessions</p>
          <div className="flex flex-col gap-2">
            {recentSessions.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No sessions yet.</p>
            )}
            {recentSessions.map((s) => (
              <Link
                key={s.id}
                to={s.status === 'completed' ? `/shuttle/session/${s.id}` : `/shuttle/session/${s.id}/live`}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 flex items-center justify-between transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
              >
                <div className="flex items-center min-w-0">
                  <AvatarStack players={(s.playerIds || []).map((id) => ({ id, name: playersById[id]?.name || '?' }))} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {new Date(s.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">{s.playerIds?.length || 0} players</p>
                  </div>
                </div>
                {s.status === 'completed' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 shrink-0">
                    Completed
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold bg-brand text-white shrink-0">
                    Start ▶
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Leaderboard (top 5, min {MIN_RANKED_MATCHES} matches)
          </p>
          <Leaderboard rows={topFive} />
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Session wins</p>
        <Leaderboard
          rows={sessionWinRows}
          renderValue={(row) => (
            <ValueWithCount count={row.sessionsPlayed}>
              {row.sessionWins} {row.sessionWins === 1 ? 'win' : 'wins'}
            </ValueWithCount>
          )}
        />
      </div>

      <Footer />
    </div>
  )
}
