// engine/expenseEngine.js
//
// Works out who should pay next. Framework-agnostic and side-effect free,
// like the schedule and stats engines, so the fairness logic can be reasoned
// about (and tested) without a browser or Firestore anywhere near it.
//
// ONE POOL, NOT ONE ROTATION PER CATEGORY. Court, food and pre-match snacks
// cost wildly different amounts, so taking strict turns within each of them
// isn't actually fair - three snack runs don't square up against one court
// booking. Instead every category feeds a single pot and the suggestion is
// simply whoever has put in the least money lately.
//
// Ranking, lowest first:
//   1. total amount paid inside the window
//   2. then fewest times paid - so someone who logged payments without
//      recording amounts still reads as having chipped in
//   3. then longest ago, then name, so the order is stable and readable
//
// NOTE this makes `amount` the thing fairness is measured in. An entry logged
// without one still counts as a turn (rule 2) but contributes nothing to the
// total, so a group that rarely records amounts will get a weaker suggestion.

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
  return (expenses || []).filter((e) => e && e.paidBy && toTime(e.date) >= cutoff)
}

/**
 * Per-player spend summary over the window, across every category.
 *
 * Covers all ACTIVE players, including those who have paid nothing - they are
 * exactly who the suggestion needs to surface, so leaving them out would hide
 * the answer.
 *
 * Returns [{ playerId, name, timesPaid, totalAmount, lastPaidDate }], ordered
 * most-due first (least spent).
 */
export function buildSpendSummary(expenses, players, { months = SPEND_WINDOW_MONTHS } = {}) {
  const active = (players || []).filter((p) => p.isActive)
  const scoped = inWindow(expenses, months)

  return active
    .map((player) => {
      const theirs = scoped.filter((e) => e.paidBy === player.id)
      return {
        playerId: player.id,
        name: player.name,
        timesPaid: theirs.length,
        // Amounts are optional, so this is the sum of what was actually
        // recorded - not a claim about everything they have ever paid for.
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
 * Suggest who should pay next: whoever has put in the least over the window.
 *
 * `exclude` skips specific players and hands back the next one down the list -
 * for when the person the rotation names simply isn't at the court today. It's
 * a view of the same ranking, not a change to it: nobody's standing moves, and
 * the skip is meant to live in UI state for the evening rather than be stored.
 *
 * Returns { playerId, reason, totalAmount, rank } or null. Null means either
 * nothing has been logged in the window - so everyone is tied on zero and any
 * name would be an arbitrary pick dressed up as a recommendation - or every
 * candidate has been skipped. The UI tells those two apart by whether it did
 * the skipping.
 */
export function suggestNextPayer(expenses, players, { months = SPEND_WINDOW_MONTHS, exclude = [] } = {}) {
  const scoped = inWindow(expenses, months)
  if (!scoped.length) return null

  const summary = buildSpendSummary(expenses, players, { months })
  const skip = new Set(exclude)
  const rank = summary.findIndex((row) => !skip.has(row.playerId))
  if (rank === -1) return null

  const pick = summary[rank]
  return {
    playerId: pick.playerId,
    totalAmount: pick.totalAmount,
    // 1-based position on the board, so the UI can say "2nd in line".
    rank: rank + 1,
    reason: reasonFor(pick, months),
  }
}

/** Plain-language justification, so the suggestion isn't a black box. */
function reasonFor(row, months) {
  const window = `${months} month${months === 1 ? '' : 's'}`
  if (row.timesPaid === 0) return `hasn't paid in the last ${window}`
  if (row.totalAmount === 0) {
    return `paid ${row.timesPaid} time${row.timesPaid === 1 ? '' : 's'}, no amounts recorded`
  }
  return `lowest spend: SAR ${row.totalAmount.toFixed(2)} in ${window}`
}

/** Total logged across everyone in the window - the context line for the board. */
export function windowTotal(expenses, { months = SPEND_WINDOW_MONTHS } = {}) {
  return inWindow(expenses, months).reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
}

/**
 * The last amount actually recorded for a category, or null.
 *
 * Feeds the form's prefill: the court booking in particular is the same figure
 * most weeks, and typing it again every time is the main reason amounts get
 * left blank - which is the one thing that weakens the fairness ranking, since
 * a blank entry counts as a turn but contributes nothing to the total.
 *
 * Entries logged without an amount are ignored rather than treated as zero,
 * so one blank week doesn't wipe the remembered rate.
 */
export function lastAmountFor(expenses, category) {
  const rows = (expenses || []).filter((e) => e && e.category === category && Number(e.amount) > 0)
  if (!rows.length) return null
  // Not assuming the caller sorted - this engine is handed raw lists in tests.
  const latest = rows.reduce((best, e) => (toTime(e.date) > toTime(best.date) ? e : best))
  return Number(latest.amount)
}

/**
 * Spend grouped by calendar month, newest first.
 *
 * Deliberately covers ALL history, not the fairness window: this answers "what
 * did August cost us", which is a different question from "whose turn is it",
 * and clipping it to two months would make the section pointless by month three.
 *
 * Returns [{ key, year, month, total, count, byCategory, top }] where `month`
 * is 0-based, `byCategory` maps category -> amount, and `top` is the biggest
 * contributor that month ({ playerId, name, amount }) or null when nobody
 * recorded an amount. Formatting is left to the UI.
 */
export function monthlySummary(expenses, players, { limit = 12 } = {}) {
  const names = Object.fromEntries((players || []).map((p) => [p.id, p.name]))
  const months = new Map()

  for (const e of expenses || []) {
    if (!e || !e.date) continue
    const d = new Date(e.date)
    if (Number.isNaN(d.getTime())) continue

    const year = d.getFullYear()
    const month = d.getMonth()
    const key = `${year}-${String(month + 1).padStart(2, '0')}`
    if (!months.has(key)) {
      months.set(key, { key, year, month, total: 0, count: 0, byCategory: {}, byPlayer: {} })
    }
    const bucket = months.get(key)
    const amount = Number(e.amount) || 0

    // Every entry counts toward `count` even with no amount - it's a record of
    // activity - while the money totals only ever reflect what was recorded.
    bucket.count += 1
    bucket.total += amount
    if (amount > 0) {
      if (e.category) bucket.byCategory[e.category] = (bucket.byCategory[e.category] || 0) + amount
      if (e.paidBy) bucket.byPlayer[e.paidBy] = (bucket.byPlayer[e.paidBy] || 0) + amount
    }
  }

  return [...months.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, limit)
    .map(({ byPlayer, ...rest }) => {
      const ranked = Object.entries(byPlayer).sort((a, b) => b[1] - a[1])
      const [playerId, amount] = ranked[0] || []
      return {
        ...rest,
        top: playerId
          ? // Names can go missing if a player was deleted after paying; the
            // month total is still true, so the row is kept either way.
            { playerId, name: names[playerId] || 'Unknown player', amount }
          : null,
      }
    })
}
