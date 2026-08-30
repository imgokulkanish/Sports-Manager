// engine/pdfExport.js
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { deriveInningsState, matchResultHeadline } from './scoringEngine'
import { formatOversDisplay } from '../utils'
import {
  battingLeaderboard,
  bowlingLeaderboard,
  mvpLeaderboard,
  strikeRateLeaderboard,
  battingAverageLeaderboard,
  bowlingAverageLeaderboard,
  bowlingStrikeRateLeaderboard,
  economyLeaderboard,
  battingAverage,
  strikeRate,
  economyRate,
  totalMVPPoints,
  MIN_STATS_MATCHES,
  MIN_MVP_MATCHES,
} from './statsEngine'

const BRAND = [15, 122, 107] // #0F7A6B

function addHeader(doc, title, subtitleLines = []) {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, pageWidth, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.text(title, 14, 13)
  doc.setFontSize(9)
  doc.text(subtitleLines.join('   ·   '), 14, 21)
  doc.text('GK', pageWidth - 14, 10, { align: 'right' })
  doc.setTextColor(20, 20, 20)
}

/**
 * @param {number} [contentEndY] - Y position right after the last drawn
 *   content, so the credit line sits just below it instead of pinned to the
 *   bottom of the page (which leaves a large gap on short documents).
 *   Clamped to the page bottom so it never runs off on longer documents.
 */
function addFooter(doc, contentEndY) {
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageCount = doc.internal.getNumberOfPages()
  doc.setPage(pageCount)
  const y = contentEndY != null ? Math.min(contentEndY + 12, pageHeight - 8) : pageHeight - 8
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text('Cricket Manager — A Gokul Kanish Product', pageWidth / 2, y, { align: 'center' })
}

function inningsTables(doc, innings, playersById, label, startY) {
  const derived = deriveInningsState(innings)
  const name = (id) => playersById[id]?.name || id

  doc.setFontSize(11)
  doc.setTextColor(20, 20, 20)
  doc.text(`${label}: ${derived.totalRuns}/${derived.totalWickets} (${formatOversDisplay(derived.oversBowled)} ov)`, 14, startY)

  const battingRows = Object.entries(derived.batting)
    .sort((a, b) => b[1].runs - a[1].runs)
    .map(([id, b]) => [name(id), b.isOut ? (b.howOut === 'retired' ? 'retired out' : b.howOut || 'out') : 'not out', b.runs, b.balls, b.fours, b.sixes])

  autoTable(doc, {
    startY: startY + 4,
    head: [['Batsman', 'Dismissal', 'R', 'B', '4s', '6s']],
    body: battingRows,
    theme: 'striped',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 8 },
  })

  const bowlingRows = Object.entries(derived.bowling)
    .sort((a, b) => b[1].wickets - a[1].wickets)
    .map(([id, b]) => [name(id), formatOversDisplay(b.overs), b.maidens, b.runsConceded, b.wickets, b.overs > 0 ? (b.runsConceded / b.overs).toFixed(1) : '-'])

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Bowler', 'O', 'M', 'R', 'W', 'Econ']],
    body: bowlingRows,
    theme: 'striped',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 8 },
  })

  return doc.lastAutoTable.finalY
}

export function exportScorecardPDF(match, players) {
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]))
  const doc = new jsPDF()
  const dateStr = new Date(match.date).toLocaleDateString()
  const name = (id) => playersById[id]?.name || ''
  addHeader(doc, 'Match Scorecard', [dateStr, match.venue || '', `Toss: Team ${match.toss?.wonBy} chose to ${match.toss?.decision}`])

  let y = 36
  if (match.teamA?.umpireId || match.teamB?.umpireId) {
    doc.setFontSize(9)
    doc.setTextColor(90, 90, 90)
    doc.text(
      `Umpires: ${name(match.teamA?.umpireId) || '—'} (${match.teamA?.name || 'Team A'})   ·   ${name(match.teamB?.umpireId) || '—'} (${match.teamB?.name || 'Team B'})`,
      14,
      y,
    )
    y += 8
  }
  if (match.innings1) y = inningsTables(doc, match.innings1, playersById, `Team ${match.innings1.battingTeam}`, y) + 10
  if (match.innings2) y = inningsTables(doc, match.innings2, playersById, `Team ${match.innings2.battingTeam}`, y) + 10

  let contentEndY = y
  if (match.result) {
    doc.setFontSize(11)
    doc.setTextColor(15, 122, 107)
    doc.text(`Result: ${match.result.margin || ''}`, 14, y)
    contentEndY = y
    if (match.manOfTheMatch) {
      doc.text(`Man of the Match: ${playersById[match.manOfTheMatch]?.name || ''}`, 14, y + 7)
      contentEndY = y + 7
    }
  }

  addFooter(doc, contentEndY)
  doc.save(`scorecard-${dateStr.replace(/\//g, '-')}.pdf`)
}

