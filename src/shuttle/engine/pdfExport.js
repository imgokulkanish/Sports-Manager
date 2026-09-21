// engine/pdfExport.js
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { computePlayerStats, leaderboard, sessionLeaderboard, sessionWinnerId, formatDiff } from './statsEngine'
import { orderedMatches } from './scheduleEngine'
import { withGuests } from './guests'

const BRAND = [31, 111, 74] // #1F6F4A

// A "round" is a block of time; on a two-court round it holds two matches.
// Counts a pre-multi-court schedule (no `slot` field) as one round per match.
function roundCount(schedule = []) {
  if (!schedule.length) return 0
  return new Set(schedule.map((round, i) => round.slot ?? i)).size
}

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

function nameOf(playersById, id) {
  return playersById[id]?.name || id
}

// A drop-in who played a couple of matches is named with what they actually
// turned up for, so a 2-0 record on the sheet can't be read as a full session.
function nameWithGuestNote(playersById, row, totalMatches) {
  const name = nameOf(playersById, row.playerId)
  return row.guest ? `${name} (guest, played ${row.matches}/${totalMatches})` : name
}

/** Substitutions made mid-session, as table rows. Empty when there were none. */
function substitutionRows(session, playersById) {
  return (session.substitutions || []).map((sub) => [
    (sub.slot ?? sub.matchIndex) + 1,
    nameOf(playersById, sub.outId),
    nameOf(playersById, sub.inId),
  ])
}

export function exportSchedulePDF(session, players) {
  // Quick-play guests are named on the session document rather than in the
  // players collection, so the lookup has to come from both. See engine/guests.js.
  const playersById = withGuests(Object.fromEntries(players.map((p) => [p.id, p])), session)
  const doc = new jsPDF()
  const dateStr = new Date(session.date).toLocaleDateString()
  addHeader(doc, 'Badminton Match Schedule', [dateStr, `Umpire: ${session.umpire || '—'}`])

  const perPerson = session.playerIds?.length
    ? (session.courtCost + session.waterCost) / session.playerIds.length
    : 0

  autoTable(doc, {
    startY: 34,
    head: [['Cost item', 'Amount (SAR)']],
    body: [
      ['Court cost', session.courtCost?.toFixed(2) ?? '0.00'],
      ['Water cost', session.waterCost?.toFixed(2) ?? '0.00'],
      ['Total', ((session.courtCost || 0) + (session.waterCost || 0)).toFixed(2)],
      ['Per person', perPerson.toFixed(2)],
    ],
    theme: 'striped',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 9 },
  })

  // Rows are numbered by time slot, so the two matches of a two-court round
  // both read as that round, distinguished by the Court column.
  const multiCourt = (session.schedule || []).some((round) => (round.court ?? 1) > 1)
  const scheduleRows = orderedMatches(session.schedule || []).map(({ match: round, slot, court }) => [
    slot + 1,
    ...(multiCourt ? [court] : []),
    round.team1.map((id) => nameOf(playersById, id)).join(' & '),
    round.team2.map((id) => nameOf(playersById, id)).join(' & '),
    round.resting.map((id) => nameOf(playersById, id)).join(', ') || '—',
  ])

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [[ 'Rd', ...(multiCourt ? ['Ct'] : []), 'Team 1', 'Team 2', 'Resting']],
    body: scheduleRows,
    theme: 'grid',
    headStyles: { fillColor: BRAND },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    styles: { fontSize: 8 },
  })

  // Partner summary: who each player partnered, in order
  const partnerLog = {}
  ;[...(session.playerIds || []), ...(session.guestIds || [])].forEach((id) => (partnerLog[id] = []))
  ;(session.schedule || []).forEach((round) => {
    // Only true doubles: singles has no partner to log (pairing someone with
    // `undefined` would print a blank name), and the pair in a 2 vs 1 isn't a
    // partnership either.
    if (round.team1.length !== 2 || round.team2.length !== 2) return
    ;[round.team1, round.team2].forEach((team) => {
      const [x, y] = team
      if (partnerLog[x]) partnerLog[x].push(nameOf(playersById, y))
      if (partnerLog[y]) partnerLog[y].push(nameOf(playersById, x))
    })
  })

  const partnerRows = Object.entries(partnerLog).map(([id, partners]) => [
    nameOf(playersById, id),
    partners.join(' → ') || '—',
    partners.length,
  ])

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [['Player', 'Partners in order', 'Matches']],
    body: partnerRows,
    theme: 'striped',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 8 },
  })

  doc.save(`schedule-${dateStr.replace(/\//g, '-')}.pdf`)
}

