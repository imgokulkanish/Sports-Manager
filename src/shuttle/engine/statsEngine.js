// engine/statsEngine.js
//
// Pure functions that turn a list of sessions (each with schedule + scores)
// into the leaderboards, heatmaps, and streak stats used across the app.
// Kept framework-agnostic so it can be unit tested without React/Firebase.

import { isGuestId } from './guests'

// player.createdAt is a Firestore serverTimestamp() in production but a raw
// Date.now() number under the dormant localStore fallback - normalize both
// (plus a stray ISO string, just in case) to epoch millis for comparison.
function toMillis(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.seconds === 'number') return value.seconds * 1000
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? 0 : t
}

// Below this many matches, a derived rate/record (win rate, best partner,
// nemesis, head-to-head, etc.) is too noisy to trust at a glance - the UI
// tags it rather than hiding it, so small groups still see *something*.
export const MIN_RELIABLE_MATCHES = 4

export function isLowSample(matches, threshold = MIN_RELIABLE_MATCHES) {
  return (matches || 0) < threshold
}

/**
 * Quick play is a bag of ad-hoc matches - a few games squeezed into whatever
 * court time was going - rather than an organised session. It's stored in the
 * same collection so every match-level stat picks it up for free, but it is
 * NOT a session: it has no schedule, no cost split, and nobody "wins the day"
 * off it. Anything counting sessions rather than matches filters it out.
 */
export function isQuickPlay(session) {
  return session?.kind === 'quick'
}

/** Completed organised sessions - quick play excluded. See isQuickPlay. */
export function completedSessions(sessions) {
  return (sessions || []).filter((s) => s.status === 'completed' && !isQuickPlay(s))
}

// Matches a player needs before they are RANKED on a win-rate board, as
// opposed to MIN_RELIABLE_MATCHES above, which only tags a figure as noisy
// once it's already on screen. A leaderboard position is a claim about who is
// playing best, so it takes a real body of work: at four or five matches a
// couple of good nights outranks a whole season, which is exactly the reading
// a leaderboard invites. Boards that are meant to list everyone (the Stats
// page's overall leaderboard, per-session results) deliberately don't use it.
export const MIN_RANKED_MATCHES = 10

/**
 * Walks every completed session and builds a fresh, denormalized stats
 * object per player. This mirrors what would be written to the
 * `playerStats` collection after each session completes.
 */
