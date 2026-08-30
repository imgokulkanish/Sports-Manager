import { useMemo } from 'react'
import { usePlayers } from './usePlayers'
import { useMatches } from './useMatch'
import { computePlayerStats, filterMatchesByDays } from '../engine/statsEngine'

export function useStats(days = null) {
  const { players, loading: playersLoading } = usePlayers()
  const { matches, loading: matchesLoading } = useMatches()

  const scopedMatches = useMemo(() => filterMatchesByDays(matches, days), [matches, days])
  const statsById = useMemo(() => computePlayerStats(scopedMatches, players), [scopedMatches, players])

  return {
    players,
    matches: scopedMatches,
    allMatches: matches,
    statsById,
    loading: playersLoading || matchesLoading,
  }
}
