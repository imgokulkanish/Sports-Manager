// engine/statsEngine.js
import { computeMVPPoints, buildMatchPlayerStats } from './mvpEngine.js'
import { deriveInningsState, deriveMatchupStats, legalBallCountFromOvers } from './scoringEngine.js'

export const MIN_RELIABLE_MATCHES = 2 // below this, tag stats as "small sample" in the UI
export const MIN_STRIKE_RATE_RUNS = 25 // below this, a strike rate is too noisy (e.g. a 4-ball cameo) to rank
export const MIN_MVP_MATCHES = 5 // MVP average swings hard on 1-2 big games, so it needs a longer track record than other leaderboards
export const MIN_STATS_MATCHES = 5 // the Stats page's full leaderboards (unlike the Dashboard's small-sample-tagged summaries) filter everyone below this out entirely
export const MIN_MATCHUP_MATCHES = 5 // the Matchups page needs a real track record before a head-to-head means anything, not just "Stats page" consistency — kept as its own constant in case that reasoning ever diverges from MIN_STATS_MATCHES
export const MIN_MATCHUP_BALLS = 3 // below this, a matchup's strike rate is too noisy to call "toughest" or "best" — kept low so more pairs qualify while data is still thin

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function emptyStat(playerId, name) {
  return {
    playerId,
    name,
    matchesPlayed: 0,
    inningsBatted: 0,
    inningsBowled: 0,
    totalRuns: 0,
    totalBalls: 0,
    timesOut: 0,
    fours: 0,
    sixes: 0,
    highestScore: 0,
    highestScoreNotOut: false, // HS shows as "95*" on the career table
    fifties: 0,
    twentyFives: 0, // 25-49 — short-format games rarely reach 50, so 25s carry the signal 100s would elsewhere
    ducks: 0,
    catches: 0,
    stumpings: 0,
    totalOvers: 0,
    totalBallsBowled: 0,
    totalRunsConceded: 0,
    totalWickets: 0,
    maidens: 0,
    twoWicketHauls: 0, // exactly 2 wickets in an innings
    threeWicketHauls: 0, // 3+ wickets in an innings — short spells make 5-fors near impossible
    bestBowling: null, // { wickets, runs }
    motmCount: 0,
    mvpPointsHistory: [], // { matchId, date, points }
  }
}

