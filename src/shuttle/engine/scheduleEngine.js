// engine/scheduleEngine.js
//
// Generates a slot-by-slot badminton doubles schedule for 6-8 players
// (a general fallback exists for other counts, see computeTotalRounds).
//
// TERMINOLOGY (matters since multi-court support landed):
//   slot  = one block of wall-clock time (what the UI calls a "round").
//   match = one game on one court. A slot holds one match per court booked
//           for that slot, and those matches are played simultaneously.
// The emitted `schedule` array stays FLAT — one entry per match, tagged with
// `slot` and `court` — so `scores[i]`, stats, exports and the offline cache
// keep keying off a plain match index exactly as they did when every slot
// held exactly one match. Entries without `slot`/`court` (every session
// created before this change) read as court 1, slot === index.
//
// DESIGN NOTES / deviations from the literal spec (documented up front so
// nobody is surprised later):
//
// 1. "targetMatchesPerPlayer = floor(numPlayers * totalRounds / numPlayers)"
//    as written in the spec reduces to totalRounds, which can't be right
//    since only 4 of numPlayers are active per court. The number that
//    actually reproduces the spec's own examples (6p/15r -> 10 matches,
//    7p/14r -> 8 matches, 8p/10r -> 5 matches) is:
//        targetMatchesPerPlayer = floor((4 * totalMatches) / numPlayers)
//    where totalMatches sums the courts across all slots (== slot count on a
//    single-court session, so single-court behaviour is unchanged).
//
// 2. Running 10,000 full seed attempts synchronously in a browser tab would
//    freeze the UI. We cap attempts (default 500, tunable) and stop early
//    once we find a "perfect" result (all hard constraints satisfied +
//    every pair covered at least once). This keeps schedule generation
//    under ~1s for 6-8 players while still exploring plenty of seeds.
//    "All pairs covered" has to mean "all pairs it's possible to cover":
//    a schedule holds only 2 partnerships per match, so a 12-slot/2-court
//    plan (18 matches, 36 partnerships) can never cover all 45 pairs of a
//    10-player group. The exit tests coverage against that ceiling - see
//    maxCoverageRatio - otherwise every multi-court plan burns all 500
//    seeds and generation creeps past a second.
//
// 3. "mustRest" (active streak >= 2) and "mustPlay" (rest streak >= 2, or
//    forced by remaining-slots-equals-remaining-need) can conflict. When
//    they do, mustRest (a hard safety/fairness constraint) wins, and we
//    surface a warning rather than silently breaking the no-more-than-2-
//    consecutive-slots rule.
//
// 6. requiredPairs ([{ a, b }]) guarantees two people at least one match as
//    partners. It's enforced in three places rather than one, because a pure
//    scoring nudge can't promise anything: scoreSplit pays a large bounty for
//    an outstanding pair, each slot force-selects up to 2 courts' worth of
//    due pairs so they're actually on court together, and any pair still
//    unmet at the end costs enough fitness that a seed which satisfies it
//    always outranks one that doesn't. Once satisfied it's forgotten -
//    "at least once" means the rest of the session stays unconstrained.
//
//    Each pair gets a randomised DUE SLOT rather than being chased from the
//    first round. Chasing immediately buried every required pair in round 1
//    (with 9 players and 8 on court, both are nearly always available, so the
//    bounty landed at the first opportunity every single time). Before its due
//    slot a pair is left entirely alone - if the ordinary variety scoring
//    happens to pair them, that counts and the rule retires early. Due slots
//    sit in the first ~70% of the session so there's always slack left to
//    satisfy one that the schedule didn't produce on its own.
//
// 5. matchCaps ({ playerId: maxMatches }) is a personal ceiling for someone
//    easing back from injury. It's a MAXIMUM, not a target: the court time is
//    already booked, so the matches they give up are handed to everyone else
//    rather than shortening the session. Targets are shared out by water
//    filling (assignTargets), which is what makes that redistribution respect
//    a second, lower cap instead of overshooting it. The cap holds unless the
//    court cannot be filled without them, and any breach is warned about.
//
// 4. mustRest is CAPPED AT THE BENCH SIZE (numPlayers - 4 * courts). With
//    10 players on 2 courts the bench is only 2, so by the third slot most
//    of the group would hit activeStreak >= 2 and the old uncapped rule
//    would flag 8 players to rest, fail to fill the courts, and relax its
//    way back out with a warning every single slot. Instead we rank the
//    rest candidates (longest active streak first, then most matches
//    already played) and bench only as many as there are bench spots.
//    On a single court with 6-8 players the cap is never binding, so this
//    is a no-op for the original round shapes.

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function computeTotalRounds(numPlayers) {
  const map = { 6: 15, 7: 14, 8: 10 }
  if (map[numPlayers]) return map[numPlayers]
  // Generic fallback for 5 or 9+ players: aim for full pair coverage
  // (twice each for very small groups, once each for larger ones).
  const targetMatchesPerPlayer = numPlayers <= 5 ? (numPlayers - 1) * 2 : numPlayers - 1
  return Math.max(1, Math.ceil((targetMatchesPerPlayer * numPlayers) / 4))
}

// The default matches-per-player implied by computeTotalRounds, surfaced so
// the UI can show/pre-fill it when letting the user override the round count.
export function defaultMatchesPerPlayer(numPlayers) {
  const totalRounds = computeTotalRounds(numPlayers)
  return Math.floor((4 * totalRounds) / numPlayers)
}

