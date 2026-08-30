// hooks/useExpenses.js
//
// Who fronted the money each week. The four recurring costs the group actually
// has: the court booking, shuttles, the meal afterwards, and the pre-match
// snack run. This is deliberately not a general-purpose expense tracker - see
// EXPENSE_CATEGORIES.
//
// Document shape in the `expenses` collection:
//   id         auto
//   date       ISO string - when the money was spent
//   category   'court' | 'shuttles' | 'breakfast' | 'tea'
//              The stored values are historical: 'breakfast' is any post-match
//              meal and 'tea' is any pre-match snack. Only the labels below
//              were widened - renaming the values would orphan logged entries.
//   paidBy     playerId
//   amount     number | null   - optional; some weeks only WHO paid matters
//   sessionId  string | null   - optional link to a session on the same day
//   notes      string | null
//   createdAt  serverTimestamp (Date.now() under the localStore fallback)
//
// Note: the `expenses` collection needs its own match block in
// firestore.rules. The rules there are scoped per collection because the
// Firebase project is shared with two other apps, so a new collection is
// denied by default until it's listed.
import { useEffect, useState, useCallback } from 'react'
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { db, firebaseStatus } from '../firebase'
import { localSubscribe, localAdd, localDelete } from '../localStore'

const COLLECTION = 'expenses'
const USE_LOCAL = !firebaseStatus().configured

/**
 * Fixed on purpose: these are the real recurring costs, not a free-text field.
 * They all feed one shared pot for the fairness calculation - see
 * expenseEngine.js for why there is no per-category rotation.
 */
export const EXPENSE_CATEGORIES = [
  { value: 'court', label: 'Court booking', short: 'Court' },
  { value: 'shuttles', label: 'Shuttlecocks', short: 'Shuttles' },
  // Values are frozen for stored data; labels say what these actually cover.
  { value: 'breakfast', label: 'Food after - breakfast, lunch or dinner', short: 'Food' },
  { value: 'tea', label: 'Pre-match snacks - tea, sandwich, juice', short: 'Snacks' },
]

export function categoryLabel(value) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value
}

/** Compact label for tight rows, where the full name would wrap. */
export function categoryShort(value) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.short || value
}

export function useExpenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (USE_LOCAL) {
      return localSubscribe(COLLECTION, (items) => {
        setExpenses([...items].sort((a, b) => new Date(b.date) - new Date(a.date)))
        setLoading(false)
      })
    }
    const q = query(collection(db, COLLECTION), orderBy('date', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setExpenses(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              ...data,
              // Sessions store dates the same way - normalize a Firestore
              // Timestamp back to an ISO string so callers only see one shape.
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

  const addExpense = useCallback(async (data) => {
    const payload = {
      date: new Date(data.date).toISOString(),
      category: data.category,
      paidBy: data.paidBy,
      // An empty amount box means "we didn't track it", not zero - null keeps
      // that distinction so totals don't quietly count it as a free week.
      amount: data.amount === '' || data.amount == null ? null : Number(data.amount),
      sessionId: data.sessionId || null,
      notes: data.notes?.trim() || null,
    }
    if (USE_LOCAL) return localAdd(COLLECTION, { ...payload, createdAt: Date.now() })
    const ref = await addDoc(collection(db, COLLECTION), { ...payload, createdAt: serverTimestamp() })
    return ref.id
  }, [])

  const deleteExpense = useCallback(async (id) => {
    if (USE_LOCAL) return localDelete(COLLECTION, id)
    return deleteDoc(doc(db, COLLECTION, id))
  }, [])

  return { expenses, loading, error, addExpense, deleteExpense }
}
