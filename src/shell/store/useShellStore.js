// useShellStore.js
//
// The ONLY shell-level state: which sport is currently selected. Everything
// else (players roster, sessions/matches, live scoring state, per-sport
// stats) stays in each sport's own existing hooks/stores exactly as it is
// today — this store never reaches into Shuttle or Cricket's domain state.
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
      setSport: (sport) => {
        if (!Object.values(SPORTS).includes(sport)) {
          console.warn(`useShellStore: unknown sport "${sport}", ignoring`)
          return
        }
        set({ currentSport: sport })
      },
    }),
    { name: STORAGE_KEY }
  )
)
