// usePlayerLinks.js
//
// CRUD for the new `playerLinks` collection — the additive identity layer
// we agreed on. Deliberately mirrors the shape of Shuttle's and Cricket's
// existing usePlayers.js hooks (same onSnapshot/addDoc/updateDoc/deleteDoc
// pattern) so it reads like something that belongs next to them, not a
// foreign pattern.
//
// Document shape in the `playerLinks` collection:
//   id                  auto
//   name                string  — the shared display name
//   shuttlePlayerId     string | null  — FK into players/{id}
//   cricketPlayerId     string | null  — FK into cricketPlayers/{id}
//   joinedAt            serverTimestamp
//
// This hook ONLY touches `playerLinks`. It never reads or writes `players`
// or `cricketPlayers` — composing those in is the job of `mergePeople.js`,
// kept separate so this hook stays as small and boring as the two it's
// modeled on.
import { useEffect, useState, useCallback } from 'react'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '../../firebase' // src/firebase.js — one shared config for the whole app

const COLLECTION = 'playerLinks'

export function usePlayerLinks() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('joinedAt', 'asc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLinks(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsub
  }, [])

  /** Link an existing Shuttle player and/or Cricket player as one person. */
  const createLink = useCallback(async ({ name, shuttlePlayerId = null, cricketPlayerId = null }) => {
    return addDoc(collection(db, COLLECTION), {
      name,
      shuttlePlayerId,
      cricketPlayerId,
      joinedAt: serverTimestamp(),
    })
  }, [])

  /** Attach a not-yet-linked sport-specific player to an existing link. */
  const attachSportPlayer = useCallback(async (linkId, sport, playerId) => {
    const field = sport === 'shuttle' ? 'shuttlePlayerId' : 'cricketPlayerId'
    return updateDoc(doc(db, COLLECTION, linkId), { [field]: playerId })
  }, [])

  const renameLink = useCallback(async (linkId, name) => {
    return updateDoc(doc(db, COLLECTION, linkId), { name })
  }, [])

  /** Removes the LINK only — never touches players/{id} or cricketPlayers/{id}. */
  const deleteLink = useCallback(async (linkId) => {
    return deleteDoc(doc(db, COLLECTION, linkId))
  }, [])

  return { links, loading, error, createLink, attachSportPlayer, renameLink, deleteLink }
}
