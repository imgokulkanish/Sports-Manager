// pages/SessionDetail.jsx
import React, { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSession, useSessions } from '../hooks/useSession'
import { usePlayers } from '../hooks/usePlayers'
import { sessionLeaderboard, sessionMVP, sessionWinnerId, isQuickPlay, formatDiff } from '../engine/statsEngine'
import { withGuests } from '../engine/guests'
import ScheduleTable from '../components/ScheduleTable'
import ExportButtons from '../components/ExportButtons'
import Footer from '../components/Footer'
import { ListSkeleton } from '../components/Skeleton'
import { StatusBadge } from '../components/StatsBadge'
import SessionEditModal from '../components/SessionEditModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../../shell/components/Toast'
import { useAdmin } from '../../shell/components/Admin'

// A "round" is a block of time; on a two-court round it holds two matches.
// Counts a pre-multi-court schedule (no `slot` field) as one round per match.
function roundCount(schedule = []) {
  if (!schedule.length) return 0
  return new Set(schedule.map((round, i) => round.slot ?? i)).size
}

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, loading, updateSession } = useSession(id)
  const { deleteSession } = useSessions()
  const { players } = usePlayers()
  const { showToast } = useToast()
  const { isAdmin } = useAdmin()
  const [showEdit, setShowEdit] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Quick-play guests have no player record - their names are carried on the
  // session document itself - so they're folded into the lookup here rather
  // than every table below having to know about them. See engine/guests.js.
  const playersById = useMemo(
    () => withGuests(Object.fromEntries(players.map((p) => [p.id, p])), session),
    [players, session],
  )

  const handleEditSubmit = async (data) => {
    await updateSession(data)
    setShowEdit(false)
    showToast('Session updated')
  }

  const handleDelete = async () => {
    setConfirmDelete(false)
    await deleteSession(id)
    showToast('Session deleted')
    navigate('/shuttle/history')
  }

  // Shared with the live page and the PDF so all three rank a session the
  // same way. Guests - players who dropped in for a match or two without
  // joining the session - come last and are labelled with how much of it
  // they actually played.
  const leaderboardRows = useMemo(() => {
    if (!session) return []
    const totalMatches = session.schedule?.length || 0
    return sessionLeaderboard(session).map((row) => ({
      ...row,
      id: row.playerId,
      name: playersById[row.playerId]?.name || row.playerId,
      guestLabel: row.guest ? `played ${row.matches} of ${totalMatches}` : null,
    }))
  }, [session, playersById])

  const winnerId = useMemo(() => (session ? sessionWinnerId(session) : null), [session])
  // Only render the decider note when it actually decided something - see
  // sessionLeaderboard, which drops one whose tie no longer stands.
  const deciderWinner = useMemo(() => leaderboardRows.find((r) => r.deciderWon) || null, [leaderboardRows])

  const mvp = useMemo(() => (session ? sessionMVP(session) : null), [session])

  if (loading || !session) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <ListSkeleton rows={5} />
      </div>
    )
  }

  const quick = isQuickPlay(session)
  const totalCost = (session.courtCost || 0) + (session.waterCost || 0)
  const perPerson = session.playerIds?.length ? totalCost / session.playerIds.length : 0
  const dateStr = new Date(session.date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{dateStr}</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={session.status} />
          <button onClick={() => setShowEdit(true)} className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200">
            Edit
          </button>
          {/* Deleting a session is admin-only - see shell/components/Admin.jsx. */}
          {isAdmin && (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-500 dark:text-red-400 underline hover:text-red-700 dark:hover:text-red-300">
              Delete
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {quick && <span className="text-gray-400 dark:text-gray-500">Quick play · </span>}
        {session.playerIds?.length} players
        {session.guestIds?.length ? ` + ${session.guestIds.length} guest${session.guestIds.length > 1 ? 's' : ''}` : ''} ·{' '}
        {roundCount(session.schedule)} rounds
        {session.schedule?.length !== roundCount(session.schedule)
          ? ` · ${session.schedule.length} matches`
          : ''}{' '}
        {quick ? '' : ` · Umpire: ${session.umpire || '—'}`}
      </p>

      {winnerId && (
        <div className="text-center bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 rounded-xl p-4 mb-4 shadow-sm">
          <p className="text-xl mb-1">🏆</p>
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            {playersById[winnerId]?.name || winnerId} wins!
          </p>
        </div>
      )}

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Final leaderboard</p>
      <div className="flex flex-col gap-1.5 mb-4">
        {leaderboardRows.map((row, i) => (
          <div
            key={row.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              i === 0 && !row.guest
                ? 'bg-brand-light dark:bg-brand/15 border-brand-border dark:border-brand/30 shadow-sm'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
            }`}
          >
            <span
              className={`text-xs font-medium w-4 text-center ${
                i === 0 && !row.guest ? 'text-brand dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {row.guest ? '–' : i + 1}
            </span>
            <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 truncate flex items-center gap-1.5">
              {row.name}
              {row.guestLabel && (
                <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500 shrink-0">
                  Guest ({row.guestLabel})
                </span>
              )}
              {row.deciderWon && (
                <span
                  title="Won the singles decider after finishing level on points"
                  className="text-[9px] font-semibold leading-none px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30"
                >
                  DECIDER
                </span>
              )}
              {mvp?.playerId === row.id && (
                <span
                  title={`Best win rate this session: ${row.wins}W ${row.losses}L`}
                  className="text-[9px] font-semibold leading-none px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30"
                >
                  MVP
                </span>
              )}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {row.wins}W {row.losses}L
            </span>
            <span className="text-sm font-semibold text-brand dark:text-emerald-400">
              {row.pts} pts{' '}
              <span
                title="Point difference: the margin of every match they played, added up"
                className="text-xs font-normal text-gray-400 dark:text-gray-500"
              >
                ({formatDiff(row.diff)})
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Why the top two aren't in rally-point order. */}
      {deciderWinner && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
          <span>🎾</span>
          <p className="text-xs text-amber-900 dark:text-amber-200">
            Level on points — <span className="font-medium">{playersById[deciderWinner.playerId]?.name}</span> won
            the singles decider
            {session.decider.points
              ? ` ${Math.max(...session.decider.points)}–${Math.min(...session.decider.points)}`
              : ''}
            {' '}against{' '}
            {playersById[(session.decider.players || []).find((id) => id !== deciderWinner.playerId)]?.name}
          </p>
        </div>
      )}

      {/* Quick play books no court of its own, so there is nothing to split. */}
      {!quick && (
        <div className="bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 rounded-lg px-3 py-2 flex justify-between items-center mb-4">
          <span className="text-xs text-green-800 dark:text-green-300">SAR {totalCost.toFixed(2)} total</span>
          <span className="text-sm font-semibold text-green-800 dark:text-green-300">
            SAR {perPerson.toFixed(2)} / person
          </span>
        </div>
      )}

      <div className="mb-4">
        <ExportButtons session={session} players={players} variant="results" />
      </div>

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Match log</p>
      <ScheduleTable schedule={session.schedule || []} playersById={playersById} scores={session.scores || {}} compact />

      {/* Why the log may not match the schedule that was printed at the start:
          somebody was late, or a drop-in took a game. */}
      {session.substitutions?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Substitutions</p>
          <div className="flex flex-col gap-1.5">
            {session.substitutions.map((sub, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm"
              >
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-9 shrink-0">
                  Rd {(sub.slot ?? sub.matchIndex) + 1}
                </span>
                <span className="text-gray-900 dark:text-gray-100 truncate">
                  {playersById[sub.inId]?.name || sub.inId}
                  <span className="text-gray-400 dark:text-gray-500"> in for </span>
                  {playersById[sub.outId]?.name || sub.outId}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {session.status !== 'completed' && (
        <Link
          to={`/shuttle/session/${id}/live`}
          className="block text-center bg-brand hover:bg-brand-dark text-white rounded-lg py-3 text-sm font-semibold mt-4 transition-all active:scale-[0.98]"
        >
          Continue Live Scoring
        </Link>
      )}

      <SessionEditModal open={showEdit} session={session} onClose={() => setShowEdit(false)} onSubmit={handleEditSubmit} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this session?"
        message="This permanently removes the session and its scores. Player stats will recalculate without it."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <Footer />
    </div>
  )
}
