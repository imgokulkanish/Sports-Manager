// seedFirestore.js
//
// One-off script to pre-populate Firestore with the regular badminton
// group so you don't have to add everyone by hand in the UI.
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
  console.error(
    'Missing Firebase config. Copy .env.example to .env.local (or .env) and fill in your project values before seeding.',
  )
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const PLAYER_NAMES = ['Ismail', 'Imran', 'Madhav', 'Aravind', 'Gokul', 'Perumal', 'Santhosh']

async function seed() {
  const existing = await getDocs(collection(db, 'players'))
  if (!existing.empty) {
    console.log(`players collection already has ${existing.size} doc(s) - skipping seed to avoid duplicates.`)
    console.log('Delete the collection first if you want to reseed from scratch.')
    return
  }

  const idsByName = {}
  for (const name of PLAYER_NAMES) {
    const ref = await addDoc(collection(db, 'players'), {
      name,
      isActive: true,
      constraints: {
        forbiddenPartners: [],
        forbiddenOpponents: [],
        earlyMatchRequired: false,
        doubleWith: [],
      },
      createdAt: serverTimestamp(),
    })
    idsByName[name] = ref.id
    console.log(`Added ${name} (${ref.id})`)
  }

  // Gokul.forbiddenOpponents = ["Santhosh"], applied as a follow-up update
  // since we need Santhosh's generated id first.
  const { updateDoc, doc } = await import('firebase/firestore')
  await updateDoc(doc(db, 'players', idsByName['Gokul']), {
    'constraints.forbiddenOpponents': [idsByName['Santhosh']],
  })
  console.log('Applied constraint: Gokul.forbiddenOpponents = [Santhosh]')

  console.log('\nSeed complete.')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
