// Avatar.jsx
//
// Moved verbatim from shuttle-manager/src/components/Avatar.jsx — zero
// changes. Worth calling out WHY this one moves unchanged while so much
// else needs adapting: it was already fully sport-agnostic (id + name in,
// a deterministic color out) with no Shuttle-specific coupling at all. This
// is the one component in either app that was already shared-app-ready.
//
// Cricket's utils.js independently reinvented the same function with a
// different palette (avatarColor/initials) — once Cricket's pages are
// physically moved in, point their imports at this file instead of
// Cricket's own utils.js avatarColor/initials, so avatars are visually
// consistent regardless of which app a player originated in. Not done here
// since that's an edit to Cricket's existing files, not a shell-only change
// — flagging as a small follow-up, not doing it silently.
import React from 'react'

export function initials(name = '') {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

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
