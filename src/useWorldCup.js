import { useState, useEffect, useCallback } from 'react'
import {
  fetchScoreboard,
  fetchStandings,
  parseMatches,
  parseStandings,
  mergeMatches,
  TOURNAMENT_RANGE,
} from './api.js'

export function useWorldCup() {
  const [matches, setMatches] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      // The default scoreboard is the freshest source for live/today games;
      // the full-range fetch and standings are optional extras that shouldn't
      // fail the whole load if ESPN doesn't return them.
      const [scoreData, fullData, standData] = await Promise.all([
        fetchScoreboard(),
        fetchScoreboard(TOURNAMENT_RANGE).catch(() => null),
        fetchStandings().catch(() => null),
      ])

      let all = parseMatches(scoreData)
      if (fullData) {
        // Wider snapshot as the base, live scoreboard overrides for fresh scores.
        all = mergeMatches(parseMatches(fullData), all)
      }
      setMatches(all)
      if (standData) setGroups(parseStandings(standData))
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Auto-refresh every 60s
    const iv = setInterval(() => load(true), 60_000)
    return () => clearInterval(iv)
  }, [load])

  const refresh = () => load(true)

  return { matches, groups, loading, error, lastUpdated, refreshing, refresh }
}
