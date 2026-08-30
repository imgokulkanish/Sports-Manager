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
//     the null-amount-still-counts-as-a-turn rule — is UNCHANGED. Pooling
//     across sports doesn't need new ranking logic, only a different
//     grouping key upstream.
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
 * Returns [{ personId, name, timesPaid, totalAmount, lastPaidDate }],
 * ordered most-due first (least spent).
 */
export function buildSpendSummary(expenses, people, { months = SPEND_WINDOW_MONTHS } = {}) {
  const active = (people || []).filter((p) => p.isActive)
  const scoped = inWindow(expenses, months)

  return active
    .map((person) => {
      const theirs = scoped.filter((e) => (e.personId || e.paidBy) === person.id)
      return {
        personId: person.id,
        name: person.name,
        timesPaid: theirs.length,
        totalAmount: theirs.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
        lastPaidDate: theirs.reduce((latest, e) => (toTime(e.date) > toTime(latest) ? e.date : latest), null),
      }
    })
    .sort(compareByDueness)
}

/** Least contribution first. Every term is a per-row value, so this is a total order. */
function compareByDueness(a, b) {
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
export function suggestNextPayer(expenses, people, { months = SPEND_WINDOW_MONTHS, exclude = [] } = {}) {
  const scoped = inWindow(expenses, months)
  if (!scoped.length) return null

  const summary = buildSpendSummary(expenses, people, { months })
  const skip = new Set(exclude)
  const rank = summary.findIndex((row) => !skip.has(row.personId))
  if (rank === -1) return null

  const pick = summary[rank]
  return {
    personId: pick.personId,
    totalAmount: pick.totalAmount,
    rank: rank + 1,
    reason: reasonFor(pick, months),
  }
}

function reasonFor(row, months) {
  const window = `${months} month${months === 1 ? '' : 's'}`
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
