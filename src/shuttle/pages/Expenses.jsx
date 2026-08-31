// pages/Expenses.jsx
//
// Who fronted the money, and whose turn it is next. The suggestion is only
// half the point - the fairness board underneath it is the other half, so the
// rotation can be checked rather than taken on trust.
import React, { useEffect, useMemo, useState } from 'react'
import { usePlayers } from '../hooks/usePlayers'
import { useSessions } from '../hooks/useSession'
import { useExpenses, EXPENSE_CATEGORIES, categoryLabel, categoryShort } from '../hooks/useExpenses'
import {
  suggestNextPayer,
  buildSpendSummary,
  windowTotal,
  lastAmountFor,
  monthlySummary,
  SPEND_WINDOW_MONTHS,
} from '../engine/expenseEngine'
import Avatar from '../components/Avatar'
import Footer from '../components/Footer'
import ConfirmDialog from '../components/ConfirmDialog'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../../shell/components/Toast'
import { BTN_SOLID } from '../styles'

const INPUT =
  'w-full mt-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm'
const LABEL = 'text-xs text-gray-500 dark:text-gray-400'
const CARD = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg'
const WINDOW = `${SPEND_WINDOW_MONTHS} month${SPEND_WINDOW_MONTHS === 1 ? '' : 's'}`

const today = () => new Date().toISOString().slice(0, 10)

/** 2 -> "2nd". Only ever used for small rotation positions. */
function ordinal(n) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'
  return `${n}${suffix}`
}
const money = (n) => `SAR ${Number(n || 0).toFixed(2)}`

/** "August 2026" from the 0-based month the engine hands back. */
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

