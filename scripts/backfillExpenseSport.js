// backfillExpenseSport.js
//
// ONE-TIME, ADDITIVE migration: sets `sport: 'shuttle'` on every existing
// `expenses/{id}` doc that doesn't already have a `sport` field. Every
// existing expense was logged by Shuttle Manager (Cricket has none today),
// so this is unambiguous — no guessing which sport an old entry belongs to.
//
// SAFE BY CONSTRUCTION:
//   - Never touches any other field.
//   - Skips docs that already have `sport` set, so it's safe to re-run.
//   - Fully reversible: to undo, delete the `sport` field from affected
//     docs (or just don't read/rely on it — nothing else changes shape).
//
// Run once, the same way seedFirestore.js is run:
//   node backfillExpenseSport.js
//
// Mirrors seedFirestore.js's existing guard pattern (check before write,
// log what happened, exit) rather than introducing a new migration
// framework/dependency.
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import 'dotenv/config'

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

async function main() {
  const app = initializeApp(firebaseConfig)
  const db = getFirestore(app)

  const snap = await getDocs(collection(db, 'expenses'))
  let updated = 0
  let skipped = 0

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    if (data.sport) {
      skipped += 1
      continue
    }
    await updateDoc(doc(db, 'expenses', docSnap.id), { sport: 'shuttle' })
    updated += 1
  }

  console.log(`Backfill complete: ${updated} docs updated, ${skipped} already had 'sport' set.`)
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
