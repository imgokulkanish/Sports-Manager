// NextPayerCard.jsx (shell)
//
// The "Who's paying next?" card, lifted out of Shuttle Manager's Dashboard
// (its local PayingThisWeek component) so BOTH sports' dashboards can show
// it — expenses are one joint pot, so the answer is the same on either
// dashboard and there's no reason it only lived on Shuttle's.
//
// It also fixes a real inconsistency the lift exposed: Shuttle's Dashboard
// was still computing this from the OLD shuttle-only hook + engine
// (shuttle/hooks/useExpenses + shuttle/engine/expenseEngine), so it could
// name a different person than /expenses, which already runs on the shared
// cross-sport pot. This component uses the exact same sources as
// ExpensesShared — useSharedExpenses + mergePeople + shell/lib/expenseEngine
// — so the dashboard and the Expenses page can no longer disagree.
//
// Note it subscribes to the same four collections ExpensesShared does
// (shuttle players, cricket players, playerLinks, expenses). That's the
// price of the joint pot; onSnapshot listeners for the same collection are
// deduped by the Firestore SDK's local cache, so it's not four extra reads
// per dashboard visit.
import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePlayers as useShuttlePlayers } from '../../shuttle/hooks/usePlayers'
import { usePlayers as useCricketPlayers } from '../../cricket/hooks/usePlayers'
import { usePlayerLinks } from '../hooks/usePlayerLinks'
import { useSharedExpenses } from '../hooks/useSharedExpenses'
import { mergePeople, buildPersonIndex, attachPersonIds } from '../lib/mergePeople'
import { suggestNextPayer } from '../lib/expenseEngine'
import Avatar from './Avatar'

export default function NextPayerCard({ className = '' }) {
  const { players: shuttlePlayers } = useShuttlePlayers()
  const { players: cricketPlayers } = useCricketPlayers()
  const { links } = usePlayerLinks()
  const { expenses } = useSharedExpenses()

  const people = useMemo(
    () => mergePeople(shuttlePlayers, cricketPlayers, links),
    [shuttlePlayers, cricketPlayers, links],
  )
  const resolvedExpenses = useMemo(
    () => attachPersonIds(expenses, buildPersonIndex(people)),
    [expenses, people],
  )
  const suggestion = useMemo(() => suggestNextPayer(resolvedExpenses, people), [resolvedExpenses, people])
  const person = suggestion ? people.find((p) => p.id === suggestion.personId) : null

  return (
    <Link
      to="/expenses"
      className={`block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Who&apos;s paying next?</p>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">Expenses →</span>
      </div>
      <div className="bg-brand-light dark:bg-brand/15 rounded-lg px-3 py-2">
        {person ? (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar id={person.id} name={person.name} size="xs" />
            <span className="text-sm font-medium text-green-900 dark:text-green-200 truncate">{person.name}</span>
            <span className="text-[11px] text-green-700 dark:text-green-300/80 truncate ml-auto shrink-0">
              {suggestion.reason}
            </span>
          </div>
        ) : (
          <span className="text-sm font-medium text-green-900 dark:text-green-200">
            Pick anyone — nothing logged yet
          </span>
        )}
      </div>
    </Link>
  )
}
