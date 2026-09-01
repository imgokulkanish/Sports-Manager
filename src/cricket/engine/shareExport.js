// engine/shareExport.js
//
// Plain-text WhatsApp-style match summary. Kept as a pure string builder
// (no clipboard/share-sheet code here) so it's trivial to unit test and
// reuse from anywhere — the UI layer decides how to hand the string off.
import { computeMatchResult, deriveInningsState } from './scoringEngine'
import { buildMatchPlayerStats } from './mvpEngine'
import { formatOversDisplay } from '../utils'

function teamNameOf(match, teamKey) {
  return (teamKey === 'A' ? match.teamA?.name : match.teamB?.name) || teamKey
}

/**
 * @returns {string} e.g.
 *   "🏏 Team A won by 11 runs. Gopi: 34(22), Ismail: 3 wkts. MOTM: Gopi 🏆"
 */
export function buildShareText(match, playersById = {}) {
  if (!match) return ''
  const name = (id) => playersById[id]?.name || 'Unknown'
  const result = computeMatchResult(match)
  const perPlayer = buildMatchPlayerStats(match)

  // Ties broken by first appearance in the ball/over log — good enough for
  // a casual result summary, not meant to be a rigorous tiebreak rule.
  let topScorer = null
  let topWicketTaker = null
  Object.entries(perPlayer).forEach(([id, s]) => {
    if (!topScorer || s.runs > topScorer.runs) topScorer = { id, runs: s.runs, balls: s.balls }
    if (!topWicketTaker || s.wickets > topWicketTaker.wickets) topWicketTaker = { id, wickets: s.wickets }
  })

  const statsParts = []
  const sameParty = topScorer && topWicketTaker && topScorer.id === topWicketTaker.id && topWicketTaker.wickets > 0
  if (topScorer && topScorer.runs > 0 && sameParty) {
    statsParts.push(`${name(topScorer.id)}: ${topScorer.runs}(${topScorer.balls}), ${topWicketTaker.wickets} wkts`)
  } else {
    if (topScorer && topScorer.runs > 0) statsParts.push(`${name(topScorer.id)}: ${topScorer.runs}(${topScorer.balls})`)
    if (topWicketTaker && topWicketTaker.wickets > 0) statsParts.push(`${name(topWicketTaker.id)}: ${topWicketTaker.wickets} wkts`)
  }

  let headline = 'No result.'
  if (result?.winner === 'tie') headline = 'Match tied.'
  else if (result?.winner === 'no-result') headline = `${result.margin}.`
  else if (result?.winner) headline = `${teamNameOf(match, result.winner)} won by ${result.margin.replace(/^won by /, '')}.`

  const statsText = statsParts.length ? ` ${statsParts.join(', ')}.` : ''
  const motmText = match.manOfTheMatch ? ` MOTM: ${name(match.manOfTheMatch)} 🏆` : ''

  return `🏏 ${headline}${statsText}${motmText}`
}

// ---------------------------------------------------------------------------
// Full scorecard, for the WhatsApp button on the match page. `buildShareText`
// above stays a one-liner for list views and the OS share sheet; this is the
// message that replaces screenshotting the scorecard, so it carries the same
// content the page shows in the same order.
// ---------------------------------------------------------------------------

// WhatsApp renders *asterisks* as bold and nothing else — no headings, no
// tables — so every figure below has to read correctly as plain text.
function inningsShareLines(match, innings, playersById) {
  const derived = deriveInningsState(innings)
  const name = (id) => playersById[id]?.name || id
  const lines = []

  lines.push(
    `*${teamNameOf(match, innings.battingTeam)}* ${derived.totalRuns}/${derived.totalWickets} (${formatOversDisplay(derived.oversBowled)} ov)`,
  )
  // Quick mode splits an over's runs across whoever was at the crease, so the
  // per-batsman figures are estimates. Saying so travels with the numbers.
  if (innings.scoringMode === 'quick') lines.push('_(quick mode — batting figures estimated)_')

  const batting = Object.entries(derived.batting).sort((a, b) => b[1].runs - a[1].runs)
  // Empty in a tournament match when the opposition batted: their individual
  // figures are never recorded, so the team total is the whole story.
  if (batting.length) {
    lines.push(
      `🏏 ${batting
        .map(([id, b]) => {
          const boundaries = [b.fours ? `${b.fours}x4` : '', b.sixes ? `${b.sixes}x6` : ''].filter(Boolean).join(' ')
          return `${name(id)} ${b.runs}${b.isOut ? '' : '*'} (${b.balls}${boundaries ? `, ${boundaries}` : ''})`
        })
        .join(', ')}`,
    )
  }

  const bowling = Object.entries(derived.bowling).sort((a, b) => b[1].wickets - a[1].wickets)
  if (bowling.length) {
    lines.push(
      `⚾ ${bowling
        .map(([id, b]) => `${name(id)} ${formatOversDisplay(b.overs)}-${b.maidens}-${b.runsConceded}-${b.wickets}`)
        .join(', ')}`,
    )
  }

  return lines
}

/**
 * Whole-match summary: heading, result, MOTM, and both innings with batting
 * and bowling figures. Mirrors pages/MatchDetail.jsx so the message and the
 * screen can't disagree. A not-out batsman is marked with a trailing `*`,
 * the way a printed scorecard does it.
 *
 * @returns {string}
 */
export function buildScorecardShareText(match, playersById = {}) {
  if (!match) return ''
  const name = (id) => playersById[id]?.name || id
  const lines = []

  lines.push(`🏏 *${match.teamA?.name || 'Team A'} vs ${match.teamB?.name || 'Team B'}*`)

  const meta = []
  if (match.isTournament) meta.push(match.tournamentStage || 'Tournament')
  meta.push(
    new Date(match.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
  )
  if (match.venue) meta.push(match.venue)
  if (match.toss?.wonBy) meta.push(`Toss: ${teamNameOf(match, match.toss.wonBy)} chose to ${match.toss.decision}`)
  lines.push(meta.join(' · '))
  lines.push('')

  const result = match.result || computeMatchResult(match)
  if (match.status === 'completed' && result) {
    if (result.winner === 'tie') lines.push('🏆 *Match tied*')
    else if (result.winner === 'no-result') lines.push(`*${result.margin}*`)
    else lines.push(`🏆 *${teamNameOf(match, result.winner)} ${result.margin}*`)
    if (match.manOfTheMatch) lines.push(`MOTM: ${name(match.manOfTheMatch)} 🌟`)
  } else {
    lines.push('_In progress_')
  }

  ;[match.innings1, match.innings2].forEach((innings) => {
    if (!innings) return
    lines.push('')
    lines.push(...inningsShareLines(match, innings, playersById))
  })

  return lines.join('\n')
}
