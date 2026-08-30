// components/ScorePad.jsx
//
// The score-entry half of a match card, shared by RoundCard (doubles rounds)
// and DeciderCard (the singles tiebreaker). Extracted so the badminton finish
// rule lives in exactly one place - a decider is scored to the same 21/deuce/
// 30 rule as everything else, and if that rule ever changes it changes once.
import React from 'react'
import { BTN_SOLID } from '../styles'
import Avatar from './Avatar'

function CounterButton({ children, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="w-9 h-9 rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-lg font-semibold flex items-center justify-center transition-all active:scale-95 hover:border-brand hover:text-brand dark:hover:border-brand dark:hover:text-emerald-400"
    >
      {children}
    </button>
  )
}

function ScoreInput({ value, onChange, ariaLabel }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={value}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10)
        onChange(Number.isNaN(n) ? 0 : Math.max(0, Math.min(30, n)))
      }}
      className="text-2xl font-bold text-gray-900 dark:text-gray-100 w-14 text-center tabular-nums bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-brand dark:focus:border-emerald-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  )
}

/**
 * Whoever reaches 21 first wins outright. If both sides reach 21 (deuce),
 * play continues until either side is 2 points clear, capped at 30.
 */
export function hasWon(mine, theirs) {
  return mine === 30 || (mine >= 21 && (theirs < 21 || mine - theirs >= 2))
}

/**
 * One side of a match: who's on it, their score, and the button that declares
 * them the winner. `side` only labels the controls for screen readers.
 */
export function TeamScorePanel({ players, score, onScore, onWin, winLabel, canWin, disabled, side }) {
  const bump = (delta) => onScore(Math.max(0, Math.min(30, score + delta)))
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-center flex flex-col gap-2">
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 min-h-[2.5rem] flex flex-col justify-center gap-1">
        {players.map((p) => (
          <div key={p.id} className="flex items-center justify-center gap-1.5">
            <Avatar id={p.id} name={p.name} size="xs" />
            {p.name}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3">
        <CounterButton ariaLabel={`${side} score minus`} onClick={() => bump(-1)}>
          −
        </CounterButton>
        <ScoreInput ariaLabel={`${side} score`} value={score} onChange={onScore} />
        <CounterButton ariaLabel={`${side} score plus`} onClick={() => bump(1)}>
          +
        </CounterButton>
      </div>
      <button
        onClick={onWin}
        disabled={disabled || !canWin}
        className={`bg-brand text-white rounded-lg py-3 px-3 text-sm font-semibold w-full ${BTN_SOLID}`}
      >
        {winLabel}
      </button>
    </div>
  )
}

/**
 * The "the match was cut short" toggle. Normally a side can only be declared
 * the winner once it has actually reached a valid finish; this lets an umpire
 * close out a match that ran out of time on whatever score was reached.
 */
export function ManualFinishToggle({ on, onToggle }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        className="text-xs text-gray-400 dark:text-gray-500 underline hover:text-gray-600 dark:hover:text-gray-300"
      >
        {on ? 'Cancel manual finish' : 'Match cut short? Finish manually'}
      </button>
      {on && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
          Pick the winning side using the current score.
        </p>
      )}
    </div>
  )
}
