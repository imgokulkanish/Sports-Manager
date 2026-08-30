// hooks/usePlayers.js
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
import { db, firebaseStatus } from '../firebase'
import { localSubscribe, localAdd, localUpdate, localDelete } from '../localStore'

const COLLECTION = 'players'
const USE_LOCAL = !firebaseStatus().configured

export function usePlayers() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (USE_LOCAL) {
      return localSubscribe(COLLECTION, (items) => {
        setPlayers([...items].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)))
        setLoading(false)
      })
    }
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsub
  }, [])

  const addPlayer = useCallback(async (data) => {
    const payload = {
      name: data.name,
      isActive: true,
      constraints: {
        forbiddenPartners: data.forbiddenPartners || [],
        forbiddenOpponents: data.forbiddenOpponents || [],
        earlyMatchRequired: Boolean(data.earlyMatchRequired),
        doubleWith: data.doubleWith || [],
      },
    }
    if (USE_LOCAL) return localAdd(COLLECTION, { ...payload, createdAt: Date.now() })
    return addDoc(collection(db, COLLECTION), { ...payload, createdAt: serverTimestamp() })
  }, [])

  const updatePlayer = useCallback(async (id, data) => {
    if (USE_LOCAL) return localUpdate(COLLECTION, id, data)
    return updateDoc(doc(db, COLLECTION, id), data)
  }, [])

  const toggleActive = useCallback(async (id, isActive) => {
    if (USE_LOCAL) return localUpdate(COLLECTION, id, { isActive })
    return updateDoc(doc(db, COLLECTION, id), { isActive })
  }, [])

  const deletePlayer = useCallback(async (id) => {
    if (USE_LOCAL) return localDelete(COLLECTION, id)
    return deleteDoc(doc(db, COLLECTION, id))
  }, [])

  return { players, loading, error, addPlayer, updatePlayer, toggleActive, deletePlayer }
}
