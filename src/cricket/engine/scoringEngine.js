// engine/scoringEngine.js
//
// Turns a raw ball log (Full Mode) or over-summary log (Quick Mode) into
// derived innings state: totals, per-player batting/bowling figures, and
// batting partnerships. Both modes produce the same shape of output so the
// rest of the app (stats engine, scorecards, PDF export) doesn't need to
// know which mode a given match used.
//
// DESIGN NOTE — why derive from a log instead of mutating state incrementally:
// Recomputing from the full ball/over log on every read (rather than
// maintaining running totals that get mutated per tap) makes "Undo last
// ball" trivial and bug-resistant — it's just "drop the last entry and
// recompute" rather than reversing a stateful mutation. For a casual match
// (a few hundred balls at most) this is cheap enough to do on every render.
//
// SIMPLIFICATIONS (documented so nobody's surprised by a real umpire's math):
// - No-ball "free hit" mechanics aren't modeled — a no-ball adds its extra
//   run and doesn't count as a legal ball, but doesn't trigger a following
//   free-hit flag. Add this later if your group plays with free hits.
// - Byes/leg-byes count toward the team total and the partnership, but not
//   toward the striking batsman's individual runs or the bowler's runs
//   conceded — this matches real scoring convention. The Full Mode UI only
//   exposes Wide/No ball as extras (this group doesn't use byes), but the
//   engine still handles bye/legbye extraType values correctly if present
//   in older data — this code path is unused, not removed.
// - Wides/no-balls: the fixed extra run(s) count toward the team total and
//   the bowler's runs conceded, not toward any batsman's individual runs.
// - Run-outs don't credit the bowler with a wicket (matches real rules).
// - "Balls faced" for strike rate counts every non-wide delivery (including
//   no-balls), which is a common casual-cricket simplification.
// - Retiring mid-innings (injury, has to head out, etc.) is scored as
//   "retired out": a real dismissal — `isOut: true`, `howOut: 'retired'`,
//   counted in totalWickets — but with no bowler credited, same as a
//   run-out. Unlike a normal wicket, there's no "who's coming in" bowler
//   context to update (it doesn't consume a ball or touch any bowler's
//   figures), and the retiree can't be selected again later.

// TOURNAMENT MATCHES — the un-tracked opposition side.
//
// A tournament match is an ordinary match document (same `cricketMatches`
// collection, so it flows into computePlayerStats and every existing
// leaderboard for free) with `isTournament: true` and a teamB that is an
// EXTERNAL opponent: { name, captainId: null, playerIds: [], isExternal: true,
// playerCount }. We keep no roster for them — only the team name as a label.
//
// Ball entries for the side we don't track use this sentinel in place of a
// player id: `batsmanId: OPPONENT_ID` when our bowler is bowling to their
// batsman, `bowlerId: OPPONENT_ID` when our batsman is facing their bowler.
// The derive functions below count those balls toward the TEAM total (runs,
// wickets, overs) but never build individual figures for the sentinel — see
// ensureBatting/ensureBowling.
export const OPPONENT_ID = 'opponent'

export function isOpponentId(id) {
  return id === OPPONENT_ID
}

/**
 * How many players a team is playing with — the basis for "all out" (squad
 * size - 1 wickets) and "wickets in hand". An external opponent has no
 * roster to count, so it carries an explicit `playerCount` recorded when the
 * match was set up (defaulting to however many we fielded).
 */