// Rounds needed for every player to get roughly `matchesPerPlayer` matches
// (only 4 of numPlayers are on court each round).
export function roundsForMatchesPerPlayer(numPlayers, matchesPerPlayer) {
  return Math.max(1, Math.ceil((matchesPerPlayer * numPlayers) / 4))
}

// --- Court plans -------------------------------------------------------------
// A court plan is simply the number of courts available in each time slot,
// e.g. [2,2,2,2,2,2,1,1,1,1,1,1] = "two courts for the first hour, one for
// the second" at 10 minutes a match. Single-court sessions pass an array of
// 1s (or nothing at all, in which case one is built from the round count).

export const DEFAULT_MINUTES_PER_MATCH = 10

/**
 * Turn a booking ("2 hours total, second court for the first hour, matches
 * run ~10 minutes") into a per-slot court plan.
 */
export function courtPlanFromMinutes(totalMinutes, extraCourtMinutes, minutesPerMatch = DEFAULT_MINUTES_PER_MATCH) {
  const perMatch = Math.max(1, Math.floor(minutesPerMatch) || DEFAULT_MINUTES_PER_MATCH)
  const totalSlots = Math.max(1, Math.floor((Math.max(0, totalMinutes) || 0) / perMatch))
  const extraSlots = Math.min(totalSlots, Math.max(0, Math.floor((Math.max(0, extraCourtMinutes) || 0) / perMatch)))
  return Array.from({ length: totalSlots }, (_, i) => (i < extraSlots ? 2 : 1))
}

/**
 * Build a plan around a target matches-per-player instead of around the clock,
 * keeping the two-court stretch at the front where the extra court is booked.
 * Two-court slots are worth two matches, so they burn through the target twice
 * as fast; if the target is small enough that the two-court stretch alone
 * overshoots it, the stretch itself is shortened.
 */
export function courtPlanForMatchesPerPlayer(numPlayers, matchesPerPlayer, extraCourtSlots = 0) {
  const totalMatches = Math.max(1, Math.ceil((matchesPerPlayer * numPlayers) / 4))
  const twoCourt = Math.min(Math.max(0, extraCourtSlots), Math.floor(totalMatches / 2))
  const singleCourt = Math.max(0, totalMatches - 2 * twoCourt)
  return [...Array(twoCourt).fill(2), ...Array(singleCourt).fill(1)]
}

/**
 * Clamp a plan to what the group can actually staff: a court needs 4 players,
 * so 10 players can run at most 2 courts, 7 players at most 1.
 */
export function clampCourtPlan(courtsBySlot, numPlayers) {
  const maxCourts = Math.max(1, Math.floor(numPlayers / 4))
  return courtsBySlot.map((c) => Math.max(1, Math.min(maxCourts, c)))
}

/** Slot/match/matches-per-player totals for a plan, for UI preview text. */
export function summarizeCourtPlan(courtsBySlot, numPlayers) {
  const slots = courtsBySlot.length
  const totalMatches = courtsBySlot.reduce((sum, c) => sum + c, 0)
  const matchesPerPlayer = numPlayers ? Math.floor((4 * totalMatches) / numPlayers) : 0
  const extraSlots = numPlayers ? 4 * totalMatches - matchesPerPlayer * numPlayers : 0
  return { slots, totalMatches, matchesPerPlayer, playersWithOneExtra: extraSlots }
}

/**
 * Group a flat schedule into time slots. Pre-multi-court schedules have no
 * `slot` field, so each match becomes its own slot and nothing changes.
 * Returns [{ slot, matches: [{ index, match, court }] }].
 */
export function groupBySlot(schedule = []) {
  const bySlot = new Map()
  schedule.forEach((match, index) => {
    const slot = match.slot ?? index
    if (!bySlot.has(slot)) bySlot.set(slot, [])
    bySlot.get(slot).push({ index, match, court: match.court ?? 1 })
  })
  return [...bySlot.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([slot, matches]) => ({ slot, matches: matches.sort((a, b) => a.court - b.court) }))
}

/**
 * Flat, display-ordered view of a schedule: sorted by slot then court, with
 * each match's original array index carried along. That index is the key
 * `scores` is stored under, so anything rendering a schedule must read the
 * order from here and the result from there — after a live round swap (see
 * swapSlots) the array order and the playing order are no longer the same.
 * Returns [{ index, match, slot, court }].
 */
export function orderedMatches(schedule = []) {
  return groupBySlot(schedule).flatMap(({ slot, matches }) =>
    matches.map(({ index, match, court }) => ({ index, match, slot, court })),
  )
}

// --- Live schedule edits -----------------------------------------------------
//
// Two things go wrong court-side that no pre-generated schedule can foresee:
// somebody due on court is still stuck in traffic, and somebody who isn't in
// the session at all turns up wanting a game or two. Both are handled by
// editing the schedule in place rather than regenerating it, because `scores`
// is keyed by each match's index in the flat array — regenerating, inserting
// or reordering entries would orphan every result already recorded. So the
// helpers below never add, remove, or move array entries. They only rewrite
// the contents of one match, or swap the `slot` numbers that decide *when*
// matches are played.

