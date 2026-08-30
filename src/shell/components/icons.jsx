// icons.jsx
//
// A small, shell-only icon set for the sidebar/bottom-nav chrome (sport
// switcher + generic nav glyphs). This is deliberately NOT a replacement for
// either app's existing icon set (Shuttle has components/icons/, Cricket has
// components/StatIcons.jsx) — those stay exactly where they are and keep
// serving their own pages. This set only covers the handful of glyphs the
// shell chrome itself needs (home, plus, history, stats, players, wallet,
// swords for Matchups). Swap for real brand icons whenever you're ready;
// stroke-based and currentColor so they inherit sidebar text color for free.
import React from 'react'

const paths = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  'plus-circle': 'M12 8v8M8 12h8M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  history: 'M3 3v6h6M3.51 15a9 9 0 102.13-9.36L3 9',
  'bar-chart': 'M4 20V10M12 20V4M20 20v-6',
  users: 'M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M17 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  wallet: 'M3 7a2 2 0 012-2h13a1 1 0 011 1v2H5a2 2 0 01-2-2zm0 0v10a2 2 0 002 2h14a1 1 0 001-1v-8a1 1 0 00-1-1H8',
  swords: 'M6 3l6 6M18 3l-6 6M4 20l8-8M20 20l-8-8M6 3H3v3M18 3h3v3',
}

export default function Icon({ name, size = 20, className = '' }) {
  const d = paths[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
