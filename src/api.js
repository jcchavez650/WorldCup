// ESPN unofficial API – no key required
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world'
const ESPN_V2 = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world'

// ESPN's public endpoints send `Access-Control-Allow-Origin: *`, so we can
// fetch them directly from the browser without a third-party CORS proxy.
async function get(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Pass `dates` (e.g. '20260611-20260719') to fetch a whole date range instead
// of just the default matchday window around today.
export async function fetchScoreboard(dates) {
  const q = dates ? `?dates=${dates}` : ''
  return get(`${ESPN_BASE}/scoreboard${q}`)
}

export async function fetchStandings() {
  return get(`${ESPN_V2}/standings`)
}

// Full WC 2026 window so the schedule, bracket and elimination views are
// populated regardless of what "today" is.
export const TOURNAMENT_RANGE = '20260611-20260719'

// Official WC 2026 knockout schedule (YYYYMMDD per round). ESPN's default
// scoreboard only returns matches near "today", and its multi-day range param
// is unreliable for soccer — so we fetch each knockout date explicitly and
// tag the round by the date it was played on.
export const KNOCKOUT_DATES = {
  r32: ['20260628', '20260629', '20260630', '20260701', '20260702', '20260703'],
  r16: ['20260704', '20260705', '20260706', '20260707'],
  qf: ['20260709', '20260710', '20260711'],
  sf: ['20260714', '20260715'],
  tp: ['20260718'],
  f: ['20260719'],
}

// Fetch the whole knockout stage date-by-date and tag each match with its
// round. Individual dates that fail (or have no games yet) resolve to [].
export async function fetchKnockout() {
  const jobs = []
  for (const [round, dates] of Object.entries(KNOCKOUT_DATES)) {
    for (const d of dates) {
      jobs.push(
        fetchScoreboard(d)
          .then(data => parseMatches(data).map(m => ({ ...m, round })))
          .catch(() => [])
      )
    }
  }
  const lists = await Promise.all(jobs)
  const byId = new Map()
  for (const m of lists.flat()) if (!byId.has(m.id)) byId.set(m.id, m)
  return [...byId.values()]
}

// Round of a match: prefer the date-derived tag, fall back to text detection.
export function roundOf(match) {
  return match?.round ?? roundKey(match)
}

// Map a match to a knockout round key, or null for group-stage / unknown.
// Reads every text field ESPN might carry the round in (event name, the
// competition note headline, the season slug).
export function roundKey(match) {
  const t = `${match?.name ?? ''} ${match?.note ?? ''} ${match?.group ?? ''}`.toLowerCase()
  if (t.includes('round of 32')) return 'r32'
  if (t.includes('round of 16')) return 'r16'
  if (t.includes('quarter')) return 'qf'
  if (t.includes('semi')) return 'sf'
  // Check third place before "final" — its label often contains "place final".
  if (t.includes('third place') || t.includes('3rd place') || t.includes('third-place')) return 'tp'
  if (t.includes('final')) return 'f'
  return null
}

// The winning team's name for a decided match, or null if undecided/unknown.
export function winnerName(m) {
  if (!m) return null
  if (m.home?.winner) return m.home.team
  if (m.away?.winner) return m.away.team
  const hs = Number(m.home?.score), as = Number(m.away?.score)
  if (m.home?.score != null && m.away?.score != null && !Number.isNaN(hs) && !Number.isNaN(as)) {
    if (hs > as) return m.home.team
    if (as > hs) return m.away.team
  }
  return null
}

// Merge two match lists by id. Entries in `fresher` win over `base` (used to
// let the live scoreboard override the wider date-range snapshot).
export function mergeMatches(base, fresher) {
  const byId = new Map()
  for (const m of base) byId.set(m.id, m)
  for (const m of fresher) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.date - b.date)
}