/**
 * Put `inId` on court in place of `outId` for one match. The rest of the slot
 * is fixed up too: a slot has one bench shared by every court playing it, so
 * the player coming off joins it and the player coming on leaves it.
 *
 * Returns the schedule unchanged (same reference) if the swap is impossible —
 * no such match, `outId` not on that court, or `inId` already playing the
 * same slot on the other court. Callers use the identity check to tell a
 * no-op from a real edit.
 */
export function substituteInSchedule(schedule = [], matchIndex, outId, inId) {
  const target = schedule[matchIndex]
  if (!target || !outId || !inId || outId === inId) return schedule
  if (![...target.team1, ...target.team2].includes(outId)) return schedule

  const slot = target.slot ?? matchIndex
  const inSlot = (match, i) => (match.slot ?? i) === slot
  // Nobody can be on two courts at once.
  const alreadyPlaying = schedule.some(
    (match, i) => inSlot(match, i) && [...match.team1, ...match.team2].includes(inId),
  )
  if (alreadyPlaying) return schedule

  return schedule.map((match, i) => {
    if (!inSlot(match, i)) return match
    const resting = [...(match.resting || []).filter((id) => id !== inId && id !== outId), outId]
    if (i !== matchIndex) return { ...match, resting }
    return {
      ...match,
      team1: match.team1.map((id) => (id === outId ? inId : id)),
      team2: match.team2.map((id) => (id === outId ? inId : id)),
      resting,
    }
  })
}

/**
 * Trade the running order of two slots — used when a player is still on the
 * way and a later round they aren't in can be pulled forward to buy time.
 *
 * The `slot` numbers move, not the array entries, so every already-recorded
 * score stays attached to the match it belongs to. Round numbers on screen
 * follow the clock rather than the match: whatever is played second is
 * "Round 2", which is what the umpire calls out.
 */
export function swapSlots(schedule = [], slotA, slotB) {
  if (slotA === slotB) return schedule
  return schedule.map((match, i) => {
    const slot = match.slot ?? i
    if (slot === slotA) return { ...match, slot: slotB }
    if (slot === slotB) return { ...match, slot: slotA }
    return match.slot === slot ? match : { ...match, slot }
  })
}

/** The same trade applied to a session's stored courts-per-slot plan. */
export function swapCourtPlanSlots(courtsBySlot, slotA, slotB) {
  if (!Array.isArray(courtsBySlot) || slotA === slotB) return courtsBySlot
  if (Math.max(slotA, slotB) >= courtsBySlot.length) return courtsBySlot
  const next = [...courtsBySlot]
  ;[next[slotA], next[slotB]] = [next[slotB], next[slotA]]
  return next
}

/**
 * Which slots can still be rewritten: everything after the last slot holding
 * any result at all. A slot with a result in it is left alone even if its
 * other court is still playing — rewriting half a slot would strand a
 * recorded score next to opponents who never played it.
 *
 * Anchoring on the LAST scored slot rather than the first unscored one
 * matters: an undo can leave an unscored slot sitting behind a scored one,
 * and redrawing from there would rewrite rounds that have already been played.
 *
 * Returns { fromSlot, courtsBySlot, indices } where `indices` are the schedule
 * array positions of the pending matches in playing order, or null if there is
 * nothing left to rewrite.
 */
export function pendingSlots(schedule = [], scores = {}) {
  const slots = groupBySlot(schedule)
  let lastScored = -1
  slots.forEach((slot, i) => {
    if (slot.matches.some(({ index }) => scores[index])) lastScored = i
  })
  const pending = slots.slice(lastScored + 1)
  if (!pending.length) return null
  return {
    fromSlot: pending[0].slot,
    courtsBySlot: pending.map((slot) => slot.matches.length),
    indices: pending.flatMap((slot) => slot.matches.map(({ index }) => index)),
  }
}

/**
 * Drop a freshly generated set of matches into the pending slots, keeping each
 * entry's array position, `slot` and `court` exactly as they were — only who
 * is on court changes. That's what lets a late arrival be worked into the rest
 * of the session without disturbing a single recorded score, since `scores` is
 * keyed by array position.
 *
 * `replacements` must line up with `pendingSlots().indices`; anything else is
 * refused (returns the schedule unchanged) rather than written half-applied.
 */
export function replacePendingMatches(schedule = [], indices = [], replacements = []) {
  if (!indices.length || indices.length !== replacements.length) return schedule
  const byIndex = new Map(indices.map((scheduleIndex, i) => [scheduleIndex, replacements[i]]))
  return schedule.map((match, i) => {
    const next = byIndex.get(i)
    if (!next) return match
    return { ...match, team1: next.team1, team2: next.team2, resting: next.resting }
  })
}

/**
 * Everyone who appears on court in the schedule but isn't a member of the
 * session — the drop-in players substituted in for a match or two. Derived
 * from the schedule rather than tracked separately so undoing a substitution
 * cleans up after itself.
 */
export function guestIdsIn(schedule = [], playerIds = []) {
  const members = new Set(playerIds)
  const guests = new Set()
  schedule.forEach((match) => {
    ;[...match.team1, ...match.team2].forEach((id) => {
      if (!members.has(id)) guests.add(id)
    })
  })
  return [...guests]
}

