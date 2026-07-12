import { roundKey } from './api.js'

// WC 2026: 32-team knockout (Round of 32 → Final) plus a third-place play-off.
// Total match slots per round, split evenly across the two sides of the tree.
const ROUND_SLOTS = { r32: 16, r16: 8, qf: 4, sf: 2, tp: 1, f: 1 }

// Split a round's matches into the left and right halves of the bracket,
// padding with nulls (TBD) up to the full slot count so the tree keeps its
// shape before results are in.
function halves(byRound, key) {
  const total = ROUND_SLOTS[key]
  const played = byRound[key] ?? []
  const padded = [
    ...played,
    ...Array.from({ length: Math.max(0, total - played.length) }, () => null),
  ].slice(0, total)
  const half = total / 2
  return { left: padded.slice(0, half), right: padded.slice(half) }
}

export default function Bracket({ matches }) {
  const byRound = {}
  for (const m of matches) {
    const r = roundKey(m)
    if (!r) continue
    ;(byRound[r] ??= []).push(m)
  }
  for (const r of Object.keys(byRound)) byRound[r].sort((a, b) => a.date - b.date)

  const hasAny = ['r32', 'r16', 'qf', 'sf', 'tp', 'f'].some(k => byRound[k]?.length)

  const r32 = halves(byRound, 'r32')
  const r16 = halves(byRound, 'r16')
  const qf = halves(byRound, 'qf')
  const sf = halves(byRound, 'sf')
  const final = (byRound.f ?? [])[0] ?? null
  const third = (byRound.tp ?? [])[0] ?? null

  return (
    <div className="bracket-wrapper">
      {!hasAny && (
        <div className="empty" style={{ marginBottom: 4 }}>
          <div className="e">🏆</div>
          <div>The knockout bracket fills in as results come in.</div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text2)' }}>
            Round of 32 begins after the group stage. Scroll sideways to see the
            full bracket.
          </div>
        </div>
      )}

      <div className="bracket-tree">
        {/* Left half — fans inward to the right */}
        <Column label="R32" side="left" cells={r32.left} />
        <Column label="R16" side="left" cells={r16.left} receives />
        <Column label="QF" side="left" cells={qf.left} receives />
        <Column label="SF" side="left" cells={sf.left} receives />

        {/* Center — the Final and third-place play-off */}
        <div className="bk-col center">
          <div className="bk-col-label">Final</div>
          <div className="bk-col-body bk-center-body">
            <div className="cell bk-final-cell">
              <Matchup match={final} champion />
            </div>
            <div className="bk-third">
              <div className="bk-col-label third">3rd Place</div>
              <div className="cell">
                <Matchup match={third} />
              </div>
            </div>
          </div>
        </div>

        {/* Right half — mirrors the left, fans inward to the left */}
        <Column label="SF" side="right" cells={sf.right} receives />
        <Column label="QF" side="right" cells={qf.right} receives />
        <Column label="R16" side="right" cells={r16.right} receives />
        <Column label="R32" side="right" cells={r32.right} />
      </div>
    </div>
  )
}

function Column({ label, cells, side, receives = false }) {
  return (
    <div className={`bk-col ${side} ${receives ? 'receives' : ''}`}>
      <div className="bk-col-label">{label}</div>
      <div className="bk-col-body">
        {cells.map((m, i) => (
          <div className="cell" key={m?.id ?? `${label}-${i}`}>
            <Matchup match={m} />
            {receives && <span className="bk-join" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function Matchup({ match: m, champion = false }) {
  if (!m) {
    return (
      <div className={`bracket-matchup ${champion ? 'final' : ''}`}>
        <Team />
        <Team />
      </div>
    )
  }
  const hasScore = m.home.score !== null
  return (
    <div className={`bracket-matchup ${champion ? 'final' : ''}`}>
      <Team team={m.home} score={hasScore ? m.home.score : null} />
      <Team team={m.away} score={hasScore ? m.away.score : null} />
    </div>
  )
}

function Team({ team, score }) {
  // Undecided slot — either no competitor object, or ESPN returned a
  // placeholder whose name is empty/"TBD". Keep the bracket's shape but render
  // it quietly instead of a loud "🏳️ TBD".
  if (!team || !team.team || team.team === 'TBD') {
    return (
      <div className="bracket-team empty">
        <div className="bracket-team-info">
          <span className="tbd-slot">–</span>
        </div>
      </div>
    )
  }
  return (
    <div className={`bracket-team ${team.winner ? 'winner' : ''}`}>
      <div className="bracket-team-info">
        <span>{team.flag}</span>
        <span>{team.team}</span>
      </div>
      {score !== null && <span className="bracket-team-score">{score}</span>}
    </div>
  )
}
