// pages/Stats.jsx
import React, { useMemo, useState } from 'react'
import { useStats } from '../hooks/useStats'
import {
  leaderboard,
  partnershipHeatmap,
  headToHead,
  attendanceCounts,
  sessionWinCounts,
  isLowSample,
  MIN_RANKED_MATCHES,
} from '../engine/statsEngine'
import Leaderboard, { ValueWithCount } from '../components/Leaderboard'
import SampleTag from '../components/SampleTag'
import Avatar from '../components/Avatar'
import Footer from '../components/Footer'
import { ListSkeleton } from '../components/Skeleton'
import { exportPeriodSummaryPDF } from '../engine/pdfExport'

const RANGE_OPTIONS = [
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 180 days', value: 180 },
  { label: 'All time', value: null },
]

const CARD = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3'

function h2hCellClass(rec) {
  if (!rec || rec.wins === rec.losses) return 'bg-gray-50 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400'
  if (rec.wins > rec.losses) return 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
  return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
}

function heatColor(rate) {
  if (rate === null || rate === undefined) return '#F3F4F6'
  // interpolate between light green (#D1FAE5) and brand green (#1F6F4A)
  const stops = ['#D1FAE5', '#86EFAC', '#4ADE80', '#1F6F4A']
  const idx = Math.min(stops.length - 1, Math.floor(rate * stops.length))
  return stops[idx]
}

