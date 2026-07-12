import { MatchCard } from './Scores.jsx'
import { roundOf } from './api.js'

const ROUND_LABELS = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  tp: 'Third-place Play-off',
  f: 'Final',
}
const ORDER = ['r32', 'r16', 'qf', 'sf', 'tp', 'f']

// A team slot is only "real" once it's been decided — undecided knockout
// fixtures come back from ESPN with placeholder (TBD) competitors.
const known = t => t && t !== 'TBD'
const isDecided = m => known(m.home?.team) && known(m.away?.team)

export default function Elimination({ matches }) {
  const byRound = {}
  for (const m of matches) {
    const r = roundOf(m)
    if (!r || !isDecided(m)) continue
    ;(byRound[r] ??= []).push(m)
  }

  const sections = ORDER
    .filter(r => byRound[r]?.length)
    .map(r => ({
      key: r,
      label: ROUND_LABELS[r],
      games: byRound[r].sort((a, b) => a.date - b.date),
    }))

  if (!sections.length) {
    return (
      <div className="empty">
        <div className="e">🥊</div>
        <div>No elimination matches yet.</div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text2)' }}>
          Knockout games appear here once the Round of 32 begins.
        </div>
      </div>
    )
  }

  return (
    <div>
      {sections.map(sec => (
        <div key={sec.key}>
          <div className="section-header">{sec.label}</div>
          {sec.games.map(m => <MatchCard key={m.id} match={m} />)}
        </div>
      ))}
    </div>
  )
}
