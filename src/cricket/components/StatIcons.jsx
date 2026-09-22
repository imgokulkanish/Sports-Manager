import React from 'react'

// Shared per-category icons for leaderboards — used by both the Stats page
// tabs and the Dashboard's compact mini-leaderboards, so "same icon" means
// literally the same component, not just a visual match.

export function BatIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 2.5v6" strokeLinecap="round" />
      <rect x="7" y="8" width="8" height="12" rx="3" />
    </svg>
  )
}

export function BallIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <path d="M6 8c2 2 2 6 0 8M18 8c-2 2-2 6 0 8" strokeLinecap="round" />
    </svg>
  )
}

export function TrophyIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" strokeLinecap="round" />
      <path d="M12 12v4M9 20h6M10 16h4v4h-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StopwatchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 2h6M12 2v3" strokeLinecap="round" />
    </svg>
  )
}

export function TargetIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
    </svg>
  )
}

export function GaugeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 18a8 8 0 1 1 16 0" strokeLinecap="round" />
      <path d="M12 18l4-6" strokeLinecap="round" />
      <circle cx="12" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function CrosshairIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" strokeLinecap="round" />
    </svg>
  )
}

export function ShieldIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ArmbandIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 4h10l-1.5 16h-7L7 4Z" strokeLinejoin="round" />
      <path d="M14 10.2a2.6 2.6 0 1 0 0 4.4" strokeLinecap="round" />
    </svg>
  )
}