function shuffle(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// The 3 distinct ways to split 4 people into two teams of 2.
function teamSplits(four) {
  const [a, b, c, d] = four
  return [
    { team1: [a, b], team2: [c, d] },
    { team1: [a, c], team2: [b, d] },
    { team1: [a, d], team2: [b, c] },
  ]
}

function violatesForbidden(team1, team2, playersById) {
  const check = (ids) => {
    const [p1, p2] = ids.map((id) => playersById[id])
    if (!p1 || !p2) return false
    const c1 = p1.constraints || {}
    const c2 = p2.constraints || {}
    return (c1.forbiddenPartners || []).includes(p2.id) || (c2.forbiddenPartners || []).includes(p1.id)
  }
  const partnerViolation = check(team1) || check(team2)
  let opponentViolation = false
  for (const x of team1) {
    for (const y of team2) {
      const px = playersById[x]
      const py = playersById[y]
      if (!px || !py) continue
      const cx = px.constraints || {}
      const cy = py.constraints || {}
      if ((cx.forbiddenOpponents || []).includes(py.id) || (cy.forbiddenOpponents || []).includes(px.id)) {
        opponentViolation = true
      }
    }
  }
  return partnerViolation || opponentViolation
}

function scoreSplit({ team1, team2 }, state, slotIndex, playersById, duePairs = null) {
  let score = 0
  const partnerPairs = [
    [team1[0], team1[1]],
    [team2[0], team2[1]],
  ]
  const oppPairs = []
  for (const x of team1) for (const y of team2) oppPairs.push([x, y])

  for (const [a, b] of partnerPairs) {
    const key = pairKey(a, b)
    const count = state.partnerCount[key] || 0
    const lastSlot = state.partnerLastSlot[key]
    // A pair the user asked for that hasn't happened yet outweighs every other
    // consideration here - variety, spacing, repeat penalties - by design.
    if (duePairs && duePairs.has(key)) score -= 500
    // Heavily discourage repeat partnerships; more so if repeated recently.
    if (count > 0) {
      score += 40 * count
      if (lastSlot !== undefined) {
        const gap = slotIndex - lastSlot
        if (gap <= 2) score += 30 - gap * 10
      }
    } else {
      score -= 15 // reward covering a brand-new pair
    }
    // doubleWith target: this pair SHOULD partner exactly twice.
    const pa = playersById[a]
    const pb = playersById[b]
    const wantsDouble =
      (pa?.constraints?.doubleWith || []).includes(b) || (pb?.constraints?.doubleWith || []).includes(a)
    if (wantsDouble && count >= 2) score += 50 // already got their two, discourage a third
    if (wantsDouble && count < 2) score -= 10 // encourage reaching two
  }

  for (const [a, b] of oppPairs) {
    const key = pairKey(a, b)
    const count = state.opponentCount[key] || 0
    if (count > 0) score += 8 * count
  }

  // Discourage an exact repeat of the same 4 players with the same split
  const matchSignature = `${pairKey(team1[0], team1[1])}::${pairKey(team2[0], team2[1])}`
  if (state.recentMatchSignatures.has(matchSignature)) score += 60

  return score
}

// Best legal team split for one foursome, or null if all 3 splits are blocked
// by a forbidden-partner/opponent constraint.
function bestSplitFor(four, state, slotIndex, playersById, rng, duePairs = null) {
  let best = null
  let bestScore = Infinity
  for (const split of shuffle(teamSplits(four), rng)) {
    if (violatesForbidden(split.team1, split.team2, playersById)) continue
    const s = scoreSplit(split, state, slotIndex, playersById, duePairs)
    if (s < bestScore) {
      bestScore = s
      best = split
    }
  }
  return best ? { split: best, score: bestScore } : null
}

// The 35 ways to deal 8 players onto two courts of 4. The first player is
// pinned to court 1 so we don't enumerate each partition twice (A|B and B|A).
function twoCourtPartitions(eight) {
  const [pinned, ...rest] = eight
  const out = []
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      for (let k = j + 1; k < rest.length; k++) {
        const courtA = [pinned, rest[i], rest[j], rest[k]]
        const courtB = rest.filter((_, idx) => idx !== i && idx !== j && idx !== k)
        out.push([courtA, courtB])
      }
    }
  }
  return out
}

/**
 * Deal the slot's active players onto `courts` courts and pick each court's
 * teams. Two courts get an exhaustive search over all 35 deals (cheap, and
 * it materially improves pair coverage over greedy chunking); one court uses
 * the original single-foursome path including its swap-out fallback; three or
 * more fall back to greedy chunking in priority order.
 */
function assignCourts(activeIds, courts, eligiblePool, state, slotIndex, playersById, rng, duePairs = null) {
  if (courts === 1) {
    const four = activeIds.slice(0, 4)
    const direct = bestSplitFor(four, state, slotIndex, playersById, rng, duePairs)
    if (direct) return [direct.split]
    // All 3 splits violate a forbidden constraint for this exact foursome.
    // Try swapping one player out for another eligible player once.
    for (const swapOut of four) {
      const alternatives = eligiblePool.filter((id) => !four.includes(id))
      for (const alt of shuffle(alternatives, rng)) {
        const candidate = four.map((id) => (id === swapOut ? alt : id))
        const found = bestSplitFor(candidate, state, slotIndex, playersById, rng, duePairs)
        if (found) return [found.split]
      }
    }
    return null
  }

  if (courts === 2) {
    let best = null
    let bestScore = Infinity
    for (const [courtA, courtB] of twoCourtPartitions(activeIds)) {
      const a = bestSplitFor(courtA, state, slotIndex, playersById, rng, duePairs)
      if (!a) continue
      const b = bestSplitFor(courtB, state, slotIndex, playersById, rng, duePairs)
      if (!b) continue
      const total = a.score + b.score
      if (total < bestScore) {
        bestScore = total
        best = [a.split, b.split]
      }
    }
    return best
  }

  // 3+ courts: chunk in priority order. Not exhaustive, but nobody books
  // three courts for this group today and the fairness targets still hold.
  const matches = []
  for (let c = 0; c < courts; c++) {
    const found = bestSplitFor(activeIds.slice(c * 4, c * 4 + 4), state, slotIndex, playersById, rng, duePairs)
    if (!found) return null
    matches.push(found.split)
  }
  return matches
}

