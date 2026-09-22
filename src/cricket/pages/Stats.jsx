import React, { useMemo, useState } from 'react'
import { useStats } from '../hooks/useStats'
import {
  battingLeaderboard,
  bowlingLeaderboard,
  mvpLeaderboard,
  strikeRateLeaderboard,
  battingAverageLeaderboard,
  bowlingAverageLeaderboard,
  bowlingStrikeRateLeaderboard,
  economyLeaderboard,
  computeCaptaincyStats,
  captaincyLeaderboard,
  captaincyWinPctLeaderboard,
  MIN_STRIKE_RATE_RUNS,
  MIN_STATS_MATCHES,
  MIN_CAPTAINCY_MATCHES,
} from '../engine/statsEngine'
import { exportPeriodSummaryPDF } from '../engine/pdfExport'
import Leaderboard from '../components/Leaderboard'
import CaptaincyBoard from '../components/CaptaincyBoard'
import Footer from '../components/Footer'
import { ListSkeleton } from '../components/Skeleton'
import { formatOversDisplay } from '../utils'
import { BatIcon, BallIcon, TrophyIcon, StopwatchIcon, TargetIcon, ShieldIcon, CrosshairIcon, GaugeIcon, ArmbandIcon } from '../components/StatIcons'
import MvpInfoModal from '../components/MvpInfoModal'
import { useMatchVariant } from '../context/MatchVariant'

const RANGE_OPTIONS = [
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 180 days', value: 180 },
  { label: 'All time', value: null },
]

const STATS_TABS = [
  { key: 'batting', label: 'Batting', icon: BatIcon },
  { key: 'bowling', label: 'Bowling', icon: BallIcon },
  { key: 'mvp', label: 'MVP', icon: TrophyIcon },
  { key: 'strikeRate', label: 'Strike Rate', icon: StopwatchIcon },
  { key: 'bowlingStrikeRate', label: 'Bowling Strike Rate', icon: GaugeIcon },
  { key: 'average', label: 'Batting Average', icon: TargetIcon },
  { key: 'bowlingAverage', label: 'Bowling Average', icon: CrosshairIcon },
  { key: 'economy', label: 'Economy', icon: ShieldIcon },
  { key: 'captaincy', label: 'Captaincy', icon: ArmbandIcon },
]

