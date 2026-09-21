// hooks/useSession.js
import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { db, firebaseStatus } from '../firebase'
import { localSubscribe, localAdd, localUpdate, localDelete, localGetOnce } from '../localStore'
import { isGuestId, pruneGuestNames } from '../engine/guests'
import {
  substituteInSchedule,
  swapPlayersInSlot,
  moveSlot,
  moveCourtPlanSlot,
  guestIdsIn,
  groupBySlot,
  pendingSlots,
  replacePendingMatches,
  generateSchedule,
  applySessionOverrides,
  maxCourtsFor,
  resolveOnCourt,
  compactOnCourt,
  startedMatches,
  swapMatchPlaces,
  playedCourt,
} from '../engine/scheduleEngine'

const COLLECTION = 'sessions'
const LOCAL_CACHE_PREFIX = 'shuttle-manager:session:'
const USE_LOCAL = !firebaseStatus().configured

// --- Offline-safety helpers -------------------------------------------------
// Live scoring writes to Firestore AND mirrors to localStorage so a dropped
// connection mid-session doesn't lose scores. On reconnect, the live page
// reconciles by re-writing local state to Firestore.

export function cacheSessionLocally(sessionId, sessionData) {
  try {
    localStorage.setItem(LOCAL_CACHE_PREFIX + sessionId, JSON.stringify(sessionData))
  } catch {
    // localStorage may be unavailable (private browsing, quota) - fail silently,
    // Firestore is still the source of truth when online.
  }
}

export function readCachedSession(sessionId) {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_PREFIX + sessionId)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearCachedSession(sessionId) {
  try {
    localStorage.removeItem(LOCAL_CACHE_PREFIX + sessionId)
  } catch {
    /* no-op */
  }
}

// --- Hooks -------------------------------------------------------------------

export function useSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (USE_LOCAL) {
      return localSubscribe(COLLECTION, (items) => {
        setSessions([...items].sort((a, b) => new Date(b.date) - new Date(a.date)))
        setLoading(false)
      })
    }
    const q = query(collection(db, COLLECTION), orderBy('date', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSessions(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              ...data,
              date: data.date?.toDate ? data.date.toDate().toISOString() : data.date,
            }
          }),
        )
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsub
  }, [])

  const createSession = useCallback(async (sessionData) => {
    const payload = {
      ...sessionData,
      date: new Date(sessionData.date).toISOString(),
      // Quick play is created already 'completed' - it has no schedule to work
      // through, every match in it is a finished result the moment it's added.
      status: sessionData.status || 'scheduled',
      scores: sessionData.scores || {},
    }
    if (USE_LOCAL) return localAdd(COLLECTION, { ...payload, createdAt: Date.now() })
    const ref = await addDoc(collection(db, COLLECTION), { ...payload, createdAt: serverTimestamp() })
    return ref.id
  }, [])

  const deleteSession = useCallback(async (sessionId) => {
    clearCachedSession(sessionId)
    if (USE_LOCAL) return localDelete(COLLECTION, sessionId)
    return deleteDoc(doc(db, COLLECTION, sessionId))
  }, [])

  return { sessions, loading, error, createSession, deleteSession }
}

