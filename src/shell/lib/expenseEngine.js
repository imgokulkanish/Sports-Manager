// expenseEngine.js (shared, joint-pot version)
//
// Evolves Shuttle Manager's existing engine (same file, not a rewrite) to
// pool badminton + cricket spending into one fairness rotation, per your
// call to make it a joint pot rather than per-sport.
//
// WHAT CHANGED FROM THE ORIGINAL, AND WHY:
//   - `players` (Shuttle-only) becomes `people`: an array the CALLER builds
//     by resolving every expense's (sport, paidBy) pair through playerLinks
//     first. This engine stays framework-agnostic and Firestore-free, same
//     as the original — it doesn't know about playerLinks, Firestore, or
//     either sport's players collection. It just groups by whatever `id`
//     the caller hands it.
//   - Everything else — the ranking (least spent, then fewest times paid,
//     then longest ago, then name), the "one pool not per category" design,
//     the null-amount-still-counts-as-a-turn rule — was UNCHANGED. Pooling
//     across sports doesn't need new ranking logic, only a different
//     grouping key upstream.
//   - ADDED SINCE: a recent-big-payment cooldown sits ABOVE that ranking —
//     see the block above BIG_PAYMENT_AMOUNT for what it does and why it
//     deprioritises rather than excludes.
//
// GRACEFUL DEGRADATION WITHOUT playerLinks: if the caller hasn't built
// playerLinks yet (or a given player isn't linked), it should hand this
// engine one `people` row per unlinked sport-specific player — e.g.
// `{ id: 'shuttle:abc123', name, isActive }` — rather than fail or block.
// Once that player is linked, the caller's join naturally starts handing
// this engine ONE row with the combined identity, and their spending
// merges retroactively with no data rewrite. This file has no awareness of
// that transition either way — it's entirely the caller's join logic.
//
// Framework-agnostic and side-effect free, like the original, so the
// fairness logic can be reasoned about (and tested) without a browser or
// Firestore anywhere near it.

/** How far back the fairness calculation looks. */
export const SPEND_WINDOW_MONTHS = 2