// Parse scoreboard into structured matches
export function parseMatches(data) {
  if (!data?.events) return []
  return data.events.map(event => {
    const comp = event.competitions?.[0] ?? {}
    const home = comp.competitors?.find(c => c.homeAway === 'home')
    const away = comp.competitors?.find(c => c.homeAway === 'away')
    const status = comp.status ?? {}

    return {
      id: event.id,
      date: new Date(event.date),
      name: event.name,
      note: comp.notes?.[0]?.headline ?? '',
      group: event.season?.slug ?? '',
      venue: comp.venue?.fullName ?? '',
      statusType: status.type?.name ?? '',
      displayClock: status.displayClock ?? '',
      period: status.period ?? 0,
      home: {
        team: home?.team?.displayName ?? 'TBD',
        abbr: home?.team?.abbreviation ?? '',
        flag: countryFlag(home?.team?.abbreviation),
        score: home?.score ?? null,
        winner: home?.winner ?? false,
      },
      away: {
        team: away?.team?.displayName ?? 'TBD',
        abbr: away?.team?.abbreviation ?? '',
        flag: countryFlag(away?.team?.abbreviation),
        score: away?.score ?? null,
        winner: away?.winner ?? false,
      },
    }
  })
}

// Parse standings into groups
export function parseStandings(data) {
  if (!data?.children) return []
  return data.children.map(group => ({
    name: group.name ?? group.abbreviation,
    teams: (group.standings?.entries ?? []).map(entry => {
      const stats = {}
      entry.stats?.forEach(s => { stats[s.name] = s.value })
      return {
        team: entry.team?.displayName ?? '',
        abbr: entry.team?.abbreviation ?? '',
        flag: countryFlag(entry.team?.abbreviation),
        gp: stats.gamesPlayed ?? 0,
        w: stats.wins ?? 0,
        d: stats.ties ?? 0,
        l: stats.losses ?? 0,
        gf: stats.pointsFor ?? 0,
        ga: stats.pointsAgainst ?? 0,
        gd: stats.pointDifferential ?? 0,
        pts: stats.points ?? 0,
      }
    }).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf),
  }))
}

// Country code → flag emoji
export function countryFlag(abbr) {
  const map = {
    USA: '🇺🇸', MEX: '🇲🇽', CAN: '🇨🇦',
    BRA: '🇧🇷', ARG: '🇦🇷', URU: '🇺🇾', COL: '🇨🇴', ECU: '🇪🇨', PER: '🇵🇪', CHI: '🇨🇱', PAR: '🇵🇾', BOL: '🇧🇴', VEN: '🇻🇪',
    FRA: '🇫🇷', GER: '🇩🇪', ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', ESP: '🇪🇸', POR: '🇵🇹', ITA: '🇮🇹', NED: '🇳🇱', BEL: '🇧🇪',
    CRO: '🇭🇷', SER: '🇷🇸', POL: '🇵🇱', SUI: '🇨🇭', AUT: '🇦🇹', DEN: '🇩🇰', SWE: '🇸🇪', NOR: '🇳🇴',
    SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', SVK: '🇸🇰', CZE: '🇨🇿', HUN: '🇭🇺', ROM: '🇷🇴', UKR: '🇺🇦',
    TUR: '🇹🇷', GRE: '🇬🇷', ALB: '🇦🇱', GEO: '🇬🇪', SLO: '🇸🇮',
    MAR: '🇲🇦', SEN: '🇸🇳', NGR: '🇳🇬', EGY: '🇪🇬', CMR: '🇨🇲', CIV: '🇨🇮', GHA: '🇬🇭', TUN: '🇹🇳', RSA: '🇿🇦', MLI: '🇲🇱', COD: '🇨🇩', GAB: '🇬🇦',
    JPN: '🇯🇵', KOR: '🇰🇷', SAU: '🇸🇦', IRN: '🇮🇷', AUS: '🇦🇺', QAT: '🇶🇦', UAE: '🇦🇪', IRQ: '🇮🇶', UZB: '🇺🇿', JOR: '🇯🇴', THA: '🇹🇭', IND: '🇮🇳', CHN: '🇨🇳',
    NZL: '🇳🇿', PNG: '🇵🇬',
    CRI: '🇨🇷', HON: '🇭🇳', GUA: '🇬🇹', PAN: '🇵🇦', JAM: '🇯🇲', TRI: '🇹🇹',
  }
  return map[abbr] ?? '🏳️'
}