export function computePlayerStats(sessions, players) {
  const byId = {}
  for (const p of players) {
    byId[p.id] = {
      playerId: p.id,
      name: p.name,
      totalMatches: 0,
      totalWins: 0,
      totalSessions: 0,
      partnerStats: {},
      opponentStats: {},
      sessionHistory: [],
      matchHistory: [],
      currentWinStreak: 0,
      bestWinStreak: 0,
      currentLossStreak: 0,
      worstLossStreak: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      bestWinMargin: 0,
    }
  }

  const completed = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  for (const session of completed) {
    const attended = new Set(session.playerIds || [])
    const sessionMatches = {}
    const sessionWins = {}
    attended.forEach((id) => {
      sessionMatches[id] = 0
      sessionWins[id] = 0
    })

    // Walked in playing order, not array order. A round swapped forward or
    // dragged in the "Up next" list keeps its array position (scores are keyed
    // by it) and only its `slot` changes, so array order can run a later match
    // before an earlier one - which reorders every streak built from here.
    const inPlayOrder = (session.schedule || [])
      .map((round, idx) => ({ round, idx }))
      .sort((a, b) => (a.round.slot ?? a.idx) - (b.round.slot ?? b.idx) || (a.round.court ?? 1) - (b.round.court ?? 1))
    inPlayOrder.forEach(({ round, idx }) => {
      const scoreEntry = session.scores?.[idx]
      const winnerTeam = scoreEntry?.winner
      if (!winnerTeam) return
      const winners = winnerTeam === 1 ? round.team1 : round.team2
      const losers = winnerTeam === 1 ? round.team2 : round.team1
      const all = [...round.team1, ...round.team2]
      // Older sessions (pre point-tracking) may have a winner but no per-team
      // points, so every points-derived stat below must degrade gracefully.
      const pts = scoreEntry.points

      all.forEach((id) => {
        if (!byId[id]) return
        byId[id].totalMatches++
        sessionMatches[id] = (sessionMatches[id] || 0) + 1
      })

      const recordMatchHistory = (teamIds, teamPts, oppPts, won) => {
        teamIds.forEach((id) => {
          if (!byId[id]) return
          if (pts) {
            byId[id].pointsFor += teamPts
            byId[id].pointsAgainst += oppPts
          }
          byId[id].matchHistory.push({
            date: session.date,
            won,
            pointsFor: pts ? teamPts : null,
            pointsAgainst: pts ? oppPts : null,
          })
        })
      }
      recordMatchHistory(round.team1, pts?.team1, pts?.team2, winnerTeam === 1)
      recordMatchHistory(round.team2, pts?.team2, pts?.team1, winnerTeam === 2)

      winners.forEach((id) => {
        if (!byId[id]) return
        byId[id].totalWins++
        sessionWins[id] = (sessionWins[id] || 0) + 1
        byId[id].currentWinStreak++
        byId[id].bestWinStreak = Math.max(byId[id].bestWinStreak, byId[id].currentWinStreak)
        byId[id].currentLossStreak = 0
        if (pts) {
          const margin = winnerTeam === 1 ? pts.team1 - pts.team2 : pts.team2 - pts.team1
          byId[id].bestWinMargin = Math.max(byId[id].bestWinMargin, margin)
        }
      })
      losers.forEach((id) => {
        if (!byId[id]) return
        byId[id].currentWinStreak = 0
        byId[id].currentLossStreak++
        byId[id].worstLossStreak = Math.max(byId[id].worstLossStreak, byId[id].currentLossStreak)
      })

      // Partner stats, recorded symmetrically. A singles match (quick play,
      // see isQuickPlay) has one-player teams and therefore no partnership at
      // all - recording one would write a partnerStats entry under the key
      // `undefined` and quietly poison every best-partner and heatmap figure.
      // A quick-play guest (engine/guests.js) has no player record, so they
      // can't be anyone's best partner or nemesis: the id would resolve to
      // nothing on the stats pages, and one game against a passer-by isn't a
      // partnership or a rivalry worth reporting. The match itself still
      // counts in full for the roster players who played it.
      // `margin` is the pair's point difference for this match (null on an
      // old winner-only score). It separates partnerships whose records are
      // identical - two pairs at 4-0 are only level until you ask how
      // convincingly each of them won.
      const recordPartnership = (team, won, margin) => {
        if (team.length !== 2) return
        const [x, y] = team
        ;[[x, y], [y, x]].forEach(([self, mate]) => {
          if (!byId[self] || isGuestId(mate)) return
          byId[self].partnerStats[mate] = byId[self].partnerStats[mate] || { matches: 0, wins: 0, pointDiff: 0 }
          byId[self].partnerStats[mate].matches++
          if (won) byId[self].partnerStats[mate].wins++
          if (margin != null) byId[self].partnerStats[mate].pointDiff += margin
        })
      }
      const partnerWon1 = winnerTeam === 1
      const partnerWon2 = winnerTeam === 2
      const margin1 = pts ? (pts.team1 || 0) - (pts.team2 || 0) : null
      recordPartnership(round.team1, partnerWon1, margin1)
      recordPartnership(round.team2, partnerWon2, margin1 == null ? null : -margin1)
      // opponent stats
      for (const x of round.team1) {
        for (const y of round.team2) {
          if (byId[x] && !isGuestId(y)) {
            byId[x].opponentStats[y] = byId[x].opponentStats[y] || { matches: 0, wins: 0 }
            byId[x].opponentStats[y].matches++
            if (partnerWon1) byId[x].opponentStats[y].wins++
          }
          if (byId[y] && !isGuestId(x)) {
            byId[y].opponentStats[x] = byId[y].opponentStats[x] || { matches: 0, wins: 0 }
            byId[y].opponentStats[x].matches++
            if (partnerWon2) byId[y].opponentStats[x].wins++
          }
        }
      }
    })

    // Quick play contributes matches but not attendance: turning up for two
    // casual games isn't turning up for the session, and counting it would
    // inflate everyone's attendance rate against a session that never ran.
    const quick = isQuickPlay(session)
    attended.forEach((id) => {
      if (!byId[id]) return
      if (!quick) byId[id].totalSessions++
      byId[id].sessionHistory.push({
        sessionId: session.id,
        date: session.date,
        matches: sessionMatches[id] || 0,
        wins: sessionWins[id] || 0,
        ...(quick ? { quick: true } : {}),
      })
    })

    // Guests dropped in for a match or two without joining the session (see
    // sessionLeaderboard). Their matches already counted in the loop above -
    // it keys off who was on court, not off playerIds - so all that's left is
    // the history entry. It's flagged and deliberately does NOT bump
    // totalSessions: they weren't at the session, and counting it would
    // credit them attendance they didn't earn and dilute everyone else's
    // attendance rate against a session they weren't invited to.
    ;(session.guestIds || []).forEach((id) => {
      if (!byId[id] || attended.has(id)) return
      byId[id].sessionHistory.push({
        sessionId: session.id,
        date: session.date,
        matches: sessionMatches[id] || 0,
        wins: sessionWins[id] || 0,
        guest: true,
      })
    })
  }

  return byId
}

