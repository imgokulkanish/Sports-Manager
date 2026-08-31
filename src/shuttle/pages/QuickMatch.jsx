// pages/QuickMatch.jsx
//
// Matches played without an organised session - a few games squeezed into
// whatever court time was going. No schedule to generate and no rounds to work
// through: pick who's on, play, record the result, repeat for as long as the
// court is free.
//
// The results are real results. They count towards match totals, win rates,
// partnerships and head-to-heads exactly like session matches do. What they
// don't count towards is anything measured in *sessions* - attendance, and
// winner-of-the-day - because a couple of casual games isn't a session
// turned up to. See isQuickPlay in the stats engine.
//
// GUESTS. Casual court time is exactly where someone off the roster ends up
// making up the numbers, so a guest can be typed in by name and picked like
// anyone else. They get no player record: the name lives in the day's
// quick-play document and nowhere else, so a one-off opponent never lands on
// the roster or in the stats pages. See engine/guests.js.
import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayers } from '../hooks/usePlayers'
import { useQuickPlay } from '../hooks/useSession'
import { sessionLeaderboard } from '../engine/statsEngine'
import { isGuestId, newGuestId } from '../engine/guests'
import { TeamScorePanel, ManualFinishToggle, hasWon } from '../components/ScorePad'
import Avatar from '../components/Avatar'
import Footer from '../components/Footer'
import EmptyState from '../components/EmptyState'
import { PeopleIcon } from '../components/icons'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../../shell/components/Toast'
import { BTN_OUTLINE, BTN_SOLID } from '../styles'

const FORMATS = {
  singles: { label: 'Singles', perSide: 1 },
  doubles: { label: 'Doubles', perSide: 2 },
}

function SideBox({ title, ids, perSide, playersById, onRemove }) {
  const slots = Array.from({ length: perSide }, (_, i) => ids[i] ?? null)
  return (
    <div className="flex-1 min-w-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">{title}</p>
      <div className="flex flex-col gap-1.5">
        {slots.map((id, i) =>
          id ? (
            <button
              key={id}
              type="button"
              onClick={() => onRemove(id)}
              className="flex items-center gap-1.5 text-sm text-gray-900 dark:text-gray-100 text-left hover:text-red-600 dark:hover:text-red-400"
              title="Remove"
            >
              <Avatar id={id} name={playersById[id]?.name || id} size="xs" />
              <span className="truncate">{playersById[id]?.name || id}</span>
            </button>
          ) : (
            <span key={`empty-${i}`} className="text-sm text-gray-300 dark:text-gray-600">
              — empty —
            </span>
          ),
        )}
      </div>
    </div>
  )
}