/** Walks every completed match and builds denormalized per-player stats. */
export function computePlayerStats(matches, players) {
  const byId = {}
  for (const p of players) byId[p.id] = emptyStat(p.id, p.name)

  const completed = matches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  for (const match of completed) {
    const playedThisMatch = new Set([...(match.teamA?.playerIds || []), ...(match.teamB?.playerIds || [])])
    // Distinct from playedThisMatch — a squad member who never got a
    // batting turn (innings ended first, or they only bowled/fielded)
    // shouldn't count toward "innings batted" context.
    const battedThisMatch = new Set()
    const bowledThisMatch = new Set()
    const matchMVP = buildMatchPlayerStats(match)

    for (const innings of [match.innings1, match.innings2]) {
      if (!innings) continue
      const derived = deriveInningsState(innings)
      Object.entries(derived.batting || {}).forEach(([playerId, b]) => {
        if (!byId[playerId]) return
        const s = byId[playerId]
        s.totalRuns += b.runs || 0
        s.totalBalls += b.balls || 0
        s.fours += b.fours || 0
        s.sixes += b.sixes || 0
        // Retiring hurt isn't a dismissal (isOut stays false — see
        // scoringEngine.js) so it already can't inflate this count; it
        // shouldn't count against average, same as "not out" at the end of
        // an innings.
        if (b.isOut) s.timesOut += 1
        const runs = b.runs || 0
        // On a tie, the not-out innings wins — "34*" is the better record.
        if (runs > s.highestScore || (runs === s.highestScore && !b.isOut)) {
          s.highestScore = runs
          s.highestScoreNotOut = !b.isOut
        }
        if (runs >= 50) s.fifties += 1
        else if (runs >= 25) s.twentyFives += 1
        if (runs === 0 && b.isOut) s.ducks += 1
        battedThisMatch.add(playerId)
      })
      // Fielding credit comes off the dismissed batsman's record — the
      // fielder is only ever stored there. Quick Mode records no fielder,
      // so its catches simply don't show up here.
      Object.values(derived.batting || {}).forEach((b) => {
        const fielder = b.fielderId && byId[b.fielderId]
        if (!fielder) return
        if (b.howOut === 'caught') fielder.catches += 1
        else if (b.howOut === 'stumped') fielder.stumpings += 1
      })
      Object.entries(derived.bowling || {}).forEach(([playerId, b]) => {
        if (!byId[playerId]) return
        const s = byId[playerId]
        s.totalOvers += b.overs || 0
        // Summed per-match here (each b.overs is valid "X.Y" notation on its
        // own) rather than derived from the running totalOvers total, since
        // adding multiple "X.Y" notation values as plain decimals can carry
        // incorrectly once the balls digits add past 9 (e.g. 3.5 + 3.5 = 7.0,
        // not the true 46 balls) — legalBallCountFromOvers assumes valid
        // notation, which the aggregate no longer is once summed.
        s.totalBallsBowled += legalBallCountFromOvers(b.overs || 0)
        s.totalRunsConceded += b.runsConceded || 0
        s.totalWickets += b.wickets || 0
        s.maidens += b.maidens || 0
        if (b.wickets >= 3) s.threeWicketHauls += 1
        else if (b.wickets === 2) s.twoWicketHauls += 1
        if (!s.bestBowling || b.wickets > s.bestBowling.wickets ||
          (b.wickets === s.bestBowling.wickets && b.runsConceded < s.bestBowling.runs)) {
          if (b.wickets > 0 || !s.bestBowling) {
            s.bestBowling = { wickets: b.wickets || 0, runs: b.runsConceded || 0 }
          }
        }
        bowledThisMatch.add(playerId)
      })
    }

    playedThisMatch.forEach((playerId) => {
      if (!byId[playerId]) return
      byId[playerId].matchesPlayed += 1
      const points = computeMVPPoints(matchMVP[playerId] || {})
      byId[playerId].mvpPointsHistory.push({ matchId: match.id, date: match.date, points })
    })
    battedThisMatch.forEach((playerId) => {
      byId[playerId].inningsBatted += 1
    })
    bowledThisMatch.forEach((playerId) => {
      byId[playerId].inningsBowled += 1
    })

    if (match.manOfTheMatch && byId[match.manOfTheMatch]) {
      byId[match.manOfTheMatch].motmCount += 1
    }
  }

  return byId
}

export function battingAverage(s) {
  // No dismissals yet means the average is mathematically undefined
  // (division by zero) — show "-" rather than a misleading number, even if
  // the player has scored runs across their (all not-out) innings.
  if (!s || s.timesOut === 0) return null
  return s.totalRuns / s.timesOut
}

export function strikeRate(s) {
  if (!s || !s.totalBalls) return null
  return (s.totalRuns / s.totalBalls) * 100
}

export function bowlingAverage(s) {
  if (!s || !s.totalWickets) return null
  return s.totalRunsConceded / s.totalWickets
}

export function economyRate(s) {
  if (!s || !s.totalOvers) return null
  return s.totalRunsConceded / s.totalOvers
}

export function bowlingStrikeRate(s) {
  if (!s || !s.totalWickets) return null
  return s.totalBallsBowled / s.totalWickets
}

export function avgMVPPoints(s) {
  if (!s || !s.mvpPointsHistory.length) return 0
  return s.mvpPointsHistory.reduce((sum, h) => sum + h.points, 0) / s.mvpPointsHistory.length
}

