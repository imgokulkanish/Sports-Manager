// useShellStore.js
//
// The ONLY shell-level state: which sport is currently selected, and whether
// that selection was ever actually made by a person. Everything else (players
// roster, sessions/matches, live scoring state, per-sport stats) stays in each
// sport's own existing hooks/stores exactly as it is today — this store never
// reaches into Shuttle or Cricket's domain state.
//
// Persisted to localStorage so a page refresh (or opening the app fresh
// tomorrow) lands you back on whichever sport you were last using, rather
// than defaulting to Shuttle every time. This is the shell's first new
// dependency (zustand) — neither Shuttle Manager nor Cricket Manager use a
// state manager today (both explicitly avoid one), so this is scoped
// strictly to shell-level concerns, not a precedent for adding state
// management inside either sport's existing code.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const SPORTS = {
  SHUTTLE: 'shuttle',
  CRICKET: 'cricket',
}

const STORAGE_KEY = 'shell:current-sport'

export const useShellStore = create(
  persist(
    (set) => ({
      currentSport: SPORTS.SHUTTLE,
      // `currentSport` alone can't tell a real choice from the default, and
      // the two need different landing behaviour: a returning user goes
      // straight to their sport, a brand-new one gets asked once. Set by
      // setSport, so anything that picks a sport — the picker, the header
      // chip, the sidebar/More switcher, or a sport-prefixed URL — counts.
      // See shell/pages/SportPicker.jsx for what reads it.
      hasChosenSport: false,
      setSport: (sport) => {
        if (!Object.values(SPORTS).includes(sport)) {
          console.warn(`useShellStore: unknown sport "${sport}", ignoring`)
          return
        }
        set({ currentSport: sport, hasChosenSport: true })
      },
    }),
    {
      name: STORAGE_KEY,
      // Bumped when `hasChosenSport` was added. Anyone with v0 data already
      // has the app installed and a sport they've been using, so migrating
      // them as "already chosen" keeps the first-run picker genuinely
      // first-run instead of ambushing every existing user once.
      version: 1,
      migrate: (persisted, version) =>
        version === 0 ? { ...persisted, hasChosenSport: true } : persisted,
    }
  )
)
