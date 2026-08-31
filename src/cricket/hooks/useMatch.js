// hooks/useMatch.js
import { useEffect, useState, useCallback } from 'react'
import { db } from '../firebase'
import { collection, doc, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { useMatchVariant } from '../context/MatchVariant'

// Own collection (not Shuttle Manager's `sessions`) so the two apps' data
// stays isolated inside the shared kanishpersonalos project.
//
// WHICH collection is no longer fixed: full cricket writes `cricketMatches`,
// Box Cricket writes `boxCricketMatches`, chosen by the surrounding
// MatchVariantProvider. That split IS the "box records don't count toward
// cricket stats" requirement — the stats engine only ever sees the matches
// the active variant subscribed to. See context/MatchVariant.jsx.
const DEFAULT_COLLECTION = 'cricketMatches'

/**
 * Deleting doesn't need the collection subscription that useMatches sets up,
 * so it's a plain function — callers that only delete (match detail, live
 * scoring) would otherwise open a second onSnapshot over every match just to
 * reach this, which is real bandwidth on a phone at the ground.
 *
 * `collectionName` defaults to full cricket's, so any caller written before
 * box cricket existed keeps working unchanged; variant-aware pages pass
 * `useMatchVariant().collection`.
 */
export async function deleteMatchById(matchId, collectionName = DEFAULT_COLLECTION) {
  return deleteDoc(doc(db, collectionName, matchId))
}

export function useMatches() {
  const { collection: COLLECTION } = useMatchVariant()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('date', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMatches(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [COLLECTION])

  const createMatch = useCallback(async (matchData) => {
    const ref = await addDoc(collection(db, COLLECTION), {
      ...matchData,
      date: new Date(matchData.date).toISOString(),
      status: 'scheduled',
      innings1: null,
      innings2: null,
      manOfTheMatch: null,
      result: null,
      createdAt: serverTimestamp(),
    })
    return ref.id
  }, [COLLECTION])

  const deleteMatch = useCallback(async (matchId) => deleteMatchById(matchId, COLLECTION), [COLLECTION])

  return { matches, loading, error, createMatch, deleteMatch }
}

export function useMatch(matchId) {
  const { collection: COLLECTION } = useMatchVariant()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(Boolean(matchId))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!matchId) {
      setMatch(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = onSnapshot(
      doc(db, COLLECTION, matchId),
      (snap) => {
        setMatch(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [matchId, COLLECTION])

  const updateMatch = useCallback(
    async (data) => {
      if (!matchId) return
      await updateDoc(doc(db, COLLECTION, matchId), data)
    },
    [matchId, COLLECTION],
  )

  // --- Innings lifecycle ---------------------------------------------------
  const startInnings1 = useCallback(
    async ({ battingTeam, scoringMode, openers, openingBowlerId }) => {
      const innings1 = {
        battingTeam,
        scoringMode,
        balls: [],
        overs: [],
        openers,
        openingBowlerId,
        partnerships: [],
      }
      await updateMatch({ status: 'live', innings1 })
    },
    [updateMatch],
  )

  const startInnings2 = useCallback(async () => {
    const battingTeam = match.innings1.battingTeam === 'A' ? 'B' : 'A'
    const innings2 = {
      battingTeam,
      scoringMode: match.innings1.scoringMode,
      balls: [],
      overs: [],
      openers: null,
      openingBowlerId: null,
      partnerships: [],
    }
    await updateMatch({ innings2 })
  }, [match, updateMatch])

  // --- Full mode: ball-by-ball -----------------------------------------------
  const addBall = useCallback(
    async (inningsKey, ball) => {
      const innings = match[inningsKey]
      const balls = [...(innings.balls || []), ball]
      await updateMatch({ [inningsKey]: { ...innings, balls } })
    },
    [match, updateMatch],
  )

  const undoLastBall = useCallback(
    async (inningsKey) => {
      const innings = match[inningsKey]
      const balls = (innings.balls || []).slice(0, -1)
      await updateMatch({ [inningsKey]: { ...innings, balls } })
    },
    [match, updateMatch],
  )

  // --- Quick mode: over-level -----------------------------------------------
  const addOverSummary = useCallback(
    async (inningsKey, overSummary) => {
      const innings = match[inningsKey]
      const overs = [...(innings.overs || []), overSummary]
      await updateMatch({ [inningsKey]: { ...innings, overs } })
    },
    [match, updateMatch],
  )

  const undoLastOver = useCallback(
    async (inningsKey) => {
      const innings = match[inningsKey]
      const overs = (innings.overs || []).slice(0, -1)
      await updateMatch({ [inningsKey]: { ...innings, overs } })
    },
    [match, updateMatch],
  )

  // Quick mode has no per-ball log to attach a retirement entry to, so it
  // lives in a separate array on the innings — see deriveQuickModeInnings.
  const addRetirement = useCallback(
    async (inningsKey, entry) => {
      const innings = match[inningsKey]
      const retirements = [...(innings.retirements || []), entry]
      await updateMatch({ [inningsKey]: { ...innings, retirements } })
    },
    [match, updateMatch],
  )

  const completeMatch = useCallback(
    async ({ winner, margin, manOfTheMatch }) => {
      await updateMatch({ status: 'completed', result: { winner, margin }, manOfTheMatch })
    },
    [updateMatch],
  )

  return {
    match,
    loading,
    error,
    updateMatch,
    startInnings1,
    startInnings2,
    addBall,
    undoLastBall,
    addOverSummary,
    undoLastOver,
    addRetirement,
    completeMatch,
  }
}