export function exportResultsPDF(session, players) {
  // Quick-play guests are named on the session document rather than in the
  // players collection, so the lookup has to come from both. See engine/guests.js.
  const playersById = withGuests(Object.fromEntries(players.map((p) => [p.id, p])), session)
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const dateStr = new Date(session.date).toLocaleDateString()
  addHeader(doc, 'Session Results', [
    dateStr,
    `${session.playerIds?.length || 0} players`,
    `${roundCount(session.schedule)} rounds`,
    `Umpire: ${session.umpire || '—'}`,
  ])

  const multiCourt = (session.schedule || []).some((round) => (round.court ?? 1) > 1)
  const matchRows = orderedMatches(session.schedule || []).map(({ index: i, match: round, slot, court }) => {
    const winner = session.scores?.[i]?.winner
    const points = session.scores?.[i]?.points
    return [
      slot + 1,
      ...(multiCourt ? [court] : []),
      round.team1.map((id) => nameOf(playersById, id)).join(' & '),
      round.team2.map((id) => nameOf(playersById, id)).join(' & '),
      winner ? `Team ${winner}` : '—',
      points ? `${points.team1}-${points.team2}` : '—',
    ]
  })

  // Final leaderboard for this session — the same tally the app's screens
  // rank by, so the sheet and the phone never disagree. Guests come last and
  // are named with how many matches they actually turned up for.
  const totalMatches = session.schedule?.length || 0
  const board = sessionLeaderboard(session)
  const winnerId = sessionWinnerId(session)

  let nextY = 34
  if (winnerId) {
    doc.setFillColor(225, 245, 236)
    doc.roundedRect(14, nextY, pageWidth - 28, 14, 2, 2, 'F')
    doc.setTextColor(...BRAND)
    doc.setFontSize(12)
    doc.text(`Winner: ${nameOf(playersById, winnerId)}`, pageWidth / 2, nextY + 9, { align: 'center' })
    doc.setTextColor(20, 20, 20)
    nextY += 14 + 6
  }

  autoTable(doc, {
    startY: nextY,
    head: [['Rd', ...(multiCourt ? ['Ct'] : []), 'Team 1', 'Team 2', 'Winner', 'Score']],
    body: matchRows,
    theme: 'grid',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 8 },
  })

  const leaderboardRows = board.map((row, i) => [
    row.guest ? '—' : i + 1,
    nameWithGuestNote(playersById, row, totalMatches),
    row.wins,
    row.losses,
    row.pts,
    formatDiff(row.diff),
  ])

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [['Rank', 'Player', 'W', 'L', 'Pts', 'Diff']],
    body: leaderboardRows,
    theme: 'striped',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 9 },
  })

  // The tiebreaker, when the top two finished level on match points.
  if (session.decider?.winnerId) {
    const loserId = (session.decider.players || []).find((id) => id !== session.decider.winnerId)
    const score = session.decider.points
      ? ` ${Math.max(...session.decider.points)}-${Math.min(...session.decider.points)}`
      : ''
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Singles decider (level on points)']],
      body: [[`${nameOf(playersById, session.decider.winnerId)} beat ${nameOf(playersById, loserId)}${score}`]],
      theme: 'striped',
      headStyles: { fillColor: BRAND },
      styles: { fontSize: 9 },
    })
  }

  // Why the sheet may not match the schedule that was printed at the start.
  const subRows = substitutionRows(session, playersById)
  if (subRows.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Rd', 'Off court', 'Came on']],
      body: subRows,
      theme: 'striped',
      headStyles: { fillColor: BRAND },
      styles: { fontSize: 8 },
    })
  }

  doc.save(`results-${dateStr.replace(/\//g, '-')}.pdf`)
}

