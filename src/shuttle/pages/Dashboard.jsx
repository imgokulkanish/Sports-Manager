// pages/Dashboard.jsx
import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStats } from '../hooks/useStats'
import {
  leaderboard,
  computePlayerStats,
  winRate,
  sessionWinCounts,
  isQuickPlay,
  bestPartnership,
  hotStreak,
  mostDominant,
  mostMVPs,
  mostReliable,
  mostImproved,
  MIN_RANKED_MATCHES,
  MIN_RELIABLE_MATCHES,
} from '../engine/statsEngine'
import { MetricCard } from '../components/StatsBadge'
import Leaderboard, { ValueWithCount } from '../components/Leaderboard'
import Avatar from '../components/Avatar'
import SampleTag from '../components/SampleTag'
import Footer from '../components/Footer'
import {
  CalendarIcon,
  PeopleIcon,
  ActivityIcon,
  TrophyIcon,
  MedalIcon,
  FlameIcon,
  HandshakeIcon,
  TargetIcon,
  StarIcon,
  CheckCircleIcon,
  TrendUpIcon,
} from '../components/icons'
import { ListSkeleton, MetricGridSkeleton, ButtonRowSkeleton } from '../components/Skeleton'
import NextPayerCard from '../../shell/components/NextPayerCard'
import SportChip from '../../shell/components/SportChip'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// Appends who else is level on the top figure. Every highlight card uses it:
// a tiebreak picks whose name goes on the card, but it isn't a claim that
// they are actually ahead.
function withTie(base, tied) {
  if (!tied || tied < 2) return base
  const others = tied - 1
  return `${base} — tied with ${plural(others, 'other')}`
}

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

