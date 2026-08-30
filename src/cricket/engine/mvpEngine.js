// engine/mvpEngine.js
//
// Simple fantasy-cricket-style scoring used to rank performances within a
// single match and suggest a Man of the Match. Thresholds are exported as
// constants so they're easy to retune after a few real matches.

import { deriveInningsState, isOpponentId } from './scoringEngine'

export const MVP_RULES = {
  RUN: 1,
  FOUR_BONUS: 3,
  SIX_BONUS: 5,
  HALF_CENTURY_THRESHOLD: 30, // box cricket overs are short; "50" doesn't map cleanly
  HALF_CENTURY_BONUS: 8,
  WICKET: 20,
  MAIDEN_BONUS: 20,
  GOOD_ECONOMY_THRESHOLD: 6,
  GOOD_ECONOMY_BONUS: 10,
  POOR_ECONOMY_THRESHOLD: 10,
  POOR_ECONOMY_PENALTY: -6,
  CATCH: 8,
  RUNOUT: 8,
  STUMPING: 10,
}

/**
 * @param {Object} p - one player's aggregated stats for a single match
 *   { runs, fours, sixes, wickets, maidens, runsConceded, oversBowled,
 *     catches, runouts, stumpings }
 * @returns {number} total MVP points for that match
 */
export function computeMVPPoints(p = {}) {
  const {
    runs = 0,
    fours = 0,
    sixes = 0,
    wickets = 0,
    maidens = 0,
    runsConceded = 0,
    oversBowled = 0,
    catches = 0,
    runouts = 0,
    stumpings = 0,
  } = p

  let points = 0
  // Batting
  points += runs * MVP_RULES.RUN
  points += fours * MVP_RULES.FOUR_BONUS
  points += sixes * MVP_RULES.SIX_BONUS
  if (runs >= MVP_RULES.HALF_CENTURY_THRESHOLD) points += MVP_RULES.HALF_CENTURY_BONUS

  // Bowling
  points += wickets * MVP_RULES.WICKET
  points += maidens * MVP_RULES.MAIDEN_BONUS
  if (oversBowled > 0) {
    const economy = runsConceded / oversBowled
    if (economy < MVP_RULES.GOOD_ECONOMY_THRESHOLD) points += MVP_RULES.GOOD_ECONOMY_BONUS
    else if (economy > MVP_RULES.POOR_ECONOMY_THRESHOLD) points += MVP_RULES.POOR_ECONOMY_PENALTY
  }

  // Fielding
  points += catches * MVP_RULES.CATCH
  points += runouts * MVP_RULES.RUNOUT
  points += stumpings * MVP_RULES.STUMPING

  return points
}

/**
 * Builds a { playerId -> match-stats } map from a completed match's two
 * innings, combining batting, bowling, and fielding contributions.
 */
export function buildMatchPlayerStats(match) {
  const stats = {}
  const ensure = (id) => {
    if (!stats[id]) {
      stats[id] = {
        runs: 0, balls: 0, fours: 0, sixes: 0,
        wickets: 0, maidens: 0, runsConceded: 0, oversBowled: 0,
        catches: 0, runouts: 0, stumpings: 0,
      }
    }
    return stats[id]
  }

  for (const innings of [match.innings1, match.innings2]) {
    if (!innings) continue
    const derived = deriveInningsState(innings)
    Object.entries(derived.batting || {}).forEach(([playerId, b]) => {
      const s = ensure(playerId)
      s.runs += b.runs || 0
      s.balls += b.balls || 0
      s.fours += b.fours || 0
      s.sixes += b.sixes || 0
    })
    Object.entries(derived.bowling || {}).forEach(([playerId, b]) => {
      const s = ensure(playerId)
      s.wickets += b.wickets || 0
      s.maidens += b.maidens || 0
      s.runsConceded += b.runsConceded || 0
      s.oversBowled += b.overs || 0
    })
    // Fielding credit, from ball-level dismissal records (Full Mode) or
    // batting.fielderId (both modes, when recorded).
    const dismissals = innings.balls?.length
      ? innings.balls.filter((b) => b.isWicket && b.fielderId)
      : Object.values(derived.batting || {}).filter((b) => b.isOut && b.fielderId)
    for (const d of dismissals) {
      // No fielding credit for the un-tracked opposition side — we hold no
      // roster for them, so there's nobody to credit.
      if (!d.fielderId || isOpponentId(d.fielderId)) continue
      const s = ensure(d.fielderId)
      if (d.wicketType === 'caught') s.catches += 1
      else if (d.wicketType === 'runout') s.runouts += 1
      else if (d.wicketType === 'stumped') s.stumpings += 1
    }
  }
  return stats
}

/**
 * @returns {{ playerId: string, points: number } | null}
 */
export function suggestMOTM(match) {
  const perPlayer = buildMatchPlayerStats(match)
  let best = null
  for (const [playerId, s] of Object.entries(perPlayer)) {
    const points = computeMVPPoints(s)
    if (!best || points > best.points) best = { playerId, points }
  }
  return best
}
