// PlayersShared.jsx  —  routed at /people ("Link people")
//
// NARROWED: this page is no longer "the Players page". Each sport's real
// roster went back to that sport (/shuttle/players, /cricket/players),
// because everything you actually do to a player — per-player stats, the
// detail modal, add/edit/archive, role filters — is sport-specific, and
// badminton stats and cricket stats have no overlapping fields to merge.
//
// What is left here is the one genuinely cross-sport job: declaring that
// a Shuttle player and a Cricket player are the SAME PERSON. That link is
// what lets the expense rotation treat both sports as one joint pot (see
// expenseEngine.js) instead of asking the same person twice.
//
// Composes THREE existing/new hooks:
//   - Shuttle's usePlayers()  (unchanged, moved as-is)
//   - Cricket's usePlayers()  (unchanged, moved as-is — note both files are
//     literally named usePlayers.js in their original repos; aliased on
//     import below since they now live in one app)
//   - usePlayerLinks()        (new, additive — see that file)
// ...then joins them with the pure mergePeople() function.
//
// Linking is manual by design (per our earlier discussion — a small friend
// group, automatic name-matching isn't worth the false-positive risk).
// This page's linking UI is intentionally plain (native <select> based), not
// a polished modal — the priority right now is a working join, not a
// refined interaction; happy to redesign this pass once the data layer is
// confirmed correct.
//
// TODO: fix these two import paths once Shuttle's and Cricket's hooks/
// folders are physically moved into this app's source tree (see
// ShuttleRoutes.jsx / CricketRoutes.jsx TODOs for the same move).
import React, { useMemo, useState } from 'react'
import { usePlayers as useShuttlePlayers } from '../../shuttle/hooks/usePlayers'
import { usePlayers as useCricketPlayers } from '../../cricket/hooks/usePlayers'
import { usePlayerLinks } from '../hooks/usePlayerLinks'
import { mergePeople } from '../lib/mergePeople'
import { Link } from 'react-router-dom'

const PALETTE = ['#1F6F4A', '#0F7A6B', '#2563EB', '#7C3AED', '#DC2626', '#475569']
function initials(name = '') {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
function avatarColor(id = '') {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

function SportBadge({ label, active }) {
  return (
    <span
      className={[
        'text-[10px] font-medium px-1.5 py-0.5 rounded',
        active
          ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          : 'bg-gray-50 text-gray-300 dark:bg-gray-900 dark:text-gray-700',
      ].join(' ')}
    >
      {label}
    </span>
  )
}

function LinkForm({ unlinkedShuttle, unlinkedCricket, onLink }) {
  const [shuttleId, setShuttleId] = useState('')
  const [cricketId, setCricketId] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || (!shuttleId && !cricketId)) return
    setSaving(true)
    try {
      await onLink({
        name: name.trim(),
        shuttlePlayerId: shuttleId || null,
        cricketPlayerId: cricketId || null,
      })
      setShuttleId('')
      setCricketId('')
      setName('')
    } finally {
      setSaving(false)
    }
  }

  const selectCls =
    'w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm'

  return (
    <form onSubmit={submit} className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-3 mb-6">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Link a person across sports</p>
      <div className="grid gap-2 mb-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Shared display name"
          className={selectCls}
        />
        <select value={shuttleId} onChange={(e) => setShuttleId(e.target.value)} className={selectCls}>
          <option value="">— Shuttle player (optional) —</option>
          {unlinkedShuttle.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select value={cricketId} onChange={(e) => setCricketId(e.target.value)} className={selectCls}>
          <option value="">— Cricket player (optional) —</option>
          {unlinkedCricket.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={saving || !name.trim() || (!shuttleId && !cricketId)}
        className="text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg px-3 py-1.5 disabled:opacity-40"
      >
        {saving ? 'Linking…' : 'Link'}
      </button>
    </form>
  )
}

export default function PlayersShared() {
  const { players: shuttlePlayers, loading: shuttleLoading } = useShuttlePlayers()
  const { players: cricketPlayers, loading: cricketLoading } = useCricketPlayers()
  const { links, loading: linksLoading, createLink } = usePlayerLinks()

  const people = useMemo(
    () => mergePeople(shuttlePlayers, cricketPlayers, links),
    [shuttlePlayers, cricketPlayers, links],
  )

  const unlinkedShuttle = useMemo(
    () => people.filter((p) => p.shuttlePlayerId && !p.cricketPlayerId).map((p) => ({ id: p.shuttlePlayerId, name: p.name })),
    [people],
  )
  const unlinkedCricket = useMemo(
    () => people.filter((p) => p.cricketPlayerId && !p.shuttlePlayerId).map((p) => ({ id: p.cricketPlayerId, name: p.name })),
    [people],
  )

  if (shuttleLoading || cricketLoading || linksLoading) {
    return <div className="p-6 text-sm text-gray-400">Loading players…</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Link people</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Match up someone's badminton and cricket entries so the expense rotation counts them
        once, not twice. {people.filter((p) => p.linked).length} linked · {people.length} total.
      </p>

      {/* This page can't add, edit or archive anyone, and shows no stats —
          that's each sport's own roster, one tap away. */}
      <div className="flex gap-2 mb-5">
        <Link
          to="/shuttle/players"
          className="flex-1 text-center text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          🏸 Badminton players →
        </Link>
        <Link
          to="/cricket/players"
          className="flex-1 text-center text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          🏏 Cricket players →
        </Link>
      </div>

      <LinkForm unlinkedShuttle={unlinkedShuttle} unlinkedCricket={unlinkedCricket} onLink={createLink} />

      <div className="flex flex-col gap-1.5">
        {people.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2"
          >
            <div
              className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ backgroundColor: avatarColor(p.id) }}
            >
              {initials(p.name)}
            </div>
            <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">
              {p.name}
              {!p.isActive && <span className="text-gray-400 dark:text-gray-500 text-xs ml-1.5">(inactive)</span>}
            </span>
            <SportBadge label="🏸" active={Boolean(p.shuttlePlayerId)} />
            <SportBadge label="🏏" active={Boolean(p.cricketPlayerId)} />
          </div>
        ))}
      </div>
    </div>
  )
}
