// navConfig.js
//
// Single source of truth for what the Sidebar/BottomNav render. Kept as
// plain data (not JSX) so both nav components can map over the same list
// without duplicating the item order or route paths.
//
// CONFIRMED against both apps' real, cloned App.jsx files (not inferred).
//
// ROUTING DECISION THIS MAKES (flagging — not yet confirmed with you):
// Both apps' real routes are root-level today (/, /players, /session/new,
// /match/new, /history, ...) — fine as separate deployments, but they'd
// collide in one shell. This config assumes sport-namespaced routes:
// /shuttle/... and /cricket/.... Every internal Link/useNavigate call in
// both apps' existing pages needs its path updated to add the prefix — a
// mechanical find-and-replace, but it touches every page file in both apps,
// so flagging as real work, not a zero-cost rename.
//
// LABEL DECISION: your brief said "New session" / "New match"; both real
// apps actually use the shorter "New" for this nav item (sidebar and bottom
// nav both, per their Navbar.jsx). Kept your fuller wording as the primary
// `label` (sidebar has room) and added `mobileLabel: 'New'` matching the
// existing apps' convention for the space-constrained bottom nav. Easy to
// change either way if you'd rather they matched exactly.
import { SPORTS } from '../store/useShellStore'

export const SHARED_NAV_ITEMS = [
  { label: 'Players', path: '/players', icon: 'users' },
  { label: 'Expenses', path: '/expenses', icon: 'wallet' },
]

export const SPORT_NAV_ITEMS = {
  [SPORTS.SHUTTLE]: [
    { label: 'Home', path: '/shuttle', icon: 'home' },
    { label: 'New session', mobileLabel: 'New', path: '/shuttle/session/new', icon: 'plus-circle' },
    { label: 'History', path: '/shuttle/history', icon: 'history' },
    { label: 'Stats', path: '/shuttle/stats', icon: 'bar-chart' },
  ],
  [SPORTS.CRICKET]: [
    { label: 'Home', path: '/cricket', icon: 'home' },
    { label: 'New match', mobileLabel: 'New', path: '/cricket/match/new', icon: 'plus-circle' },
    { label: 'History', path: '/cricket/history', icon: 'history' },
    { label: 'Stats', path: '/cricket/stats', icon: 'bar-chart' },
    { label: 'Matchups', path: '/cricket/matchups', icon: 'swords' },
  ],
}

export const SPORT_META = {
  [SPORTS.SHUTTLE]: {
    label: 'Shuttle',
    emoji: '🏸',
    // Matches Shuttle Manager's existing tailwind.config.js `brand` token.
    accent: '#1F6F4A',
  },
  [SPORTS.CRICKET]: {
    label: 'Cricket',
    emoji: '🏏',
    // Matches Cricket Manager's existing tailwind.config.js `pitch` token.
    accent: '#0F7A6B',
  },
}
