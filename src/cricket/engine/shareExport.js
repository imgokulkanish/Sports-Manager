// engine/shareExport.js
//
// Plain-text WhatsApp-style match summary. Kept as a pure string builder
// (no clipboard/share-sheet code here) so it's trivial to unit test and
// reuse from anywhere — the UI layer decides how to hand the string off.
import { computeMatchResult } from './scoringEngine'
import { buildMatchPlayerStats } from './mvpEngine'

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
