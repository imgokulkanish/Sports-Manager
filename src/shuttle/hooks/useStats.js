// hooks/useStats.js
import { useMemo } from 'react'
import { usePlayers } from './usePlayers'
import { useSessions } from './useSession'
import { computePlayerStats, filterSessionsByDays } from '../engine/statsEngine'

/**
 * Combines live players + sessions into a ready-to-render stats object.
 * `days` filters to a rolling window (30/90/180/null=all) for the Stats page.
 */
export function useStats(days = null) {
  const { players, loading: playersLoading } = usePlayers()
  const { sessions, loading: sessionsLoading } = useSessions()

  const scopedSessions = useMemo(() => filterSessionsByDays(sessions, days), [sessions, days])

  const statsById = useMemo(
    () => computePlayerStats(scopedSessions, players),
    [scopedSessions, players],
  )

  return {
    players,
    sessions: scopedSessions,
    allSessions: sessions,
    statsById,
    loading: playersLoading || sessionsLoading,
  }
}