/** Point difference for display: "+23", "-15", "0" — the sign is the point. */
export function formatDiff(diff) {
  return `${diff > 0 ? '+' : ''}${diff || 0}`
}

export function winRate(stat) {
  if (!stat || !stat.totalMatches) return 0
  return stat.totalWins / stat.totalMatches
}

/** Plain win/loss counts - losses are just the complement, never stored separately. */
export function matchRecord(stat) {
  const totalMatches = stat?.totalMatches || 0
  const totalWins = stat?.totalWins || 0
  return { wins: totalWins, losses: totalMatches - totalWins }
}

/**
 * Average points scored/conceded per match. Only counts matches with a
 * per-point score on record, so a player with a mix of old (winner-only) and
 * new (scored) sessions still gets an honest average - not diluted by nulls.
 * Returns null if none of their matches have points recorded.
 */
export function avgPoints(stat) {
  const scored = (stat?.matchHistory || []).filter((m) => m.pointsFor != null)
  if (!scored.length) return null
  const totalFor = scored.reduce((sum, m) => sum + m.pointsFor, 0)
  const totalAgainst = scored.reduce((sum, m) => sum + m.pointsAgainst, 0)
  return {
    matches: scored.length,
    for: totalFor / scored.length,
    against: totalAgainst / scored.length,
    diff: (totalFor - totalAgainst) / scored.length,
  }
}

/** Last `n` match results in chronological order (oldest to newest), as booleans. */
export function recentForm(stat, n = 5) {
  return (stat?.matchHistory || []).slice(-n).map((m) => m.won)
}

/**
 * Attendance reliability: completed sessions attended vs. completed sessions
 * held since the player joined (by createdAt). Distinct from the Stats page's
 * attendanceCounts(), which is a raw last-N-sessions count for the bar chart -
 * this one is a rate scoped to each player's own tenure, so a recent joiner
 * isn't penalized for sessions before they existed.
 */
export function attendanceRate(player, sessions) {
  if (!player) return null
  const completed = completedSessions(sessions)
  // "Joined" is the earlier of being added to the app and first turning up.
  // createdAt alone is when the player RECORD was made, and the group added
  // people after sessions they had already played were logged - so a regular
  // added late had every session before that dropped from both sides of the
  // rate. Perumal read 4 of 5 while actually attending 9 of 10, which put him
  // level with, then behind, players who had turned up less.
  const firstPlayed = completed
    .filter((s) => (s.playerIds || []).includes(player.id))
    .reduce((min, s) => Math.min(min, new Date(s.date).getTime()), Infinity)
  const created = toMillis(player.createdAt)
  const joinedAt = created ? Math.min(created, firstPlayed) : 0
  const eligible = completed.filter((s) => new Date(s.date).getTime() >= joinedAt)
  if (!eligible.length) return null
  const attended = eligible.filter((s) => (s.playerIds || []).includes(player.id)).length
  return { attended, eligible: eligible.length, rate: attended / eligible.length }
}

/**
 * Per-player tally of outright session wins and session-MVP awards across all
 * completed sessions. Reuses sessionWinnerId/sessionMVP (defined below) so the
 * "who won this session" definition stays in exactly one place.
 */
