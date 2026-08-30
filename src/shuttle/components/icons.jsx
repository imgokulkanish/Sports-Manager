// components/icons.jsx
// Shared inline SVG icons that need to render identically across platforms —
// unlike emoji, which fall back to inconsistent (or broken) glyphs depending
// on the OS's installed font set (e.g. 🏸 rendering as a padlock on some
// Windows/Chrome combinations).
import React from 'react'

export function ShuttlecockIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21 5 6M12 21 9.5 4.5M12 21l2.5-16.5M12 21l7-15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 6c3-2.2 11-2.2 14 0" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="21" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function PeopleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" strokeLinecap="round" />
      <circle cx="17" cy="8.5" r="2.5" />
      <path d="M15.5 14.2c2.7.4 4.5 2.5 4.5 5.8" strokeLinecap="round" />
    </svg>
  )
}

export function CalendarIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" strokeLinecap="round" />
    </svg>
  )
}

export function ActivityIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 13h4l2.2-6L13 19l2.5-9.5L17 13h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function TrophyIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" strokeLinejoin="round" />
      <path d="M7 6H4.5A1.5 1.5 0 0 0 3 7.5 3.5 3.5 0 0 0 6.5 11H7M17 6h2.5A1.5 1.5 0 0 1 21 7.5 3.5 3.5 0 0 1 17.5 11H17" />
      <path d="M12 14v3M9 20h6M9.5 20c0-1.7.7-2.6 2.5-3 1.8.4 2.5 1.3 2.5 3" strokeLinecap="round" />
    </svg>
  )
}
