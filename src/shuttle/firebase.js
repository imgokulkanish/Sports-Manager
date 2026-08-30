// Shim — the real config now lives at src/firebase.js (one shared Firebase
// project for the whole merged app). Kept as a re-export so every existing
// `from '../firebase'` import inside this folder's hooks/components
// continues to work unmodified.
export * from '../firebase'
export { default } from '../firebase'