export function sessionAchievements(sessions, players) {
  const counts = Object.fromEntries(players.map((p) => [p.id, { sessionWins: 0, mvpCount: 0 }]))
  completedSessions(sessions)
    .forEach((s) => {
      const winnerId = sessionWinnerId(s)
      if (winnerId && counts[winnerId]) counts[winnerId].sessionWins++
      const mvp = sessionMVP(s)
      if (mvp && counts[mvp.playerId]) counts[mvp.playerId].mvpCount++
    })
  return counts
}

export function leaderboard(statsById, { minMatches = 0 } = {}) {
  return Object.values(statsById)
    .filter((s) => s.totalMatches >= minMatches)
    .map((s) => ({ ...s, winRate: winRate(s) }))
    .sort((a, b) => b.winRate - a.winRate || b.totalMatches - a.totalMatches)
}

// Partnerships with enough matches together to be worth comparing, best win
// rate first. Ties go to the pairing with more matches behind it, so the one
// named is the better-evidenced one rather than whichever happened to be
// stored first.
function rankedPartnerships(stat) {
  return Object.entries(stat?.partnerStats || {})
    .filter(([, v]) => v.matches >= 2)
    .map(([partnerId, v]) => ({ partnerId, ...v, winRate: v.wins / v.matches }))
    .sort((a, b) => b.winRate - a.winRate || b.matches - a.matches)
}

/**
 * The partner someone plays best with - but only when there's a genuine
 * standout, because "best" is a comparison and ranking top of a field of one
 * isn't one. Two things have to hold:
 *
 * - they must have actually won together. A pairing that has lost every match
 *   is nobody's best partner however it ranks, and with a single partnership
 *   clearing the match floor it would otherwise be announced at 0% together.
 * - the field must be separable. If every qualifying partnership shares the
 *   same win rate, picking one out of the tie is arbitrary.
 */
export function bestPartner(stat) {
  const ranked = rankedPartnerships(stat)
  if (!ranked.length) return null
  const top = ranked[0]
  if (!top.wins) return null
  if (ranked.length > 1 && top.winRate === ranked[ranked.length - 1].winRate) return null
  return top
}

/**
 * The flip side of bestPartner: the pairing that hasn't clicked yet (shown as
 * "Toughest pairing" - it describes the pair, not the person). Needs two
 * qualifying partnerships to compare, since with a single one the same person
 * would come back as both best and toughest, and needs them to differ, for
 * the same reason bestPartner does.
 */
export function worstPartner(stat) {
  const ranked = rankedPartnerships(stat)
  if (ranked.length < 2) return null
  const bottom = ranked[ranked.length - 1]
  if (bottom.winRate === ranked[0].winRate) return null
  return bottom
}

/**
 * The opponent who beats them most. Same honesty guard as bestPartner in
 * reverse: someone they have never lost to is not a nemesis, however few
 * opponents clear the match floor.
 */
export function nemesis(stat) {
  const entries = Object.entries(stat?.opponentStats || {}).filter(([, v]) => v.matches >= 2)
  if (!entries.length) return null
  const [opponentId, v] = entries.sort((a, b) => a[1].wins / a[1].matches - b[1].wins / b[1].matches)[0]
  if (v.wins === v.matches) return null
  return { opponentId, ...v, lossRate: 1 - v.wins / v.matches }
}

/**
 * Every partnership on record for one player as a flat list, so the player
 * modal can show the full "played with" breakdown rather than only the single
 * best/toughest pairing bestPartner and worstPartner pick out.
 *
 * Unlike those two this applies no match floor and no standout guard - the
 * point here is the raw record, one row per person, and a 1-0 is honest as
 * long as it's labelled as a 1-0 (the UI tags low samples). Best win rate
 * first, so the list reads as a ranking; ties break on matches played, which
 * puts the better-evidenced record above a lucky one-off at the same rate.
 */
export function partnerRecords(stat) {
  return Object.entries(stat?.partnerStats || {})
    .map(([id, v]) => ({ id, matches: v.matches, wins: v.wins, losses: v.matches - v.wins, winRate: v.wins / v.matches }))
    .sort((a, b) => b.winRate - a.winRate || b.matches - a.matches)
}

/** The same flat breakdown for opponents faced - the "played against" side. */
export function opponentRecords(stat) {
  return Object.entries(stat?.opponentStats || {})
    .map(([id, v]) => ({ id, matches: v.matches, wins: v.wins, losses: v.matches - v.wins, winRate: v.wins / v.matches }))
    .sort((a, b) => b.winRate - a.winRate || b.matches - a.matches)
}