export function totalMVPPoints(s) {
  if (!s || !s.mvpPointsHistory.length) return 0
  return s.mvpPointsHistory.reduce((sum, h) => sum + h.points, 0)
}

export function battingLeaderboard(statsById, { minMatches = 0 } = {}) {
  return Object.values(statsById)
    .filter((s) => s.matchesPlayed >= minMatches && s.totalBalls > 0)
    .map((s) => ({ ...s, average: battingAverage(s), strikeRate: strikeRate(s) }))
    .sort((a, b) => b.totalRuns - a.totalRuns)
}

export function bowlingLeaderboard(statsById, { minMatches = 0 } = {}) {
  return Object.values(statsById)
    .filter((s) => s.matchesPlayed >= minMatches && s.totalOvers > 0)
    .map((s) => ({ ...s, average: bowlingAverage(s), economy: economyRate(s) }))
    .sort((a, b) => b.totalWickets - a.totalWickets || (economyRate(a) ?? 99) - (economyRate(b) ?? 99))
}

export function mvpLeaderboard(statsById, { minMatches = 0 } = {}) {
  return Object.values(statsById)
    .filter((s) => s.matchesPlayed >= minMatches)
    .map((s) => ({ ...s, avgPoints: avgMVPPoints(s), totalPoints: totalMVPPoints(s) }))
    .sort((a, b) => b.avgPoints - a.avgPoints)
}

// Rate-based leaderboards (strike rate, average, economy) default to
// requiring MIN_RELIABLE_MATCHES — unlike the raw-total leaderboards above,
// a rate computed from a handful of balls/overs swings wildly, so a small
// sample would otherwise sit at the top rather than just get flagged.

export function strikeRateLeaderboard(statsById, { minMatches = MIN_RELIABLE_MATCHES, minRuns = MIN_STRIKE_RATE_RUNS } = {}) {
  return Object.values(statsById)
    .filter((s) => s.matchesPlayed >= minMatches && s.totalRuns >= minRuns && strikeRate(s) !== null)
    .map((s) => ({ ...s, strikeRate: strikeRate(s) }))
    .sort((a, b) => b.strikeRate - a.strikeRate)
}

export function battingAverageLeaderboard(statsById, { minMatches = MIN_RELIABLE_MATCHES } = {}) {
  return Object.values(statsById)
    .filter((s) => s.matchesPlayed >= minMatches && battingAverage(s) !== null)
    .map((s) => ({ ...s, average: battingAverage(s) }))
    .sort((a, b) => b.average - a.average)
}

export function economyLeaderboard(statsById, { minMatches = MIN_RELIABLE_MATCHES } = {}) {
  return Object.values(statsById)
    .filter((s) => s.matchesPlayed >= minMatches && economyRate(s) !== null)
    .map((s) => ({ ...s, economy: economyRate(s) }))
    .sort((a, b) => a.economy - b.economy) // ascending — lower economy is better
}

export function bowlingAverageLeaderboard(statsById, { minMatches = MIN_RELIABLE_MATCHES } = {}) {
  return Object.values(statsById)
    .filter((s) => s.matchesPlayed >= minMatches && bowlingAverage(s) !== null)
    .map((s) => ({ ...s, average: bowlingAverage(s) }))
    .sort((a, b) => a.average - b.average) // ascending — fewer runs per wicket is better
}

export function bowlingStrikeRateLeaderboard(statsById, { minMatches = MIN_RELIABLE_MATCHES } = {}) {
  return Object.values(statsById)
    .filter((s) => s.matchesPlayed >= minMatches && bowlingStrikeRate(s) !== null)
    .map((s) => ({ ...s, bowlingStrikeRate: bowlingStrikeRate(s) }))
    .sort((a, b) => a.bowlingStrikeRate - b.bowlingStrikeRate) // ascending — fewer balls per wicket is better
}

/** Where this player sits on each Stats-page leaderboard (same
 * MIN_STATS_MATCHES cut-off, so "No. 2 in economy" here matches what the
 * Stats page shows). Only podium finishes are returned, best rank first.
 * Tied values share a rank. */
