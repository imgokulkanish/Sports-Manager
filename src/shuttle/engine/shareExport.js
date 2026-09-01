// engine/shareExport.js
//
// Plain-text session summary, shaped for pasting into a WhatsApp group.
// Kept as a pure string builder (no share-sheet or clipboard code here) so
// the UI layer decides how to hand the string off, and so the wording can be
// checked without a browser. WhatsApp renders *asterisks* as bold, which is
// the only markup it understands — no headings, no tables, so the board is
// laid out as plain lines that survive its aggressive whitespace collapsing.
import { sessionLeaderboard, sessionMVP, sessionWinnerId, isQuickPlay, formatDiff } from './statsEngine'
import { groupBySlot } from './scheduleEngine'
import { withGuests } from './guests'

const MEDALS = ['🥇', '🥈', '🥉']

function dateLabel(date) {
  return new Date(date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * One-line-per-player session summary for sharing.
 *
 * Mirrors what SessionDetail renders — same ranking, same guest labelling,
 * same money split — so the message and the screen can't disagree. Works on a
 * session that is still running too: it just says so instead of crowning
 * anyone. `players` is the players collection; quick-play guests are named on
 * the session document and get folded in here (see engine/guests.js).
 *
 * @returns {string}
 */
export function buildSessionShareText(session, players = []) {
  if (!session) return ''
  const playersById = withGuests(Object.fromEntries(players.map((p) => [p.id, p])), session)
  const nameOf = (id) => playersById[id]?.name || id

  const board = sessionLeaderboard(session)
  const totalMatches = session.schedule?.length || 0
  const rounds = groupBySlot(session.schedule || []).length
  const winnerId = sessionWinnerId(session)
  const mvp = sessionMVP(session)
  const quick = isQuickPlay(session)

  const lines = []
  lines.push(`🏸 *Badminton — ${dateLabel(session.date)}*`)

  const guestCount = session.guestIds?.length || 0
  const meta = [
    `${session.playerIds?.length || 0} players${guestCount ? ` + ${guestCount} guest${guestCount > 1 ? 's' : ''}` : ''}`,
    `${rounds} round${rounds === 1 ? '' : 's'}`,
  ]
  if (!quick && session.umpire) meta.push(`Umpire: ${session.umpire}`)
  lines.push(meta.join(' · '))
  lines.push('')

  if (session.status === 'completed' && winnerId) lines.push(`🏆 *${nameOf(winnerId)} wins!*`)
  else if (winnerId) lines.push(`Leading: *${nameOf(winnerId)}* (in progress)`)
  else lines.push('No results yet.')
  lines.push('')

  // Guests sort last and are numbered '–' rather than given a place, the same
  // as on screen: a drop-in's two wins shouldn't read as beating the field.
  let place = 0
  board.forEach((row) => {
    const badges = []
    if (row.deciderWon) badges.push('(decider)')
    if (mvp?.playerId === row.playerId) badges.push('MVP')
    const suffix = badges.length ? ` ${badges.join(' ')}` : ''
    if (row.guest) {
      lines.push(
        `– ${nameOf(row.playerId)} (guest, played ${row.matches} of ${totalMatches}) — ${row.pts} pts · ${row.wins}W ${row.losses}L · ${formatDiff(row.diff)}`,
      )
    } else {
      place += 1
      const rank = MEDALS[place - 1] || `${place}.`
      lines.push(
        `${rank} ${nameOf(row.playerId)} — ${row.pts} pts · ${row.wins}W ${row.losses}L · ${formatDiff(row.diff)}${suffix}`,
      )
    }
  })

  // Quick play books no court of its own, so there is nothing to split.
  if (!quick) {
    const total = (session.courtCost || 0) + (session.waterCost || 0)
    if (total > 0) {
      const perPerson = session.playerIds?.length ? total / session.playerIds.length : 0
      lines.push('')
      lines.push(`💰 SAR ${total.toFixed(2)} total · *SAR ${perPerson.toFixed(2)} / person*`)
    }
  }

  return lines.join('\n')
}

/**
 * Match-by-match list, for when the group wants the scores rather than the
 * standings. Appended to the summary by the share button's "with match log"
 * path; unplayed rounds are left off so a half-finished session reads cleanly.
 */
export function buildScheduleShareText(session, players = []) {
  if (!session) return ''
  const playersById = withGuests(Object.fromEntries(players.map((p) => [p.id, p])), session)
  const nameOf = (id) => playersById[id]?.name || id
  const side = (team = []) => team.map(nameOf).join(' & ')

  const lines = ['', '*Match log*']
  groupBySlot(session.schedule || []).forEach(({ slot, matches }) => {
    matches.forEach(({ index, match, court }) => {
      const entry = session.scores?.[index]
      const label = matches.length > 1 ? `R${slot + 1}C${court}` : `R${slot + 1}`
      if (!entry?.winner) {
        lines.push(`${label}: ${side(match.team1)} vs ${side(match.team2)} — not played`)
        return
      }
      const p1 = entry.points?.team1
      const p2 = entry.points?.team2
      const score = p1 != null && p2 != null ? ` ${p1}–${p2}` : ''
      const win = entry.winner === 1 ? match.team1 : match.team2
      lines.push(`${label}: ${side(match.team1)} vs ${side(match.team2)}${score} → ${side(win)} ✅`)
    })
  })
  return lines.join('\n')
}