/** Partnership win-rate matrix for the heatmap, keyed [playerId][partnerId]. */
export function partnershipHeatmap(statsById, playerIds) {
  const matrix = {}
  for (const a of playerIds) {
    matrix[a] = {}
    for (const b of playerIds) {
      if (a === b) {
        matrix[a][b] = null
        continue
      }
      const stat = statsById[a]?.partnerStats?.[b]
      matrix[a][b] = stat && stat.matches > 0 ? stat.wins / stat.matches : null
    }
  }
  return matrix
}

/** Head-to-head win record matrix (a's wins vs b), keyed [a][b]. */
export function headToHead(statsById, playerIds) {
  const matrix = {}
  for (const a of playerIds) {
    matrix[a] = {}
    for (const b of playerIds) {
      if (a === b) {
        matrix[a][b] = null
        continue
      }
      const stat = statsById[a]?.opponentStats?.[b]
      matrix[a][b] = stat ? { wins: stat.wins, losses: stat.matches - stat.wins } : null
    }
  }
  return matrix
}

export function attendanceCounts(sessions, players, lastN = null) {
  const completed = completedSessions(sessions)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  const scoped = lastN ? completed.slice(0, lastN) : completed
  const counts = Object.fromEntries(players.map((p) => [p.id, 0]))
  scoped.forEach((s) => (s.playerIds || []).forEach((id) => {
    if (id in counts) counts[id]++
  }))
  return counts
}

/** Filters sessions to the last N days for the Stats page's date filter. */
export function filterSessionsByDays(sessions, days) {
  if (!days) return sessions
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return sessions.filter((s) => new Date(s.date).getTime() >= cutoff)
}

/**
 * Per-player tallies for a single session: match points (1 per win), W/L,
 * point difference, and matches played — ordered the way every screen in the
 * app ranks a session.
 *
 * POINT DIFFERENCE (`diff`) is the tiebreak, not total points scored. It sums
 * the margin of every match a player was in: +6 for winning 21-15, -6 for
 * losing it. Total scored rewards being in long, close matches whoever won
 * them — two players level on match points would be separated by who happened
 * to play the grindier games. Margin measures how convincingly they won, which
 * is what a tiebreak is for. `scored` is still tallied for anything that wants
 * the raw total.
 *
 * GUESTS. A player who isn't in `playerIds` but appears on court is a drop-in:
 * someone easing back from injury, or a passer-by who wanted a game or two
 * (see substituteInSchedule). Their matches are tallied identically so the
 * record isn't lost, but they always sort below the members and carry
 * `guest: true` plus a `matches` count, because two matches' worth of wins
 * shouldn't out-rank someone who played the whole session. Winner-of-the-day
 * and MVP are members-only for the same reason.
 *
 * THE DECIDER. Two people can finish level on match points, in which case the
 * session is settled on total rally points - which has come down to a single
 * point across a whole evening. `session.decider` records an optional singles
 * match played to settle it, and its winner takes the tie ahead of the rally
 * count. It only ever moves someone within their own points group, so it can
 * never lift a player above someone who won more matches than them.
 *
 * Returns [{ playerId, matches, wins, losses, pts, scored, guest, deciderWon }].
 */