export function useSession(sessionId) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sessionId) return
    if (USE_LOCAL) {
      return localSubscribe(COLLECTION, (items) => {
        setSession(items.find((i) => i.id === sessionId) || null)
        setLoading(false)
      })
    }
    const ref = doc(db, COLLECTION, sessionId)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          const normalized = {
            id: snap.id,
            ...data,
            date: data.date?.toDate ? data.date.toDate().toISOString() : data.date,
          }
          setSession(normalized)
          cacheSessionLocally(sessionId, normalized)
        } else {
          setSession(null)
        }
        setLoading(false)
      },
      (err) => {
        // Firestore unreachable - fall back to the local cache so a live
        // session in progress can keep going offline.
        const cached = readCachedSession(sessionId)
        if (cached) setSession(cached)
        setError(err)
        setLoading(false)
      },
    )
    return unsub
  }, [sessionId])

  const updateSession = useCallback(
    async (data) => {
      if (!sessionId) return
      if (USE_LOCAL) return localUpdate(COLLECTION, sessionId, data)
      cacheSessionLocally(sessionId, { ...session, ...data })
      try {
        await updateDoc(doc(db, COLLECTION, sessionId), data)
      } catch (err) {
        // Keep the local cache; the UI can retry later. Rethrow so callers
        // (e.g. score buttons) can show a "saved locally, will sync" toast.
        throw err
      }
    },
    [sessionId, session],
  )

  // What each court is playing right now - see resolveOnCourt. Read fresh in
  // every write below so the court that didn't change hands is pinned to the
  // match it is actually in the middle of.
  const currentOnCourt = useCallback(
    () => resolveOnCourt(session?.schedule || [], session?.scores || {}, session?.onCourt || {}),
    [session],
  )

  /**
   * Record a result and hand the freed court its next match in the same write.
   * The entry keeps the court it was played on (which court-2 bookings are
   * counted against) and when, so "undo last" can find the latest result
   * across courts that no longer finish in schedule order.
   */
  const recordScore = useCallback(
    async (roundIndex, winner, points) => {
      const schedule = session?.schedule || []
      const before = currentOnCourt()
      const onEntry = Object.entries(before).find(([, index]) => index === roundIndex)
      const court = onEntry ? Number(onEntry[0]) : schedule[roundIndex]?.court ?? 1
      const entry = { winner, ...(points ? { points } : {}), court, at: Date.now() }
      const newScores = { ...(session?.scores || {}), [roundIndex]: entry }
      const onCourt = compactOnCourt(resolveOnCourt(schedule, newScores, before))
      await updateSession({ scores: newScores, onCourt })
    },
    [session, updateSession, currentOnCourt],
  )

  /**
   * Take a result back off and put the match back on the court it was played
   * on - an undo is nearly always a mis-tap, so the players are still there.
   * Whatever that court had just been handed goes back in the queue, as does
   * anything on another court sharing a player with it.
   */
  const undoLastScore = useCallback(
    async (roundIndex) => {
      const schedule = session?.schedule || []
      const entry = session?.scores?.[roundIndex]
      const newScores = { ...(session?.scores || {}) }
      delete newScores[roundIndex]
      if (!schedule[roundIndex]) {
        await updateSession({ scores: newScores })
        return
      }
      const court = playedCourt(schedule, roundIndex, entry)
      const players = new Set([...schedule[roundIndex].team1, ...schedule[roundIndex].team2])
      const pinned = {}
      Object.entries(currentOnCourt()).forEach(([c, index]) => {
        if (!Number.isInteger(index) || Number(c) === court) return
        if ([...schedule[index].team1, ...schedule[index].team2].some((id) => players.has(id))) return
        pinned[c] = index
      })
      pinned[court] = roundIndex
      const onCourt = compactOnCourt(resolveOnCourt(schedule, newScores, pinned))
      await updateSession({ scores: newScores, onCourt })
    },
    [session, updateSession, currentOnCourt],
  )

  /**
   * Put a different match on `court` - the one due there is waiting on a
   * player who hasn't arrived, or the court's booked matches are done and the
   * group wants to keep it going. The match it replaces trades places with the
   * one brought on (see swapMatchPlaces), so it comes round again later
   * instead of being handed straight back to the next free court.
   */
  const playOnCourt = useCallback(
    async (court, matchIndex) => {
      const current = session?.schedule || []
      if (!current[matchIndex] || session?.scores?.[matchIndex]) return false
      const before = currentOnCourt()
      const replaced = before[court]
      const schedule = Number.isInteger(replaced) ? swapMatchPlaces(current, replaced, matchIndex) : current
      const pinned = { ...before, [court]: matchIndex }
      const onCourt = compactOnCourt(resolveOnCourt(schedule, session?.scores || {}, pinned))
      if (onCourt[court] !== matchIndex) return false
      await updateSession(schedule === current ? { onCourt } : { schedule, onCourt })
      return true
    },
    [session, updateSession, currentOnCourt],
  )

  // --- Live schedule adjustments ---------------------------------------------
  // Both of these rewrite the schedule of a session that's already underway,
  // so both go out of their way not to disturb `scores`, which is keyed by
  // each match's index in the flat schedule array. See the "Live schedule
  // edits" section of engine/scheduleEngine.js for the guarantees.

  /**
   * Put `inId` on court in place of `outId` for one match - the fix for a
   * player stuck in traffic, and the way a drop-in gets a game. Someone who
   * isn't in playerIds is recorded as a guest of the session.
   * Resolves false if the swap wasn't possible (already playing that round).
   */
  const substitutePlayer = useCallback(
    async (matchIndex, outId, inId) => {
      const current = session?.schedule || []
      const live = currentOnCourt()
      const busyIds = Object.values(live)
        .filter(Number.isInteger)
        .flatMap((index) => [...current[index].team1, ...current[index].team2])
      const schedule = substituteInSchedule(current, matchIndex, outId, inId, { busyIds })
      if (schedule === current) return false
      await updateSession({
        schedule,
        // Pinned, so the edit can't shift which match a court is in the middle of.
        onCourt: compactOnCourt(live),
        // Recomputed from the schedule rather than appended to, so undoing a
        // substitution takes the guest back off the session by itself.
        guestIds: guestIdsIn(schedule, session?.playerIds || []),
        substitutions: [
          ...(session?.substitutions || []),
          { matchIndex, slot: current[matchIndex]?.slot ?? matchIndex, outId, inId, at: new Date().toISOString() },
        ],
      })
      return true
    },
    [session, updateSession, currentOnCourt],
  )

  /**
   * Switch two on-court players between teams (or courts) for this match only.
   * Deliberately not logged in `substitutions` - see swapPlayersInSlot.
   */
  const swapPlayers = useCallback(
    async (matchIndex, idA, idB) => {
      const current = session?.schedule || []
      const live = compactOnCourt(currentOnCourt())
      const schedule = swapPlayersInSlot(current, matchIndex, idA, idB, { matchIndices: Object.values(live) })
      if (schedule === current) return false
      await updateSession({ schedule, onCourt: live })
      return true
    },
    [session, updateSession, currentOnCourt],
  )

  /**
   * Reorder the rounds still to come, dragging one round to another position
   * and sliding the ones in between along - see moveSlot for why that isn't
   * the same operation as swapSlots. Only ever called with rounds that still
   * have matches to play; a finished or on-court match moving with its round
   * only changes where it is listed, since results and `onCourt` go by index.
   */
  const moveRound = useCallback(
    async (fromSlot, toSlot) => {
      const current = session?.schedule || []
      const schedule = moveSlot(current, fromSlot, toSlot)
      if (schedule === current) return false
      const data = { schedule }
      const plan = moveCourtPlanSlot(session?.courtsBySlot, fromSlot, toSlot)
      if (plan !== session?.courtsBySlot) data.courtsBySlot = plan
      await updateSession(data)
      return true
    },
    [session, updateSession],
  )

  /**
   * Work a late arrival into a session that's already running: they join the
   * roster and every round that hasn't started yet is redrawn around the
   * bigger group. Rounds already played, part-played, or scored are left
   * exactly as they are - see pendingSlots for where the line is drawn.
   *
   * `playerRecords` is the full player list, needed because the regenerated
   * rounds have to respect everyone's partner/opponent constraints.
   * Resolves { ok, rounds } - `rounds` being how many were redrawn.
   */
  const addPlayerAndRedraw = useCallback(
    async (playerId, playerRecords) => {
      if (!playerId || (session?.playerIds || []).includes(playerId)) return { ok: false, reason: 'already-in' }
      const playerIds = [...(session?.playerIds || []), playerId]
      const pending = pendingSlots(
        session?.schedule || [],
        session?.scores || {},
        startedMatches(session?.schedule || [], session?.scores || {}, session?.onCourt),
      )
      if (!pending) return { ok: false, reason: 'nothing-pending' }

      const roster = playerIds.map((id) => playerRecords.find((p) => p.id === id)).filter(Boolean)
      // Everything the redraw is NOT allowed to touch, handed over as history.
      // Without it the remaining rounds are drawn as if the evening had just
      // started: the generator re-pairs people who already played together and
      // leaves others never paired at all, which is exactly the complaint a
      // late arrival is least likely to be blamed for.
      const locked = new Set(pending.indices)
      const priorSchedule = (session?.schedule || []).filter((_, i) => !locked.has(i))
      const generated = generateSchedule(applySessionOverrides(roster), {}, {
        courtsBySlot: pending.courtsBySlot,
        priorSchedule,
        // Each pending round keeps its court count; whether a court plays
        // doubles, singles or 2 vs 1 is re-decided for the bigger group (7 + 1
        // late arrival turns court 2 back into a doubles court).
        spareCourt: session?.spareCourt || null,
      })
      // A court needs four players and the constraints have to be satisfiable;
      // if the draw fails, the session is left untouched rather than half-edited.
      if (!generated || generated.schedule.length !== pending.indices.length) {
        return { ok: false, reason: 'generate-failed' }
      }

      const schedule = replacePendingMatches(session.schedule, pending.indices, generated.schedule)
      await updateSession({
        playerIds,
        schedule,
        // Someone who was filling in as a guest and is now joining properly
        // should stop being counted as a guest.
        guestIds: guestIdsIn(schedule, playerIds),
      })
      return { ok: true, rounds: pending.courtsBySlot.length }
    },
    [session, updateSession],
  )

  /** Add one more round without disturbing the planned or scored matches. */
  const addExtraRound = useCallback(
    async (playerRecords) => {
      const playerIds = session?.playerIds || []
      const roster = playerIds.map((id) => playerRecords.find((p) => p.id === id)).filter(Boolean)
      if (roster.length < 4) return { ok: false, reason: 'not-enough-players' }

      const existingSlots = groupBySlot(session?.schedule || [])
      const nextSlot = existingSlots.length ? Math.max(...existingSlots.map((entry) => entry.slot)) + 1 : 0
      const spareCourt = session?.spareCourt || null
      const courtCount = Math.min(session?.courtsBySlot?.at(-1) || 1, maxCourtsFor(roster.length, spareCourt))
      const generated = generateSchedule(applySessionOverrides(roster), {}, {
        courtsBySlot: [courtCount],
        priorSchedule: session?.schedule || [],
        spareCourt,
      })
      if (!generated) return { ok: false, reason: 'generate-failed' }

      const newMatches = generated.schedule.map((match) => ({ ...match, slot: nextSlot }))
      await updateSession({
        schedule: [...(session?.schedule || []), ...newMatches],
        courtsBySlot: [...(session?.courtsBySlot || existingSlots.map((entry) => entry.matches.length)), courtCount],
      })
      return { ok: true, matches: newMatches.length }
    },
    [session, updateSession],
  )

  /**
   * Record the singles tiebreaker between the two players who finished level
   * on match points. Stored beside the schedule rather than in it: it's a
   * singles match, and folding it into a doubles schedule would put a
   * one-player "team" through every partner/opponent stat in the app.
   * `points` is [winnerSideScore, otherSideScore] aligned with `players`.
   */
  const recordDecider = useCallback(
    async (players, winnerId, points) => {
      if (players?.length !== 2 || !players.includes(winnerId)) return false
      await updateSession({
        decider: { players, winnerId, points, at: new Date().toISOString() },
      })
      return true
    },
    [updateSession],
  )

  /** Undo a mis-tapped decider; the session falls back to the rally-point tiebreak. */
  const clearDecider = useCallback(async () => {
    await updateSession({ decider: null })
  }, [updateSession])

  const completeSession = useCallback(async () => {
    await updateSession({ status: 'completed' })
    clearCachedSession(sessionId)
  }, [updateSession, sessionId])

  // Same delete as useSessions', offered here so the live page doesn't have to
  // subscribe to the whole collection just to discard the session it's already
  // holding - that page has to survive a bad court-side connection.
  const deleteThisSession = useCallback(async () => {
    if (!sessionId) return
    clearCachedSession(sessionId)
    if (USE_LOCAL) return localDelete(COLLECTION, sessionId)
    return deleteDoc(doc(db, COLLECTION, sessionId))
  }, [sessionId])

  return {
    session,
    loading,
    error,
    updateSession,
    recordScore,
    undoLastScore,
    substitutePlayer,
    swapPlayers,
    playOnCourt,
    moveRound,
    addPlayerAndRedraw,
    addExtraRound,
    recordDecider,
    clearDecider,
    completeSession,
    deleteThisSession,
  }
}

