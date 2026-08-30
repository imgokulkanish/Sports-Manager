import { useEffect, useState, useCallback } from 'react'
import { db } from '../firebase'
import { collection, doc, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

// Own collection (not Shuttle Manager's `players`) so the two apps' rosters
// and schemas don't collide inside the shared kanishpersonalos project.
const COLLECTION = 'cricketPlayers'

export function usePlayers() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPlayers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [])

  const addPlayer = useCallback(async (data) => {
    const ref = await addDoc(collection(db, COLLECTION), {
      name: data.name,
      isActive: true,
      preferredRole: data.preferredRole || null,
      createdAt: serverTimestamp(),
    })
    return { id: ref.id }
  }, [])

  const updatePlayer = useCallback(async (id, data) => updateDoc(doc(db, COLLECTION, id), data), [])
  const toggleActive = useCallback(async (id, isActive) => updateDoc(doc(db, COLLECTION, id), { isActive }), [])
  const deletePlayer = useCallback(async (id) => deleteDoc(doc(db, COLLECTION, id)), [])

  return { players, loading, error, addPlayer, updatePlayer, toggleActive, deletePlayer }
}
