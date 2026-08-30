// utils.js
// Deterministic avatar color assignment so the same player always gets the
// same color across every screen (Players grid, scorecards, leaderboards).
const PALETTE = ['#0F7A6B', '#2563EB', '#D97706', '#7C3AED', '#DC2626', '#0891B2']

export function initials(name = '') {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function avatarColor(id = '') {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export function formatOversDisplay(overs) {
  if (overs === undefined || overs === null) return '0.0'
  return Number(overs).toFixed(1)
}
