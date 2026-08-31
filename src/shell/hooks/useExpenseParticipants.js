// useExpenseParticipants.js
//
// Who is actually IN the expense rotation. Additive, same pattern as
// usePlayerLinks: a small collection of its own that neither sport's roster
// knows about.
//
// THE PROBLEM THIS SOLVES. The rotation pool was "everyone active in either
// sport" — the only lever was archiving someone in their sport roster, which
// is the wrong tool: a cricket regular who simply never chips in is still an
// active cricket player, and archiving them would pull them out of team
// selection, matchups and stats to fix a spreadsheet. So the pool needed its
// own opt-out, independent of `isActive`.
//
// WHY THE DOC ID IS THE SPORT-SPECIFIC PLAYER ID, NOT THE MERGED PERSON ID.
// A merged person id is a linkId when they're linked and a synthesized
// `shuttle:<rawId>` / `cricket:<rawId>` composite when they aren't (see
// mergePeople.js), so it CHANGES the moment someone is linked or unlinked.
// Keying opt-outs by it would silently re-add someone to the rotation the
// first time you linked their two identities — the exact kind of quiet
// money-affecting change this app already gates behind a PIN. The raw
// players/{id} and cricketPlayers/{id} ids never change, so they're the
// stable anchor. Same reasoning as `paidBy` staying sport-specific in
// EXPENSES_DESIGN.md: identity joins happen at read time, not by rewriting
// keys.
//
// Document shape in `expenseOptOuts`:
//   id        `${sport}:${playerId}`  — e.g. 'cricket:8Kd2...'
//   sport     'shuttle' | 'cricket'
//   playerId  the raw players/{id} or cricketPlayers/{id} value
//   updatedAt serverTimestamp
//
// A document's PRESENCE means "not in the rotation". Opting someone back in
// deletes the doc rather than flipping a flag to false, so the collection
// only ever holds the exceptions and there's no third "unset" state to
// reason about.
import { useEffect, useState, useCallback, useMemo } from 'react'
import { collection, onSnapshot, setDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'

const COLLECTION = 'expenseOptOuts'

/** The opt-out keys a merged person covers — one per sport identity they have. */
export function keysForPerson(person) {
  const keys = []
  if (person?.shuttlePlayerId) keys.push(`shuttle:${person.shuttlePlayerId}`)
  if (person?.cricketPlayerId) keys.push(`cricket:${person.cricketPlayerId}`)
  return keys
}

export function useExpenseParticipants() {
  const [optOutKeys, setOptOutKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // No orderBy: this collection is a set of ids, and the docs carry no
    // field worth sorting on.
    const unsub = onSnapshot(
      collection(db, COLLECTION),
      (snap) => {
        setOptOutKeys(snap.docs.map((d) => d.id))
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsub
  }, [])

  const excluded = useMemo(() => new Set(optOutKeys), [optOutKeys])

  /**
   * Out of the rotation if ANY of their sport identities is opted out.
   * "Any" rather than "every" is deliberate: linking two identities where
   * one was already excluded should keep the person out and let you opt them
   * back in explicitly, rather than quietly resurrecting them because the
   * other half was never excluded.
   */
  const isInRotation = useCallback(
    (person) => !keysForPerson(person).some((k) => excluded.has(k)),
    [excluded],
  )

  /** Writes BOTH sides for a linked person, so the state survives unlinking. */
  const setPersonInRotation = useCallback(async (person, inRotation) => {
    const keys = keysForPerson(person)
    await Promise.all(
      keys.map((key) => {
        const ref = doc(db, COLLECTION, key)
        if (inRotation) return deleteDoc(ref)
        const [sport, playerId] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
        return setDoc(ref, { sport, playerId, updatedAt: serverTimestamp() })
      }),
    )
  }, [])

  return { excluded, loading, error, isInRotation, setPersonInRotation }
}