function pickActive(eligiblePool, mustPlaySet, matchesRemaining, restStreak, rng, count, forcedIds = new Set()) {
  // Forced players (half of an outstanding required pair) come first - they're
  // no use to the pair if the ordinary mustPlay queue crowds them out.
  // Then mustPlay (if more than `count`, take the ones with the greatest
  // matchesRemaining - they're the most "behind").
  const forcedArr = eligiblePool.filter((id) => forcedIds.has(id))
  const mustPlayArr = eligiblePool.filter((id) => mustPlaySet.has(id) && !forcedIds.has(id))
  const rest = eligiblePool.filter((id) => !mustPlaySet.has(id) && !forcedIds.has(id))

  const byPriority = (ids) =>
    shuffle(ids, rng).sort((a, b) => {
      const diff = (matchesRemaining[b] || 0) - (matchesRemaining[a] || 0)
      if (diff !== 0) return diff
      return (restStreak[b] || 0) - (restStreak[a] || 0)
    })

  let chosen = byPriority(forcedArr).slice(0, count)
  if (chosen.length < count) {
    chosen = chosen.concat(byPriority(mustPlayArr).slice(0, count - chosen.length))
  }
  if (chosen.length < count) {
    chosen = chosen.concat(byPriority(rest).slice(0, count - chosen.length))
  }
  return chosen.length === count ? chosen : null
}

/**
 * Share the session's player-slots out as evenly as possible without letting
 * anyone exceed their ceiling. Ceilings come from matchCaps and from the
 * structural limit that nobody can play twice in one slot.
 *
 * Water filling: hand each player the smaller of their cap and an even share
 * of what's left, cheapest cap first, so every slot a capped player declines
 * is re-offered to the players who can still take it.
 */
function assignTargets(ids, totalPlayerSlots, totalSlots, matchCaps, rng) {
  const caps = {}
  for (const id of ids) {
    const asked = matchCaps[id]
    caps[id] = Math.max(0, Math.min(asked == null ? Infinity : asked, totalSlots))
  }

  const targets = {}
  let remaining = totalPlayerSlots
  let left = ids.length
  for (const id of [...ids].sort((a, b) => caps[a] - caps[b])) {
    targets[id] = Math.min(caps[id], Math.floor(remaining / left))
    remaining -= targets[id]
    left--
  }

  // Flooring above leaves a few slots over; give them to whoever still has
  // headroom. Randomised so it isn't always the same players topped up.
  for (const id of shuffle(ids, rng)) {
    if (remaining <= 0) break
    if (targets[id] < caps[id]) {
      targets[id] += 1
      remaining -= 1
    }
  }

  // Anything still left means every player is at their ceiling and the courts
  // can't be filled - the caller turns this into a warning.
  return { targets, shortfall: Math.max(0, remaining) }
}

