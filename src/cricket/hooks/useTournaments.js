// hooks/useTournaments.js
//
// A tournament is just an *envelope*: a name, a date, and the squad that
// turned up for the day. The matches themselves live in the ordinary
// `cricketMatches` collection (tagged with `isTournament`/`tournamentId`), so
// every tournament performance flows into computePlayerStats and the app-wide
// leaderboards with no extra plumbing. Nothing here duplicates match data.
import { useEffect, useState, useCallback } from 'react'
import { db } from '../firebase'
import { collection, doc, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

// Same isolation reasoning as cricketMatches/cricketPlayers — own collection
// inside the shared kanishpersonalos project.
const COLLECTION = 'cricketTournaments'

export function useTournaments() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('date', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setTournaments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [])

  /** @param {{ name: string, date: string, squadPlayerIds: string[] }} data */
  const createTournament = useCallback(async (data) => {
    const ref = await addDoc(collection(db, COLLECTION), {
      name: data.name,
      date: new Date(data.date).toISOString(),
      squadPlayerIds: data.squadPlayerIds || [],
      status: 'active',
      createdAt: serverTimestamp(),
    })
    return ref.id
  }, [])

  const deleteTournament = useCallback(async (id) => deleteDoc(doc(db, COLLECTION, id)), [])

  return { tournaments, loading, error, createTournament, deleteTournament }
}

export function useTournament(tournamentId) {
  const [tournament, setTournament] = useState(null)
  const [loading, setLoading] = useState(Boolean(tournamentId))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!tournamentId) {
      setTournament(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = onSnapshot(
      doc(db, COLLECTION, tournamentId),
      (snap) => {
        setTournament(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [tournamentId])

  const updateTournament = useCallback(
    async (data) => {
      if (!tournamentId) return
      await updateDoc(doc(db, COLLECTION, tournamentId), data)
    },
    [tournamentId],
  )

  const setStatus = useCallback((status) => updateTournament({ status }), [updateTournament])

  return { tournament, loading, error, updateTournament, setStatus }
}

/** All matches belonging to one tournament, newest last (playing order). */
export function tournamentMatches(matches, tournamentId) {
  if (!tournamentId) return []
  return matches
    .filter((m) => m.isTournament && m.tournamentId === tournamentId)
    .sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.id).localeCompare(String(b.id)))
}
