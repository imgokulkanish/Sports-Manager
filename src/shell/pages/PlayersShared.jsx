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
// Composes THREE hooks — Shuttle's usePlayers(), Cricket's usePlayers()
// (both literally named usePlayers.js in their original repos, so aliased
// on import) and usePlayerLinks() — then joins them with the pure
// mergePeople() function.
//
// Linking is manual by design: a small friend group, where automatic
// name-matching isn't worth the false-positive risk.
//
// SHOWING LINKED STATE (this pass). The list previously rendered two
// 🏸/🏏 chips per row that were simply dimmer when absent — which read as
// decoration, not status, and left the actual question ("is this person
// linked, and to whom?") unanswered. Three changes fix that:
//   1. The list is SPLIT into "Linked across both sports" and "Not linked
//      yet", so linked state is structural rather than something you have
//      to spot in a chip.
//   2. A linked row spells out both sides — "🏸 Gokul · 🏏 GK" — because
//      the whole point of a link is that the two rosters spell the name
//      differently. If both sides match the display name exactly there's
//      nothing to disambiguate, so it's omitted.
//   3. An unlinked row says which sport it came from and, where there IS a
//      counterpart to pick, offers "Link" inline rather than making you
//      scroll back to the form.
import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayers as useShuttlePlayers } from '../../shuttle/hooks/usePlayers'
import { usePlayers as useCricketPlayers } from '../../cricket/hooks/usePlayers'
import { usePlayerLinks } from '../hooks/usePlayerLinks'
import { mergePeople } from '../lib/mergePeople'
import Avatar from '../components/Avatar'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { useAdmin } from '../components/Admin'

const CARD = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg'
const SELECT =
  'w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm'

/** Both sides of a link, written out — the bit that makes a link legible. */
function LinkedNames({ person }) {
  const shuttleName = person.shuttleProfile?.name
  const cricketName = person.cricketProfile?.name
  // Nothing to disambiguate if both rosters already agree with the display
  // name — showing "🏸 Imran · 🏏 Imran" under a row titled "Imran" is noise.
  if (shuttleName === person.name && cricketName === person.name) return null
  return (
    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
      {shuttleName && <>🏸 {shuttleName}</>}
      {shuttleName && cricketName && ' · '}
      {cricketName && <>🏏 {cricketName}</>}
    </p>
  )
}

