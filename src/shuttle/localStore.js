// localStore.js
//
// Minimal localStorage-backed stand-in for the Firestore collections used by
// usePlayers/useSession. Firebase isn't wired up yet (no .env.local), so the
// hooks fall back to this so the app is fully usable for local testing.
// Mirrors just the shape those hooks need: subscribe (like onSnapshot), add,
// update, delete, get-once.

const PREFIX = 'shuttle-manager:localdb:'
const listeners = new Map() // collection name -> Set<callback>

function read(name) {
  try {
    const raw = localStorage.getItem(PREFIX + name)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function write(name, items) {
  localStorage.setItem(PREFIX + name, JSON.stringify(items))
  listeners.get(name)?.forEach((cb) => cb(items))
}

function genId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function localSubscribe(name, callback) {
  if (!listeners.has(name)) listeners.set(name, new Set())
  listeners.get(name).add(callback)
  callback(read(name))
  return () => listeners.get(name)?.delete(callback)
}

export function localAdd(name, data) {
  const items = read(name)
  const id = genId()
  items.push({ id, ...data })
  write(name, items)
  return id
}

export function localUpdate(name, id, data) {
  const items = read(name)
  const idx = items.findIndex((i) => i.id === id)
  if (idx === -1) return
  items[idx] = { ...items[idx], ...data }
  write(name, items)
}

export function localDelete(name, id) {
  write(name, read(name).filter((i) => i.id !== id))
}

export function localGetOnce(name, id) {
  return read(name).find((i) => i.id === id) || null
}
