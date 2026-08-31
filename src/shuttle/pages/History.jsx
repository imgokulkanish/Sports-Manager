// pages/History.jsx
import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStats } from '../hooks/useStats'
import { useSessions } from '../hooks/useSession'
import { sessionWinnerId, isQuickPlay } from '../engine/statsEngine'
import { StatusBadge } from '../components/StatsBadge'
import Footer from '../components/Footer'
import EmptyState from '../components/EmptyState'
import { CalendarIcon } from '../components/icons'
import { ListSkeleton } from '../components/Skeleton'
import { useToast } from '../../shell/components/Toast'
import { useAdmin } from '../../shell/components/Admin'
import ConfirmDialog from '../components/ConfirmDialog'

const INPUT = 'w-full mt-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-2 py-1.5 text-xs'

export default function History() {
  const { players, allSessions, loading } = useStats()
  const { deleteSession } = useSessions()
  const { showToast } = useToast()
  const { isAdmin } = useAdmin()
  const [playerFilter, setPlayerFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players])

  const hasFilters = Boolean(playerFilter || fromDate || toDate)

  const filtered = useMemo(() => {
    return allSessions
      .filter((s) => s.status === 'completed')
      // Guests appear under their own filter too - they were on court, and a
      // player looking up "my sessions" means the ones they played in.
      .filter(
        (s) =>
          !playerFilter ||
          (s.playerIds || []).includes(playerFilter) ||
          (s.guestIds || []).includes(playerFilter),
      )
      .filter((s) => !fromDate || new Date(s.date) >= new Date(fromDate))
      .filter((s) => !toDate || new Date(s.date) <= new Date(toDate))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [allSessions, playerFilter, fromDate, toDate])

  // Shared with the session pages so the same person is named here as there -
  // and so a guest who won their one drop-in match can't take the day.
  // Quick play has no winner of the day: it's a handful of casual games, not
  // a session anyone can win. It's still listed, just badged for what it is.
  const winnerOfDay = (session) => {
    if (isQuickPlay(session)) return null
    const winnerId = sessionWinnerId(session)
    return winnerId ? playersById[winnerId]?.name : null
  }

  if (loading) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <ListSkeleton rows={5} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 md:pb-8">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">History</h1>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={INPUT} />
        </div>
      </div>

      <select
        value={playerFilter}
        onChange={(e) => setPlayerFilter(e.target.value)}
        className="w-full mb-4 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
      >
        <option value="">All players</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <EmptyState
            icon={<CalendarIcon className="w-6 h-6" />}
            title={hasFilters ? 'No sessions match these filters' : 'No sessions yet'}
            message={hasFilters ? 'Try widening the date range or clearing the player filter.' : 'Completed sessions will show up here once you finish one.'}
            action={
              !hasFilters && (
                <Link
                  to="/shuttle/session/new"
                  className="bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-4 py-2 transition-all active:scale-[0.98] inline-block"
                >
                  New Session
                </Link>
              )
            }
          />
        )}
        {filtered.map((s) => (
          <div
            key={s.id}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 flex items-center gap-2 transition-shadow hover:shadow-sm"
          >
            <Link to={`/shuttle/session/${s.id}`} className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {new Date(s.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                {isQuickPlay(s) ? (
                  <span className="text-[10px] font-medium leading-none px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                    Quick play
                  </span>
                ) : (
                  <StatusBadge status={s.status} />
                )}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {s.playerIds?.length || 0} players
                {isQuickPlay(s) ? ` · ${s.schedule?.length || 0} matches` : ''}
                {winnerOfDay(s) ? ` · 🏆 ${winnerOfDay(s)}` : ''}
              </p>
            </Link>
            {/* Deleting a session is admin-only - see shell/components/Admin.jsx. */}
            {isAdmin && (
              <button
                onClick={() => setPendingDelete(s)}
                aria-label="Delete session"
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
        title="Delete this session?"
        message="This permanently removes the session and its scores. Player stats will recalculate without it."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          await deleteSession(pendingDelete.id)
          showToast('Session deleted')
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <Footer />
    </div>
  )
}