function LinkedRow({ person, canUnlink, onUnlink }) {
  return (
    <div className={`${CARD} flex items-center gap-3 px-3 py-2`}>
      <Avatar id={person.id} name={person.name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
          {person.name}
          {!person.isActive && <span className="text-gray-400 dark:text-gray-500 text-xs ml-1.5">(inactive)</span>}
        </p>
        <LinkedNames person={person} />
      </div>
      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-light dark:bg-brand/20 text-green-700 dark:text-emerald-300 border border-brand-border dark:border-brand/30">
        🏸🏏 Linked
      </span>
      {canUnlink && (
        <button
          onClick={() => onUnlink(person)}
          className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 underline transition-colors"
        >
          Unlink
        </button>
      )}
    </div>
  )
}

function UnlinkedRow({ person, counterparts, onQuickLink, busy }) {
  const [open, setOpen] = useState(false)
  const [otherId, setOtherId] = useState('')
  const sport = person.shuttlePlayerId ? 'shuttle' : 'cricket'
  const missing = sport === 'shuttle' ? 'cricket' : 'shuttle'

  const submit = async () => {
    if (!otherId) return
    await onQuickLink(person, missing, otherId)
    setOpen(false)
    setOtherId('')
  }

  return (
    <div className={`${CARD} px-3 py-2`}>
      <div className="flex items-center gap-3">
        <Avatar id={person.id} name={person.name} size="md" className="opacity-70" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
            {person.name}
            {!person.isActive && <span className="text-gray-400 dark:text-gray-500 text-xs ml-1.5">(inactive)</span>}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {sport === 'shuttle' ? '🏸 Badminton only' : '🏏 Cricket only'}
          </p>
        </div>
        {counterparts.length > 0 ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 text-[11px] font-medium text-brand dark:text-emerald-400 border border-brand-border dark:border-brand/30 rounded-full px-2.5 py-1 hover:bg-brand-light dark:hover:bg-brand/15 transition-colors"
          >
            {open ? 'Cancel' : 'Link'}
          </button>
        ) : (
          // No unlinked player on the other side to pair with — saying so is
          // more useful than a button that opens an empty dropdown.
          <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
            No {missing === 'cricket' ? 'cricket' : 'badminton'} match
          </span>
        )}
      </div>

      {open && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <select value={otherId} onChange={(e) => setOtherId(e.target.value)} className={`${SELECT} flex-1`}>
            <option value="">
              {missing === 'cricket' ? '— Same person in cricket —' : '— Same person in badminton —'}
            </option>
            {counterparts.map((c) => (
              <option key={c.rawId} value={c.rawId}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={submit}
            disabled={!otherId || busy}
            className="shrink-0 text-sm font-medium text-white bg-brand rounded-lg px-4 disabled:opacity-40"
          >
            {busy ? 'Linking…' : 'Link'}
          </button>
        </div>
      )}
    </div>
  )
}

function LinkForm({ unlinkedShuttle, unlinkedCricket, onLink }) {
  const [shuttleId, setShuttleId] = useState('')
  const [cricketId, setCricketId] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !shuttleId || !cricketId) return
    setSaving(true)
    try {
      await onLink({ name: name.trim(), shuttlePlayerId: shuttleId, cricketPlayerId: cricketId })
      setShuttleId('')
      setCricketId('')
      setName('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-3 mb-6">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Link a person across sports</p>
      {/* BOTH sides are required now. The form previously accepted one side
          alone, which created a link doc that merged nothing — an extra
          record that looked linked in Firestore and rendered as an ordinary
          unlinked person here. A one-sport player already appears in this
          list on their own; there is nothing to declare until there are two
          identities to join. */}
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
        Pick the same person on both sides. The shared name is what shows on Expenses.
      </p>
      <div className="grid gap-2 mb-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Shared display name"
          className={SELECT}
        />
        <select value={shuttleId} onChange={(e) => setShuttleId(e.target.value)} className={SELECT}>
          <option value="">— Badminton player —</option>
          {unlinkedShuttle.map((p) => (
            <option key={p.rawId} value={p.rawId}>{p.name}</option>
          ))}
        </select>
        <select value={cricketId} onChange={(e) => setCricketId(e.target.value)} className={SELECT}>
          <option value="">— Cricket player —</option>
          {unlinkedCricket.map((p) => (
            <option key={p.rawId} value={p.rawId}>{p.name}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={saving || !name.trim() || !shuttleId || !cricketId}
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
  const { links, loading: linksLoading, createLink, attachSportPlayer, renameLink, deleteLink } = usePlayerLinks()
  const { showToast } = useToast()
  // Unlinking splits one person back into two, which silently doubles their
  // slot in the expense rotation — same class of accident as the deletes the
  // PIN already covers. See shell/components/Admin.jsx.
  const { isAdmin } = useAdmin()

  const [pendingUnlink, setPendingUnlink] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const people = useMemo(
    () => mergePeople(shuttlePlayers, cricketPlayers, links),
    [shuttlePlayers, cricketPlayers, links],
  )

  const byName = (a, b) => a.name.localeCompare(b.name)
  const linked = useMemo(() => people.filter((p) => p.linked).sort(byName), [people])
  const unlinked = useMemo(() => people.filter((p) => !p.linked).sort(byName), [people])

  // Candidates for the dropdowns: sport-specific players not yet claimed by
  // any link. `rawId` is the players/{id} value the link doc stores — NOT the
  // merged person id, which is a composite for unlinked people.
  const unlinkedShuttle = useMemo(
    () => unlinked.filter((p) => p.shuttlePlayerId).map((p) => ({ rawId: p.shuttlePlayerId, name: p.name })),
    [unlinked],
  )
  const unlinkedCricket = useMemo(
    () => unlinked.filter((p) => p.cricketPlayerId).map((p) => ({ rawId: p.cricketPlayerId, name: p.name })),
    [unlinked],
  )

  // Joins two raw player ids into ONE link doc, reusing whatever is already
  // there instead of always adding a row.
  //
  // Why this isn't just createLink: the old form accepted a single side, so
  // half-finished link docs (a name + one id, merging nothing) may already
  // exist in Firestore. A person in that state still shows up in the
  // dropdowns below, and blindly creating a second doc for the same raw id
  // would leave TWO docs claiming it — mergePeople maps every link doc, so
  // that person would render twice here AND take two slots in the expense
  // rotation, which is exactly the double-counting this page exists to
  // prevent. The form now requires both sides so no new partials appear;
  // this handles the ones that may already be there.
  const reconcileLink = async ({ name, shuttlePlayerId, cricketPlayerId }) => {
    const owningShuttle = links.find((l) => l.shuttlePlayerId === shuttlePlayerId)
    const owningCricket = links.find((l) => l.cricketPlayerId === cricketPlayerId)

    // Neither side is spoken for — the ordinary case.
    if (!owningShuttle && !owningCricket) {
      return createLink({ name, shuttlePlayerId, cricketPlayerId })
    }

    // A partial doc on each side: fold the cricket one into the shuttle one
    // and drop the empty shell, rather than leaving a doc behind that claims
    // an id now held by another.
    if (owningShuttle && owningCricket && owningShuttle.id !== owningCricket.id) {
      await attachSportPlayer(owningShuttle.id, 'cricket', cricketPlayerId)
      if (owningShuttle.name !== name) await renameLink(owningShuttle.id, name)
      return deleteLink(owningCricket.id)
    }

    // One partial doc: fill in the missing side in place.
    const keep = owningShuttle || owningCricket
    if (!keep.shuttlePlayerId) await attachSportPlayer(keep.id, 'shuttle', shuttlePlayerId)
    if (!keep.cricketPlayerId) await attachSportPlayer(keep.id, 'cricket', cricketPlayerId)
    if (keep.name !== name) await renameLink(keep.id, name)
  }

  const handleCreate = async (payload) => {
    try {
      await reconcileLink(payload)
      showToast(`${payload.name} linked across both sports`)
    } catch (err) {
      console.error('Failed to create link:', err)
      showToast('Could not save that link', 'error')
      throw err
    }
  }

  // Inline "Link" on an unlinked row: same createLink call, with the row's own
  // name as the shared display name (editable afterwards is a follow-up — the
  // common case is the two rosters spelling one person slightly differently,
  // and either spelling is a reasonable default).
  const handleQuickLink = async (person, missingSport, otherRawId) => {
    setBusyId(person.id)
    try {
      await handleCreate({
        name: person.name,
        shuttlePlayerId: missingSport === 'shuttle' ? otherRawId : person.shuttlePlayerId,
        cricketPlayerId: missingSport === 'cricket' ? otherRawId : person.cricketPlayerId,
      })
    } catch {
      // handleCreate already toasted
    } finally {
      setBusyId(null)
    }
  }

  const confirmUnlink = async () => {
    const target = pendingUnlink
    setPendingUnlink(null)
    try {
      await deleteLink(target.id)
      showToast(`${target.name} unlinked`)
    } catch (err) {
      console.error('Failed to unlink:', err)
      showToast('Could not unlink that person', 'error')
    }
  }

  if (shuttleLoading || cricketLoading || linksLoading) {
    return <div className="p-6 text-sm text-gray-400">Loading players…</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Link people</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Match up someone's badminton and cricket entries so the expense rotation counts them once, not twice.
      </p>

      {/* Counts as a summary strip rather than a sentence — this is the
          answer to "how much of this is done?", and it was previously buried
          mid-paragraph. */}
      <div className={`${CARD} flex divide-x divide-gray-100 dark:divide-gray-800 mb-5`}>
        <div className="flex-1 px-3 py-2.5 text-center">
          <p className="text-lg font-semibold text-brand dark:text-emerald-400 tabular-nums">{linked.length}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Linked</p>
        </div>
        <div className="flex-1 px-3 py-2.5 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{unlinked.length}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">One sport only</p>
        </div>
        <div className="flex-1 px-3 py-2.5 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{people.length}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">People</p>
        </div>
      </div>

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

      <LinkForm unlinkedShuttle={unlinkedShuttle} unlinkedCricket={unlinkedCricket} onLink={handleCreate} />

      {linked.length > 0 && (
        <>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Linked across both sports</p>
            {!isAdmin && (
              <Link
                to="/settings"
                className="text-[11px] text-gray-400 dark:text-gray-500 underline hover:text-gray-600 dark:hover:text-gray-300"
              >
                Turn on admin mode to unlink
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-1.5 mb-6">
            {linked.map((p) => (
              <LinkedRow key={p.id} person={p} canUnlink={isAdmin} onUnlink={setPendingUnlink} />
            ))}
          </div>
        </>
      )}

      {unlinked.length > 0 && (
        <>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Not linked yet</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">
            These are fine as they are — each counts once in the rotation. Link one only if the same person also plays the other sport
            under a separate entry.
          </p>
          <div className="flex flex-col gap-1.5">
            {unlinked.map((p) => (
              <UnlinkedRow
                key={p.id}
                person={p}
                busy={busyId === p.id}
                onQuickLink={handleQuickLink}
                counterparts={p.shuttlePlayerId ? unlinkedCricket : unlinkedShuttle}
              />
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingUnlink)}
        title="Unlink this person?"
        message={
          pendingUnlink
            ? `${pendingUnlink.name} splits back into a separate badminton and cricket entry, and will take two turns in the expense rotation instead of one. Their players, sessions, matches and past expenses are untouched.`
            : ''
        }
        confirmLabel="Unlink"
        danger
        onConfirm={confirmUnlink}
        onCancel={() => setPendingUnlink(null)}
      />
    </div>
  )
}