export default function Stats() {
  const variant = useMatchVariant()
  const [days, setDays] = useState(90)
  const [showRangeMenu, setShowRangeMenu] = useState(false)
  const [tab, setTab] = useState('batting')
  const [showMvpInfo, setShowMvpInfo] = useState(false)
  const { players, matches, statsById, loading } = useStats(days)

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])

  // Every category on the Stats page filters out players below
  // MIN_STATS_MATCHES entirely (unlike the Dashboard's small-sample-tagged
  // summaries) — a short run of matches swings every one of these rates and
  // totals too easily to rank someone fairly.
  const battingRows = useMemo(() => battingLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 10), [statsById])
  const bowlingRows = useMemo(() => bowlingLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 10), [statsById])
  const mvpRows = useMemo(() => mvpLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 10), [statsById])
  const strikeRateRows = useMemo(() => strikeRateLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 10), [statsById])
  const bowlingStrikeRateRows = useMemo(() => bowlingStrikeRateLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 10), [statsById])
  const averageRows = useMemo(() => battingAverageLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 10), [statsById])
  const bowlingAverageRows = useMemo(() => bowlingAverageLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 10), [statsById])
  const economyRows = useMemo(() => economyLeaderboard(statsById, { minMatches: MIN_STATS_MATCHES }).slice(0, 10), [statsById])
  // Captaincy is counted off the match documents rather than statsById —
  // the armband belongs to the match, not to a player's ball-by-ball record
  // (see computeCaptaincyStats). It also keeps its own, lower cut-off: a
  // matches-led count is meaningful from match one, so filtering at
  // MIN_STATS_MATCHES would hide most of the captains outright.
  const captaincyById = useMemo(() => computeCaptaincyStats(matches, players), [matches, players])
  const captaincyRows = useMemo(() => captaincyLeaderboard(captaincyById).slice(0, 10), [captaincyById])
  const captaincyWinPctRows = useMemo(() => captaincyWinPctLeaderboard(captaincyById), [captaincyById])

  if (loading) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <ListSkeleton rows={5} />
      </div>
    )
  }

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === days)?.label || 'All time'
  const completedMatches = matches.filter((m) => m.status === 'completed')
  const activeTab = STATS_TABS.find((t) => t.key === tab)

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4 relative">
        <h1 className="text-lg font-semibold text-gray-900">
          {variant.key === 'box' ? 'Box Cricket Stats' : 'Stats'}
        </h1>
        <button onClick={() => setShowRangeMenu((v) => !v)} className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600">
          {rangeLabel} ↓
        </button>
        {showRangeMenu && (
          <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-40">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => {
                  setDays(opt.value)
                  setShowRangeMenu(false)
                }}
                className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
        <div className="flex gap-2 overflow-x-auto min-w-0 md:flex-1 pb-1">
          {STATS_TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-full border-2 transition-colors ${
                  active ? 'bg-pitch border-pitch text-white shadow-sm' : 'border-transparent bg-gray-50 text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {t.label}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => exportPeriodSummaryPDF(completedMatches, players, statsById, { label: variant.key === 'box' ? `Box Cricket · ${rangeLabel}` : rangeLabel })}
          className="shrink-0 text-xs border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 w-full md:w-auto"
        >
          Export summary PDF
        </button>
      </div>
      {/* The whole point of this page existing twice: same leaderboards, a
          different set of matches behind them. */}
      {variant.key === 'box' && (
        <p className="text-[11px] text-gray-500 bg-pitch-light border border-pitch-border rounded-lg px-3 py-2 mb-2">
          Built only from Box Cricket matches. Nothing here feeds the main cricket leaderboards, and nothing from there counts here.
        </p>
      )}
      <p className="text-[11px] text-gray-400 mb-3">
        {tab === 'captaincy'
          ? `Every captain of a completed match is listed. Win % needs at least ${MIN_CAPTAINCY_MATCHES} matches captained.`
          : `Leaderboards require at least ${MIN_STATS_MATCHES} matches played.`}
        {tab === 'strikeRate' ? ` Strike rate also requires at least ${MIN_STRIKE_RATE_RUNS} runs scored.` : ''}
      </p>

      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-full bg-pitch-light text-pitch flex items-center justify-center shrink-0">
          <activeTab.icon className="w-4 h-4" />
        </span>
        <p className="text-sm font-semibold text-gray-800">{activeTab.label} leaderboard</p>
        {tab === 'mvp' && (
          <button
            onClick={() => setShowMvpInfo(true)}
            aria-label="How MVP points are calculated"
            className="w-4 h-4 rounded-full border border-gray-300 text-gray-400 text-[10px] leading-none flex items-center justify-center shrink-0 hover:border-pitch hover:text-pitch"
          >
            i
          </button>
        )}
      </div>

      {tab === 'batting' && (
        <Leaderboard
          rows={battingRows}
          renderValue={(r) => (
            <>
              {r.totalRuns} runs <span className="text-[10px] font-normal text-gray-400">({r.inningsBatted} inn)</span>
            </>
          )}
        />
      )}
      {tab === 'bowling' && (
        <Leaderboard
          rows={bowlingRows}
          renderValue={(r) => (
            <>
              {r.totalWickets} wkts <span className="text-[10px] font-normal text-gray-400">({formatOversDisplay(r.totalOvers)} ov)</span>
            </>
          )}
        />
      )}
      {tab === 'mvp' && (
        <Leaderboard
          rows={mvpRows}
          renderValue={(r) => `${r.avgPoints.toFixed(0)} pts avg`}
        />
      )}
      {tab === 'strikeRate' && (
        <Leaderboard
          rows={strikeRateRows}
          renderValue={(r) => `${r.strikeRate.toFixed(0)} SR`}
        />
      )}
      {tab === 'bowlingStrikeRate' && (
        <Leaderboard
          rows={bowlingStrikeRateRows}
          renderValue={(r) => `${r.bowlingStrikeRate.toFixed(1)} SR`}
        />
      )}
      {tab === 'average' && (
        <Leaderboard
          rows={averageRows}
          renderValue={(r) => `${r.average.toFixed(1)} avg`}
        />
      )}
      {tab === 'bowlingAverage' && (
        <Leaderboard
          rows={bowlingAverageRows}
          renderValue={(r) => `${r.average.toFixed(1)} avg`}
        />
      )}
      {tab === 'economy' && (
        <Leaderboard
          rows={economyRows}
          renderValue={(r) => `${r.economy.toFixed(1)} econ`}
        />
      )}
      {tab === 'captaincy' && <CaptaincyBoard rows={captaincyRows} winPctRows={captaincyWinPctRows} />}

      <Footer />
      <MvpInfoModal open={showMvpInfo} onClose={() => setShowMvpInfo(false)} />
    </div>
  )
}
