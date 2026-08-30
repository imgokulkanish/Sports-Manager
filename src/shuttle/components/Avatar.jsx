// components/Avatar.jsx
import React from 'react'

export function initials(name = '') {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Small, deliberately muted palette anchored on the brand green so avatars
// read as one family rather than a rainbow. Every entry keeps enough
// contrast for white avatar text.
const AVATAR_PALETTE = [
  '#1F6F4A', // brand green (anchor)
  '#0E7490', // teal
  '#4338CA', // indigo
  '#92400E', // amber
  '#BE123C', // rose
  '#475569', // slate
]

function hashId(id = '') {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Deterministic avatar color for a player, keyed by id so the same player
 * always gets the same color everywhere. Falls back to the brand anchor
 * when no id is available (e.g. a bare name string with no player record).
 */
export function avatarColor(id) {
  if (!id) return AVATAR_PALETTE[0]
  return AVATAR_PALETTE[hashId(id) % AVATAR_PALETTE.length]
}

const SIZES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
}

export default function Avatar({ id, name, size = 'sm', className = '', title }) {
  return (
    <div
      title={title ?? name}
      className={`${SIZES[size]} rounded-full text-white flex items-center justify-center font-semibold shrink-0 ${className}`}
      style={{ backgroundColor: avatarColor(id) }}
    >
      {initials(name)}
    </div>
  )
}
