# Naming — decided

- **App name:** Smashers
- **Netlify slug:** `smashers-gk` (matches your existing `-gk` convention)
- **Theme/icon anchor color:** `#1E293B` (slate-navy) — deliberately neutral,
  independent of Shuttle's green (`#1F6F4A`) and Cricket's teal (`#0F7A6B`),
  which stay as in-app accents for their own sport's nav/buttons.

## Files updated
- `public/manifest.json` — real schema pulled from Shuttle's original file,
  not guessed. `short_name: "Smashers"` fits the ~12-char home-screen label
  limit with room to spare (unlike "Shuttlewicket", which was the other
  finalist and wouldn't have fit un-truncated).
- `index.html` — title, `apple-mobile-web-app-title`, `theme-color` meta.
- `src/shell/theme.jsx` — localStorage key renamed `shuttle-manager:theme`
  → `smashers:theme`. One-time, harmless: everyone's saved light/dark
  preference resets to the default ('light') on first load of the merged
  app, then persists normally from there. Not a data concern — it's a
  client-side UI preference, not anything in Firestore.

## What's NOT done here (needs you, not code)
1. **Netlify site.** Create a new site (or rename an existing one) to
   `smashers-gk.netlify.app` in the Netlify dashboard — this repo's
   `netlify.toml` doesn't hardcode a site name, so no file change is needed
   for this, just the dashboard step.
2. **Icon PNGs.** `manifest.json` and `index.html` still point at
   `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-180.png`, and
   `/favicon.svg` — these are Shuttle's actual badminton-themed icon
   artwork today. I haven't generated new ones; that's an image-creation
   task, not a code change, and better done deliberately (your call on
   whether "Smashers" gets its own mark, or keeps a shuttle/ball motif).
3. **`package.json` name field** — whenever you scaffold the merged repo,
   its `package.json` should say `"name": "smashers"` rather than
   inheriting `"shuttle-manager"`. Not touched here since that file doesn't
   exist yet for the merged app (each sub-app still has its own).