export default function Stats() {
  const [days, setDays] = useState(90)
  const [showRangeMenu, setShowRangeMenu] = useState(false)
  const { players, sessions, statsById, loading } = useStats(days)

  const activePlayers = players.filter((p) => p.isActive)
  const playerIds = activePlayers.map((p) => p.id)
  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])

  const rows = useMemo(() => leaderboard(statsById), [statsById])
  // The win-rate chart ranks, so it takes the match floor. `rows` above stays
  // unfiltered - the overall leaderboard at the bottom of the page is meant to
  // list everybody, with SampleTag marking the thin records.
  const rankedRows = useMemo(
    () => leaderboard(statsById, { minMatches: MIN_RANKED_MATCHES }),
    [statsById],
  )
  const sessionWinRows = useMemo(() => sessionWinCounts(sessions, activePlayers), [sessions, activePlayers])
  const heatmap = useMemo(() => partnershipHeatmap(statsById, playerIds), [statsById, playerIds])
  const h2h = useMemo(() => headToHead(statsById, playerIds), [statsById, playerIds])
  // attendanceCounts only tallies *completed* sessions (see statsEngine.js), so
  // with a single completed session on record every attendee lands at the same
  // count — that's correct scaling, not a bug, it just reads as "flat" until
  // there's more history. The percentage math itself (count / max * 100) is verified below.
  const attendance = useMemo(() => attendanceCounts(sessions, activePlayers, 6), [sessions, activePlayers])
  const maxAttendance = Math.max(1, ...Object.values(attendance))

  const bestStreak = useMemo(() => {
    const rows2 = Object.values(statsById).sort((a, b) => b.bestWinStreak - a.bestWinStreak)
    return rows2[0] || null
  }, [statsById])

  const bestPartnership = useMemo(() => {
    let best = null
    for (const a of playerIds) {
      for (const b of playerIds) {
        if (a >= b) continue
        const stat = statsById[a]?.partnerStats?.[b]
        if (stat && stat.matches >= 2) {
          const rate = stat.wins / stat.matches
          if (!best || rate > best.rate) best = { a, b, rate, matches: stat.matches }
        }
      }
    }
    return best
  }, [statsById, playerIds])

  if (loading) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <ListSkeleton rows={5} />
      </div>
    )
  }

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === days)?.label || 'All time'

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4 relative">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Stats</h1>
        <button
          onClick={() => setShowRangeMenu((v) => !v)}
          className="text-xs border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {rangeLabel} ↓
        </button>
        {showRangeMenu && (
          <div className="absolute right-0 top-9 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-10 w-40 animate-[fadein_0.12s_ease-out]">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => {
                  setDays(opt.value)
                  setShowRangeMenu(false)
                }}
                className="w-full text-left text-xs px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => exportPeriodSummaryPDF(sessions, players, { label: rangeLabel })}
        className="w-full text-xs font-medium border border-gray-300 dark:border-gray-700 rounded-lg py-2 mb-4 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:scale-[0.98]"
      >
        Export period summary ({rangeLabel}) — PDF
      </button>

      <div className={`${CARD} mb-4`}>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
          All-time win rate (min {MIN_RANKED_MATCHES} matches)
        </p>
        <div className="flex flex-col gap-1.5">
          {rankedRows.slice(0, 8).map((r) => (
            <div key={r.playerId} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 w-16 truncate">{r.name}</span>
              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-brand rounded-full transition-[width]" style={{ width: `${Math.round(r.winRate * 100)}%` }} />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 w-9 text-right">{Math.round(r.winRate * 100)}%</span>
              <SampleTag matches={r.totalMatches} />
            </div>
          ))}
          {rankedRows.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {rows.length === 0
                ? 'No matches recorded in this range.'
                : `Nobody has ${MIN_RANKED_MATCHES} matches in this range yet.`}
            </p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <div className={CARD}>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Best partnership</p>
          {bestPartnership ? (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                {playersById[bestPartnership.a]?.name} + {playersById[bestPartnership.b]?.name}
                <SampleTag matches={bestPartnership.matches} />
              </p>
              <p className="text-xs text-brand dark:text-emerald-400 mt-0.5">{Math.round(bestPartnership.rate * 100)}% wins together</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">{bestPartnership.matches} matches</p>
            </>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">Not enough data yet.</p>
          )}
        </div>

        <div className={CARD}>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Best win streak (all-time)</p>
          {bestStreak && bestStreak.bestWinStreak > 0 ? (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{bestStreak.name}</p>
              <p className="text-xs text-brand dark:text-emerald-400 mt-0.5">{bestStreak.bestWinStreak} consecutive wins</p>
            </>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">Not enough data yet.</p>
          )}
        </div>
      </div>

      <div className={`${CARD} mb-4`}>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Attendance (last 6 sessions)</p>
        <div className="flex items-end gap-2 h-24">
          {activePlayers.map((p) => {
            const count = attendance[p.id] || 0
            const pct = (count / maxAttendance) * 100
            return (
              <div key={p.id} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className="w-full bg-brand rounded-t transition-all"
                  style={{ height: `max(${pct}%, 3px)` }}
                  title={`${p.name}: ${count} of last ${Math.min(6, maxAttendance)} session(s)`}
                />
                <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 truncate w-full text-center">
                  {p.name.slice(0, 4)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className={`${CARD} mb-4 overflow-x-auto`}>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Partnership win % heatmap</p>
        <table className="text-[10px] text-gray-500 dark:text-gray-400 border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th></th>
              {activePlayers.map((p) => (
                <th key={p.id} className="font-normal pb-1">
                  <Avatar id={p.id} name={p.name} size="xs" className="mx-auto" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activePlayers.map((rowP) => (
              <tr key={rowP.id}>
                <td className="pr-1">
                  <Avatar id={rowP.id} name={rowP.name} size="xs" />
                </td>
                {activePlayers.map((colP) => (
                  <td key={colP.id}>
                    <div
                      className="w-5 h-5 rounded"
                      style={{ background: rowP.id === colP.id ? 'transparent' : heatColor(heatmap[rowP.id]?.[colP.id]) }}
                      title={
                        rowP.id === colP.id
                          ? ''
                          : heatmap[rowP.id]?.[colP.id] != null
                          ? `${Math.round(heatmap[rowP.id][colP.id] * 100)}%`
                          : 'No data'
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2 items-center mt-2">
          <div className="w-2.5 h-2.5 rounded" style={{ background: '#1F6F4A' }} />
          <span className="text-[9px] text-gray-400 dark:text-gray-500">High</span>
          <div className="w-2.5 h-2.5 rounded" style={{ background: '#D1FAE5' }} />
          <span className="text-[9px] text-gray-400 dark:text-gray-500">Low</span>
        </div>
      </div>

      <div className={`${CARD} mb-4 overflow-x-auto`}>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Head-to-head record (row's W-L vs column)</p>
        <table className="text-[10px] text-gray-600 dark:text-gray-400 border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th></th>
              {activePlayers.map((p) => (
                <th key={p.id} className="font-normal pb-1">
                  <Avatar id={p.id} name={p.name} size="xs" className="mx-auto" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activePlayers.map((rowP) => (
              <tr key={rowP.id}>
                <td className="pr-1">
                  <Avatar id={rowP.id} name={rowP.name} size="xs" />
                </td>
                {activePlayers.map((colP) => {
                  const rec = h2h[rowP.id]?.[colP.id]
                  const total = rec ? rec.wins + rec.losses : 0
                  const lowSample = rec && isLowSample(total)
                  return (
                    <td
                      key={colP.id}
                      className={`text-center w-8 py-1 rounded ${
                        rowP.id === colP.id ? '' : h2hCellClass(rec)
                      } ${lowSample ? 'opacity-60' : ''}`}
                      title={rec && lowSample ? `Small sample (n=${total})` : undefined}
                    >
                      {rowP.id === colP.id ? '—' : rec ? `${rec.wins}-${rec.losses}` : '·'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Session wins</p>
      <div className="mb-4">
        <Leaderboard
          rows={sessionWinRows}
          highlightTop
          renderValue={(row) => (
            <ValueWithCount count={row.sessionsPlayed}>
              {row.sessionWins} {row.sessionWins === 1 ? 'win' : 'wins'}
            </ValueWithCount>
          )}
        />
      </div>

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Overall leaderboard</p>
      <Leaderboard rows={rows} />

      <Footer />
    </div>
  )
}