export default function QuickMatch() {
  const { players, loading: playersLoading } = usePlayers()
  const { quickPlay, loading: quickLoading, addMatch, removeMatch } = useQuickPlay()
  const { showToast } = useToast()

  const [format, setFormat] = useState('doubles')
  const [side1, setSide1] = useState([])
  const [side2, setSide2] = useState([])
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [manualFinish, setManualFinish] = useState(false)
  const [saving, setSaving] = useState(false)
  // Guests typed in on this visit but not yet on court in a saved match, so
  // there is nothing on the day's document to remember them by yet.
  const [draftGuests, setDraftGuests] = useState([])
  const [guestName, setGuestName] = useState('')

  const perSide = FORMATS[format].perSide
  const activePlayers = useMemo(() => players.filter((p) => p.isActive), [players])

  // Guests already in today's record stay pickable after a reload, so the
  // same drop-in can play a second game without being typed in again.
  const savedGuests = useMemo(
    () => Object.entries(quickPlay?.guestNames || {}).map(([id, name]) => ({ id, name })),
    [quickPlay],
  )
  const guests = useMemo(() => {
    const saved = new Set(savedGuests.map((g) => g.id))
    return [...savedGuests, ...draftGuests.filter((g) => !saved.has(g.id))]
  }, [savedGuests, draftGuests])

  // Guests are looked up by id exactly like players, so every name in this
  // page - the sides, the score panels, the match list, the day's record -
  // resolves through one map with no special casing.
  const playersById = useMemo(
    () => ({
      ...Object.fromEntries(players.map((p) => [p.id, p])),
      ...Object.fromEntries(guests.map((g) => [g.id, { ...g, isGuest: true }])),
    }),
    [players, guests],
  )

  const chosen = useMemo(() => new Set([...side1, ...side2]), [side1, side2])
  const ready = side1.length === perSide && side2.length === perSide

  const resetMatch = () => {
    setScore1(0)
    setScore2(0)
    setManualFinish(false)
  }

  // Changing format mid-pick would leave over-full sides, so trim to the new
  // shape rather than silently carrying four players into a singles match.
  const changeFormat = (next) => {
    setFormat(next)
    setSide1((s) => s.slice(0, FORMATS[next].perSide))
    setSide2((s) => s.slice(0, FORMATS[next].perSide))
    resetMatch()
  }

  // One tap puts a player on the first side with room - fastest thing to do
  // courtside. Tapping them again takes them off whichever side they landed on.
  const togglePlayer = (id) => {
    if (side1.includes(id)) return setSide1((s) => s.filter((x) => x !== id))
    if (side2.includes(id)) return setSide2((s) => s.filter((x) => x !== id))
    if (side1.length < perSide) return setSide1((s) => [...s, id])
    if (side2.length < perSide) return setSide2((s) => [...s, id])
    showToast('Both sides are full — tap a player to take them off', 'info')
  }

  const removeFrom = (id) => {
    setSide1((s) => s.filter((x) => x !== id))
    setSide2((s) => s.filter((x) => x !== id))
  }

  // A guest goes straight onto a side - typing their name is already the
  // decision to put them on, and courtside nobody wants a second tap.
  const addGuest = () => {
    const name = guestName.trim()
    if (!name) return
    if (chosen.size >= perSide * 2) {
      showToast('Both sides are full — tap a player to take them off', 'info')
      return
    }
    const guest = { id: newGuestId(), name }
    setDraftGuests((g) => [...g, guest])
    setGuestName('')
    togglePlayer(guest.id)
  }

  // Only guests who haven't played yet can be dropped; once they're in a
  // saved match the name is part of the day's record, and the way to undo
  // that is to remove the match.
  const dropGuest = (id) => {
    setDraftGuests((g) => g.filter((x) => x.id !== id))
    removeFrom(id)
  }

  const side1Won = manualFinish ? score1 !== score2 : hasWon(score1, score2)
  const side2Won = manualFinish ? score1 !== score2 : hasWon(score2, score1)

  const record = async (winner) => {
    if (!ready || saving) return
    setSaving(true)
    try {
      await addMatch({
        team1: side1,
        team2: side2,
        winner,
        points: { team1: score1, team2: score2 },
        // The day's document is the only place a guest's name is kept, so it
        // has to travel with the match that puts them on court.
        guests: Object.fromEntries(
          [...side1, ...side2]
            .filter(isGuestId)
            .map((id) => [id, playersById[id]?.name || 'Guest']),
        ),
      })
      const names = (winner === 1 ? side1 : side2).map((id) => playersById[id]?.name || id).join(' & ')
      showToast(`${names} won — match recorded`)
      resetMatch()
    } catch (err) {
      console.error('Failed to record quick match:', err)
      showToast('Could not save that match — check your connection', 'error')
    } finally {
      setSaving(false)
    }
  }

  const matches = quickPlay?.schedule || []
  const dayBoard = useMemo(() => (quickPlay ? sessionLeaderboard(quickPlay) : []), [quickPlay])

  if (playersLoading || quickLoading) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <ListSkeleton rows={4} />
      </div>
    )
  }

  // One active player is enough now: guests can make up the rest of the court.
  if (activePlayers.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Match</h1>
        <EmptyState
          icon={<PeopleIcon className="w-6 h-6" />}
          title="Add some players first"
          message="Quick matches need at least one player on the roster — guests can fill the rest of the court."
          action={
            <Link to="/shuttle/players" className={`bg-brand text-white rounded-lg px-4 py-2 text-sm font-semibold ${BTN_SOLID}`}>
              Go to Players
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Quick Match</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        One-off games with no session or schedule. They count towards match records and win rates, but not towards
        session attendance.
      </p>

      <div className="flex gap-2 mb-4">
        {Object.entries(FORMATS).map(([key, { label }]) => (
          <button
            key={key}
            type="button"
            onClick={() => changeFormat(key)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium border transition-colors ${
              format === key
                ? 'bg-brand text-white border-brand'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:border-brand'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-stretch gap-2 mb-3">
        <SideBox title="Side 1" ids={side1} perSide={perSide} playersById={playersById} onRemove={removeFrom} />
        <span className="self-center text-sm font-medium text-gray-400 dark:text-gray-500">vs</span>
        <SideBox title="Side 2" ids={side2} perSide={perSide} playersById={playersById} onRemove={removeFrom} />
      </div>

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
        Tap to pick {perSide * 2} players
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
        {activePlayers.map((p) => {
          const picked = chosen.has(p.id)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlayer(p.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left ${BTN_OUTLINE} ${
                picked
                  ? 'bg-brand-light dark:bg-brand/15 border-brand-border dark:border-brand/30 text-green-800 dark:text-green-300'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 hover:border-brand'
              }`}
            >
              <Avatar id={p.id} name={p.name} size="xs" />
              <span className="truncate">{p.name}</span>
            </button>
          )
        })}
        {/* Dashed, and labelled, so it's never in doubt which names on court
            are on the roster and which are just passing through. */}
        {guests.map((g) => {
          const picked = chosen.has(g.id)
          const removable = !savedGuests.some((x) => x.id === g.id)
          return (
            <div
              key={g.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm transition-all ${
                picked
                  ? 'bg-brand-light dark:bg-brand/15 border-brand-border dark:border-brand/40 text-green-800 dark:text-green-300'
                  : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100'
              }`}
            >
              <button
                type="button"
                onClick={() => togglePlayer(g.id)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left active:scale-[0.98] transition-transform"
              >
                <Avatar id={g.id} name={g.name} size="xs" />
                <span className="truncate">{g.name}</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">guest</span>
              </button>
              {removable && (
                <button
                  type="button"
                  onClick={() => dropGuest(g.id)}
                  aria-label={`Remove ${g.name}`}
                  className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 text-base leading-none shrink-0 transition-colors"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Someone off the roster making up the numbers. They play under this
          name for today only - nothing is added to Players, and the match
          still counts in full for everyone on court who is on the roster. */}
      <div className="flex gap-2 mb-4">
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addGuest()}
          placeholder="Playing with a guest? Type their name"
          aria-label="Guest name"
          className="flex-1 min-w-0 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <button
          type="button"
          onClick={addGuest}
          disabled={!guestName.trim()}
          className={`bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg px-4 text-sm font-medium hover:border-brand ${BTN_OUTLINE}`}
        >
          Add guest
        </button>
      </div>

      {ready ? (
        <div className="flex flex-col gap-3 mb-6">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
            <TeamScorePanel
              side="Side 1"
              players={side1.map((id) => ({ id, name: playersById[id]?.name || id }))}
              score={score1}
              onScore={setScore1}
              onWin={() => record(1)}
              winLabel="Side 1 won"
              canWin={side1Won}
              disabled={saving}
            />
            <span className="text-sm font-medium text-gray-400 dark:text-gray-500 mt-16">vs</span>
            <TeamScorePanel
              side="Side 2"
              players={side2.map((id) => ({ id, name: playersById[id]?.name || id }))}
              score={score2}
              onScore={setScore2}
              onWin={() => record(2)}
              winLabel="Side 2 won"
              canWin={side2Won}
              disabled={saving}
            />
          </div>
          <ManualFinishToggle on={manualFinish} onToggle={() => setManualFinish((v) => !v)} />
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center mb-6">
          Pick {perSide * 2 - chosen.size} more player{perSide * 2 - chosen.size === 1 ? '' : 's'} to start scoring.
        </p>
      )}

      {matches.length > 0 && (
        <>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Today · {matches.length} match{matches.length === 1 ? '' : 'es'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSide1(matches[matches.length - 1].team1)
                setSide2(matches[matches.length - 1].team2)
                setFormat(matches[matches.length - 1].team1.length === 1 ? 'singles' : 'doubles')
                resetMatch()
              }}
              className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200"
            >
              Same players again
            </button>
          </div>
          <div className="flex flex-col gap-1.5 mb-4">
            {matches.map((m, i) => {
              const entry = quickPlay.scores?.[i]
              const win = entry?.winner
              const name = (id) => playersById[id]?.name || id
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm"
                >
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-4 shrink-0">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-gray-900 dark:text-gray-100">
                    <span className={win === 1 ? 'font-semibold text-brand dark:text-emerald-400' : ''}>
                      {m.team1.map(name).join(' & ')}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 mx-1.5">vs</span>
                    <span className={win === 2 ? 'font-semibold text-brand dark:text-emerald-400' : ''}>
                      {m.team2.map(name).join(' & ')}
                    </span>
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {entry?.points ? `${entry.points.team1}-${entry.points.team2}` : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMatch(i)}
                    className="text-xs text-red-400 dark:text-red-400/70 underline shrink-0 hover:text-red-600 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>

          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Today&apos;s record</p>
          <div className="flex flex-col gap-1.5">
            {dayBoard.map((row) => (
              <div
                key={row.playerId}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
              >
                <Avatar id={row.playerId} name={playersById[row.playerId]?.name || row.playerId} size="xs" />
                <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">
                  {playersById[row.playerId]?.name || row.playerId}
                </span>
                {row.guest && <span className="text-[10px] text-gray-400 dark:text-gray-500">guest</span>}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {row.wins}W {row.losses}L
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <Footer />
    </div>
  )
}