/**
 * Multi-session summary PDF for a date range (e.g. the Stats page's
 * 30/90/180/all-time filter): overall leaderboard for the period, total
 * sessions/cost, and a per-session breakdown of who won each day.
 */
export function exportPeriodSummaryPDF(sessions, players, { label = 'All time' } = {}) {
  // Every session in the period contributes its own guests to the lookup -
  // the ids are unique across documents, so they can share one map.
  const playersById = (sessions || []).reduce(
    (byId, session) => withGuests(byId, session),
    Object.fromEntries(players.map((p) => [p.id, p])),
  )
  const completed = (sessions || []).filter((s) => s.status === 'completed')
  const doc = new jsPDF()
  addHeader(doc, 'Period Summary', [label, `${completed.length} session${completed.length === 1 ? '' : 's'}`])

  const totalCost = completed.reduce((sum, s) => sum + (s.courtCost || 0) + (s.waterCost || 0), 0)

  autoTable(doc, {
    startY: 34,
    head: [['Metric', 'Value']],
    body: [
      ['Sessions', completed.length],
      ['Total cost (SAR)', totalCost.toFixed(2)],
      ['Avg cost / session (SAR)', completed.length ? (totalCost / completed.length).toFixed(2) : '0.00'],
    ],
    theme: 'striped',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 9 },
  })

  const statsById = computePlayerStats(completed, players)
  const boardRows = leaderboard(statsById).map((r, i) => [
    i + 1,
    r.name,
    r.totalMatches,
    r.totalWins,
    r.totalMatches ? `${Math.round(r.winRate * 100)}%` : '—',
  ])

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [['Rank', 'Player', 'Matches', 'Wins', 'Win %']],
    body: boardRows,
    theme: 'grid',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 8 },
  })

  const sessionRows = completed
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((s) => {
      const winnerId = sessionWinnerId(s)
      return [
        new Date(s.date).toLocaleDateString(),
        s.playerIds?.length || 0,
        winnerId ? nameOf(playersById, winnerId) : '—',
      ]
    })

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [['Date', 'Players', 'Winner of the day']],
    body: sessionRows,
    theme: 'striped',
    headStyles: { fillColor: BRAND },
    styles: { fontSize: 8 },
  })

  const fileLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  doc.save(`period-summary-${fileLabel}.pdf`)
}

export function exportSessionCSV(session, players) {
  const playersById = withGuests(Object.fromEntries(players.map((p) => [p.id, p])), session)
  const members = new Set(session.playerIds || [])
  // A guest's name is marked in the CSV too, so a spreadsheet pivot doesn't
  // silently treat their two matches as a full session's attendance.
  const csvName = (id) => (members.has(id) ? nameOf(playersById, id) : `${nameOf(playersById, id)} (guest)`)
  const header = ['round', 'team1_p1', 'team1_p2', 'team2_p1', 'team2_p2', 'winner', 'score']
  const rows = orderedMatches(session.schedule || []).map(({ index: i, match: round, slot }) => {
    const winner = session.scores?.[i]?.winner
    const points = session.scores?.[i]?.points
    return [
      slot + 1,
      csvName(round.team1[0]),
      round.team1[1] ? csvName(round.team1[1]) : '',
      csvName(round.team2[0]),
      round.team2[1] ? csvName(round.team2[1]) : '',
      winner ? `Team ${winner}` : '',
      points ? `${points.team1}-${points.team2}` : '',
    ]
  })
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStr = new Date(session.date).toLocaleDateString().replace(/\//g, '-')
  link.href = url
  link.download = `session-${dateStr}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