function attemptSchedule(players, courtsBySlot, seed, warmupRestIds = [], matchCaps = {}, requiredPairs = []) {
  const rng = mulberry32(seed)
  const playersById = Object.fromEntries(players.map((p) => [p.id, p]))
  const ids = players.map((p) => p.id)
  const n = ids.length
  const totalSlots = courtsBySlot.length
  const totalMatches = courtsBySlot.reduce((sum, c) => sum + c, 0)
  const { targets: targetByPlayer, shortfall } = assignTargets(ids, 4 * totalMatches, totalSlots, matchCaps, rng)
  // A player's own limit, kept separate from their target: the target is what
  // the schedule aims to give them, the cap is what it must not exceed even
  // when the court would otherwise go short.
  const hardCap = {}
  for (const id of ids) if (matchCaps[id] != null) hardCap[id] = Math.max(0, matchCaps[id])

  const state = {
    matchesPlayed: Object.fromEntries(ids.map((id) => [id, 0])),
    activeStreak: Object.fromEntries(ids.map((id) => [id, 0])),
    restStreak: Object.fromEntries(ids.map((id) => [id, 0])),
    maxActiveStreak: Object.fromEntries(ids.map((id) => [id, 0])),
    earlyMatches: Object.fromEntries(ids.map((id) => [id, 0])),
    partnerCount: {},
    partnerLastSlot: {},
    opponentCount: {},
    recentMatchSignatures: new Set(),
  }

  const schedule = []
  const warnings = []
  // Required partnerships still owed: pairKey -> the slot from which we start
  // actively steering towards it. Spread across the session so they don't all
  // pile into the opening rounds; varies with the seed like everything else.
  const latestDueSlot = Math.max(0, Math.floor(totalSlots * 0.7) - 1)
  const outstandingPairs = new Map(
    requiredPairs.map(({ a, b }) => [pairKey(a, b), Math.floor(rng() * (latestDueSlot + 1))]),
  )

  for (let slot = 0; slot < totalSlots; slot++) {
    const courts = courtsBySlot[slot]
    const needed = 4 * courts
    if (n < needed) return null // caller should have clamped the plan
    const benchSize = n - needed
    const remainingSlotsInclusive = totalSlots - slot
    const mustRestSet = new Set()
    const mustPlaySet = new Set()

    // Players who asked to skip slot 1 to warm up - honored as a soft
    // preference (relaxed below like any other mustRest player if the
    // courts can't otherwise be filled), and first in line for the bench.
    if (slot === 0) {
      for (const id of warmupRestIds) if (ids.includes(id)) mustRestSet.add(id)
    }

    // Rest candidates, most deserving first. Only as many as there are bench
    // spots actually get benched - see design note 4. With exactly 4 players
    // per court and no bench there's nothing to rotate onto, so this whole
    // block is skipped rather than churning out a relax warning every slot.
    const restCandidates = []
    for (const id of ids) {
      if (mustRestSet.has(id)) continue
      const remaining = targetByPlayer[id] - state.matchesPlayed[id]
      if (hardCap[id] != null && state.matchesPlayed[id] >= hardCap[id]) {
        // Someone's personal limit outranks ordinary fatigue and fairness:
        // they take the bench ahead of anyone who is merely tired or ahead.
        restCandidates.push({ id, priority: 100 })
      } else if (state.activeStreak[id] >= 2) {
        restCandidates.push({ id, priority: 10 + state.activeStreak[id] })
      } else if (remaining <= 0) {
        restCandidates.push({ id, priority: 1 }) // hit their target, let others catch up
      }
    }
    restCandidates.sort(
      (a, b) => b.priority - a.priority || state.matchesPlayed[b.id] - state.matchesPlayed[a.id],
    )
    for (const { id } of restCandidates.slice(0, Math.max(0, benchSize - mustRestSet.size))) {
      mustRestSet.add(id)
    }

    for (const id of ids) {
      // Someone at their personal limit is never *required* to play, however
      // long they've been sitting - that's the whole point of the limit.
      if (hardCap[id] != null && state.matchesPlayed[id] >= hardCap[id]) continue
      const remaining = targetByPlayer[id] - state.matchesPlayed[id]
      // A player can only take one match per slot, so remaining slots is the
      // right ceiling on how many matches they can still fit in.
      if (state.restStreak[id] >= 2) mustPlaySet.add(id)
      if (remaining >= remainingSlotsInclusive && remaining > 0) mustPlaySet.add(id)
    }

    // Hard rule wins: never let a mustRest player be forced to play.
    for (const id of mustRestSet) mustPlaySet.delete(id)

    let eligiblePool = ids.filter((id) => !mustRestSet.has(id))
    if (eligiblePool.length < needed) {
      // Only reachable when warm-up rests exceed the bench. Relax the least
      // important (those with lowest matchesPlayed) rather than fail outright.
      const relaxCandidates = ids
        .filter((id) => mustRestSet.has(id) && !mustPlaySet.has(id))
        .sort((a, b) => state.matchesPlayed[a] - state.matchesPlayed[b])
      let relaxedCount = 0
      while (eligiblePool.length < needed && relaxCandidates.length) {
        const id = relaxCandidates.shift()
        mustRestSet.delete(id)
        eligiblePool.push(id)
        relaxedCount++
      }
      if (relaxedCount > 0) {
        warnings.push(
          `Round ${slot + 1}: relaxed rest rule for ${relaxedCount} player${relaxedCount > 1 ? 's' : ''} to fill the court${courts > 1 ? 's' : ''}.`,
        )
      }
    }
    if (eligiblePool.length < needed) return null // truly infeasible for this seed

    const matchesRemaining = Object.fromEntries(
      ids.map((id) => [id, targetByPlayer[id] - state.matchesPlayed[id]]),
    )

    // Put outstanding required pairs on court, up to what the slot can hold
    // (a court fits two whole pairs). Overlapping pairs wait their turn - one
    // player can only partner one person per match, so forcing both would
    // just waste a slot.
    // Pairs that have reached their due slot. Ones still waiting are invisible
    // to both the bounty and the forcing, which is what keeps them out of the
    // opening rounds.
    const duePairs = new Set()
    for (const [key, dueSlot] of outstandingPairs) if (slot >= dueSlot) duePairs.add(key)

    const forcedIds = new Set()
    if (duePairs.size) {
      const claimed = new Set()
      for (const { a, b } of requiredPairs) {
        if (forcedIds.size >= needed) break
        if (!duePairs.has(pairKey(a, b))) continue
        if (mustRestSet.has(a) || mustRestSet.has(b)) continue // a rest rule or personal cap outranks this
        if (claimed.has(a) || claimed.has(b)) continue
        claimed.add(a)
        claimed.add(b)
        forcedIds.add(a)
        forcedIds.add(b)
      }
    }

    const activeIds = pickActive(
      eligiblePool,
      mustPlaySet,
      matchesRemaining,
      state.restStreak,
      rng,
      needed,
      forcedIds,
    )
    if (!activeIds) return null

    const matches = assignCourts(activeIds, courts, eligiblePool, state, slot, playersById, rng, duePairs)
    if (!matches) return null // give up on this seed

    // Commit state updates for the whole slot. Streaks tick per slot, not per
    // match - "played two slots back to back" is the real fatigue measure.
    const active = matches.flatMap((m) => [...m.team1, ...m.team2])
    const activeSet = new Set(active)
    const resting = ids.filter((id) => !activeSet.has(id))
    for (const id of active) {
      state.matchesPlayed[id] += 1
      state.activeStreak[id] += 1
      state.maxActiveStreak[id] = Math.max(state.maxActiveStreak[id], state.activeStreak[id])
      state.restStreak[id] = 0
      if (slot < 5) state.earlyMatches[id] += 1
    }
    for (const id of resting) {
      state.restStreak[id] += 1
      state.activeStreak[id] = 0
    }
    for (const m of matches) {
      const partnerKey1 = pairKey(m.team1[0], m.team1[1])
      const partnerKey2 = pairKey(m.team2[0], m.team2[1])
      state.partnerCount[partnerKey1] = (state.partnerCount[partnerKey1] || 0) + 1
      state.partnerCount[partnerKey2] = (state.partnerCount[partnerKey2] || 0) + 1
      state.partnerLastSlot[partnerKey1] = slot
      state.partnerLastSlot[partnerKey2] = slot
      outstandingPairs.delete(partnerKey1)
      outstandingPairs.delete(partnerKey2)
      for (const x of m.team1) {
        for (const y of m.team2) {
          const k = pairKey(x, y)
          state.opponentCount[k] = (state.opponentCount[k] || 0) + 1
        }
      }
      state.recentMatchSignatures.add(`${partnerKey1}::${partnerKey2}`)
    }
    while (state.recentMatchSignatures.size > 5) {
      state.recentMatchSignatures.delete(state.recentMatchSignatures.values().next().value)
    }

    // `resting` is the slot's bench, identical on both courts of a slot -
    // players on the other court are playing, not resting.
    matches.forEach((m, courtIndex) => {
      schedule.push({ team1: m.team1, team2: m.team2, resting, slot, court: courtIndex + 1 })
    })
  }

  // Post-hoc validation
  for (const p of players) {
    if (p.constraints?.earlyMatchRequired && state.earlyMatches[p.id] < 3) {
      warnings.push(`${p.name}: earlyMatchRequired not fully satisfied (${state.earlyMatches[p.id]}/3 in first 5 rounds).`)
    }
  }
  for (const p of players) {
    const cap = hardCap[p.id]
    if (cap != null && state.matchesPlayed[p.id] > cap) {
      warnings.push(
        `${p.name} played ${state.matchesPlayed[p.id]} of a requested ${cap} - the court couldn't be filled otherwise.`,
      )
    }
  }
  if (shortfall > 0) {
    warnings.push(
      `Match limits leave ${shortfall} court slot${shortfall > 1 ? 's' : ''} unfilled - some limits had to be exceeded.`,
    )
  }
  // Capped players are meant to sit out more, so they're excluded from the
  // evenness check - otherwise every limited session reports a false spread.
  const nameOf = (id) => playersById[id]?.name || id
  for (const { a, b } of requiredPairs) {
    if (outstandingPairs.has(pairKey(a, b))) {
      warnings.push(`${nameOf(a)} & ${nameOf(b)} never got a match as partners.`)
    }
  }
  const unmetRequired = outstandingPairs.size

  const uncappedCounts = ids.filter((id) => hardCap[id] == null).map((id) => state.matchesPlayed[id])
  const spread = uncappedCounts.length ? Math.max(...uncappedCounts) - Math.min(...uncappedCounts) : 0
  if (spread > 1) warnings.push(`Match distribution spread is ${spread} (target: max 1).`)

  // Fitness: reward pair coverage + spacing, used to rank seeds.
  let totalPairs = 0
  let coveredPairs = 0
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      totalPairs++
      if ((state.partnerCount[pairKey(ids[i], ids[j])] || 0) > 0) coveredPairs++
    }
  }
  const coverageRatio = totalPairs ? coveredPairs / totalPairs : 1
  // A schedule only contains 2 partnerships per match, so on a short session
  // with a big group full pair coverage is arithmetically out of reach. Rank
  // against what's actually achievable so the "perfect result" early exit can
  // still fire (without this, every multi-court plan burns all 500 seeds).
  const maxCoverageRatio = totalPairs ? Math.min(1, (2 * totalMatches) / totalPairs) : 1
  // An unmet required pair dominates the fitness: a seed that honours the
  // user's explicit request beats a tidier one that ignores it, every time.
  const fitness = coverageRatio * 1000 - warnings.length * 20 - spread * 50 - unmetRequired * 5000

  return {
    schedule,
    warnings,
    unmetRequired,
    stats: {
      matchesPlayed: { ...state.matchesPlayed },
      targetByPlayer,
      coverageRatio,
      maxCoverageRatio,
      spread,
      longestRunWithoutBreak: Math.max(...ids.map((id) => state.maxActiveStreak[id])),
    },
    coverageRatio,
    maxCoverageRatio,
    fitness,
  }
}

