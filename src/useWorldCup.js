import { useState, useEffect, useCallback } from 'react'
import {
  fetchScoreboard,
  fetchStandings,
  fetchKnockout,
  parseMatches,
  parseStandings,
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
      // the per-date knockout fetch (round-tagged) fills the bracket even on
      // rest days; standings are optional and shouldn't fail the whole load.
      const [scoreData, knockout, standData] = await Promise.all([
        fetchScoreboard(),
        fetchKnockout().catch(() => []),
        fetchStandings().catch(() => null),
      ])

      // Knockout matches (with their round tags) take precedence; the default
      // scoreboard adds group-stage / today's games not covered above.
      const byId = new Map()
      for (const m of knockout) byId.set(m.id, m)
      for (const m of parseMatches(scoreData)) if (!byId.has(m.id)) byId.set(m.id, m)
      const all = [...byId.values()].sort((a, b) => a.date - b.date)

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