function toTime(value) {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Start of the window: `months` calendar months before now. */
export function windowStart(months = SPEND_WINDOW_MONTHS, from = new Date()) {
  const d = new Date(from)
  d.setMonth(d.getMonth() - months)
  return d
}

// THE RECENT-BIG-PAYMENT COOLDOWN.
//
// The two-month pot on its own has a blind spot: someone who fronted a
// single heavy bill a few days ago can still sit at the top of the rotation
// purely because that is the only time they have ever paid, while people
// who chip in small amounts every week sit below them. Asking that person
// again this week is the exact thing the rotation exists to prevent, even
// though the two-month arithmetic says they owe the most.
//
// So: one entry over BIG_PAYMENT_AMOUNT inside the last
// BIG_PAYMENT_WINDOW_DAYS sends a person to the BACK of the order rather
// than out of it. Deprioritise, don't exclude — with a hard skip, an
// evening where everyone happened to front something big would leave the
// card with nobody to name at all. Sorted last, the rotation always still
// has an answer, and it degrades to plain lowest-spend order the moment
// nobody is inside the cooldown.
//
// It is a SINGLE entry's amount that counts, not the two-week total:
// "fronted more than 80 in one go recently" is what earns a rest, while
// four 25s over two weeks is exactly the steady chipping-in the rotation
// is meant to keep rewarding.

/** A single entry above this (SAR) counts as having fronted a big one. */
export const BIG_PAYMENT_AMOUNT = 80

/** How recently that big entry has to be to still count. */
export const BIG_PAYMENT_WINDOW_DAYS = 14

/** Start of the cooldown window: `days` before now. */
export function cooldownStart(days = BIG_PAYMENT_WINDOW_DAYS, from = new Date()) {
  const d = new Date(from)
  d.setDate(d.getDate() - days)
  return d
}

function inWindow(expenses, months) {
  const cutoff = windowStart(months).getTime()
  // `personId` replaces the original's implicit reliance on `paidBy` being
  // a Shuttle players/{id} — the caller has already resolved it (see file
  // header). Falls back to `paidBy` so pre-migration callers/tests that
  // haven't adopted personId yet don't silently drop every row.
  return (expenses || []).filter((e) => e && (e.personId || e.paidBy) && toTime(e.date) >= cutoff)
}

/**
 * Per-person spend summary over the window, across every category AND
 * every sport — this is the joint-pot behavior. `people` covers all ACTIVE
 * people (linked identities + any not-yet-linked sport-specific players),
 * including those who have paid nothing - they are exactly who the
 * suggestion needs to surface.
 *
 * Returns [{ personId, name, timesPaid, totalAmount, lastPaidDate,
 * recentBig, onCooldown }], ordered most-due first — cooled-down people
 * last, then least spent.
 */
export function buildSpendSummary(
  expenses,
  people,
  { months = SPEND_WINDOW_MONTHS, bigAmount = BIG_PAYMENT_AMOUNT, bigWindowDays = BIG_PAYMENT_WINDOW_DAYS } = {},
) {
  const active = (people || []).filter((p) => p.isActive)
  const scoped = inWindow(expenses, months)
  // The cooldown window sits inside the spend window, so `scoped` already
  // holds every entry that could qualify — no second pass over the raw list.
  const bigCutoff = cooldownStart(bigWindowDays).getTime()

  return active
    .map((person) => {
      const theirs = scoped.filter((e) => (e.personId || e.paidBy) === person.id)
      // The biggest qualifying entry, not the latest one: if someone fronted
      // a 200 and then a 90, the 200 is what the board should name.
      const big = theirs
        .filter((e) => Number(e.amount) > bigAmount && toTime(e.date) >= bigCutoff)
        .reduce((best, e) => (!best || Number(e.amount) > Number(best.amount) ? e : best), null)
      return {
        personId: person.id,
        name: person.name,
        timesPaid: theirs.length,
        totalAmount: theirs.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
        lastPaidDate: theirs.reduce((latest, e) => (toTime(e.date) > toTime(latest) ? e.date : latest), null),
        recentBig: big ? { amount: Number(big.amount), date: big.date } : null,
        onCooldown: Boolean(big),
      }
    })
    .sort(compareByDueness)
}

/** Least contribution first. Every term is a per-row value, so this is a total order. */
function compareByDueness(a, b) {
  // Ahead of the money, deliberately: whoever fronted a big one in the last
  // couple of weeks goes to the back whatever the two-month total says.
  // Everything below is the original ranking, now applied WITHIN each group
  // — so the cooled-down people are still ordered sensibly among themselves
  // for the evening when every single person is inside the cooldown.
  if (a.onCooldown !== b.onCooldown) return a.onCooldown ? 1 : -1
  if (a.totalAmount !== b.totalAmount) return a.totalAmount - b.totalAmount
  if (a.timesPaid !== b.timesPaid) return a.timesPaid - b.timesPaid
  const byDate = toTime(a.lastPaidDate) - toTime(b.lastPaidDate) // longest ago first
  if (byDate !== 0) return byDate
  return a.name.localeCompare(b.name)
}

/**
 * Suggest who should pay next: whoever has put in the least across BOTH
 * sports over the window. Same semantics as the original — `exclude` skips
 * specific people for one evening's UI state without touching anyone's
 * standing.
 */
export function suggestNextPayer(
  expenses,
  people,
  {
    months = SPEND_WINDOW_MONTHS,
    exclude = [],
    bigAmount = BIG_PAYMENT_AMOUNT,
    bigWindowDays = BIG_PAYMENT_WINDOW_DAYS,
  } = {},
) {
  const scoped = inWindow(expenses, months)
  if (!scoped.length) return null

  // No cooldown filtering of its own: compareByDueness has already put
  // anyone who fronted a big one recently at the back, so taking the first
  // un-excluded row honours the cooldown AND still names someone on the
  // night when everybody is inside it.
  const summary = buildSpendSummary(expenses, people, { months, bigAmount, bigWindowDays })
  const skip = new Set(exclude)
  const rank = summary.findIndex((row) => !skip.has(row.personId))
  if (rank === -1) return null

  const pick = summary[rank]
  return {
    personId: pick.personId,
    totalAmount: pick.totalAmount,
    rank: rank + 1,
    recentBig: pick.recentBig,
    onCooldown: pick.onCooldown,
    reason: reasonFor(pick, months),
  }
}

function reasonFor(row, months) {
  const window = `${months} month${months === 1 ? '' : 's'}`
  // Only reachable when EVERY candidate is inside the cooldown, so say that
  // plainly rather than quoting a lowest-spend figure that would read as if
  // the rule had been ignored.
  if (row.onCooldown) {
    return `everyone's fronted a big one lately — lowest spend: SAR ${row.totalAmount.toFixed(2)} in ${window}`
  }
  if (row.timesPaid === 0) return `hasn't paid in the last ${window}`
  if (row.totalAmount === 0) {
    return `paid ${row.timesPaid} time${row.timesPaid === 1 ? '' : 's'}, no amounts recorded`
  }
  return `lowest spend: SAR ${row.totalAmount.toFixed(2)} in ${window}`
}

/** Total logged across everyone, both sports, in the window. */
export function windowTotal(expenses, { months = SPEND_WINDOW_MONTHS } = {}) {
  return inWindow(expenses, months).reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
}

/**
 * The last amount actually recorded for a category, or null. Unchanged from
 * the original — categories are still looked up by their own value
 * regardless of which sport they belong to (see expenseCategories.js).
 */
export function lastAmountFor(expenses, category) {
  const rows = (expenses || []).filter((e) => e && e.category === category && Number(e.amount) > 0)
  if (!rows.length) return null
  const latest = rows.reduce((best, e) => (toTime(e.date) > toTime(best.date) ? e : best))
  return Number(latest.amount)
}

/**
 * Spend grouped by calendar month, newest first, across BOTH sports.
 * `byCategory` now naturally spans both sports' category values since
 * they're non-overlapping strings — a cricket "ground" entry and a shuttle
 * "court" entry both just add their own key to the same bucket.
 *
 * Returns [{ key, year, month, total, count, byCategory, top }].
 */
export function monthlySummary(expenses, people, { limit = 12 } = {}) {
  const names = Object.fromEntries((people || []).map((p) => [p.id, p.name]))
  const months = new Map()

  for (const e of expenses || []) {
    if (!e || !e.date) continue
    const d = new Date(e.date)
    if (Number.isNaN(d.getTime())) continue

    const year = d.getFullYear()
    const month = d.getMonth()
    const key = `${year}-${String(month + 1).padStart(2, '0')}`
    if (!months.has(key)) {
      months.set(key, { key, year, month, total: 0, count: 0, byCategory: {}, byPerson: {} })
    }
    const bucket = months.get(key)
    const amount = Number(e.amount) || 0
    const personId = e.personId || e.paidBy

    bucket.count += 1
    bucket.total += amount
    if (amount > 0) {
      if (e.category) bucket.byCategory[e.category] = (bucket.byCategory[e.category] || 0) + amount
      if (personId) bucket.byPerson[personId] = (bucket.byPerson[personId] || 0) + amount
    }
  }

  return [...months.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, limit)
    .map(({ byPerson, ...rest }) => {
      const ranked = Object.entries(byPerson).sort((a, b) => b[1] - a[1])
      const [personId, amount] = ranked[0] || []
      return {
        ...rest,
        top: personId ? { personId, name: names[personId] || 'Unknown player', amount } : null,
      }
    })
}