/**
 * Generate the best schedule found across multiple seed attempts.
 * @param {Array} playerList - [{ id, name, constraints }]
 * @param {Object} sessionConstraints - reserved for future session-level rules
 * @param {Object} options - { seed, maxAttempts, courtsBySlot, totalRounds,
 *                             matchesPerPlayer, warmupRestIds, matchCaps }
 *   `matchCaps` is { playerId: maxMatches } - a personal ceiling, see note 5.
 *   `requiredPairs` is [{ a, b }] - partner at least once, see note 6.
 *   `courtsBySlot` wins when present; otherwise a single-court plan is built
 *   from totalRounds / matchesPerPlayer exactly as before.
 * @returns {{ schedule, warnings, stats, courtsBySlot, totalRounds, totalSlots,
 *             totalMatches, seedUsed } | null}
 */
export function generateSchedule(playerList, sessionConstraints = {}, options = {}) {
  if (!playerList || playerList.length < 4) return null
  const n = playerList.length

  let courtsBySlot
  const warnings = []
  if (options.courtsBySlot?.length) {
    courtsBySlot = clampCourtPlan(options.courtsBySlot, n)
    const droppedSlots = courtsBySlot.filter((c, i) => c < options.courtsBySlot[i]).length
    if (droppedSlots > 0) {
      warnings.push(
        `${droppedSlots} round${droppedSlots > 1 ? 's' : ''} dropped to ${Math.floor(n / 4)} court${Math.floor(n / 4) > 1 ? 's' : ''}: ${n} players can't fill more.`,
      )
    }
  } else {
    const totalRounds =
      options.totalRounds ||
      (options.matchesPerPlayer
        ? roundsForMatchesPerPlayer(n, options.matchesPerPlayer)
        : computeTotalRounds(n))
    courtsBySlot = Array.from({ length: totalRounds }, () => 1)
  }

  const maxAttempts = options.maxAttempts || 500
  // Attempt count alone doesn't bound the wall clock: a plan whose warnings
  // can never all be cleared (e.g. more warm-up rests than bench spots) never
  // hits the early exit, and two-court slots cost ~10x a single-court slot to
  // search. The deadline keeps generation snappy whatever shape it's handed;
  // whatever the best seed so far is when it trips is what we return.
  const deadline = Date.now() + (options.maxMs || 800)
  const baseSeed = options.seed ?? Math.floor(Math.random() * 1e9)
  const warmupRestIds = options.warmupRestIds || []
  const matchCaps = options.matchCaps || {}
  // Drop rules naming anyone who isn't playing (sat out after the rule was
  // added), so they can't quietly make every seed look unsatisfiable.
  const playing = new Set(playerList.map((p) => p.id))
  const requiredPairs = (options.requiredPairs || []).filter(
    ({ a, b }) => a !== b && playing.has(a) && playing.has(b),
  )

  let best = null
  let bestSeed = null
  for (let i = 0; i < maxAttempts; i++) {
    if (best && Date.now() > deadline) break
    const seed = baseSeed + i * 7919 // step by a prime to decorrelate seeds
    const result = attemptSchedule(playerList, courtsBySlot, seed, warmupRestIds, matchCaps, requiredPairs)
    if (!result) continue
    if (!best || result.fitness > best.fitness) {
      best = result
      bestSeed = seed
    }
    // Early exit on a "perfect" result: best achievable pair coverage, no
    // warnings. See maxCoverageRatio above for why this isn't just === 1.
    if (result.coverageRatio >= result.maxCoverageRatio && result.warnings.length === 0 && !result.unmetRequired) break
  }

  if (!best) return null
  return {
    ...best,
    warnings: [...warnings, ...best.warnings],
    courtsBySlot,
    totalRounds: courtsBySlot.length, // slots; kept under the old name for callers
    totalSlots: courtsBySlot.length,
    totalMatches: courtsBySlot.reduce((sum, c) => sum + c, 0),
    seedUsed: bestSeed,
  }
}