export default function Dashboard() {
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
  const allSessionWinRows = useMemo(
    () => sessionWinCounts(sessions, players.filter((p) => p.isActive)),
    [sessions, players],
  )
  const sessionWinRows = useMemo(() => allSessionWinRows.slice(0, 5), [allSessionWinRows])

  // Who has won the most nights outright. Distinct from "best win rate" above:
  // that one counts individual matches, this counts evenings topped, and they
  // are regularly different people - a steady 60% rarely wins the day, while
  // someone streaky takes it outright and loses the rest.
  //
  // A shared top score is called out rather than silently resolved. The sort
  // breaks the tie on sessions played so the card is deterministic, but that
  // is an ordering rule, not a claim that one of them is ahead.
  const mostSessionsWon = useMemo(() => {
    const top = allSessionWinRows[0]
    if (!top) return null
    const tied = allSessionWinRows.filter((r) => r.sessionWins === top.sessionWins).length
    return { ...top, tied }
  }, [allSessionWinRows])

  // Highlights are about the current group, so archived players are left out.
  const activePlayers = useMemo(() => players.filter((p) => p.isActive), [players])
  const activeIds = useMemo(() => activePlayers.map((p) => p.id), [activePlayers])

  const streak = useMemo(() => hotStreak(statsById, activeIds), [statsById, activeIds])
  // Four matches together, the app's "reliable sample" line: at two, a lucky
  // 2-0 outranks a pair who have gone 7-1.
  const duo = useMemo(() => {
    const best = bestPartnership(statsById, activeIds, { minMatches: MIN_RELIABLE_MATCHES })
    return best && best.wins > 0 ? best : null
  }, [statsById, activeIds])
  const dominant = useMemo(() => mostDominant(statsById, activeIds), [statsById, activeIds])
  const mvp = useMemo(() => mostMVPs(sessions, activePlayers), [sessions, activePlayers])
  const reliable = useMemo(() => mostReliable(activePlayers, sessions), [activePlayers, sessions])
  const improved = useMemo(() => mostImproved(sessions, activePlayers), [sessions, activePlayers])

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
        <div className="mb-3">
          <MetricGridSkeleton items={2} />
        </div>
        <div className="mb-5">
          <MetricGridSkeleton items={9} columns="grid-cols-2 md:grid-cols-3" />
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
        {/* On a phone this is the only thing on screen that says the app has
            a second sport — the switcher otherwise hides in the More sheet.
            Renders nothing at md: and up, where the Sidebar has one. */}
        <div className="flex items-center gap-2">
          <SportChip />
          <Link
            to="/settings"
            aria-label="Settings"
            className="text-gray-400 dark:text-gray-500 text-xl hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            ⚙
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <MetricCard
          label="Total sessions"
          value={completedSessions}
          sub={upcomingSessions > 0 ? `${upcomingSessions} upcoming` : undefined}
          icon={CalendarIcon}
          accent="gray"
        />
        <MetricCard label="Total players" value={totalPlayers} icon={PeopleIcon} accent="gray" />
      </div>

      {/* Nine highlights: a clean 3x3 from md up. On a phone's two columns the
          ninth spans the row rather than leaving a hole beside it. */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
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
        <MetricCard
          label="Most sessions won"
          value={mostSessionsWon?.name || '—'}
          sub={
            mostSessionsWon
              ? withTie(`${mostSessionsWon.sessionWins} of ${plural(mostSessionsWon.sessionsPlayed, 'session')}`, mostSessionsWon.tied)
              : 'No session won yet'
          }
          icon={MedalIcon}
          accent="brand"
        />
        <MetricCard
          label="Hot streak"
          value={streak?.name || '—'}
          sub={streak ? withTie(`${streak.streak} wins in a row`, streak.tied) : 'Nobody on 3+ wins lately'}
          icon={FlameIcon}
          accent="blue"
        />
        <MetricCard
          label="Best duo"
          value={duo ? `${playersById[duo.a]?.name} & ${playersById[duo.b]?.name}` : '—'}
          sub={
            duo
              ? `${duo.wins}-${duo.matches - duo.wins} together, ${duo.pointDiff > 0 ? '+' : ''}${duo.pointDiff} pts${
                  duo.tied > 1 ? ` — level with ${plural(duo.tied - 1, 'other pair')}` : ''
                }`
              : `min ${MIN_RELIABLE_MATCHES} matches together`
          }
          icon={HandshakeIcon}
          accent="brand"
        />
        <MetricCard
          label="Most dominant"
          value={dominant?.name || '—'}
          sub={
            dominant
              ? withTie(`+${dominant.diff.toFixed(1)} points per match`, dominant.tied)
              : `min ${MIN_RANKED_MATCHES} scored matches`
          }
          icon={TargetIcon}
          accent="blue"
        />
        <MetricCard
          label="Most MVPs"
          value={mvp?.name || '—'}
          sub={mvp ? withTie(plural(mvp.mvps, 'MVP award'), mvp.tied) : 'No MVP awarded yet'}
          icon={StarIcon}
          accent="brand"
        />
        <MetricCard
          label="Most reliable"
          value={reliable?.name || '—'}
          sub={
            reliable
              ? withTie(`${reliable.attended} of ${plural(reliable.eligible, 'session')} (${reliable.rate}%)`, reliable.tied)
              : 'min 4 sessions since joining'
          }
          icon={CheckCircleIcon}
          accent="blue"
        />
        <MetricCard
          className="col-span-2 md:col-span-1"
          label="Most improved (30 days)"
          value={improved?.name || '—'}
          sub={
            improved
              ? withTie(`${improved.before}% → ${improved.after}% win rate`, improved.tied)
              : 'Nobody up 4+ points lately'
          }
          icon={TrendUpIcon}
          accent="brand"
        />
      </div>

      <NextPayerCard className="mb-5" />

      <div className="grid grid-cols-3 gap-2 mb-5">
        <Link
          to="/shuttle/session/new"
          className="bg-brand hover:bg-brand-dark text-white text-center text-xs font-semibold rounded-lg py-2.5 transition-all active:scale-[0.98] hover:shadow-md"
        >
          New Session
        </Link>
        <Link
          to="/shuttle/players"
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
