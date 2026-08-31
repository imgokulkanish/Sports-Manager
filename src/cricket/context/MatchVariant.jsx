// context/MatchVariant.jsx
//
// Box Cricket is the same game with different rules, so it reuses every
// cricket page as-is rather than forking ~4,000 lines of scoring UI. What
// actually differs between the two is small and lives here:
//
//   - `collection`  — which Firestore collection the match documents go in.
//     This is the whole reason box records "don't count" toward the general
//     cricket stats: computePlayerStats only ever sees the matches that
//     useMatches() subscribed to, and the two variants subscribe to
//     different collections. There is no `isBox` flag to remember to filter
//     on in eight different places, so a missed filter can't silently leak
//     box runs into the season leaderboards.
//   - `basePath`    — the route prefix every in-page Link/navigate() builds
//     from, so the identical Dashboard/History/Stats components can live at
//     both /cricket/... and /cricket/box/....
//   - feature flags — tournaments are a full-cricket concept (a tournament
//     envelope points at `cricketMatches` docs), and the six-is-out rule is
//     a box concept. Each variant declares which it has.
//
// The PLAYER roster is deliberately NOT varied: it's the same people either
// way, so both variants read `cricketPlayers`. Only the match records — and
// therefore every stat derived from them — are separate.
import React, { createContext, useContext, useMemo } from 'react'

export const MATCH_VARIANTS = {
  standard: {
    key: 'standard',
    label: 'Cricket',
    shortLabel: 'Cricket',
    collection: 'cricketMatches',
    basePath: '/cricket',
    supportsTournaments: true,
    // Full cricket plays sixes normally; the rule picker isn't offered.
    supportsSixRule: false,
    defaultOversPerInnings: 8,
    defaultMaxOversPerBowler: 3,
  },
  box: {
    key: 'box',
    label: 'Box Cricket',
    shortLabel: 'Box',
    collection: 'boxCricketMatches',
    basePath: '/cricket/box',
    supportsTournaments: false,
    supportsSixRule: true,
    // Box games are played in a netted cage — shorter innings and shorter
    // bowling spells are the norm, so the New Match form starts there
    // instead of at full-cricket's defaults.
    defaultOversPerInnings: 6,
    defaultMaxOversPerBowler: 2,
  },
}

const MatchVariantContext = createContext(MATCH_VARIANTS.standard)

export function MatchVariantProvider({ variant = 'standard', children }) {
  const value = useMemo(() => MATCH_VARIANTS[variant] || MATCH_VARIANTS.standard, [variant])
  return <MatchVariantContext.Provider value={value}>{children}</MatchVariantContext.Provider>
}

/**
 * Which flavour of cricket the surrounding page tree is rendering.
 * Defaults to `standard` so any page mounted outside a provider (or an
 * older test) behaves exactly as it did before box cricket existed.
 */
export function useMatchVariant() {
  return useContext(MatchVariantContext)
}

/** True when this match doc was recorded with "a six is out" switched on. */
export function sixIsOut(match) {
  return Boolean(match?.boxRules?.sixIsOut)
}
