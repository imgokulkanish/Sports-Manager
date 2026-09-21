// components/RoundAdjustModal.jsx
//
// The court-side escape hatch for a round that can't be played as scheduled.
// Two situations, both common enough to be worth a dedicated flow:
//
//   1. Someone due on court is still on the way. Either swap them for a
//      player who's resting, or play a later match they aren't in on that
//      court and push theirs back, which buys them the ten minutes.
//   3. The teams just want mixing up - two players on court switch sides (or
//      courts) for this match. Nobody comes on or off, so it isn't logged as
//      a substitution.
//   2. Someone who isn't in the session at all wants a game or two - easing
//      back from an injury, or just passing through. They come on in place of
//      a scheduled player and are recorded as a guest of the session, so the
//      match still lands on their record.
//
// Everything here edits the matches on court now. Later rounds are left exactly
// as generated, because a substitution is a one-off, not a change of plan.
// The courts run as separate queues, so the two matches on court can come
// from different rounds - `slot` is simply what is being played right now.
import React, { useMemo, useState } from 'react'
import Avatar from './Avatar'
import { BTN_OUTLINE, BTN_SOLID } from '../styles'

const SECTION = 'text-xs font-medium text-gray-500 dark:text-gray-400 mb-2'

function PlayerButton({ id, name, subtitle, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 hover:border-brand dark:hover:border-brand ${BTN_OUTLINE}`}
    >
      <Avatar id={id} name={name} size="xs" />
      <span className="flex-1 truncate">{name}</span>
      {subtitle && <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{subtitle}</span>}
    </button>
  )
}

export default function RoundAdjustModal({
  open,
  onClose,
  slot,
  multiCourt,
  playersById,
  benchIds = [],
  laterMatches = [],
  outsideCandidates = [],
  onSubstitute,
  onSwapPlayers,
  onPlayInstead,
  onAddGuest,
  busy = false,
}) {
  const [missingId, setMissingId] = useState(null)
  const [guestName, setGuestName] = useState('')
  const [addingGuest, setAddingGuest] = useState(false)

  const name = (id) => playersById[id]?.name || id

  // Everyone on court this round, tagged with the match and team they're in so
  // a substitution knows which entry of the flat schedule to rewrite, and a
  // side switch knows who is actually on the other side.
  const onCourt = useMemo(() => {
    if (!slot) return []
    return slot.matches.flatMap(({ index, match, court }) => [
      ...match.team1.map((id) => ({ id, matchIndex: index, court, team: 1 })),
      ...match.team2.map((id) => ({ id, matchIndex: index, court, team: 2 })),
    ])
  }, [slot])

  const missing = missingId ? onCourt.find((p) => p.id === missingId) : null

  // Anyone on court who isn't the selected player's partner: the other team in
  // their match, plus everyone on the other court when the round has two.
  const switchTargets = useMemo(() => {
    if (!missing) return []
    return onCourt.filter(
      (p) => p.id !== missing.id && !(p.matchIndex === missing.matchIndex && p.team === missing.team),
    )
  }, [onCourt, missing])

  // Matches that could go on this court instead: the missing player isn't in
  // them (the whole point is to give them time to arrive), and nobody in them
  // is playing on another court.
  const swappableMatches = useMemo(() => {
    if (!missing) return []
    const busy = new Set(onCourt.filter((p) => p.matchIndex !== missing.matchIndex).map((p) => p.id))
    return laterMatches
      .filter(({ match }) => ![...match.team1, ...match.team2].some((id) => id === missing.id || busy.has(id)))
      .slice(0, 4)
  }, [laterMatches, missing, onCourt])

  const close = () => {
    setMissingId(null)
    setGuestName('')
    onClose()
  }

  const handleSubstitute = async (inId) => {
    if (!missing) return
    const ok = await onSubstitute(missing.matchIndex, missing.id, inId)
    if (ok) close()
  }

  const handleSwitchSides = async (otherId) => {
    if (!missing) return
    const ok = await onSwapPlayers(missing.matchIndex, missing.id, otherId)
    if (ok) close()
  }

  const handleSwap = async (matchIndex) => {
    if (!missing) return
    const ok = await onPlayInstead(missing.court, matchIndex)
    if (ok) close()
  }

  const handleAddGuest = async () => {
    const trimmed = guestName.trim()
    if (!trimmed || !missing || addingGuest) return
    setAddingGuest(true)
    try {
      const newId = await onAddGuest(trimmed)
      if (newId) await handleSubstitute(newId)
    } finally {
      setAddingGuest(false)
    }
  }

  if (!open || !slot) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 md:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl w-full max-w-md max-h-[88vh] overflow-y-auto p-5 shadow-xl animate-[fadein_0.15s_ease-out]">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Adjust {multiCourt ? 'matches on court' : 'this match'}
          </h3>
          <button
            onClick={close}
            className="text-xs text-gray-400 dark:text-gray-500 underline hover:text-gray-600 dark:hover:text-gray-300"
          >
            Close
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Changes apply to what is being played now. Later rounds keep their original pairings.
        </p>

        {!missing ? (
          <>
            <p className={SECTION}>Which player needs changing?</p>
            <div className="flex flex-col gap-1.5">
              {onCourt.map(({ id, court, team }) => (
                <PlayerButton
                  key={id}
                  id={id}
                  name={name(id)}
                  subtitle={multiCourt ? `Court ${court} · Team ${team}` : `Team ${team}`}
                  onClick={() => setMissingId(id)}
                />
              ))}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">
              Pick whoever is missing, giving up their spot to a drop-in, or switching sides.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
              <Avatar id={missing.id} name={name(missing.id)} size="xs" />
              <span className="text-sm text-amber-800 dark:text-amber-300 flex-1 truncate">
                {name(missing.id)} selected
              </span>
              <button
                onClick={() => setMissingId(null)}
                className="text-xs text-amber-700 dark:text-amber-400 underline shrink-0 hover:text-amber-900 dark:hover:text-amber-200"
              >
                Change
              </button>
            </div>

            {/* First, because it's the lightest change: nobody leaves the
                court, the teams just get mixed up for this one match. */}
            <p className={SECTION}>Switch sides with</p>
            {switchTargets.length > 0 ? (
              <div className="flex flex-col gap-1.5 mb-5">
                {switchTargets.map(({ id, court, team }) => (
                  <PlayerButton
                    key={id}
                    id={id}
                    name={name(id)}
                    subtitle={multiCourt ? `Court ${court} · Team ${team}` : `Team ${team}`}
                    disabled={busy}
                    onClick={() => handleSwitchSides(id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">Nobody on the other side to switch with.</p>
            )}

            <p className={SECTION}>Or swap in someone resting</p>
            {benchIds.length > 0 ? (
              <div className="flex flex-col gap-1.5 mb-5">
                {benchIds.map((id) => (
                  <PlayerButton
                    key={id}
                    id={id}
                    name={name(id)}
                    subtitle="resting"
                    disabled={busy}
                    onClick={() => handleSubstitute(id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">
                Nobody is resting — everyone is already on court.
              </p>
            )}

            <p className={SECTION}>
              Play a later match {multiCourt ? `on Court ${missing.court} ` : ''}now
            </p>
            {swappableMatches.length > 0 ? (
              <div className="flex flex-col gap-1.5 mb-5">
                {swappableMatches.map(({ index, match, roundNumber }) => (
                  <button
                    key={index}
                    type="button"
                    disabled={busy}
                    onClick={() => handleSwap(index)}
                    className={`flex items-start gap-3 w-full text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-brand dark:hover:border-brand ${BTN_OUTLINE}`}
                  >
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-9 shrink-0 mt-0.5">
                      Rd {roundNumber}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-sm text-gray-900 dark:text-gray-100">
                      {match.team1.map(name).join(' & ')}
                      <span className="text-gray-400 dark:text-gray-500 mx-1.5">vs</span>
                      {match.team2.map(name).join(' & ')}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">
                No later match can start now without {name(missing.id)} or someone already on court.
              </p>
            )}

            <p className={SECTION}>Bring in someone from outside the session</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-1 mb-2">
              They play this match only. It counts on their record, and every session sheet marks them as a guest
              with the number of matches they actually played.
            </p>
            {outsideCandidates.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-3 max-h-48 overflow-y-auto">
                {outsideCandidates.map((p) => (
                  <PlayerButton
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    subtitle="guest"
                    disabled={busy}
                    onClick={() => handleSubstitute(p.id)}
                  />
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
                placeholder="Or add a new player by name"
                className="flex-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleAddGuest}
                disabled={busy || addingGuest || !guestName.trim()}
                className={`bg-brand text-white rounded-lg px-4 text-sm font-semibold ${BTN_SOLID}`}
              >
                {addingGuest ? 'Adding…' : 'Add'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
