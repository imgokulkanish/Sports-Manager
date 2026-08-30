// engine/guests.js
//
// A guest is someone who turned up for a game without being on the roster.
// Sessions already have a shape for that - anyone on court who isn't in
// `playerIds` is listed in `guestIds` and sorts below the members on the
// session board (see sessionLeaderboard) - but until now a guest still had
// to BE a player record, so a passer-by who played one game was on the
// roster forever.
//
// Quick matches take the other route: the guest gets a synthetic id that
// lives only inside that day's quick-play document, with their name stored
// beside it in `guestNames`. Nothing is written to the players collection,
// so they never appear on the roster, in the stats pages, or in anyone's
// partner/opponent records - computePlayerStats keys off real player records
// and skips ids it doesn't know. The match itself still counts in full for
// the roster players who were on court.
//
// The prefix is what tells the two apart, so it has to be something a
// Firestore document id can never be. Firestore ids are alphanumeric, so a
// colon is safe.

export const GUEST_PREFIX = 'guest:'

export function isGuestId(id) {
  return typeof id === 'string' && id.startsWith(GUEST_PREFIX)
}

/** A fresh guest id. Only ever has to be unique within one day's document. */
export function newGuestId() {
  return `${GUEST_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/**
 * The session's guests as pseudo player records, keyed by id. Everything in
 * the app names people by looking them up in a `playersById` map, so handing
 * that map the guests as well is enough to name them in schedule tables,
 * leaderboards, the PDF and the CSV without threading a second lookup
 * through every component.
 */
export function guestPlayersOf(session) {
  const names = session?.guestNames || {}
  return Object.fromEntries(Object.entries(names).map(([id, name]) => [id, { id, name, isGuest: true }]))
}

/**
 * `playersById` with the session's off-roster guests folded in. Returns the
 * original map untouched when there are none, so it stays cheap to call from
 * a memo on pages that will never see a guest.
 */
export function withGuests(playersById, session) {
  const guests = guestPlayersOf(session)
  return Object.keys(guests).length ? { ...playersById, ...guests } : playersById
}

/**
 * Keep only the names of guests still on court, so removing the last match a
 * guest played takes their name off the document rather than leaving it
 * behind as an orphan.
 */
export function pruneGuestNames(guestIds, names = {}) {
  return Object.fromEntries(guestIds.filter((id) => names[id]).map((id) => [id, names[id]]))
}