/**
 * Regenerate with a fresh seed (used by the "Regenerate" button). Keeps the
 * court plan fixed to whatever the original generation used, so regenerating
 * doesn't silently drop a user-chosen round count or second court.
 */
export function regenerateSchedule(playerList, sessionConstraints = {}, options = {}) {
  const nextSeed = Math.floor(Math.random() * 1e9)
  return generateSchedule(playerList, sessionConstraints, { ...options, seed: nextSeed })
}

/**
 * Builds ephemeral player objects with session-only overrides layered on top
 * of each player's saved constraints, without mutating the stored records:
 * - sittingOutIds: players excluded from the generated matches entirely
 *   (still shown as "resting" every round by the caller, still counted for
 *   cost-splitting - this function only concerns who's eligible to play).
 * - avoidPairs: [{ a, b, type: 'partner' | 'opponent' }] - one-off "keep
 *   these two apart" rules for this session only.
 */
export function applySessionOverrides(playerList, { sittingOutIds = [], avoidPairs = [] } = {}) {
  const sittingOut = new Set(sittingOutIds)
  const eligible = playerList.filter((p) => !sittingOut.has(p.id))
  const byId = Object.fromEntries(
    eligible.map((p) => [
      p.id,
      {
        ...p,
        constraints: {
          ...p.constraints,
          forbiddenPartners: [...(p.constraints?.forbiddenPartners || [])],
          forbiddenOpponents: [...(p.constraints?.forbiddenOpponents || [])],
        },
      },
    ]),
  )
  for (const { a, b, type } of avoidPairs) {
    if (!byId[a] || !byId[b]) continue
    const key = type === 'opponent' ? 'forbiddenOpponents' : 'forbiddenPartners'
    byId[a].constraints[key].push(b)
    byId[b].constraints[key].push(a)
  }
  return Object.values(byId)
}
