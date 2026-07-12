import { useState, useEffect, useCallback } from 'react'
import {
  fetchScoreboard,
  fetchStandings,
  fetchKnockout,
  parseMatches,
  parseStandings,
} from './api.js'

// Format a Date as ESPN's YYYYMMDD date param.
function ymd(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

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
      // Fetch the default scoreboard plus today's and tomorrow's dates
      // explicitly so the Scores tab always has today + next-day games; the
      // per-date knockout fetch (round-tagged) fills the bracket even on rest
      // days; standings are optional and shouldn't fail the whole load.
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(now.getDate() + 1)

      const [scoreData, todayData, tomorrowData, knockout, standData] = await Promise.all([
        fetchScoreboard(),
        fetchScoreboard(ymd(now)).catch(() => null),
        fetchScoreboard(ymd(tomorrow)).catch(() => null),
        fetchKnockout().catch(() => []),
        fetchStandings().catch(() => null),
      ])

      // Knockout matches (with their round tags) take precedence; the
      // scoreboard fetches add group-stage / today / tomorrow games.
      const byId = new Map()
      for (const m of knockout) byId.set(m.id, m)
      for (const data of [scoreData, todayData, tomorrowData]) {
        for (const m of parseMatches(data)) if (!byId.has(m.id)) byId.set(m.id, m)
      }
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
