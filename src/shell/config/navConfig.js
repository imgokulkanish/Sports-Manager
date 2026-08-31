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

// REVISED: Players is a PER-SPORT page again, not a shared one.
//
// The first cut made /players a single shared page, which meant the only
// thing you could do to a player was link their two identities — every
// per-player stat (win %, achievements, batting/bowling cards, the detail
// modal, add/edit/archive) lives in each sport's OWN Players page, and the
// two sports' stats have nothing in common to merge. So both sports' real
// Players pages are routed again under their own prefix, and the shared
// section keeps only what is genuinely cross-sport: linking one person's
// two identities (which the joint expense pot needs) and Expenses itself.
export const SHARED_NAV_ITEMS = [
  { label: 'Link people', path: '/people', icon: 'link' },
  { label: 'Expenses', path: '/expenses', icon: 'wallet' },
]

// `bottomNav: false` keeps an item out of the phone tab bar (it shows in the
// More sheet instead). Six tabs is already the ceiling at 375px — see
// BottomNav.jsx — so Players rides in More rather than pushing the bar to
// seven, which is exactly where it was reachable from before this change.
export const SPORT_NAV_ITEMS = {
  [SPORTS.SHUTTLE]: [
    { label: 'Home', path: '/shuttle', icon: 'home' },
    { label: 'New session', mobileLabel: 'New', path: '/shuttle/session/new', icon: 'plus-circle' },
    { label: 'Quick', path: '/shuttle/quick', icon: 'zap' },
    { label: 'Players', path: '/shuttle/players', icon: 'users', bottomNav: false },
    { label: 'History', path: '/shuttle/history', icon: 'history' },
    { label: 'Stats', path: '/shuttle/stats', icon: 'bar-chart' },
  ],
  [SPORTS.CRICKET]: [
    { label: 'Home', path: '/cricket', icon: 'home' },
    { label: 'New match', mobileLabel: 'New', path: '/cricket/match/new', icon: 'plus-circle' },
    { label: 'Players', path: '/cricket/players', icon: 'users', bottomNav: false },
    { label: 'History', path: '/cricket/history', icon: 'history' },
    { label: 'Stats', path: '/cricket/stats', icon: 'bar-chart' },
    { label: 'Matchups', path: '/cricket/matchups', icon: 'swords' },
    // Overflow (More sheet on mobile, sidebar on desktop) for the same
    // reason Players is: the tab bar is full at six. The cricket Dashboard
    // also links to it directly so it isn't only reachable from here.
    { label: 'Box Cricket', path: '/cricket/box', icon: 'box', bottomNav: false },
  ],
}

// BOX CRICKET — a sub-section of Cricket, not a third sport.
//
// It lives at /cricket/box and keeps its own match records and leaderboards
// (different Firestore collection — see cricket/context/MatchVariant.jsx),
// but it's the same roster, the same expense pot and the same sport chip, so
// it doesn't belong in the sport switcher.
//
// While you're anywhere under /cricket/box the nav SWAPS to this list rather
// than adding a seventh cricket item: cricket's own nav is already at the
// six-tab ceiling the bottom bar can hold (see BottomNav.jsx), and once
// you're inside box cricket the cricket-wide History/Stats links would be
// showing you the wrong ledger anyway. The first item walks back out.
export const BOX_NAV_ITEMS = [
  { label: 'Cricket', mobileLabel: 'Back', path: '/cricket', icon: 'home' },
  // `end` explicitly: the default heuristic (a two-segment path is exact)
  // would treat /cricket/box as a prefix and light this up on every box page.
  { label: 'Box home', mobileLabel: 'Box', path: '/cricket/box', icon: 'box', end: true },
  { label: 'New box match', mobileLabel: 'New', path: '/cricket/box/match/new', icon: 'plus-circle' },
  { label: 'Box history', mobileLabel: 'History', path: '/cricket/box/history', icon: 'history' },
  { label: 'Box stats', mobileLabel: 'Stats', path: '/cricket/box/stats', icon: 'bar-chart' },
  { label: 'Players', path: '/cricket/players', icon: 'users', bottomNav: false },
]

/**
 * Which nav list a given pathname should render. Everything except box
 * cricket is answered by the selected sport; box cricket is the one place
 * the URL overrides it, because it's a section inside a sport rather than a
 * sport of its own.
 */
export function navItemsFor(pathname, currentSport) {
  if (pathname === '/cricket/box' || pathname.startsWith('/cricket/box/')) return BOX_NAV_ITEMS
  return SPORT_NAV_ITEMS[currentSport]
}

// One accent for the whole shell. Cricket used to carry its own `pitch`
// token (#0F7A6B) here, which made the selected-sport chip a visibly
// different green depending on which sport you were on — the shell chrome
// should read as one app, so both sports share Shuttle Manager's existing
// `brand` token.
export const SHELL_ACCENT = '#1F6F4A'

export const SPORT_META = {
  [SPORTS.SHUTTLE]: {
    label: 'Shuttle',
    emoji: '🏸',
    accent: SHELL_ACCENT,
  },
  [SPORTS.CRICKET]: {
    label: 'Cricket',
    emoji: '🏏',
    accent: SHELL_ACCENT,
  },
}