export function playerHighlights(statsById, playerId, { maxRank = 3, minMatches = MIN_STATS_MATCHES } = {}) {
  const boards = [
    { label: 'runs', rows: battingLeaderboard(statsById, { minMatches }), value: (r) => r.totalRuns },
    { label: 'wickets', rows: bowlingLeaderboard(statsById, { minMatches }), value: (r) => r.totalWickets },
    { label: 'MVP average', rows: mvpLeaderboard(statsById, { minMatches }), value: (r) => r.avgPoints },
    { label: 'strike rate', rows: strikeRateLeaderboard(statsById, { minMatches }), value: (r) => r.strikeRate },
    { label: 'batting average', rows: battingAverageLeaderboard(statsById, { minMatches }), value: (r) => r.average },
    { label: 'economy', rows: economyLeaderboard(statsById, { minMatches }), value: (r) => r.economy },
    { label: 'bowling average', rows: bowlingAverageLeaderboard(statsById, { minMatches }), value: (r) => r.average },
    { label: 'bowling strike rate', rows: bowlingStrikeRateLeaderboard(statsById, { minMatches }), value: (r) => r.bowlingStrikeRate },
  ]
  const highlights = []
  for (const { label, rows, value } of boards) {
    const index = rows.findIndex((r) => r.playerId === playerId)
    if (index === -1) continue
    const mine = value(rows[index])
    // Every leaderboard is already sorted best-first, so the first row with
    // the same value is where the tie starts.
    const rank = rows.findIndex((r) => value(r) === mine) + 1
    if (rank <= maxRank) highlights.push({ label, rank })
  }
  return highlights.sort((a, b) => a.rank - b.rank)
}

export function attendanceCounts(matches, players, lastN = null) {
  const completed = matches
    .filter((m) => m.status === 'completed')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  const scoped = lastN ? completed.slice(0, lastN) : completed
  const counts = Object.fromEntries(players.map((p) => [p.id, 0]))
  scoped.forEach((m) => {
    const ids = new Set([...(m.teamA?.playerIds || []), ...(m.teamB?.playerIds || [])])
    ids.forEach((id) => {
      if (id in counts) counts[id]++
    })
  })
  return counts
}

export function filterMatchesByDays(matches, days) {
  if (!days) return matches
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return matches.filter((m) => new Date(m.date).getTime() >= cutoff)
}

/** Aggregates deriveMatchupStats() across every completed match into one
 * { [batsmanId]: { [bowlerId]: { runs, balls, wickets, strikeRate, estimated? } } }
 * matrix — same denormalize-once-then-read pattern as computePlayerStats,
 * just keyed by the batsman+bowler pair instead of the player alone. A pair
 * is flagged `estimated` if any contributing innings was Quick Mode, since
 * mixing in even one estimated innings means the combined total is no
 * longer purely exact. */
export function buildMatchupMatrix(matches) {
  const matrix = {}
  const completed = matches.filter((m) => m.status === 'completed')

  for (const match of completed) {
    for (const innings of [match.innings1, match.innings2]) {
      if (!innings) continue
      const derived = deriveMatchupStats(innings)
      Object.entries(derived).forEach(([batsmanId, byBowler]) => {
        if (!matrix[batsmanId]) matrix[batsmanId] = {}
        Object.entries(byBowler).forEach(([bowlerId, cell]) => {
          if (!matrix[batsmanId][bowlerId]) {
            matrix[batsmanId][bowlerId] = { runs: 0, balls: 0, wickets: 0, estimated: false }
          }
          const agg = matrix[batsmanId][bowlerId]
          agg.runs += cell.runs || 0
          agg.balls += cell.balls || 0
          agg.wickets += cell.wickets || 0
          if (cell.estimated) agg.estimated = true
        })
      })
    }
  }

  Object.values(matrix).forEach((byBowler) => {
    Object.values(byBowler).forEach((cell) => {
      cell.strikeRate = cell.balls > 0 ? (cell.runs / cell.balls) * 100 : null
    })
  })

  return matrix
}

