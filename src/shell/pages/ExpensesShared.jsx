// ExpensesShared.jsx
//
// Adapted from Shuttle Manager's pages/Expenses.jsx — same UI shape and the
// same care around the details (amount prefill, "not here today" skipping,
// same-day activity linking, monthly summary), rebuilt against the joint,
// cross-sport pot you chose. Read the inline comments marked CHANGED for
// exactly what's different from the original and why; everything else is
// intentionally as close to a port as the schema change allows.
//
// TODO: these are generic, sport-agnostic UI components from Shuttle's
// codebase (Footer, ConfirmDialog, ListSkeleton, useToast, BTN_SOLID) — fix
// these import paths once physically moved into the shell, same pattern as
// every other TODO in this skeleton. None of them need to change internally;
// they were never Shuttle-specific to begin with.
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayers as useShuttlePlayers } from '../../shuttle/hooks/usePlayers'
import { usePlayers as useCricketPlayers } from '../../cricket/hooks/usePlayers'
import { usePlayerLinks } from '../hooks/usePlayerLinks'
import { mergePeople, buildPersonIndex, attachPersonIds } from '../lib/mergePeople'
import { useSharedExpenses } from '../hooks/useSharedExpenses'
import { useExpenseParticipants } from '../hooks/useExpenseParticipants'
import { categoriesForSport, categoryLabel, categoryShort } from '../lib/expenseCategories'
import {
  suggestNextPayer,
  buildSpendSummary,
  windowTotal,
  lastAmountFor,
  monthlySummary,
  SPEND_WINDOW_MONTHS,
  BIG_PAYMENT_AMOUNT,
  BIG_PAYMENT_WINDOW_DAYS,
} from '../lib/expenseEngine'
import { useShellStore, SPORTS } from '../store/useShellStore'
import Avatar from '../components/Avatar'
import Footer from '../components/Footer'
import ConfirmDialog from '../components/ConfirmDialog'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { useAdmin } from '../components/Admin'

const INPUT =
  'w-full mt-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm'
const LABEL = 'text-xs text-gray-500 dark:text-gray-400'
const CARD = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg'
const WINDOW = `${SPEND_WINDOW_MONTHS} month${SPEND_WINDOW_MONTHS === 1 ? '' : 's'}`
// 14 days reads better as "2 weeks" on a card; fall back to days if the
// engine's constant is ever set to something that isn't whole weeks.
const COOLDOWN_WINDOW =
  BIG_PAYMENT_WINDOW_DAYS % 7 === 0
    ? `${BIG_PAYMENT_WINDOW_DAYS / 7} week${BIG_PAYMENT_WINDOW_DAYS === 7 ? '' : 's'}`
    : `${BIG_PAYMENT_WINDOW_DAYS} days`

const today = () => new Date().toISOString().slice(0, 10)

