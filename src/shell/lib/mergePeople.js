// mergePeople.js
//
// Framework-agnostic, side-effect free, like the schedule/stats/expense
// engines — no Firestore or React here, just plain data in, plain data out,
// so it can be tested without mocking anything.
//
// Combines three sources into one list of "people" for the shared Players
// page and the expense engine's fairness pool:
//   - shuttlePlayers  — raw docs from players/{id} (Shuttle's usePlayers())
//   - cricketPlayers  — raw docs from cricketPlayers/{id} (Cricket's usePlayers())
//   - links           — playerLinks docs (usePlayerLinks())
//
// A linked person produces ONE merged row. An unlinked sport-specific
// player produces their own row, keyed by a `sport:rawId` composite id —
// this is the "unlinked players are fine by default" behavior: nothing
// breaks, they just don't merge with anything yet.

/**
 * @returns [{
 *   id,                  // linkId, or 'shuttle:<id>' / 'cricket:<id>' if unlinked
 *   name,
 *   isActive,            // active in EITHER sport counts as active overall
 *   linked,              // true only if playing both sports under one link
 *   shuttlePlayerId,     // or null
 *   cricketPlayerId,     // or null
 *   shuttleProfile,      // raw shuttle player doc, or null
 *   cricketProfile,      // raw cricket player doc, or null
 * }]
 */
export function mergePeople(shuttlePlayers = [], cricketPlayers = [], links = []) {
  const shuttleById = Object.fromEntries(shuttlePlayers.map((p) => [p.id, p]))
  const cricketById = Object.fromEntries(cricketPlayers.map((p) => [p.id, p]))

  const claimedShuttleIds = new Set()
  const claimedCricketIds = new Set()

  const merged = links.map((link) => {
    const shuttleProfile = link.shuttlePlayerId ? shuttleById[link.shuttlePlayerId] || null : null
    const cricketProfile = link.cricketPlayerId ? cricketById[link.cricketPlayerId] || null : null
    if (link.shuttlePlayerId) claimedShuttleIds.add(link.shuttlePlayerId)
    if (link.cricketPlayerId) claimedCricketIds.add(link.cricketPlayerId)

    return {
      id: link.id,
      name: link.name,
      // Active if active in either sport they're linked to. A stale/deleted
      // reference (profile is null) doesn't count as active on that side.
      isActive: Boolean(shuttleProfile?.isActive) || Boolean(cricketProfile?.isActive),
      linked: Boolean(link.shuttlePlayerId && link.cricketPlayerId),
      shuttlePlayerId: link.shuttlePlayerId || null,
      cricketPlayerId: link.cricketPlayerId || null,
      shuttleProfile,
      cricketProfile,
    }
  })

  for (const p of shuttlePlayers) {
    if (claimedShuttleIds.has(p.id)) continue
    merged.push({
      id: `shuttle:${p.id}`,
      name: p.name,
      isActive: Boolean(p.isActive),
      linked: false,
      shuttlePlayerId: p.id,
      cricketPlayerId: null,
      shuttleProfile: p,
      cricketProfile: null,
    })
  }

  for (const p of cricketPlayers) {
    if (claimedCricketIds.has(p.id)) continue
    merged.push({
      id: `cricket:${p.id}`,
      name: p.name,
      isActive: Boolean(p.isActive),
      linked: false,
      shuttlePlayerId: null,
      cricketPlayerId: p.id,
      shuttleProfile: null,
      cricketProfile: p,
    })
  }

  return merged
}

/**
 * Builds a { 'shuttle:<rawId>': personId, 'cricket:<rawId>': personId } index
 * from a merged people list — the lookup an expense's (sport, paidBy) pair
 * needs to resolve to a person id (see expenseEngine.js's `resolvePersonId`
 * usage). Kept as its own function so callers who only need resolution
 * (e.g. the expenses hook) don't need to re-derive it from scratch.
 */
export function buildPersonIndex(mergedPeople) {
  const index = {}
  for (const person of mergedPeople) {
    if (person.shuttlePlayerId) index[`shuttle:${person.shuttlePlayerId}`] = person.id
    if (person.cricketPlayerId) index[`cricket:${person.cricketPlayerId}`] = person.id
  }
  return index
}

/**
 * Stamps `personId` onto each expense using the index above — the one step
 * expenseEngine.js expects the CALLER to have done before handing it
 * expenses (see that file's header comment). Expenses whose (sport, paidBy)
 * pair isn't in the index yet (shouldn't normally happen — every player was
 * created through one of the two sports' rosters) fall back to the raw
 * composite key rather than being silently dropped.
 */
export function attachPersonIds(expenses, personIndex) {
  return expenses.map((e) => {
    const key = `${e.sport}:${e.paidBy}`
    return { ...e, personId: personIndex[key] || key }
  })
}
