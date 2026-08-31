# Shared Expenses — design (joint pot, sport-tagged)

## Schema

`expenses/{id}` — same collection Shuttle already uses, same fields as
today, **plus one new field**:

```
{
  date: ISO string,
  sport: 'shuttle' | 'cricket',   // NEW — everything else is unchanged
  category: string,               // see taxonomy below — meaning depends on `sport`
  paidBy: playerId,                // unchanged: still the SPORT-SPECIFIC player id
                                    // (players/{id} if sport='shuttle',
                                    //  cricketPlayers/{id} if sport='cricket')
  amount: number | null,
  sessionId: string | null,        // unchanged for shuttle entries;
  matchId: string | null,          // NEW, parallel field for cricket entries
                                    // (kept separate rather than renaming
                                    // sessionId, since that would touch every
                                    // existing shuttle expense doc for no
                                    // functional gain)
  notes: string | null,
  createdAt: serverTimestamp,
}
```

**Why `paidBy` stays sport-specific instead of switching to a shared
identity id:** per the additive `playerLinks` approach we agreed on for
Players, `expenses` shouldn't be the thing that forces an identity
migration. Existing Shuttle expense docs keep referencing `players/{id}`
exactly as they do today — zero rewrite of history. Cricket entries will
reference `cricketPlayers/{id}`. The joining across sports happens at
**read time**, in the engine, not by rewriting `paidBy` everywhere.

## Category taxonomy

Shuttle's existing category *values* are frozen (renaming would orphan
historical entries — same reasoning as today). Cricket gets its own
non-overlapping values, both live in one lookup table so `categoryLabel()` /
`categoryShort()` keep working without callers needing to pass `sport`:

```js
export const EXPENSE_CATEGORIES = [
  // --- Shuttle (unchanged, frozen values) ---
  { value: 'court', label: 'Court booking', short: 'Court', sport: 'shuttle' },
  { value: 'shuttles', label: 'Shuttlecocks', short: 'Shuttles', sport: 'shuttle' },
  { value: 'breakfast', label: 'Food after - breakfast, lunch or dinner', short: 'Food', sport: 'shuttle' },
  { value: 'tea', label: 'Pre-match snacks - tea, sandwich, juice', short: 'Snacks', sport: 'shuttle' },
  // --- Cricket (new) ---
  { value: 'ground', label: 'Ground/turf booking', short: 'Ground', sport: 'cricket' },
  { value: 'equipment', label: 'Balls, bats, gear', short: 'Gear', sport: 'cricket' },
  { value: 'cricket-food', label: 'Food after', short: 'Food', sport: 'cricket' },
  { value: 'cricket-snacks', label: 'Pre-match snacks', short: 'Snacks', sport: 'cricket' },
]

export function categoriesForSport(sport) {
  return EXPENSE_CATEGORIES.filter((c) => c.sport === sport)
}
```

The entry form filters its category dropdown with `categoriesForSport(sport)`
using whichever sport is currently selected in the shell — so someone
logging a cricket expense never sees "Shuttlecocks" as an option.

## The fairness engine: joint pot, with a graceful degradation path