function ordinal(n) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'
  return `${n}${suffix}`
}
const money = (n) => `SAR ${Number(n || 0).toFixed(2)}`
function formatMonth(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
function sinceLabel(date) {
  if (!date) return 'never'
  const days = Math.floor((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

/**
 * Who counts toward "whose turn is it". Collapsed to a one-line summary by
 * default — this is a set-it-once-a-season control, not something you touch
 * on an evening out, so it shouldn't compete with the form above it.
 *
 * Deliberately NOT the same thing as archiving someone in their sport roster:
 * that removes them from team selection, matchups and stats too. Plenty of
 * people are active players who simply don't share costs — guests, juniors,
 * whoever pays their own way — and until now there was no way to say that
 * without lying about their playing status.
 */
function RotationManager({ rotationPeople, excludedPeople, canEdit, busyId, onChange }) {
  const [open, setOpen] = useState(false)
  // Active only, so this list and its count match the board above it exactly
  // (buildSpendSummary drops inactive people too). Someone archived in their
  // sport is already absent from the rotation without needing a second
  // switch here — un-archiving them brings them back.
  const inRotation = useMemo(
    () => rotationPeople.filter((p) => p.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [rotationPeople],
  )

  return (
    <div className={`${CARD} mb-6`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Who's in the rotation</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {inRotation.length} counted
            {excludedPeople.length > 0 && ` · ${excludedPeople.length} left out`}
          </p>
        </div>
        <span className="text-[11px] text-brand dark:text-emerald-400 shrink-0">{open ? 'Done' : 'Manage'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-3">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">
            Leaving someone out only affects this page — they stay a full player in their sport, keep their stats, and any payment
            they've already made still shows in the history below.
          </p>

          {!canEdit && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2 mb-3">
              <Link to="/settings" className="underline">
                Turn on admin mode
              </Link>{' '}
              to change who's counted — it decides who gets asked to pay.
            </p>
          )}

          <div className="flex flex-col gap-1">
            {inRotation.map((p) => (
              <RotationRow key={p.id} person={p} included canEdit={canEdit} busy={busyId === p.id} onChange={onChange} />
            ))}
          </div>

          {excludedPeople.length > 0 && (
            <>
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-4 mb-1.5">Not counted</p>
              <div className="flex flex-col gap-1">
                {excludedPeople.map((p) => (
                  <RotationRow key={p.id} person={p} included={false} canEdit={canEdit} busy={busyId === p.id} onChange={onChange} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function RotationRow({ person, included, canEdit, busy, onChange }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1.5">
      <Avatar id={person.id} name={person.name} size="xs" className={included ? '' : 'opacity-50'} />
      <span className={`text-sm flex-1 truncate ${included ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
        {person.name}
        {/* Which sport(s) they came from - the same person can look like two
            strangers here when their two rosters spell the name differently
            and nobody has linked them yet. */}
        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1.5">
          {person.shuttlePlayerId && '🏸'}
          {person.cricketPlayerId && '🏏'}
        </span>
        {!person.isActive && <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">archived</span>}
      </span>
      {canEdit && (
        <button
          type="button"
          onClick={() => onChange(person, !included)}
          disabled={busy}
          className={`text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors disabled:opacity-40 ${
            included
              ? 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-300 hover:text-red-500 dark:hover:border-red-500/40 dark:hover:text-red-400'
              : 'border-brand-border dark:border-brand/30 text-brand dark:text-emerald-400 hover:bg-brand-light dark:hover:bg-brand/15'
          }`}
        >
          {busy ? '…' : included ? 'Leave out' : 'Count in'}
        </button>
      )}
    </div>
  )
}

export default function ExpensesShared() {
  // CHANGED: three roster sources instead of one, joined via mergePeople —
  // this is what makes the pot joint rather than per-sport.
  const { players: shuttlePlayers, loading: shuttleLoading } = useShuttlePlayers()
  const { players: cricketPlayers, loading: cricketLoading } = useCricketPlayers()
  const { links, loading: linksLoading } = usePlayerLinks()
  const { expenses, loading: expensesLoading, error: expensesError, addExpense, deleteExpense } = useSharedExpenses()
  const { showToast } = useToast()
  // Deleting an entry silently changes whose turn it is to pay - the rotation
  // is derived from this history, so a stray tap on a passed-around phone
  // moves money around without anyone noticing. Same reasoning as every other
  // delete in the app; see shell/components/Admin.jsx.
  const { isAdmin } = useAdmin()
  const {
    loading: participantsLoading,
    error: participantsError,
    isInRotation,
    setPersonInRotation,
  } = useExpenseParticipants()

  const people = useMemo(() => mergePeople(shuttlePlayers, cricketPlayers, links), [shuttlePlayers, cricketPlayers, links])
  const personIndex = useMemo(() => buildPersonIndex(people), [people])
  const resolvedExpenses = useMemo(() => attachPersonIds(expenses, personIndex), [expenses, personIndex])
  const peopleById = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people])

  // CHANGED: which sport a NEW entry belongs to — defaults to whichever
  // sport tab you arrived from, but this page is shared, so it's an
  // explicit toggle, not locked to the shell's current sport.
  const shellSport = useShellStore((s) => s.currentSport)
  const [sport, setSport] = useState(shellSport)
  const sportCategories = useMemo(() => categoriesForSport(sport), [sport])

  const [category, setCategory] = useState(sportCategories[0]?.value || '')
  const [paidBy, setPaidBy] = useState('') // stores a PERSON id, resolved to a raw playerId on submit
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAllMonths, setShowAllMonths] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [absent, setAbsent] = useState([]) // personIds, this evening's UI state only
  const [rotationBusyId, setRotationBusyId] = useState(null)

  const changeRotation = async (person, inRotation) => {
    setRotationBusyId(person.id)
    try {
      await setPersonInRotation(person, inRotation)
      // Someone taken out of the rotation shouldn't stay on tonight's "not
      // here" list - they're not being skipped any more, they're just gone.
      if (!inRotation) setAbsent((prev) => prev.filter((id) => id !== person.id))
      showToast(inRotation ? `${person.name} counted in the rotation` : `${person.name} left out of the rotation`)
    } catch (err) {
      console.error('Failed to update rotation:', err)
      showToast(
        err?.code === 'permission-denied'
          ? 'Blocked by Firestore rules — the /expenseOptOuts rule needs deploying'
          : 'Could not save that change',
        'error',
      )
    } finally {
      setRotationBusyId(null)
    }
  }

  useEffect(() => {
    setCategory(categoriesForSport(sport)[0]?.value || '')
    setPaidBy((prev) => {
      const person = peopleById[prev]
      const stillEligible = sport === SPORTS.SHUTTLE ? person?.shuttlePlayerId : person?.cricketPlayerId
      return stillEligible ? prev : ''
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport])


  // THE ROTATION POOL vs THE FULL LIST - two different things, deliberately.
  //
  // `rotationPeople` drives who can be suggested, who appears on the board,
  // and who is offered in the payer picker. `people` (unfiltered) still backs
  // the monthly summary and every history row, because someone opted out
  // today may well have paid something last month, and their name has to
  // keep resolving. Money already spent stays counted in the pot total for
  // the same reason - it was real money.
  const rotationPeople = useMemo(() => people.filter(isInRotation), [people, isInRotation])
  const excludedPeople = useMemo(
    () => people.filter((p) => !isInRotation(p)).sort((a, b) => a.name.localeCompare(b.name)),
    [people, isInRotation],
  )

  const eligiblePayers = useMemo(
    () => rotationPeople.filter((p) => (sport === SPORTS.SHUTTLE ? p.shuttlePlayerId : p.cricketPlayerId) && p.isActive),
    [rotationPeople, sport],
  )

  // Taking the currently-selected payer out of the rotation would otherwise
  // leave the picker showing a name that no longer has an <option> - the
  // select renders blank while `paidBy` still holds the id, so Add entry
  // stays enabled and files the payment against someone you can't see.
  useEffect(() => {
    if (paidBy && !eligiblePayers.some((p) => p.id === paidBy)) setPaidBy('')
  }, [eligiblePayers, paidBy])

  const suggestion = useMemo(
    () => suggestNextPayer(resolvedExpenses, rotationPeople, { exclude: absent }),
    [resolvedExpenses, rotationPeople, absent],
  )
  const allSkipped = !suggestion && absent.length > 0
  const board = useMemo(() => buildSpendSummary(resolvedExpenses, rotationPeople), [resolvedExpenses, rotationPeople])
  const potTotal = useMemo(() => windowTotal(resolvedExpenses), [resolvedExpenses])
  const months = useMemo(() => monthlySummary(resolvedExpenses, people), [resolvedExpenses, people])
  const visibleMonths = showAllMonths ? months : months.slice(0, 3)
  const suggested = suggestion ? peopleById[suggestion.personId] : null

  // TODO: same-day activity linking (sessionOnDate in the original) needs
  // Shuttle's useSessions() and Cricket's equivalent match-listing hook
  // wired in here once both are moved — left out rather than guessed at.
  const activityOnDate = null

  const lastAmount = useMemo(() => lastAmountFor(resolvedExpenses, category), [resolvedExpenses, category])
  useEffect(() => {
    if (amountTouched) return
    setAmount(lastAmount == null ? '' : String(lastAmount))
  }, [lastAmount, amountTouched])
  const amountPrefilled = !amountTouched && lastAmount != null

  const prefill = () => {
    if (suggestion) setPaidBy(suggestion.personId)
    document.getElementById('expense-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const submit = async (e) => {
    e.preventDefault()
    const person = peopleById[paidBy]
    const rawPlayerId = sport === SPORTS.SHUTTLE ? person?.shuttlePlayerId : person?.cricketPlayerId
    if (!rawPlayerId) {
      showToast('Pick who paid', 'error')
      return
    }
    setSaving(true)
    try {
      await addExpense({
        date,
        sport,
        category,
        paidBy: rawPlayerId,
        amount,
        notes,
        activityId: activityOnDate?.id || null,
      })
      showToast(`${categoryShort(category)} logged for ${person?.name || 'player'}`)
      setAmountTouched(false)
      setNotes('')
      setPaidBy('')
      setAbsent([])
    } catch (err) {
      console.error('Failed to add expense:', err)
      showToast(
        err?.code === 'permission-denied'
          ? 'Blocked by Firestore rules — the /expenses rule needs deploying'
          : 'Could not save that — check your connection',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    const target = pendingDelete
    setPendingDelete(null)
    try {
      await deleteExpense(target.id)
      showToast('Entry deleted')
    } catch (err) {
      console.error('Failed to delete expense:', err)
      showToast('Could not delete that entry', 'error')
    }
  }

  if (shuttleLoading || cricketLoading || linksLoading || expensesLoading || participantsLoading) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <ListSkeleton rows={5} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Expenses</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Badminton and cricket spending share one pot. Whoever has put in least over the last {WINDOW} is up next —
        unless they fronted over {money(BIG_PAYMENT_AMOUNT)} in one go in the last {COOLDOWN_WINDOW}, which moves them
        to the back of the line.
      </p>

      {expensesError && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {expensesError.code === 'permission-denied'
              ? "Expenses can't be read or written yet — deploy the /expenses rules block."
              : "Couldn't load expenses. Check your connection and reload."}
          </p>
        </div>
      )}

      {/* Separate banner rather than folded into the one above: this failing
          degrades to "everyone is in the rotation", which is the old behavior
          and still perfectly usable - the page shouldn't read as broken. */}
      {participantsError && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {participantsError.code === 'permission-denied'
              ? "Everyone is being counted in the rotation — deploy the /expenseOptOuts rules block to leave people out."
              : "Couldn't load the rotation list, so everyone is being counted for now."}
          </p>
        </div>
      )}

      <div className="bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 rounded-xl p-4 mb-6">
        <p className="text-[10px] font-medium text-green-700 dark:text-green-400 uppercase tracking-wide mb-2">Next up</p>
        {suggested ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Avatar id={suggested.id} name={suggested.name} size="sm" />
              <span className="text-base font-semibold text-green-900 dark:text-green-200 truncate">{suggested.name}</span>
            </div>
            <p className="text-xs text-green-700 dark:text-green-300/80 mb-1">
              {suggestion.reason}
              {suggestion.rank > 1 && ` · ${ordinal(suggestion.rank)} in line`}
            </p>
            <button
              type="button"
              onClick={() => setAbsent((prev) => [...prev, suggestion.personId])}
              className="text-xs text-green-700 dark:text-green-400 underline mb-3 hover:text-green-900 dark:hover:text-green-200"
            >
              Not here today — suggest the next one
            </button>
          </>
        ) : allSkipped ? (
          <>
            <p className="text-base font-semibold text-green-900 dark:text-green-200 mb-1">Everyone skipped</p>
            <p className="text-xs text-green-700 dark:text-green-300/80 mb-3">
              That's all {absent.length} active people marked absent. Start over to go back to the top.
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-green-900 dark:text-green-200 mb-1">Pick anyone</p>
            <p className="text-xs text-green-700 dark:text-green-300/80 mb-3">
              Nothing logged in the last {WINDOW} yet — log the first payment and the rotation starts.
            </p>
          </>
        )}

        {absent.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 pt-2 border-t border-brand-border/60 dark:border-brand/20">
            <span className="text-[11px] text-green-700/80 dark:text-green-300/70">Not here:</span>
            {absent.map((id) => (
              <span key={id} className="text-[11px] text-green-800 dark:text-green-300">{peopleById[id]?.name || id}</span>
            ))}
            <button
              type="button"
              onClick={() => setAbsent([])}
              className="text-[11px] text-green-700 dark:text-green-400 underline ml-auto hover:text-green-900 dark:hover:text-green-200"
            >
              Start over
            </button>
          </div>
        )}
        <button type="button" onClick={prefill} className="w-full bg-brand text-white rounded-lg py-2 text-sm font-semibold">
          Log payment
        </button>
      </div>

      <form id="expense-form" onSubmit={submit} className={`${CARD} p-4 mb-6`}>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Log a payment</p>

        <div className="grid grid-cols-2 gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-3">
          {Object.values(SPORTS).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              className={`text-xs font-medium rounded-md py-2 transition-colors ${
                sport === s
                  ? 'bg-white dark:bg-gray-700 text-brand dark:text-emerald-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {s === SPORTS.SHUTTLE ? '🏸 Shuttle' : '🏏 Cricket'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-3">
          {sportCategories.map(({ value, short }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`text-xs font-medium rounded-md py-2 transition-colors ${
                category === value
                  ? 'bg-white dark:bg-gray-700 text-brand dark:text-emerald-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {short}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">{categoryLabel(category)}</p>

        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className={LABEL} htmlFor="expense-payer">Paid by</label>
            <select id="expense-payer" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={INPUT}>
              <option value="">Select a person…</option>
              {eligiblePayers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="expense-date">Date</label>
            <input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className={LABEL} htmlFor="expense-amount">Amount (SAR)</label>
            <input
              id="expense-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => { setAmountTouched(true); setAmount(e.target.value) }}
              placeholder="Optional, but drives the rotation"
              className={INPUT}
            />
            {amountPrefilled && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Last {categoryShort(category).toLowerCase()} entry — edit if this week differs.
              </p>
            )}
          </div>
          <div>
            <label className={LABEL} htmlFor="expense-notes">Notes — optional</label>
            <input
              id="expense-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 2 hours, ground 3"
              className={INPUT}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !paidBy}
          className="w-full bg-brand text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Add entry'}
        </button>
      </form>

      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Who's put in what</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{money(potTotal)} over {WINDOW}</p>
      </div>
      <div className="flex flex-col gap-1.5 mb-6">
        {board.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No active players.</p>}
        {board.map((row, i) => (
          <div key={row.personId} className={`${CARD} flex items-center gap-2 px-3 py-2`}>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-4 text-center">{i + 1}</span>
            <Avatar id={row.personId} name={row.name} size="xs" />
            <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">
              {row.name}
              {absent.includes(row.personId) && <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1.5">not here</span>}
              {/* Without this the board looks broken: someone with the
                  lowest total in the list sitting at the bottom of it needs
                  to say why. */}
              {row.onCooldown && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1.5 whitespace-nowrap">
                  just fronted {money(row.recentBig.amount)}
                </span>
              )}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{sinceLabel(row.lastPaidDate)}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 w-8 text-right">{row.timesPaid}×</span>
            <span className="text-sm font-semibold text-brand dark:text-emerald-400 shrink-0 w-20 text-right tabular-nums">
              {money(row.totalAmount)}
            </span>
          </div>
        ))}
      </div>

      <RotationManager
        rotationPeople={rotationPeople}
        excludedPeople={excludedPeople}
        canEdit={isAdmin}
        busyId={rotationBusyId}
        onChange={changeRotation}
      />

      {months.length > 0 && (
        <>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">By month</p>
            {months.length > 3 && (
              <button type="button" onClick={() => setShowAllMonths((v) => !v)} className="text-[11px] text-brand dark:text-emerald-400 underline">
                {showAllMonths ? 'Show less' : `Show all ${months.length}`}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1.5 mb-6">
            {visibleMonths.map((m) => (
              <div key={m.key} className={`${CARD} px-3 py-2`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate">{formatMonth(m.year, m.month)}</span>
                  <span className="text-sm font-semibold text-brand dark:text-emerald-400 shrink-0 tabular-nums">{money(m.total)}</span>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                  {m.count} {m.count === 1 ? 'entry' : 'entries'}
                  {m.top && ` · ${m.top.name} fronted most (${money(m.top.amount)})`}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">History</p>
        {!isAdmin && resolvedExpenses.length > 0 && (
          <Link to="/settings" className="text-[11px] text-gray-400 dark:text-gray-500 underline hover:text-gray-600 dark:hover:text-gray-300">
            Turn on admin mode to delete
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {resolvedExpenses.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Nothing logged yet.</p>}
        {resolvedExpenses.map((e) => (
          <div key={e.id} className={`${CARD} flex items-center gap-2 px-3 py-2`}>
            <Avatar id={e.personId} name={peopleById[e.personId]?.name || '?'} size="xs" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                {peopleById[e.personId]?.name || 'Unknown player'}
                <span className="text-gray-400 dark:text-gray-500"> · {e.sport === 'cricket' ? '🏏' : '🏸'} {categoryShort(e.category)}</span>
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                {formatDate(e.date)}{e.notes ? ` · ${e.notes}` : ''}
              </p>
            </div>
            <span className="text-sm font-semibold text-brand dark:text-emerald-400 shrink-0">
              {e.amount == null ? '—' : money(e.amount)}
            </span>
            {isAdmin && (
              <button
                onClick={() => setPendingDelete(e)}
                aria-label="Delete entry"
                className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 text-lg leading-none px-1.5 shrink-0 transition-colors"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this entry?"
        message={
          pendingDelete
            ? `Removes the ${categoryShort(pendingDelete.category).toLowerCase()} payment by ${
                peopleById[pendingDelete.personId]?.name || 'this person'
              } on ${formatDate(pendingDelete.date)}.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <Footer />
    </div>
  )
}