export default function Expenses() {
  const { players, loading: playersLoading } = usePlayers()
  const { sessions } = useSessions()
  const { expenses, loading: expensesLoading, error: expensesError, addExpense, deleteExpense } = useExpenses()
  const { showToast } = useToast()

  const [category, setCategory] = useState('court')
  const [paidBy, setPaidBy] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')
  // Whether the amount in the box is the user's own typing or our prefill.
  // Once they touch it we stop overwriting - a remembered rate should never
  // clobber a figure someone deliberately entered.
  const [amountTouched, setAmountTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAllMonths, setShowAllMonths] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  // Who isn't at the court today. Purely this evening's UI state - being absent
  // doesn't change anyone's standing, so it is never written to Firestore and
  // clears itself once a payment is logged.
  const [absent, setAbsent] = useState([])

  const activePlayers = useMemo(() => players.filter((p) => p.isActive), [players])
  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])

  const suggestion = useMemo(
    () => suggestNextPayer(expenses, players, { exclude: absent }),
    [expenses, players, absent],
  )
  // Told apart from "nothing logged yet": here there IS a rotation, we have
  // just skipped every name in it.
  const allSkipped = !suggestion && absent.length > 0
  const board = useMemo(() => buildSpendSummary(expenses, players), [expenses, players])
  const potTotal = useMemo(() => windowTotal(expenses), [expenses])
  const months = useMemo(() => monthlySummary(expenses, players), [expenses, players])
  const visibleMonths = showAllMonths ? months : months.slice(0, 3)
  const suggested = suggestion ? playersById[suggestion.playerId] : null

  // If a session was played on the same date, link the expense to it. No picker
  // for this - it's a convenience, and asking would be one more field to fill
  // in for something the date already tells us.
  const sessionOnDate = useMemo(
    () => sessions.find((s) => new Date(s.date).toDateString() === new Date(date).toDateString()) || null,
    [sessions, date],
  )

  // The court booking is the same figure most weeks, so retyping it is the main
  // reason amounts get left blank - and a blank amount is exactly what weakens
  // the rotation. Remember the last figure per category and offer it back.
  const lastAmount = useMemo(() => lastAmountFor(expenses, category), [expenses, category])
  useEffect(() => {
    if (amountTouched) return
    setAmount(lastAmount == null ? '' : String(lastAmount))
  }, [lastAmount, amountTouched])
  const amountPrefilled = !amountTouched && lastAmount != null

  const prefill = () => {
    if (suggestion) setPaidBy(suggestion.playerId)
    // The form sits below the card on mobile; nudge it into view so the button
    // visibly does something rather than silently setting state offscreen.
    document.getElementById('expense-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!paidBy) {
      showToast('Pick who paid', 'error')
      return
    }
    setSaving(true)
    try {
      await addExpense({ date, category, paidBy, amount, notes, sessionId: sessionOnDate?.id || null })
      showToast(`${categoryShort(category)} logged for ${playersById[paidBy]?.name || 'player'}`)
      // Amount isn't cleared here on purpose - releasing it back to the prefill
      // leaves the figure just logged sitting there, ready for the next week.
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

  if (playersLoading || expensesLoading) {
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
        Court, food and snacks all go into one pot. Whoever has put in least over the last {WINDOW} is up next.
      </p>

      {/* Without this the page just looks empty forever. The Firebase project is
          shared between apps so its rules are scoped per collection, and a new
          one is denied until it's listed - a config gap, not a network blip,
          and it needs saying so rather than showing an empty board. */}
      {expensesError && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {expensesError.code === 'permission-denied' ? (
              <>
                Expenses can&apos;t be read or written yet — the Firestore rules need a{' '}
                <span className="font-mono">match /expenses/&#123;expenseId&#125;</span> block. It&apos;s in this
                project&apos;s <span className="font-mono">firestore.rules</span>; deploy it to Firebase and this
                notice will clear.
              </>
            ) : (
              <>Couldn&apos;t load expenses. Check your connection and reload.</>
            )}
          </p>
        </div>
      )}

      <div className="bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 rounded-xl p-4 mb-6">
        <p className="text-[10px] font-medium text-green-700 dark:text-green-400 uppercase tracking-wide mb-2">
          Next up
        </p>
        {suggested ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Avatar id={suggested.id} name={suggested.name} size="sm" />
              <span className="text-base font-semibold text-green-900 dark:text-green-200 truncate">
                {suggested.name}
              </span>
            </div>
            <p className="text-xs text-green-700 dark:text-green-300/80 mb-1">
              {suggestion.reason}
              {suggestion.rank > 1 && ` · ${ordinal(suggestion.rank)} in line`}
            </p>
            <button
              type="button"
              onClick={() => setAbsent((prev) => [...prev, suggestion.playerId])}
              className="text-xs text-green-700 dark:text-green-400 underline mb-3 hover:text-green-900 dark:hover:text-green-200"
            >
              Not here today — suggest the next one
            </button>
          </>
        ) : allSkipped ? (
          <>
            <p className="text-base font-semibold text-green-900 dark:text-green-200 mb-1">Everyone skipped</p>
            <p className="text-xs text-green-700 dark:text-green-300/80 mb-3">
              That&apos;s all {absent.length} active players marked absent. Start over to go back to the top of the
              rotation.
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-green-900 dark:text-green-200 mb-1">Pick anyone</p>
            {/* No spend in the window means everyone is tied on zero. Naming
                someone would look like a recommendation but be a coin flip. */}
            <p className="text-xs text-green-700 dark:text-green-300/80 mb-3">
              Nothing logged in the last {WINDOW} yet — log the first payment and the rotation starts.
            </p>
          </>
        )}

        {/* Who has been skipped, and the way back. Shown rather than hidden so
            it's obvious why the name on the card isn't the top of the board. */}
        {absent.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 pt-2 border-t border-brand-border/60 dark:border-brand/20">
            <span className="text-[11px] text-green-700/80 dark:text-green-300/70">Not here:</span>
            {absent.map((id) => (
              <span key={id} className="text-[11px] text-green-800 dark:text-green-300">
                {playersById[id]?.name || id}
              </span>
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
        <button
          type="button"
          onClick={prefill}
          className={`w-full bg-brand text-white rounded-lg py-2 text-sm font-semibold ${BTN_SOLID}`}
        >
          Log payment
        </button>
      </div>

      <form id="expense-form" onSubmit={submit} className={`${CARD} p-4 mb-6`}>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Log a payment</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-3">
          {EXPENSE_CATEGORIES.map(({ value, short }) => (
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
            <label className={LABEL} htmlFor="expense-payer">
              Paid by
            </label>
            <select id="expense-payer" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={INPUT}>
              <option value="">Select a player…</option>
              {activePlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="expense-date">
              Date
            </label>
            <input
              id="expense-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="expense-amount">
              Amount (SAR)
            </label>
            <input
              id="expense-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmountTouched(true)
                setAmount(e.target.value)
              }}
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
            <label className={LABEL} htmlFor="expense-notes">
              Notes — optional
            </label>
            <input
              id="expense-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 2 hours, court 3"
              className={INPUT}
            />
          </div>
        </div>

        {sessionOnDate && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">
            Will be linked to the session played on {formatDate(sessionOnDate.date)}.
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !paidBy}
          className={`w-full bg-brand text-white rounded-lg py-2.5 text-sm font-semibold ${BTN_SOLID}`}
        >
          {saving ? 'Saving…' : 'Add entry'}
        </button>
      </form>

      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Who&apos;s put in what</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {money(potTotal)} over {WINDOW}
        </p>
      </div>
      <div className="flex flex-col gap-1.5 mb-6">
        {board.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No active players.</p>
        )}
        {board.map((row, i) => (
          <div key={row.playerId} className={`${CARD} flex items-center gap-2 px-3 py-2`}>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-4 text-center">{i + 1}</span>
            <Avatar id={row.playerId} name={row.name} size="xs" />
            <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">
              {row.name}
              {absent.includes(row.playerId) && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1.5">not here</span>
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

      {/* What each month cost, over all history rather than the fairness window -
          "whose turn is it" and "what did August cost us" are different
          questions, and clipping this to two months would empty it by month
          three. Only shown once there is something to summarise. */}
      {months.length > 0 && (
        <>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">By month</p>
            {months.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllMonths((v) => !v)}
                className="text-[11px] text-brand dark:text-emerald-400 underline"
              >
                {showAllMonths ? 'Show less' : `Show all ${months.length}`}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1.5 mb-6">
            {visibleMonths.map((m) => {
              const parts = EXPENSE_CATEGORIES.filter(({ value }) => m.byCategory[value] > 0)
              return (
                <div key={m.key} className={`${CARD} px-3 py-2`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                      {formatMonth(m.year, m.month)}
                    </span>
                    <span className="text-sm font-semibold text-brand dark:text-emerald-400 shrink-0 tabular-nums">
                      {money(m.total)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                    {m.count} {m.count === 1 ? 'entry' : 'entries'}
                    {m.top && ` · ${m.top.name} fronted most (${money(m.top.amount)})`}
                  </p>
                  {/* Only categories with a recorded amount - a zero here would
                      read as "we spent nothing on shuttles" when it usually
                      means nobody typed the figure in. */}
                  {parts.length > 0 && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                      {parts.map(({ value, short }) => `${short} ${money(m.byCategory[value])}`).join(' · ')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">History</p>
      <div className="flex flex-col gap-1.5">
        {expenses.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Nothing logged yet.</p>
        )}
        {expenses.map((e) => (
          <div key={e.id} className={`${CARD} flex items-center gap-2 px-3 py-2`}>
            <Avatar id={e.paidBy} name={playersById[e.paidBy]?.name || '?'} size="xs" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                {playersById[e.paidBy]?.name || 'Unknown player'}
                <span className="text-gray-400 dark:text-gray-500"> · {categoryShort(e.category)}</span>
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                {formatDate(e.date)}
                {e.notes ? ` · ${e.notes}` : ''}
              </p>
            </div>
            <span className="text-sm font-semibold text-brand dark:text-emerald-400 shrink-0">
              {e.amount == null ? '—' : money(e.amount)}
            </span>
            <button
              onClick={() => setPendingDelete(e)}
              aria-label="Delete entry"
              className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 text-lg leading-none px-1.5 shrink-0 transition-colors"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this entry?"
        message={
          pendingDelete
            ? `Removes the ${categoryShort(pendingDelete.category).toLowerCase()} payment by ${
                playersById[pendingDelete.paidBy]?.name || 'this player'
              } on ${formatDate(pendingDelete.date)}. The rotation will recalculate without it.`
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
