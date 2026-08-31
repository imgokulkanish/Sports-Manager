# Shell skeleton — what's real, what's inferred, what's next

## What this is
A working routing/nav skeleton: sport switcher, per-sport nav that swaps,
shared Players/Expenses nav that doesn't, and lazy-loaded route trees per
sport. Pages are placeholders (`TODO: wire up X`) — no real Shuttle or
Cricket page content has been rewritten, on purpose, per your migration
principle 1 (wrap/move, don't rewrite).

## New dependency: zustand
Neither app uses a state manager today (both explicitly avoid one in their
own project rules). This shell introduces zustand for exactly one piece of
state — `currentSport` — per your own target architecture. Add it with:
```
npm install zustand
```
Nothing inside Shuttle's or Cricket's existing pages needs to adopt it; their
own hooks/state stay exactly as they are.

## Confirmed vs. inferred, file by file
- `ShuttleRoutes.jsx` — **confirmed**. Based on the actual `App.jsx` you have
  in this project (I read it directly), including the undocumented
  `QuickMatch` and `Expenses` routes.
- `CricketRoutes.jsx` — **inferred, not confirmed**. Cricket's own
  `CLAUDE_PROJECT.md` lists page names but I haven't seen its `App.jsx`, so
  the exact route path strings (`match/new`, `match/:id/live`, etc.) are a
  guess following Shuttle's naming pattern. Paste Cricket's real `App.jsx`
  and I'll correct this.
- `Sidebar.jsx` / `BottomNav.jsx` — **new components**, not ports. Neither
  app's existing `Navbar.jsx` had to render a sport switcher or swap nav
  sections, so there was nothing to wrap here. Styling matches each app's
  documented brand tokens (`brand` / `pitch`) but isn't pixel-matched to
  either app's actual `Navbar.jsx`, which I haven't seen.
- `icons.jsx` — a small placeholder set for shell chrome only. Both apps
  have their own real icon sets (`components/icons/`, `StatIcons.jsx`) that
  keep serving their own pages unchanged.
- `PlayersShared.jsx` / `ExpensesShared.jsx` — intentionally empty stubs,
  not connected to Firestore yet.

## Decisions this skeleton makes for you (flagging, not hiding)
1. **Routes are sport-namespaced** (`/shuttle/...`, `/cricket/...`). Every
   internal `Link`/`navigate()` call in both apps' existing pages needs its
   path updated to match — a real (if mechanical) chunk of work across every
   page file, not a config-only change.
2. **Mobile nav uses a "More" sheet** for the sport switcher + shared items,
   since a flat bottom nav can't fit sport switcher + up to 5 sport items +
   2 shared items on a 375px screen. See the comment block at the top of
   `BottomNav.jsx` for two alternatives if this doesn't feel right.
3. **ThemeProvider moves to shell level.** `AdminProvider` did too, in a
   later pass — the two per-sport copies were the same file under different
   localStorage keys, so the same PIN had to be entered twice, and the
   shared pages had no admin context to gate their deletes against. One
   provider (`shell/components/Admin.jsx`), one unlock, one Settings page.
   RESOLVED SEPARATELY: cricket's pages still have zero `dark:` classes, but
   dark mode works there now — `index.css` remaps the ~40 light utilities
   those pages actually use, scoped to CricketRoutes'
   `data-sport-theme="cricket"` wrapper. See the DARK MODE block in that
   file for why it's CSS rather than several hundred JSX edits.
4. **Assumed Shuttle's and Cricket's `Toast.jsx` are API-compatible** (same
   `useToast()` shape) and used Shuttle's as the one shared instance. Paste
   both files if you want this confirmed rather than assumed.

## Update: pulled both repos directly (public on GitHub) via `git clone`
Rather than wait on pasted files, I cloned `imgokulkanish/Shuttle-Manager`
and `imgokulkanish/Cricket-Manager` directly. Everything below is now
confirmed against real source, not inferred.

### Corrections made to this skeleton
- **`CricketRoutes.jsx`**: real routes confirmed — one I missed in the
  original guess: `/tournament/match/new` exists *without* a `:tid`, as a
  separate route from the `:tid` variant. Fixed.
- **Nav labels**: both real apps use short **"New"** (not "New session" /
  "New match") for that nav item, in both sidebar and bottom nav. Your
  original brief spelled it out fuller, so `navConfig.js` now carries both —
  `label` for the sidebar (has room), `mobileLabel: 'New'` for the bottom
  nav, matching the existing apps' own convention. Say the word if you'd
  rather they matched exactly.
- **Firestore rules**: confirmed one shared `firestore.rules` file already
  covers `players`, `sessions`, `expenses` (Shuttle), all three `cricket*`
  collections, and `users/{userId}/kanish/data` (a third app,
  "Kanishpersonalos") — scoped per-collection already, exactly as your brief
  described. Adding a `playerLinks` block later is a two-line addition to a
  file you already maintain, not a new pattern.

### New finding that changes the Expenses design question
Read Shuttle's real `useExpenses.js` + `expenseEngine.js`. This is a much
more developed feature than "a ledger" — it's a **fairness rotation engine**:
one shared pot (not per-category), ranked by who's paid least over a
rolling 2-month window, with a "suggest next payer" feature on the Dashboard
card. Categories are hardcoded and badminton-specific (`court`, `shuttles`,
`breakfast`, `tea`) with a comment explicitly noting the stored *values* are
frozen — renaming them would orphan historical entries.

This raises a real design question before Expenses can be unified, and I'd
rather ask than guess: **should the fairness rotation pool badminton and
cricket spending together** (whoever's paid least across *both* sports pays
next, since it's the same friend group and the same wallets), **or should
each sport keep its own separate rotation** (tagged by sport, computed
independently)? This changes `expenseEngine.js`'s `buildSpendSummary` logic
non-trivially and isn't a UI-only choice — worth deciding deliberately.

### What's still genuinely open (not blocked, just not decided)
1. **Mobile nav "More sheet"** — still the one design call from before;
   nothing in the real source changes the recommendation, just confirms the
   space constraint is real (Shuttle's own comment in `Navbar.jsx` explicitly
   does the pixel math for why Expenses is sidebar-only on mobile today).

## Update: joint expense pool decided, playerLinks built
You chose **one joint fairness pot across both sports**. That decision made
`playerLinks` load-bearing rather than optional (a joint pot can't actually
pool one person's cross-sport spending without it), so it's built now:

- **`src/shell/hooks/usePlayerLinks.js`** — CRUD on the new `playerLinks`
  collection. Additive only; never touches `players` or `cricketPlayers`.
- **`src/shell/lib/mergePeople.js`** — pure join logic (no Firestore/React),
  same style as the existing engine files. Linked players produce one row;
  anyone not yet linked gets their own `shuttle:<id>` / `cricket:<id>` row
  rather than being dropped or merged incorrectly.
- **`src/shell/lib/expenseEngine.js`** / **`expenseCategories.js`** /
  **`backfillExpenseSport.js`** — moved in from the earlier Expenses design
  pass, now genuinely usable since `mergePeople`'s `buildPersonIndex` /
  `attachPersonIds` supply the `personId` this engine expects.
- **`src/shell/pages/PlayersShared.jsx`** — no longer a stub. Renders the
  merged roster with 🏸/🏏 badges per person, and a plain manual-linking
  form (pick a name, optionally attach an unlinked Shuttle player and/or
  Cricket player). Deliberately unpolished UI — the join logic is the part
  worth reviewing carefully; the form can get a redesign pass once that's
  confirmed correct.

### One more Firestore change needed (small, additive)
`firestore.rules` needs a new block for the `playerLinks` collection —
without it, reads/writes to it are denied by default (same reasoning the
file's own comments give for why `expenses` needed its own block). Add
inside the existing `service cloud.firestore` block:
```
match /playerLinks/{linkId} {
  allow read, write: if true;
}
```
Same open-rules caveat as every other collection in that file — not a new
risk, just flagging so it's not missed when you next deploy rules.

### Remaining before this is wired into a real running app
1. **Physically move both apps' source** into one repo (see the TODO blocks
   in `ShuttleRoutes.jsx` / `CricketRoutes.jsx`) — `PlayersShared.jsx`
   currently imports `usePlayers` from paths that don't exist until that
   move happens.
2. Deploy the `playerLinks` rules block above before testing linking live.

## Update: ExpensesShared.jsx built (joint pot, real port)
Re-read Shuttle's actual `Expenses.jsx` + `useExpenses.js` (not just the
earlier summary) to port this faithfully rather than reinvent it. What's
new:

- **`src/shell/components/Avatar.jsx`** — moved verbatim, unchanged. It was
  already fully sport-agnostic, so this is the one component in either app
  that needed zero adaptation. Cricket's `utils.js` independently reinvented
  the same function with a different palette — worth pointing Cricket's
  pages at this shared one during the physical move, flagged but not done
  here since it edits an existing Cricket file.
- **`src/shell/hooks/useSharedExpenses.js`** — evolves `useExpenses.js`
  with the `sport` field. Deliberately drops the original's dev-only
  localStorage fallback (dead weight once there's always one configured
  Firebase project) — flagged in the file's own header in case that
  fallback ever matters to you again.
- **`src/shell/pages/ExpensesShared.jsx`** — full port of the fairness UI
  (suggestion card, "not here today" skipping, amount prefill, monthly
  summary, delete confirm), rebuilt against the joint pot. One real design
  addition beyond a straight port: a sport toggle in the "Log a payment"
  form, since this page no longer has an implicit single sport context —
  it needed to know which roster/category set applies to a new entry.
  Payer eligibility is filtered to people with a roster entry in whichever
  sport is toggled, since `paidBy` still stores a sport-specific raw id.

### New TODOs this introduced
- `Footer`, `ConfirmDialog`, `ListSkeleton`, `useToast`, `BTN_SOLID` —
  generic, already sport-agnostic UI pieces from Shuttle's codebase, not
  yet moved in. Stood in with plain inline equivalents (a basic confirm
  box, `alert()` for errors) so the page works today; swap these back in
  once physically moved — none of them need internal changes.
- Same-day activity linking (the original's "will be linked to the session
  played on X" convenience) is left out rather than guessed at — needs
  Shuttle's `useSessions()` and Cricket's equivalent match-listing hook,
  neither wired in yet.

## Explicitly out of scope here (per your brief)
- No changes to `players`, `sessions`, `cricketPlayers`, `cricketMatches`,
  or `cricketTournaments` — this is routing/UI only.
- No `firestore.rules` changes.
- No unification of Shuttle's and Cricket's scoring/stats engines.