// Per-player matchup insights below all read the matrix built above rather
// than re-deriving anything — buildMatchupMatrix is the single place that
// walks match data, same division of labor as computePlayerStats vs. its
// *Leaderboard functions.

// toughest/best (batting side) and stingiest/expensive (bowling side) are
// two opposite-ends-of-the-same-ranking pairs. Each needs at least 2
// qualifying opponents before returning either end — with only 1 qualifier,
// "lowest SR" and "highest SR" trivially point at the same cell, which reads
// as contradictory in the UI (e.g. a 0 SR shown as someone's "strongest"
// matchup just because it's the only one on record).
function qualifyingBowlersFor(matrix, batsmanId, minBalls) {
  const byBowler = matrix[batsmanId]
  if (!byBowler) return []
  return Object.entries(byBowler)
    .filter(([, cell]) => cell.balls >= minBalls && cell.strikeRate !== null)
    .map(([bowlerId, cell]) => ({ bowlerId, ...cell }))
}
function qualifyingBatsmenFor(matrix, bowlerId, minBalls) {
  const rows = []
  Object.entries(matrix).forEach(([batsmanId, byBowler]) => {
    const cell = byBowler[bowlerId]
    if (cell && cell.balls >= minBalls && cell.strikeRate !== null) rows.push({ batsmanId, ...cell })
  })
  return rows
}

/** Bowler this batsman has the lowest strike rate against (min balls faced,
 * min 2 qualifying bowlers — see note above). */
export function toughestMatchup(matrix, batsmanId, { minBalls = MIN_MATCHUP_BALLS } = {}) {
  const candidates = qualifyingBowlersFor(matrix, batsmanId, minBalls)
  if (candidates.length < 2) return null
  return candidates.reduce((best, row) => (row.strikeRate < best.strikeRate ? row : best))
}

/** Bowler this batsman has the highest strike rate against (min balls faced,
 * min 2 qualifying bowlers). */
export function bestMatchup(matrix, batsmanId, { minBalls = MIN_MATCHUP_BALLS } = {}) {
  const candidates = qualifyingBowlersFor(matrix, batsmanId, minBalls)
  if (candidates.length < 2) return null
  return candidates.reduce((best, row) => (row.strikeRate > best.strikeRate ? row : best))
}

/** Bowler with the most dismissals against this batsman. No minBalls — the
 * dismissal count itself is the signal, and a single wicket is still real. */
export function nemesisBowler(matrix, batsmanId) {
  const byBowler = matrix[batsmanId]
  if (!byBowler) return null
  let best = null
  Object.entries(byBowler).forEach(([bowlerId, cell]) => {
    if (!cell.wickets) return
    if (!best || cell.wickets > best.wickets) best = { bowlerId, ...cell }
  })
  return best
}

/** Batsman this bowler has dismissed most often — the mirror of
 * nemesisBowler, read off the other axis of the same matrix. */
export function favoriteWicket(matrix, bowlerId) {
  let best = null
  Object.entries(matrix).forEach(([batsmanId, byBowler]) => {
    const cell = byBowler[bowlerId]
    if (!cell || !cell.wickets) return
    if (!best || cell.wickets > best.wickets) best = { batsmanId, ...cell }
  })
  return best
}

/** Batsman with the highest strike rate against this bowler (min balls
 * faced, min 2 qualifying batsmen — this bowler's worst matchup). */
export function expensiveMatchup(matrix, bowlerId, { minBalls = MIN_MATCHUP_BALLS } = {}) {
  const candidates = qualifyingBatsmenFor(matrix, bowlerId, minBalls)
  if (candidates.length < 2) return null
  return candidates.reduce((best, row) => (row.strikeRate > best.strikeRate ? row : best))
}
