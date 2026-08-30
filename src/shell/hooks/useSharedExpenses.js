// useSharedExpenses.js
//
// Evolves Shuttle Manager's useExpenses.js (same collection, same document
// shape) with one addition: every new entry gets a `sport` field. Existing
// fields/behavior — amount can be null on purpose, notes trimmed, category
// values frozen — are unchanged.
//
// TWO DELIBERATE DIFFERENCES FROM THE ORIGINAL, both flagged rather than
// silent:
//   1. `EXPENSE_CATEGORIES`/`categoryLabel`/`categoryShort` now come from
//      expenseCategories.js (Shuttle's four + Cricket's four) instead of
//      being defined inline here.
//   2. The original's `USE_LOCAL`/localStorage fallback (for running
//      without a configured Firebase project) is DROPPED. That fallback
//      existed for early local dev before .env.local was set up; the
//      merged shell always talks to the one shared, already-configured
//      Firebase project, so the branch would be dead code here. Easy to
//      reinstate (copy the pattern from Shuttle's original file) if
//      running the shell without Firebase configured ever matters to you.
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
import { db } from '../../firebase'

const COLLECTION = 'expenses'

export function useSharedExpenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
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
              date: data.date?.toDate ? data.date.toDate().toISOString() : data.date,
              // Pre-backfill docs (created before this migration ran) won't
              // have `sport` yet. Every existing entry today is Shuttle's,
              // per backfillExpenseSport.js's own reasoning — default here
              // too so the UI never has to handle an undefined sport for
              // an entry that predates this field.
              sport: data.sport || 'shuttle',
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
      sport: data.sport, // required — caller must say which sport this entry is for
      category: data.category,
      paidBy: data.paidBy, // sport-specific playerId — see EXPENSES_DESIGN.md
      matchId: data.sport === 'cricket' ? data.activityId || null : null,
      sessionId: data.sport === 'shuttle' ? data.activityId || null : null,
      amount: data.amount === '' || data.amount == null ? null : Number(data.amount),
      notes: data.notes?.trim() || null,
    }
    const ref = await addDoc(collection(db, COLLECTION), { ...payload, createdAt: serverTimestamp() })
    return ref.id
  }, [])

  const deleteExpense = useCallback(async (id) => {
    return deleteDoc(doc(db, COLLECTION, id))
  }, [])

  return { expenses, loading, error, addExpense, deleteExpense }
}
