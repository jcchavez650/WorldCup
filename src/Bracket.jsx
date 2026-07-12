import { roundKey } from './api.js'

// WC 2026 has 48 teams → a 32-team knockout starting at the Round of 32,
// plus a third-place play-off before the final.
const ROUNDS = [
  { key: 'r32', label: 'Round of 32', slots: 16 },
  { key: 'r16', label: 'Round of 16', slots: 8 },
  { key: 'qf', label: 'Quarter-finals', slots: 4 },
  { key: 'sf', label: 'Semi-finals', slots: 2 },
  { key: 'tp', label: 'Third-place Play-off', slots: 1 },
  { key: 'f', label: 'Final', slots: 1 },
]

export default function Bracket({ matches }) {
  // Bucket every knockout match by its round.
  const byRound = {}
  for (const m of matches) {
    const r = roundKey(m)
    if (!r) continue
    ;(byRound[r] ??= []).push(m)
  }
  for (const r of Object.keys(byRound)) {
    byRound[r].sort((a, b) => a.date - b.date)
  }

  const hasAny = Object.values(byRound).some(list => list.length)

  return (
    <div className="bracket-wrapper">
      {!hasAny && (
        <div className="empty">
          <div className="e">🏆</div>
          <div>The knockout bracket fills in as results come in.</div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text2)' }}>
            Round of 32 begins after the group stage. Slots below show the full
            bracket structure.
          </div>
        </div>
      )}

      {ROUNDS.map(r => {
        const played = byRound[r.key] ?? []
        // Always render the round at its true size: real matchups first, then
        // TBD placeholders to preserve the shape of the bracket.
        const padded = played.length < r.slots
          ? [...played, ...Array.from({ length: r.slots - played.length }, () => null)]
          : played

        return (
          <div className="bracket-round" key={r.key}>
            <div className="round-label">{r.label}</div>
            <div className={`bracket-grid ${r.slots === 1 ? 'single' : ''}`}>
              {padded.map((m, i) =>
                m ? <BracketMatchup key={m.id} match={m} /> : <TBDMatchup key={`tbd-${i}`} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BracketMatchup({ match: m }) {
  const hasScore = m.home.score !== null
  return (
    <div className="bracket-matchup">
      <div className={`bracket-team ${m.home.winner ? 'winner' : ''}`}>
        <div className="bracket-team-info">
          <span>{m.home.flag}</span>
          <span>{m.home.team}</span>
        </div>
        {hasScore && <span className="bracket-team-score">{m.home.score}</span>}
      </div>
      <div className={`bracket-team ${m.away.winner ? 'winner' : ''}`}>
        <div className="bracket-team-info">
          <span>{m.away.flag}</span>
          <span>{m.away.team}</span>
        </div>
        {hasScore && <span className="bracket-team-score">{m.away.score}</span>}
      </div>
    </div>
  )
}

function TBDMatchup() {
  return (
    <div className="bracket-matchup">
      <div className="bracket-team">
        <div className="bracket-team-info">
          <span>🏳️</span>
          <span className="tbd">TBD</span>
        </div>
      </div>
      <div className="bracket-team">
        <div className="bracket-team-info">
          <span>🏳️</span>
          <span className="tbd">TBD</span>
        </div>
      </div>
    </div>
  )
}
