// hooks/localStore.js
//
// A tiny reactive "collection" store backed by localStorage, standing in for
// Firestore during development (see useMatch.js / usePlayers.js). Same shape
// as a Firestore collection: a map of id -> document. Swap these two hook
// files back to the Firestore versions once a real project is wired up —
// nothing outside hooks/ talks to this module directly.

const PREFIX = 'cricket-manager:db:'
const listeners = new Map() // collectionName -> Set<() => void>

function storageKey(collectionName) {
  return `${PREFIX}${collectionName}`
}

function notify(collectionName) {
  listeners.get(collectionName)?.forEach((cb) => cb())
}

export function subscribe(collectionName, callback) {
  if (!listeners.has(collectionName)) listeners.set(collectionName, new Set())
  listeners.get(collectionName).add(callback)
  return () => listeners.get(collectionName)?.delete(callback)
}

export function getAll(collectionName) {
  try {
    const raw = localStorage.getItem(storageKey(collectionName))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeAll(collectionName, all) {
  try {
    localStorage.setItem(storageKey(collectionName), JSON.stringify(all))
  } catch {
    /* best-effort only, e.g. storage quota exceeded */
  }
  notify(collectionName)
}

export function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function setDoc(collectionName, id, data) {
  const all = getAll(collectionName)
  all[id] = data
  writeAll(collectionName, all)
}

export function updateDocFields(collectionName, id, patch) {
  const all = getAll(collectionName)
  all[id] = { ...(all[id] || {}), ...patch }
  writeAll(collectionName, all)
}

export function deleteDocById(collectionName, id) {
  const all = getAll(collectionName)
  delete all[id]
  writeAll(collectionName, all)
}

// Cross-tab sync: the native `storage` event fires in OTHER tabs when one tab
// writes to localStorage. Same-tab updates are handled by notify() above.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return
    notify(e.key.slice(PREFIX.length))
  })
}