export function exportBallByBallCSV(match) {
  const rows = []
  ;[match.innings1, match.innings2].forEach((innings, idx) => {
    if (!innings) return
    if (innings.scoringMode === 'quick') {
      ;(innings.overs || []).forEach((o) => {
        rows.push([idx + 1, o.over, '', o.bowlerId, '', o.runsConceded, '', o.wickets])
      })
    } else {
      ;(innings.balls || []).forEach((b) => {
        rows.push([idx + 1, b.over, b.ballInOver, b.bowlerId, b.batsmanId, b.runs, b.extraType || '', b.isWicket ? 1 : 0])
      })
    }
  })
  const header = ['innings', 'over', 'ball', 'bowler', 'batsman', 'runs', 'extra', 'wicket']
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStr = new Date(match.date).toLocaleDateString().replace(/\//g, '-')
  link.href = url
  link.download = `match-${dateStr}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * One-tournament summary PDF: the rounds played, then EVERY player who
 * turned out — not a top-N cut. Unlike exportPeriodSummaryPDF below, there's
 * no min-matches fairness filter: a tournament is a handful of rounds on one
 * day, so filtering by track record would empty the page. Sorted by runs
 * then wickets so the biggest contributors sit at the top anyway.
 *
 * @param {Object} tournament - { name, date }
 * @param {Array} matches - this tournament's matches only
 * @param {Array} players
 * @param {Object} statsById - computePlayerStats over those same matches
 */
export function exportTournamentSummaryPDF(tournament, matches, players, statsById) {
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]))
  // Landscape for the same reason as exportPeriodSummaryPDF: the per-player
  // table below is 13 columns wide (batting and bowling side by side), and
  // the rounds table's result line ("X 47/1 beat Y 43/0 by 4 runs") wraps
  // badly in portrait's ~180mm.
  const doc = new jsPDF({ orientation: 'landscape' })
  const dateStr = new Date(tournament.date).toLocaleDateString()
  const completed = matches.filter((m) => m.status === 'completed')
  const won = completed.filter((m) => m.result?.winner === 'A').length

  addHeader(doc, tournament.name || 'Tournament', [
    dateStr,
    `${matches.length} round${matches.length === 1 ? '' : 's'}`,
    `${won} of ${completed.length} won`,
  ])

  // Rounds played, in playing order.
  const roundRows = matches.map((m) => [
    m.tournamentStage || 'Round',
    m.opponentName || m.teamB?.name || '—',
    m.status === 'completed' ? matchResultHeadline(m) || '—' : m.status === 'live' ? 'In progress' : 'Not started',
    m.manOfTheMatch ? playersById[m.manOfTheMatch]?.name || '' : '—',
  ])

  doc.setFontSize(10)
  doc.setTextColor(20, 20, 20)
  doc.text('Rounds', 14, 36)
  autoTable(doc, {
    startY: 39,
    head: [['Stage', 'Opponent', 'Result', 'MOTM']],
    body: roundRows.length ? roundRows : [['—', '—', 'No rounds played yet', '—']],
    theme: 'grid',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 7.5, cellPadding: 1.5 },
  })

  // Everyone who played, batting and bowling side by side.
  const num = (v, digits = 1) => (v === null || v === undefined ? '-' : v.toFixed(digits))
  const playerRows = Object.values(statsById)
    .filter((s) => s.matchesPlayed > 0)
    .sort((a, b) => b.totalRuns - a.totalRuns || b.totalWickets - a.totalWickets)
    .map((s, i) => [
      i + 1,
      s.name,
      s.matchesPlayed,
      s.totalRuns,
      s.totalBalls,
      num(strikeRate(s), 0),
      num(battingAverage(s)),
      s.highestScore,
      formatOversDisplay(s.totalOvers),
      s.totalRunsConceded,
      s.totalWickets,
      num(economyRate(s)),
      totalMVPPoints(s),
    ])

  doc.setFontSize(10)
  doc.setTextColor(20, 20, 20)
  doc.text('All players who played', 14, doc.lastAutoTable.finalY + 10)
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 13,
    head: [['#', 'Player', 'M', 'Runs', 'Balls', 'SR', 'Avg', 'HS', 'Ov', 'RC', 'Wkts', 'Econ', 'MVP']],
    body: playerRows.length ? playerRows : [['—', 'No completed rounds yet', '', '', '', '', '', '', '', '', '', '', '']],
    theme: 'striped',
    headStyles: { fillColor: BRAND, fontSize: 7.5 },
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 38 } },
  })

  addFooter(doc, doc.lastAutoTable.finalY)
  doc.save(`tournament-${(tournament.name || 'summary').replace(/\s+/g, '-').toLowerCase()}-${dateStr.replace(/\//g, '-')}.pdf`)
}

/** Season/period summary PDF across multiple completed matches. */
export function exportPeriodSummaryPDF(matches, players, statsById, { label } = {}) {
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]))
  // Landscape — the top-performers table now has 9 columns (MVP through
  // BowlSR), which wrapped every cell onto multiple lines in portrait's
  // ~180mm content width. Landscape's ~280mm gives each column enough room
  // to hold a "Name (xx.x stat)" cell on one line.
  const doc = new jsPDF({ orientation: 'landscape' })
  addHeader(doc, 'Period Summary', [label || 'All time', `${matches.length} matches`])

  // Top 5 per category — same min-matches fairness filter as the Dashboard
  // (MIN_STATS_MATCHES), so one big innings/spell can't headline the
  // season summary. MVP uses its own bar (MIN_MVP_MATCHES) since its
  // average swings harder on a single big game than the other rate stats.
  // Pure presentation over the existing leaderboard functions, no new stats
  // logic.
  const top5Cells = (rows, fmt) => {
    const cells = rows.slice(0, 5).map((r) => `${r.name} (${fmt(r)})`)
    while (cells.length < 5) cells.push('—')
    return cells
  }
  const opts = { minMatches: MIN_STATS_MATCHES }
  const mvpTop5 = top5Cells(mvpLeaderboard(statsById, { minMatches: MIN_MVP_MATCHES }), (r) => `${r.avgPoints.toFixed(0)} pts`)
  const runsTop5 = top5Cells(battingLeaderboard(statsById, opts), (r) => `${r.totalRuns} runs`)
  const wicketsTop5 = top5Cells(bowlingLeaderboard(statsById, opts), (r) => `${r.totalWickets} wkts`)
  const economyTop5 = top5Cells(economyLeaderboard(statsById, opts), (r) => `${r.economy.toFixed(1)} econ`)
  const srTop5 = top5Cells(strikeRateLeaderboard(statsById, opts), (r) => `${r.strikeRate.toFixed(0)} SR`)
  const avgTop5 = top5Cells(battingAverageLeaderboard(statsById, opts), (r) => `${r.average.toFixed(1)} avg`)
  const bowlAvgTop5 = top5Cells(bowlingAverageLeaderboard(statsById, opts), (r) => `${r.average.toFixed(1)} avg`)
  const bowlSrTop5 = top5Cells(bowlingStrikeRateLeaderboard(statsById, opts), (r) => `${r.bowlingStrikeRate.toFixed(1)} SR`)

  doc.setFontSize(10)
  doc.setTextColor(20, 20, 20)
  doc.text(`Top performers (min ${MIN_STATS_MATCHES} matches, MVP min ${MIN_MVP_MATCHES})`, 14, 34)

  autoTable(doc, {
    startY: 37,
    head: [['#', 'MVP', 'Runs', 'Wkts', 'Econ', 'SR', 'Avg', 'BowlAvg', 'BowlSR']],
    body: [0, 1, 2, 3, 4].map((i) => [
      i + 1,
      mvpTop5[i],
      runsTop5[i],
      wicketsTop5[i],
      economyTop5[i],
      srTop5[i],
      avgTop5[i],
      bowlAvgTop5[i],
      bowlSrTop5[i],
    ]),
    theme: 'grid',
    headStyles: { fillColor: BRAND, fontSize: 7 },
    styles: { fontSize: 6.5, cellPadding: 1.5 },
    columnStyles: { 0: { cellWidth: 6 } },
  })

  const battingRows = battingLeaderboard(statsById)
    .slice(0, 10)
    .map((s, i) => [i + 1, s.name, s.matchesPlayed, s.totalRuns, s.average !== null ? s.average.toFixed(1) : '-', s.strikeRate !== null ? s.strikeRate.toFixed(0) : '-'])

  doc.setFontSize(10)
  doc.setTextColor(20, 20, 20)
  doc.text('Batting', 14, doc.lastAutoTable.finalY + 10)

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 13,
    head: [['#', 'Player', 'M', 'Runs', 'Avg', 'SR']],
    body: battingRows,
    theme: 'striped',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 8 },
  })

  const bowlingRows = bowlingLeaderboard(statsById)
    .slice(0, 10)
    .map((s, i) => [i + 1, s.name, s.matchesPlayed, s.totalWickets, s.average !== null ? s.average.toFixed(1) : '-', s.economy !== null ? s.economy.toFixed(1) : '-'])

  doc.setFontSize(10)
  doc.setTextColor(20, 20, 20)
  doc.text('Bowling', 14, doc.lastAutoTable.finalY + 10)

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 13,
    head: [['#', 'Player', 'M', 'Wkts', 'Avg', 'Econ']],
    body: bowlingRows,
    theme: 'striped',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 8 },
  })

  const matchRows = matches
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((m) => [
      new Date(m.date).toLocaleDateString(),
      `${m.teamA?.name || 'Team A'} vs ${m.teamB?.name || 'Team B'}`,
      m.result?.margin || '—',
      m.manOfTheMatch ? playersById[m.manOfTheMatch]?.name || '' : '—',
    ])

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [['Date', 'Match', 'Result', 'MOTM']],
    body: matchRows,
    theme: 'grid',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 8 },
  })

  addFooter(doc, doc.lastAutoTable.finalY)
  doc.save(`period-summary-${(label || 'all-time').replace(/\s+/g, '-').toLowerCase()}.pdf`)
}