/** Update any session by id, for callers that aren't subscribed to just one. */
async function updateSessionById(sessionId, data) {
  if (USE_LOCAL) return localUpdate(COLLECTION, sessionId, data)
  return updateDoc(doc(db, COLLECTION, sessionId), data)
}

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()

/**
 * Ad-hoc matches played outside an organised session — a few games squeezed
 * into spare court time. They're stored as a session document flagged
 * `kind: 'quick'` so every match-level stat picks them up with no special
 * casing, while everything that counts *sessions* filters them out (see
 * isQuickPlay in the stats engine).
 *
 * One document per day: matches accumulate into it as they're played, which
 * keeps the collection tidy and gives the day a single record to review.
 */
export function useQuickPlay(day = null) {
  const { sessions, loading, createSession } = useSessions()

  // A stable string key for the day. Defaulting the parameter to `new Date()`
  // would hand the memo a fresh object on every render, so it - and every
  // callback depending on it - would be rebuilt each time for no reason.
  const dayKey = useMemo(() => (day ? new Date(day) : new Date()).toDateString(), [day])

  const today = useMemo(
    () => sessions.find((s) => s.kind === 'quick' && sameDay(s.date, dayKey)) || null,
    [sessions, dayKey],
  )

  // Who is actually on court, split into roster players and off-roster
  // guests. Deriving it from the schedule every time means removing a match
  // takes anyone it leaves with no games at all back off the record.
  //
  // Guests are kept out of playerIds and listed in guestIds, which is the
  // same shape a session uses for a drop-in - so the session board, the PDF
  // and the CSV already know to rank them below the members and label them.
  // See engine/guests.js for why they have no player record at all.
  const rosterOf = (schedule) => {
    const ids = [...new Set(schedule.flatMap((m) => [...m.team1, ...m.team2]))]
    return {
      playerIds: ids.filter((id) => !isGuestId(id)),
      guestIds: ids.filter(isGuestId),
    }
  }

  /**
   * `guests` maps any guest id on court to the name typed for them, so the
   * day's document carries the only record of who they were.
   */
  const addMatch = useCallback(
    async ({ team1, team2, winner, points, guests = {} }) => {
      const match = { team1, team2, resting: [] }
      const entry = points ? { winner, points } : { winner }
      if (!today) {
        const schedule = [match]
        const roster = rosterOf(schedule)
        return createSession({
          kind: 'quick',
          date: new Date(dayKey),
          status: 'completed',
          ...roster,
          guestNames: pruneGuestNames(roster.guestIds, guests),
          schedule,
          scores: { 0: entry },
          courtCost: 0,
          waterCost: 0,
          umpire: '',
        })
      }
      const schedule = [...(today.schedule || []), match]
      const roster = rosterOf(schedule)
      await updateSessionById(today.id, {
        schedule,
        scores: { ...(today.scores || {}), [schedule.length - 1]: entry },
        ...roster,
        guestNames: pruneGuestNames(roster.guestIds, { ...(today.guestNames || {}), ...guests }),
      })
      return today.id
    },
    [today, dayKey, createSession],
  )

  /**
   * Remove one match. Quick play is the one place indices can safely be
   * closed up: the matches carry no slot/court numbering and nothing outside
   * the document refers to them, so `scores` is simply rebuilt to match.
   */
  const removeMatch = useCallback(
    async (matchIndex) => {
      if (!today) return
      const old = today.schedule || []
      const schedule = old.filter((_, i) => i !== matchIndex)
      const scores = {}
      old.forEach((_, i) => {
        if (i === matchIndex) return
        const entry = today.scores?.[i]
        if (entry) scores[i < matchIndex ? i : i - 1] = entry
      })
      const roster = rosterOf(schedule)
      await updateSessionById(today.id, {
        schedule,
        scores,
        ...roster,
        guestNames: pruneGuestNames(roster.guestIds, today.guestNames || {}),
      })
    },
    [today],
  )

  return { quickPlay: today, loading, addMatch, removeMatch }
}

export async function getSessionOnce(sessionId) {
  if (USE_LOCAL) return localGetOnce(COLLECTION, sessionId)
  const snap = await getDoc(doc(db, COLLECTION, sessionId))
  if (!snap.exists()) return null
  const data = snap.data()
  return { id: snap.id, ...data, date: data.date?.toDate ? data.date.toDate().toISOString() : data.date }
}
