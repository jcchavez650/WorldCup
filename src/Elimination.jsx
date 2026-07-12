import { MatchCard } from './Scores.jsx'
import { roundKey } from './api.js'

const ROUND_LABELS = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  tp: 'Third-place Play-off',
  f: 'Final',
}
const ORDER = ['r32', 'r16', 'qf', 'sf', 'tp', 'f']

export default function Elimination({ matches }) {
  const byRound = {}
  for (const m of matches) {
    const r = roundKey(m)
    if (!r) continue
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