export function squadSizeOf(team, fallback = 11) {
  if (!team) return fallback
  if (team.isExternal) return team.playerCount || fallback
  return team.playerIds?.length || fallback
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function isLegalBall(ball) {
  return ball.extraType !== 'wide' && ball.extraType !== 'noball'
}

function battingRunsFor(ball) {
  return ball.runs || 0
}

function teamRunsFor(ball) {
  return (ball.runs || 0) + (ball.extraRuns || 0)
}

function bowlerConcededFor(ball) {
  if (ball.extraType === 'bye' || ball.extraType === 'legbye') return ball.runs || 0
  return (ball.runs || 0) + (ball.extraRuns || 0)
}

function partnershipRunsFor(ball) {
  if (ball.extraType === 'wide' || ball.extraType === 'noball') return ball.extraRuns || 0
  return (ball.runs || 0) + (ball.extraType === 'bye' || ball.extraType === 'legbye' ? ball.extraRuns || 0 : 0)
}

/** Inverse of formatOvers: "1.5" (1 over, 5 balls) -> 11 legal balls. */
export function legalBallCountFromOvers(oversDecimal) {
  const whole = Math.floor(oversDecimal)
  const balls = Math.round((oversDecimal - whole) * 10)
  return whole * 6 + balls
}

export function formatOvers(legalBalls) {
  const overs = Math.floor(legalBalls / 6)
  const balls = legalBalls % 6
  return Number(`${overs}.${balls}`)
}

/** FULL MODE — derive everything from the raw ball log. */
export function deriveFullModeInnings(balls = []) {
  const batting = {}
  const bowling = {}
  const partnerships = []
  let totalRuns = 0
  let totalWickets = 0
  let legalBalls = 0

  // Tournament matches log the un-tracked opposition side under OPPONENT_ID
  // (see the note at the top of this file). Those balls still count toward
  // the team total, wickets and overs accumulated in the loop below — only
  // the individual figures are dropped, by handing the mutation sites a
  // scratch object that never lands in `batting`/`bowling`. So: when we bat,
  // our batsmen get full figures and their bowlers' figures are simply never
  // recorded; when we bowl, our bowlers get full figures and their batsmen's
  // are never recorded.
  const scratch = { batting: null, bowling: null }
  const newBatting = () => ({ runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, howOut: null, bowlerId: null, fielderId: null })

  const ensureBatting = (id) => {
    if (isOpponentId(id)) {
      if (!scratch.batting) scratch.batting = newBatting()
      return scratch.batting
    }
    if (!batting[id]) batting[id] = newBatting()
    return batting[id]
  }
  const ensureBowling = (id) => {
    if (isOpponentId(id)) {
      if (!scratch.bowling) scratch.bowling = { overs: 0, maidens: 0, runsConceded: 0, wickets: 0 }
      return scratch.bowling
    }
    if (!bowling[id]) bowling[id] = { overs: 0, maidens: 0, runsConceded: 0, wickets: 0 }
    return bowling[id]
  }

  // Partnership grouping: contiguous balls sharing the same unordered pair
  // of batsmen at the crease.
  let currentPairKey = null
  let currentPairRuns = 0
  let currentPairIds = null
  const flushPartnership = () => {
    // No partnership record for the un-tracked opposition side — there are no
    // two named batsmen to attribute one to.
    const isRealPair = currentPairIds && currentPairIds[0] !== currentPairIds[1] && !currentPairIds.some(isOpponentId)
    if (isRealPair) {
      partnerships.push({ a: currentPairIds[0], b: currentPairIds[1], runs: currentPairRuns })
    }
    currentPairKey = null
    currentPairRuns = 0
    currentPairIds = null
  }

  // Per-over grouping for maiden detection.
  let overCursor = null
  const flushOver = () => {
    if (overCursor && overCursor.legalCount >= 6) {
      const b = ensureBowling(overCursor.bowlerId)
      if (overCursor.runsThisOver === 0) b.maidens += 1
    }
    overCursor = null
  }

  const legalCountByBowler = {}

  for (const ball of balls) {
    if (ball.isRetirement) {
      // Retired out — a real dismissal, same as a run-out: counts as a
      // wicket down, no bowler credited. The crease pairing has genuinely
      // changed, same as any other wicket, so it needs flushing too.
      flushPartnership()
      const outBat = ensureBatting(ball.outBatsmanId)
      outBat.isOut = true
      outBat.howOut = 'retired'
      totalWickets += 1
      continue
    }

    const striker = ball.batsmanId
    const nonStriker = ball.nonStrikerId
    const pairKeyNow = nonStriker ? pairKey(striker, nonStriker) : null

    if (pairKeyNow && pairKeyNow !== currentPairKey) {
      flushPartnership()
      currentPairKey = pairKeyNow
      currentPairIds = [striker, nonStriker]
    }
    currentPairRuns += partnershipRunsFor(ball)

    const bat = ensureBatting(striker)
    bat.runs += battingRunsFor(ball)
    if (isLegalBall(ball) || ball.extraType === 'noball') bat.balls += 1
    if (!ball.extraType) {
      if (ball.runs === 4) bat.fours += 1
      if (ball.runs === 6) bat.sixes += 1
    }

    const bowl = ensureBowling(ball.bowlerId)
    bowl.runsConceded += bowlerConcededFor(ball)

    if (isLegalBall(ball)) {
      legalBalls += 1
      legalCountByBowler[ball.bowlerId] = (legalCountByBowler[ball.bowlerId] || 0) + 1
      if (!overCursor || overCursor.bowlerId !== ball.bowlerId || overCursor.over !== ball.over) {
        flushOver()
        overCursor = { over: ball.over, bowlerId: ball.bowlerId, runsThisOver: 0, legalCount: 0 }
      }
      overCursor.legalCount += 1
      overCursor.runsThisOver += bowlerConcededFor(ball)
    }

    totalRuns += teamRunsFor(ball)

    if (ball.isWicket) {
      totalWickets += 1
      const outId = ball.outBatsmanId || striker
      const outBat = ensureBatting(outId)
      outBat.isOut = true
      outBat.howOut = ball.wicketType
      outBat.fielderId = isOpponentId(ball.fielderId) ? null : ball.fielderId || null
      if (ball.wicketType !== 'runout') {
        // `bowl` is the scratch object for an un-tracked opposition bowler,
        // so the wicket is still counted in totalWickets above but credited
        // to nobody — and the dismissal line stays "bowled" rather than
        // "b opponent".
        outBat.bowlerId = isOpponentId(ball.bowlerId) ? null : ball.bowlerId
        bowl.wickets += 1
      }
    }
  }
  flushPartnership()
  flushOver()

  Object.entries(bowling).forEach(([id, b]) => {
    b.overs = formatOvers(legalCountByBowler[id] || 0)
  })

  return { totalRuns, totalWickets, oversBowled: formatOvers(legalBalls), batting, bowling, partnerships }
}

/** QUICK MODE — derive from per-over summaries. */
export function deriveQuickModeInnings(overs = [], retirements = []) {
  const batting = {}
  const bowling = {}
  const partnerships = []
  let totalRuns = 0
  let totalWickets = 0
  let totalOversFraction = 0

  // Same opponent-sentinel handling as Full Mode above: the over's runs and
  // wickets count toward the team total, but no individual figures are built
  // for the side we don't track. In a tournament match that means
  // `bowlerId: OPPONENT_ID` while we bat, and an empty `batsmenAtCrease`
  // while we bowl.
  const scratch = { batting: null, bowling: null }
  const newBatting = () => ({ runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, howOut: null, bowlerId: null, fielderId: null, estimated: true })

  const ensureBatting = (id) => {
    if (isOpponentId(id)) {
      if (!scratch.batting) scratch.batting = newBatting()
      return scratch.batting
    }
    if (!batting[id]) batting[id] = newBatting()
    return batting[id]
  }
  const ensureBowling = (id) => {
    if (isOpponentId(id)) {
      if (!scratch.bowling) scratch.bowling = { overs: 0, maidens: 0, runsConceded: 0, wickets: 0 }
      return scratch.bowling
    }
    if (!bowling[id]) bowling[id] = { overs: 0, maidens: 0, runsConceded: 0, wickets: 0 }
    return bowling[id]
  }

  for (const over of overs) {
    const oversFraction = over.oversFraction ?? 1
    totalOversFraction += oversFraction
    totalRuns += over.runsConceded || 0
    totalWickets += over.wickets || 0

    const bowl = ensureBowling(over.bowlerId)
    bowl.overs += oversFraction
    bowl.runsConceded += over.runsConceded || 0
    bowl.wickets += over.wickets || 0
    if ((over.runsConceded || 0) === 0 && oversFraction === 1) bowl.maidens += 1

    const crease = over.batsmenAtCrease || []
    if (crease.length) {
      const share = (over.runsConceded || 0) / crease.length
      const ballsShare = (oversFraction * 6) / crease.length
      crease.forEach((id) => {
        const bat = ensureBatting(id)
        bat.runs += share
        bat.balls += ballsShare
      })
      if (crease.length === 2) {
        partnerships.push({ a: crease[0], b: crease[1], runs: over.runsConceded || 0 })
      }
    }
    if (over.dismissedBatsmanId) {
      const bat = ensureBatting(over.dismissedBatsmanId)
      bat.isOut = true
      bat.howOut = over.wicketType || 'other'
      // Leave the credited bowler blank for an un-tracked opposition bowler,
      // so the scorecard reads "caught" rather than "c b opponent".
      bat.bowlerId = isOpponentId(over.bowlerId) ? null : over.bowlerId
    }
  }

  Object.values(batting).forEach((b) => {
    b.runs = Math.round(b.runs)
    b.balls = Math.round(b.balls)
  })

  // Retired out — a real dismissal, same as Full Mode: see the
  // SIMPLIFICATIONS note at the top of this file. No per-ball log in Quick
  // Mode, so retirements are tracked as a separate list on the innings
  // rather than woven into the over summaries; counted into totalWickets
  // here rather than through the usual per-over `wickets` field, so it
  // won't double-count unless a scorer also folds it into a later over's
  // manually-entered count. The `atOver` field on each retirement entry
  // isn't precise enough to interleave against the overs list, so as a
  // safeguard: don't stomp a real dismissal that a later over already
  // recorded for this player (dismissedBatsmanId is processed above, in
  // over order, before this runs).
  retirements.forEach(({ playerId }) => {
    const bat = ensureBatting(playerId)
    if (!bat.isOut) {
      bat.isOut = true
      bat.howOut = 'retired'
      totalWickets += 1
    }
  })

  return { totalRuns, totalWickets, oversBowled: totalOversFraction, batting, bowling, partnerships }
}

export function deriveInningsState(innings) {
  if (!innings) return null
  if (innings.scoringMode === 'quick') return deriveQuickModeInnings(innings.overs || [], innings.retirements || [])
  return deriveFullModeInnings(innings.balls || [])
}

function ensureMatchupCell(matrix, batsmanId, bowlerId, estimated = false) {
  if (!matrix[batsmanId]) matrix[batsmanId] = {}
  if (!matrix[batsmanId][bowlerId]) {
    matrix[batsmanId][bowlerId] = { runs: 0, balls: 0, wickets: 0, ...(estimated ? { estimated: true } : {}) }
  }
  return matrix[batsmanId][bowlerId]
}

/** FULL MODE matchup — same ball-log walk as deriveFullModeInnings, grouped
 * by (batsmanId, bowlerId) pair instead of batsmanId alone. */
function deriveFullModeMatchupStats(balls = []) {
  const matrix = {}
  for (const ball of balls) {
    if (ball.isRetirement) continue
    const striker = ball.batsmanId
    const bowlerId = ball.bowlerId
    if (!striker || !bowlerId) continue
    // A head-to-head needs two players we actually track — a tournament ball
    // always has an opponent sentinel on one side of the pair, so it can't
    // contribute to the matchup matrix.
    if (isOpponentId(striker) || isOpponentId(bowlerId)) continue

    const cell = ensureMatchupCell(matrix, striker, bowlerId)
    cell.runs += battingRunsFor(ball)
    if (isLegalBall(ball) || ball.extraType === 'noball') cell.balls += 1

    // Mirrors deriveFullModeInnings: run-outs don't credit the bowler, so
    // they don't count toward a batsman-bowler matchup either.
    if (ball.isWicket && ball.wicketType !== 'runout') {
      const outId = ball.outBatsmanId || striker
      const outCell = outId === striker ? cell : ensureMatchupCell(matrix, outId, bowlerId)
      outCell.wickets += 1
    }
  }
  return matrix
}

/** QUICK MODE matchup — approximated the same way partnerships already are:
 * each over's runs/balls are split evenly across the batsmen who were at the
 * crease, attributed to that over's bowler. Flagged `estimated: true`, same
 * as Quick Mode's per-batsman stats. */
function deriveQuickModeMatchupStats(overs = []) {
  const matrix = {}
  for (const over of overs) {
    const bowlerId = over.bowlerId
    const crease = (over.batsmenAtCrease || []).filter((id) => !isOpponentId(id))
    // Same as Full Mode: no matchup cell without two tracked players.
    if (!bowlerId || isOpponentId(bowlerId) || !crease.length) continue

    const oversFraction = over.oversFraction ?? 1
    const runsShare = (over.runsConceded || 0) / crease.length
    const ballsShare = (oversFraction * 6) / crease.length
    crease.forEach((batsmanId) => {
      const cell = ensureMatchupCell(matrix, batsmanId, bowlerId, true)
      cell.runs += runsShare
      cell.balls += ballsShare
    })

    if (over.dismissedBatsmanId) {
      const cell = ensureMatchupCell(matrix, over.dismissedBatsmanId, bowlerId, true)
      cell.wickets += 1
    }
  }
  Object.values(matrix).forEach((byBowler) => {
    Object.values(byBowler).forEach((cell) => {
      cell.runs = Math.round(cell.runs)
      cell.balls = Math.round(cell.balls)
    })
  })
  return matrix
}

/** Batsman-vs-bowler head-to-head for one innings: { [batsmanId]: {
 * [bowlerId]: { runs, balls, wickets, estimated? } } }. Same derive-from-log
 * pattern as deriveInningsState, just grouped by the batsman+bowler pair. */
export function deriveMatchupStats(innings) {
  if (!innings) return {}
  if (innings.scoringMode === 'quick') return deriveQuickModeMatchupStats(innings.overs || [])
  return deriveFullModeMatchupStats(innings.balls || [])
}

/** Compares both innings and returns { winner: 'A'|'B'|'tie', margin: string }. */
export function computeMatchResult(match) {
  if (!match?.innings1) return null
  if (!match?.innings2) return { winner: 'no-result', margin: 'No result — match ended early' }
  const d1 = deriveInningsState(match.innings1)
  const d2 = deriveInningsState(match.innings2)
  const teamFirst = match.innings1.battingTeam
  const teamSecond = match.innings2.battingTeam

  if (d1.totalRuns === d2.totalRuns) return { winner: 'tie', margin: 'Match tied' }
  if (d2.totalRuns > d1.totalRuns) {
    const teamKey = teamSecond === 'A' ? 'teamA' : 'teamB'
    const squadSize = squadSizeOf(match[teamKey])
    const wicketsInHand = Math.max(0, squadSize - 1 - d2.totalWickets)
    return { winner: teamSecond, margin: `won by ${wicketsInHand} wicket${wicketsInHand === 1 ? '' : 's'}` }
  }
  const margin = d1.totalRuns - d2.totalRuns
  return { winner: teamFirst, margin: `won by ${margin} run${margin === 1 ? '' : 's'}` }
}

function teamNameOf(match, teamKey) {
  return (teamKey === 'A' ? match.teamA?.name : match.teamB?.name) || teamKey
}

/**
 * One-line result summary for list views, e.g.
 * "Team A 62/4 beat Team B 51/7 by 11 runs". Returns null for matches that
 * haven't started (no headline to show — callers fall back to "A vs B").
 */
export function matchResultHeadline(match) {
  if (!match?.innings1) return null
  if (!match?.innings2) {
    const d1 = deriveInningsState(match.innings1)
    return `${teamNameOf(match, match.innings1.battingTeam)} ${d1.totalRuns}/${d1.totalWickets} — no result`
  }
  const result = computeMatchResult(match)
  if (!result) return null
  const d1 = deriveInningsState(match.innings1)
  const d2 = deriveInningsState(match.innings2)
  const scoreOf = (teamKey) => (teamKey === match.innings1.battingTeam ? d1 : d2)
  const line = (teamKey) => `${teamNameOf(match, teamKey)} ${scoreOf(teamKey).totalRuns}/${scoreOf(teamKey).totalWickets}`

  if (result.winner === 'tie') return `${line(match.innings1.battingTeam)} tied with ${line(match.innings2.battingTeam)}`
  const loser = result.winner === match.innings1.battingTeam ? match.innings2.battingTeam : match.innings1.battingTeam
  return `${line(result.winner)} beat ${line(loser)} ${result.margin.replace(/^won by /, 'by ')}`
}

/** One-line live score for the currently-batting innings, e.g. "Team A batting: 34/2 (5.2 ov)". */
export function liveScoreHeadline(match) {
  if (!match?.innings1) return null
  const activeInnings = match.innings2 || match.innings1
  const d = deriveInningsState(activeInnings)
  return `${teamNameOf(match, activeInnings.battingTeam)} batting: ${d.totalRuns}/${d.totalWickets} (${Number(d.oversBowled).toFixed(1)} ov)`
}

/** Innings completion check: all out, or overs limit reached. */
export function isInningsComplete(innings, oversLimit, squadSize) {
  if (!innings) return false
  const derived = deriveInningsState(innings)
  // A zero/missing squad size would make "all out" trivially true from the
  // very first ball — treat it as unknown and fall back to 11, which is what
  // squadSizeOf does for an external opponent with no roster to count.
  const wicketsAvailable = Math.max(1, (squadSize || 11) - 1)
  const allOut = derived.totalWickets >= wicketsAvailable
  const oversComplete = derived.oversBowled >= oversLimit
  return allOut || oversComplete
}

/** Suggests the next striker/non-striker/bowler for the UI, from the last ball. */
export function suggestNextContext(balls = [], openers) {
  if (!balls.length) return openers || {}
  const last = balls[balls.length - 1]

  if (last.isRetirement) {
    // Retirement carries no over/bowler info of its own (it doesn't consume
    // either) — recover the crease context from everything before it, then
    // pull the retiree off strike, same shape as a normal wicket.
    const prior = suggestNextContext(balls.slice(0, -1), openers)
    const survivor = prior.strikerId === last.outBatsmanId ? prior.nonStrikerId : prior.strikerId
    return {
      strikerId: null,
      nonStrikerId: survivor,
      bowlerId: prior.bowlerId,
      needsNewBatsman: true,
      needsNewOver: prior.needsNewOver || false,
    }
  }

  let striker = last.batsmanId
  let nonStriker = last.nonStrikerId
  const legalBallsInOver = balls.filter((b) => b.over === last.over && isLegalBall(b)).length

  if (last.isWicket) {
    // Whoever survived stays; the new batsman needs to be chosen by the UI.
    // Defaults to "striker was out" when outBatsmanId isn't set, since
    // that's the overwhelmingly common case (every dismissal but a
    // non-striker run-out) and the wicket modal always fills this in.
    const strikerWasOut = last.outBatsmanId ? last.outBatsmanId === striker : true
    const survivor = strikerWasOut ? nonStriker : striker
    const overEndedToo = isLegalBall(last) && legalBallsInOver >= 6

    if (overEndedToo) {
      // The over completes on the very ball the wicket falls, so ends swap
      // for the new over exactly like a normal last ball below — except one
      // end now holds the incoming batsman instead of the batsman who was
      // just there. The survivor's role flips with the swap same as always;
      // the new batsman inherits whatever role the vacated end has *after*
      // that swap, which is the opposite of the role the dismissed batsman
      // had (striker's end -> non-striker for the new over, and vice versa).
      return strikerWasOut
        ? { strikerId: survivor, nonStrikerId: null, bowlerId: null, needsNewBatsman: true, needsNewOver: true }
        : { strikerId: null, nonStrikerId: survivor, bowlerId: null, needsNewBatsman: true, needsNewOver: true }
    }
    return {
      strikerId: strikerWasOut ? null : striker,
      nonStrikerId: strikerWasOut ? survivor : null,
      bowlerId: last.bowlerId,
      needsNewBatsman: true,
      needsNewOver: false,
    }
  }

  const runsRotate = (last.runs || 0) % 2 === 1
  if (runsRotate) [striker, nonStriker] = [nonStriker, striker]
  if (legalBallsInOver >= 6) {
    [striker, nonStriker] = [nonStriker, striker]
    return { strikerId: striker, nonStrikerId: nonStriker, bowlerId: null, needsNewOver: true }
  }
  return { strikerId: striker, nonStrikerId: nonStriker, bowlerId: last.bowlerId }
}
