# Running Sports Manager

This is the actual assembled repo — both apps' real source physically
moved in, route prefixes applied, shared Players/Expenses wired to real
data, and **verified to build clean** (`npm run build`, 520 modules, zero
errors) in a sandboxed environment before being handed to you. That
sandbox used dummy Firebase credentials just to prove the code compiles —
it never touched your real Firestore data.

## 1. Install

```
npm install
```

## 2. Configure Firebase

```
cp .env.example .env.local
```

Fill in the same values your two existing apps already use (same Firebase
project — `kanishpersonalos`), plus `VITE_ADMIN_PIN`. You can copy these
straight out of either app's existing `.env.local`.

## 3. Deploy the updated Firestore rules

`firestore.rules` in this repo adds one new block (`playerLinks`) on top of
the reconciled rules — see the file's own header comment for why it's based
on Shuttle's copy rather than Cricket's (they'd drifted; Cricket's was
missing the `expenses` block). Deploy via the Firebase console or:

```
firebase deploy --only firestore:rules
```

**Do this before running the app** — without it, reads/writes to the new
`playerLinks` collection are denied by default.

## 4. Run it

```
npm run dev
```

Opens at `localhost:5173`. `/shuttle` and `/cricket` are the two sport
areas, each with its own roster at `/shuttle/players` and
`/cricket/players` (per-player stats are sport-specific, so the rosters
are too). Shared regardless of the selected sport: `/expenses` (one joint
pot) and `/people` (linking one person's two sport identities).

## 5. One-time backfill (optional but recommended)

Tags your existing expense entries with `sport: 'shuttle'` (additive only —
see `EXPENSES_DESIGN.md`):

```
node scripts/backfillExpenseSport.js
```

## 6. Link players who play both sports

Go to `/people` ("Link people" in the sidebar) and use the "Link a person
across sports" form to connect someone's existing Shuttle player record
with their existing Cricket player record. This affects the joint expense
pot only — it makes the rotation count that person once instead of twice.
Each sport's stats stay entirely separate either way, so linking is
optional and nothing breaks if you never do it.

## 7. Deploy

`netlify.toml` is already configured (same as both original apps — SPA
redirect to `index.html`). Point a new Netlify site at this repo, or drag
the `dist/` folder from `npm run build` into Netlify's manual deploy.
Site name per `NAMING.md`: `sportsmanager-gk`.

---

## What was actually done to assemble this (for your own review)

- **Both apps' real `src/` copied in unchanged** to `src/shuttle/` and
  `src/cricket/` — components, pages, hooks, engines, all of it, verbatim.
- **`firebase.js` and `theme.js` shims** in each sport folder — one-line
  re-exports pointing at the single shared `src/firebase.js` and
  `src/theme.jsx`, so none of the dozens of existing `from '../firebase'` /
  `from '../theme'` imports inside either app's hooks/pages needed touching.
- **~25 internal route references prefixed** (`/session/...` → `/shuttle/
  session/...`, `/match/...` → `/cricket/match/...`, etc.) across both
  apps' `Navbar.jsx` and pages — every one found via `grep`, listed, then
  mechanically rewritten; `/expenses` deliberately left unprefixed since
  it is the one genuinely shared route.
- **`Players.jsx` in both apps is routed again** at `/shuttle/players` and
  `/cricket/players`. It briefly wasn't: a single shared roster page could
  only link identities, while every per-player stat lives in each sport's
  own page against its own matches. The shared page kept only the linking
  job and moved to `/people`.
- **`Expenses.jsx` in both apps is simply unrouted**, not deleted — the
  shared `/expenses` supersedes it.
- **Shared UI (`Toast`, `ConfirmDialog`, `Skeleton`, `Footer`, `Avatar`)**
  live once in `src/shell/components/`, used only by the shared Players/
  Expenses pages. Each sport's own internal pages keep using their own
  original local copies of these — untouched, no cross-dependency, so
  there was never actually a need to confirm "API compatibility" between
  the two apps' versions (an earlier open question in `NOTES.md` — resolved
  by not needing to touch it).
- **`Footer.jsx`** (the one shared copy) had its Shuttle-specific
  `ShuttlecockIcon` removed, since it now renders on shared pages
  regardless of which sport is active.
- **Verified with a real build**, not just "should work" — caught and
  fixed two real issues this way (a stray `../theme` import in Shuttle's
  `Settings.jsx`, and a firebase import path one directory off) that no
  amount of manual review would have guaranteed.

## Still genuinely open (see NOTES.md / NAMING.md for full detail)

- Cricket's pages still carry no `dark:` classes of their own — dark mode
  inside `/cricket` comes from the scoped remap in `index.css` rather than
  from the components. It covers the palette those pages use today; a new
  cricket page introducing a colour outside that set will need either a
  `dark:` class (which wins over the remap) or a new line in that block.
- Same-day session/match linking on the Expenses form (the original's
  "will be linked to today's session" convenience) isn't wired — needs
  Cricket's match-listing hook alongside Shuttle's `useSessions()`.
- Icon artwork (`favicon.svg`, `icons/*.png`) is still Shuttle's original
  badminton-themed art, carried over as a placeholder — new branding is an
  image task, not a code one.
- The mobile "More sheet" nav pattern is functional but unpolished —
  flagged back when it was first built as one reasonable option, not the
  only one.