export function sessionLeaderboard(session) {
  const members = new Set(session?.playerIds || [])
  const tally = {}
  const ensure = (id) => {
    if (!tally[id]) {
      tally[id] = {
        playerId: id,
        matches: 0,
        wins: 0,
        losses: 0,
        pts: 0,
        scored: 0,
        diff: 0,
        guest: !members.has(id),
        deciderWon: false,
      }
    }
    return tally[id]
  }
  members.forEach(ensure)
  ;(session?.schedule || []).forEach((round, i) => {
    const entry = session?.scores?.[i]
    const winner = entry?.winner
    if (!winner) return
    const winTeam = winner === 1 ? round.team1 : round.team2
    const loseTeam = winner === 1 ? round.team2 : round.team1
    winTeam.forEach((id) => {
      const t = ensure(id)
      t.matches++
      t.wins++
      t.pts++
    })
    loseTeam.forEach((id) => {
      const t = ensure(id)
      t.matches++
      t.losses++
    })
    if (entry.points) {
      const t1 = entry.points.team1 || 0
      const t2 = entry.points.team2 || 0
      round.team1.forEach((id) => {
        const t = ensure(id)
        t.scored += t1
        t.diff += t1 - t2
      })
      round.team2.forEach((id) => {
        const t = ensure(id)
        t.scored += t2
        t.diff += t2 - t1
      })
    }
  })
  // A guest scheduled into a later match but not yet scored still belongs on
  // the board at 0, the same as any member who hasn't played yet.
  ;(session?.guestIds || []).forEach(ensure)

  // A decider only counts while the tie it settled is still the live one. Undo
  // a round after playing it and the standings can move under it - a decider
  // won against someone who has since dropped off the top would otherwise keep
  // promoting its winner over a player they never beat. Rather than deleting it
  // on every score change, it's simply ignored unless both its players are
  // still level at the top, so it comes back if the standings do.
  const decider = session?.decider
  let deciderWinnerId = null
  if (decider?.winnerId && decider.players?.length === 2 && decider.players.includes(decider.winnerId)) {
    const topPts = Object.values(tally).reduce((max, r) => (r.guest ? max : Math.max(max, r.pts)), 0)
    const stillLevelAtTop =
      topPts > 0 && decider.players.every((id) => tally[id] && !tally[id].guest && tally[id].pts === topPts)
    if (stillLevelAtTop) deciderWinnerId = decider.winnerId
  }
  if (deciderWinnerId) tally[deciderWinnerId].deciderWon = true

  // Every term below is a plain per-row value, so the comparator stays
  // transitive. An earlier attempt compared the two decider players against
  // each other directly, which with three players level on points could order
  // them in a cycle and leave the sort undefined.
  return Object.values(tally).sort(
    (a, b) =>
      Number(a.guest) - Number(b.guest) ||
      b.pts - a.pts ||
      Number(b.deciderWon) - Number(a.deciderWon) ||
      b.diff - a.diff ||
      b.scored - a.scored,
  )
}

/**
 * The two players a singles decider would be between, or null when the session
 * doesn't need one: the leader and whoever is level with them on match points.
 * If three or more are level, it's the two of them ahead on point difference.
 *
 * Returns [winnerSideRow, otherRow] straight from sessionLeaderboard, so once
 * a decider has been played this keeps naming the same pair.
 */
export function deciderCandidates(session) {
  const board = sessionLeaderboard(session).filter((row) => !row.guest)
  if (board.length < 2) return null
  const [first, second] = board
  if (!first.pts || first.pts !== second.pts) return null
  return [first, second]
}

/** How many players finished level on the top score (2+ means a tie at the top). */
export function tiedAtTopCount(session) {
  const board = sessionLeaderboard(session).filter((row) => !row.guest)
  if (!board.length || !board[0].pts) return 0
  return board.filter((row) => row.pts === board[0].pts).length
}

/**
 * Determines the outright winner of a single session: most match points,
 * tie-broken by point difference. Guests are ineligible - see
 * sessionLeaderboard. Returns null if the session has no recorded scores.
 */
export function sessionWinnerId(session) {
  const top = sessionLeaderboard(session).find((row) => !row.guest)
  return top && top.pts > 0 ? top.playerId : null
}

/**
 * Best performer within a single session: highest win rate among players
 * who played at least `minMatches` that session (ties broken by total wins,
 * then total scored points). This is distinct from "who placed first" -
 * a player who went 2-0 can out-rate someone who went 5-2 with more total
 * points. Returns null if nobody meets the minimum.
 *
 * Members only - a guest who won their one drop-in match is not the session's
 * best performer. The tallies below are seeded from playerIds and every bump
 * is guarded by `id in ...`, which is what keeps guests out.
 */
