// seedFirestore.js
//
// Optional one-off script to pre-populate Firestore with your regular
// cricket group so you're not adding everyone by hand in the UI.
//
// Usage:
//   1. cp .env.example .env.local and fill in your Firebase web config
//   2. npm run seed

import 'dotenv/config'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Missing Firebase config. Copy .env.example to .env.local and fill in your project values before seeding.')
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// Reuse the same regular group from Shuttle Manager as a starting point —
// edit this list to match who's actually turning up for cricket.
const PLAYER_NAMES = ['Ismail', 'Imran', 'Madhav', 'Aravind', 'Gokul Kanish', 'Perumal', 'Sinan', 'Sharafu']

// Own collection (not Shuttle Manager's `players`) — see usePlayers.js.
const COLLECTION = 'cricketPlayers'

async function seed() {
  const existing = await getDocs(collection(db, COLLECTION))
  if (!existing.empty) {
    console.log(`${COLLECTION} collection already has ${existing.size} doc(s) - skipping to avoid duplicates.`)
    return
  }

  for (const name of PLAYER_NAMES) {
    const ref = await addDoc(collection(db, COLLECTION), {
      name,
      isActive: true,
      preferredRole: null,
      createdAt: serverTimestamp(),
    })
    console.log(`Added ${name} (${ref.id})`)
  }
  console.log('\nSeed complete.')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