`buildSpendSummary` / `suggestNextPayer` already treat every category as one
pot (see the existing header comment: "ONE POOL, NOT ONE ROTATION PER
CATEGORY"). Making the pot cross-sport is almost free for the *ranking*
logic — the real change is **who counts as "the same person"** when
grouping entries.

Today, grouping key = `expense.paidBy` (a raw Shuttle `players/{id}`).
For a joint pot, grouping key needs to be a **canonical person**, resolved
via `playerLinks`:

```js
// resolvePersonId(expense, playerLinks) -> a stable grouping key.
// Falls back to the raw (sport, paidBy) pair when no link exists yet, so
// nothing breaks or double-counts before playerLinks is populated — it just
// means an unlinked person's cricket and shuttle spending won't be pooled
// with each other until they're linked. Same "unlinked players are fine by
// default" behavior we designed for the shared Players view.
function resolvePersonId(expense, playerLinksBySporadicId) {
  const link = playerLinksBySporadicId[`${expense.sport}:${expense.paidBy}`]
  return link ? link.id : `${expense.sport}:${expense.paidBy}`
}
```

`buildSpendSummary` changes from grouping by `players` (Shuttle-only) to
grouping by the union of linked identities + any not-yet-linked
sport-specific players from *both* collections. Ranking math (least spent,
then fewest times paid, then longest ago) is unchanged.

## What this means in practice, today vs. after `playerLinks` exists

- **Before `playerLinks` is built:** the joint pot technically works, but
  anyone who plays both sports shows up as two separate rows (their Shuttle
  identity and their Cricket identity), each accumulating only that sport's
  payments. Not wrong, just not yet fully "joint" for that person.
- **After `playerLinks` is built and populated:** those two rows merge into
  one the moment the two identities are linked, retroactively — no data
  rewrite needed, since the join happens at read time.

This is why I'd bump "design/build `playerLinks`" up as the next concrete
step after this — it's the thing that makes the joint pot you asked for
actually joint, for anyone who plays both.

## Migration classification (per your risk-flagging rule)

- **Adding `sport` to new expense docs:** pure frontend change (the form
  just writes one more field going forward).
- **Backfilling `sport: 'shuttle'` onto existing expense docs:** a genuine
  but low-risk Firestore migration — additive only (new field, no field
  renamed or removed, nothing deleted). See `backfillExpenseSport.js` below.
  Fully reversible: delete the field to undo.
- **`firestore.rules`:** no change needed — the existing `expenses/{expenseId}`
  block already allows read/write; it doesn't need to know about the new
  `sport` field.

## Who counts in the rotation — `expenseOptOuts`

Added after the fact: the fairness pool was "everyone active in either
sport", so anyone who plays but never chips in (guests, juniors, people who
pay their own way) sat permanently at `SAR 0.00 / never` and therefore
permanently at the top of "next up". The only lever was archiving them in
their sport roster, which is the wrong tool — that also pulls them out of
team selection, matchups and stats to fix what is purely an expenses
question.

```
expenseOptOuts/{`${sport}:${playerId}`}
{
  sport: 'shuttle' | 'cricket',
  playerId: string,            // raw players/{id} or cricketPlayers/{id}
  updatedAt: serverTimestamp,
}
```

**Presence means "not counted".** Opting someone back in deletes the doc, so
the collection only ever holds the exceptions and there is no third "unset"
state.

**Why the doc id is the sport-specific player id, not the merged person id.**
A merged person id is a `playerLinks` doc id when someone is linked and a
synthesized `shuttle:<rawId>` / `cricket:<rawId>` composite when they aren't
(see `mergePeople.js`), so it changes the moment you link or unlink them.
Keying opt-outs by it would quietly put someone back in the rotation the
first time their two identities were joined. The raw ids never change. Same
principle as `paidBy` staying sport-specific above: identity joins happen at
read time, not by rewriting keys.

A person is out if **any** of their sport identities is opted out — so
linking an excluded cricket identity to an included badminton one keeps them
out until someone says otherwise, rather than resurrecting them by accident.

### What being left out does and doesn't do

| | |
|---|---|
| Suggested as "next up" | no |
| Shown on the "who's put in what" board | no |
| Offered in the "paid by" picker | no |
| Their existing entries in History | **still shown** |
| Their past spend in the pot total / monthly summary | **still counted** |
| Their sport roster, stats, matchups, team selection | **untouched** |

That split is the point: it's a rotation setting, not a delete. Money already
spent was real money and keeps counting.

Editing the list is admin-gated (same PIN as the deletes) because it changes
who gets asked to pay. Reading it isn't. If the rules block above hasn't been
deployed the read fails closed to an empty set — everyone is counted, which is
the old behavior — and the page says so rather than looking broken.