export function sessionMVP(session, { minMatches = 2 } = {}) {
  const matches = {}
  const wins = {}
  const diff = {}
  ;(session.playerIds || []).forEach((id) => {
    matches[id] = 0
    wins[id] = 0
    diff[id] = 0
  })
  ;(session.schedule || []).forEach((round, i) => {
    const entry = session.scores?.[i]
    const winner = entry?.winner
    if (!winner) return
    const all = [...round.team1, ...round.team2]
    all.forEach((id) => {
      if (id in matches) matches[id] += 1
    })
    const winTeam = winner === 1 ? round.team1 : round.team2
    winTeam.forEach((id) => {
      if (id in wins) wins[id] += 1
    })
    if (entry.points) {
      const margin = (entry.points.team1 || 0) - (entry.points.team2 || 0)
      round.team1.forEach((id) => (id in diff ? (diff[id] += margin) : null))
      round.team2.forEach((id) => (id in diff ? (diff[id] -= margin) : null))
    }
  })

  const qualified = Object.keys(matches).filter((id) => matches[id] >= minMatches)
  if (!qualified.length) return null

  const bestId = qualified.sort((a, b) => {
    const rateA = wins[a] / matches[a]
    const rateB = wins[b] / matches[b]
    return rateB - rateA || wins[b] - wins[a] || diff[b] - diff[a]
  })[0]

  return {
    playerId: bestId,
    matches: matches[bestId],
    wins: wins[bestId],
    winRate: wins[bestId] / matches[bestId],
  }
}

/**
 * Tallies how many completed sessions each player has won outright, alongside
 * how many they turned up to - one win reads very differently off two nights
 * than off ten.
 *
 * `sessionsPlayed` counts membership, not guest appearances: a guest can't win
 * a session (see sessionLeaderboard), so counting their drop-ins would inflate
 * a denominator of "sessions they could have won".
 */
export function sessionWinCounts(sessions, players) {
  const counts = Object.fromEntries(players.map((p) => [p.id, 0]))
  const played = Object.fromEntries(players.map((p) => [p.id, 0]))
  completedSessions(sessions)
    .forEach((s) => {
      const winnerId = sessionWinnerId(s)
      if (winnerId && winnerId in counts) counts[winnerId]++
      ;(s.playerIds || []).forEach((id) => {
        if (id in played) played[id]++
      })
    })
  return players
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      sessionWins: counts[p.id] || 0,
      sessionsPlayed: played[p.id] || 0,
    }))
    .filter((r) => r.sessionWins > 0)
    // Wins first, then the fewer nights those wins came off - two players on
    // three wins each are not level if one needed twice the sessions. Name
    // last so the order is stable rather than however players happened to
    // load: the Dashboard names the top row as "most sessions won", and that
    // card shouldn't change who it credits between refreshes.
    .sort(
      (a, b) =>
        b.sessionWins - a.sessionWins ||
        a.sessionsPlayed - b.sessionsPlayed ||
        a.name.localeCompare(b.name),
    )
}

/**
 * The strongest pairing in the group, for the Stats page's "Best partnership"
 * card. Highest win rate together, and where several are level - a 2-0 and a
 * 4-0 are both 100% - the pairing with the most matches behind it wins, the
 * same tiebreak rankedPartnerships uses. Without it the card named whichever
 * 100% pairing the player list happened to reach first, so a pair who had won
 * four together lost the card to one who had won two.
 *
 * `playerIds` scopes it to the players the page is showing (active only), and
 * partnerStats is symmetric, so each pair is visited once via `a >= b`.
 */
export function bestPartnership(statsById, playerIds, { minMatches = 2 } = {}) {
  const rows = []
  for (const a of playerIds) {
    for (const b of playerIds) {
      if (a >= b) continue
      const stat = statsById[a]?.partnerStats?.[b]
      if (!stat || stat.matches < minMatches) continue
      rows.push({ a, b, rate: stat.wins / stat.matches, matches: stat.matches, wins: stat.wins, pointDiff: stat.pointDiff || 0 })
    }
  }
  if (!rows.length) return null
  // Rate, then matches, then point difference together. That last step is
  // what stops two identical records being settled by player-list order: a
  // card used to name one 4-0 pair and silently leave out the other.
  rows.sort((x, y) => y.rate - x.rate || y.matches - x.matches || y.pointDiff - x.pointDiff)
  const top = rows[0]
  // Pairs with the same win-loss record, whatever the points say. The points
  // decide whose names go on a card, but a 4-0 is still level with a 4-0, and
  // the card should say so rather than imply the other pair is behind.
  const tied = rows.filter((r) => r.rate === top.rate && r.matches === top.matches).length
  return { ...top, tied }
}

/**
 * Matches each player still has scheduled but unplayed in a live session,
 * keyed by player id. Counts what is actually on the schedule rather than
 * (total rounds - played), so a player substituted out of a later round, or
 * added part-way through, gets the count their own card shows.
 */
