import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Firebase config is pulled from environment variables (Vite exposes
// anything prefixed with VITE_ via import.meta.env). Copy .env.example
// to .env.local and fill in your Firebase project's web config.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Avoid re-initializing during Vite HMR
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const db = getFirestore(app)
export default app

// Simple helper other modules can use to show a "Firebase connected"
// indicator in Settings without importing the whole config object.
export const firebaseStatus = () => ({
  configured: Boolean(firebaseConfig.apiKey && firebaseConfig.projectId),
  projectId: firebaseConfig.projectId || null,
})