export function remainingMatchCounts(session) {
  const scores = session?.scores || {}
  const left = {}
  ;(session?.schedule || []).forEach((match, i) => {
    if (scores[i]) return
    ;[...(match.team1 || []), ...(match.team2 || [])].forEach((id) => {
      left[id] = (left[id] || 0) + 1
    })
  })
  return left
}

// ---------------------------------------------------------------------------
// Dashboard highlight cards. Each returns the leader plus `tied` - how many
// players share the top figure - so a card can say "tied with 2 others"
// instead of quietly crediting whoever the tiebreak happened to put first.
// Every one returns null rather than a leader off too little evidence.
// ---------------------------------------------------------------------------

function leaderOf(rows, value, tiebreak = () => 0) {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => value(b) - value(a) || tiebreak(a, b))
  const top = sorted[0]
  return { ...top, tied: sorted.filter((r) => value(r) === value(top)).length }
}

/**
 * Longest winning run still alive. Below `min` it's a couple of good games,
 * not a streak.
 *
 * "Still alive" also has to mean still playing. A run is only ended by a loss,
 * so someone who won their last nine matches and then stopped coming would
 * otherwise top this card for months on a streak nobody has seen - so the
 * player's last match must fall within `activeDays`.
 */
export function hotStreak(statsById, playerIds, { min = 3, activeDays = 30, now = Date.now() } = {}) {
  const cutoff = now - activeDays * 24 * 60 * 60 * 1000
  const playedRecently = (st) => {
    const last = st.matchHistory?.[st.matchHistory.length - 1]
    return last && new Date(last.date).getTime() >= cutoff
  }
  const rows = playerIds
    .map((id) => statsById[id])
    .filter((st) => st && st.currentWinStreak >= min && playedRecently(st))
    .map((st) => ({ playerId: st.playerId, name: st.name, streak: st.currentWinStreak, matches: st.totalMatches }))
  return leaderOf(rows, (r) => r.streak, (a, b) => b.matches - a.matches)
}

/**
 * Best average point difference per match: who wins comfortably, not just who
 * wins. Only scored matches count (see avgPoints), and only a positive margin
 * - the "most dominant" player can't be one who loses on average.
 */
export function mostDominant(statsById, playerIds, { minMatches = MIN_RANKED_MATCHES } = {}) {
  const rows = []
  for (const id of playerIds) {
    const avg = avgPoints(statsById[id])
    if (!avg || avg.matches < minMatches || avg.diff <= 0) continue
    // Compared to one decimal, the precision the card shows, so two players
    // on "+4.2" read as the tie they look like.
    rows.push({ playerId: id, name: statsById[id].name, diff: Math.round(avg.diff * 10) / 10, matches: avg.matches })
  }
  return leaderOf(rows, (r) => r.diff, (a, b) => b.matches - a.matches)
}

/**
 * Biggest win-rate rise: the last `days` against everything before. Both
 * windows need real samples - a rate off a handful of games swings 30 points
 * on one bad night, and that would be luck on the card, not improvement.
 * Compared in whole percentage points, which is also what the card prints.
 */
export function mostImproved(
  sessions,
  players,
  { days = 30, minRecent = 8, minPrior = 10, minGain = 4, now = Date.now() } = {},
) {
  const cutoff = now - days * 24 * 60 * 60 * 1000
  const recent = computePlayerStats(sessions.filter((s) => new Date(s.date).getTime() >= cutoff), players)
  const prior = computePlayerStats(sessions.filter((s) => new Date(s.date).getTime() < cutoff), players)
  const rows = []
  for (const p of players) {
    const r = recent[p.id]
    const q = prior[p.id]
    if (!r || !q || r.totalMatches < minRecent || q.totalMatches < minPrior) continue
    const before = Math.round(winRate(q) * 100)
    const after = Math.round(winRate(r) * 100)
    // A rise of a few points is one good night on a sample this size, and a
    // card calling it "most improved" would be reporting luck.
    if (after - before < minGain) continue
    rows.push({ playerId: p.id, name: p.name, before, after, gain: after - before, recentMatches: r.totalMatches })
  }
  return leaderOf(rows, (r) => r.gain, (a, b) => b.recentMatches - a.recentMatches)
}
