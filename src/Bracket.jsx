import { roundOf, winnerName } from './api.js'

// Levels of the knockout tree, small index = closer to Round of 32.
const R32 = 0, R16 = 1, QF = 2, SF = 3

// Pull the winner that fed into a parent slot out of a pool of feeder matches,
// marking it used so the same match can't fill two slots.
function takeFeeder(pool, teamName, used) {
  if (!teamName || teamName === 'TBD') return null
  const found = pool.find(m => !used.has(m.id) && winnerName(m) === teamName)
  if (found) used.add(found.id)
  return found ?? null
}

// Build a subtree rooted at `match` (at `level`) down to the Round of 32,
// linking each child by which feeder match its participant won. Always returns
// a full-depth node so the rendered bracket keeps its shape when data is missing.
function buildNode(match, level, pools, used) {
  if (level === R32) return { match, children: [] }
  const pool = pools[level - 1]
  let home = null, away = null
  if (match) {
    home = takeFeeder(pool, match.home?.team, used)
    away = takeFeeder(pool, match.away?.team, used)
  }
  return {
    match,
    children: [
      buildNode(home, level - 1, pools, used),
      buildNode(away, level - 1, pools, used),
    ],
  }
}

// Matches at `target` level, top-to-bottom (in-order traversal of the subtree).
function levelOrder(node, level, target) {
  if (level === target) return [node.match]
  return [
    ...levelOrder(node.children[0], level - 1, target),
    ...levelOrder(node.children[1], level - 1, target),
  ]
}

export default function Bracket({ matches }) {
  const byRound = {}
  for (const m of matches) {
    const r = roundOf(m)
    if (!r) continue
    ;(byRound[r] ??= []).push(m)
  }
  for (const r of Object.keys(byRound)) byRound[r].sort((a, b) => a.date - b.date)

  const hasAny = ['r32', 'r16', 'qf', 'sf', 'tp', 'f'].some(k => byRound[k]?.length)
  const pools = { [R32]: byRound.r32 ?? [], [R16]: byRound.r16 ?? [], [QF]: byRound.qf ?? [] }
  const sfList = byRound.sf ?? []
  const finalM = (byRound.f ?? [])[0] ?? null
  const third = (byRound.tp ?? [])[0] ?? null

  // Anchor each half of the bracket on a semi-final and reconstruct downward.
  // Order the two SFs so the left half feeds the Final's home side when known.
  let leftSf = sfList[0] ?? null, rightSf = sfList[1] ?? null
  if (finalM && sfList.length === 2) {
    const feedsHome = sfList.find(s => {
      const w = winnerName(s)
      return w && (w === finalM.home?.team || w === finalM.away?.team)
        ? w === finalM.home?.team
        : s.home?.team === finalM.home?.team || s.away?.team === finalM.home?.team
    })
    if (feedsHome) { leftSf = feedsHome; rightSf = sfList.find(s => s !== feedsHome) ?? null }
  }

  const used = new Set()
  const left = buildNode(leftSf, SF, pools, used)
  const right = buildNode(rightSf, SF, pools, used)

  return (
    <div className="bracket-wrapper">
      {!hasAny && (
        <div className="empty" style={{ marginBottom: 4 }}>
          <div className="e">🏆</div>
          <div>The knockout bracket fills in as results come in.</div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text2)' }}>
            Scroll sideways to see the full bracket.
          </div>
        </div>
      )}

      <div className="bracket-tree">
        <Column label="R32" side="left" cells={levelOrder(left, SF, R32)} />
        <Column label="R16" side="left" cells={levelOrder(left, SF, R16)} receives />
        <Column label="QF" side="left" cells={levelOrder(left, SF, QF)} receives />
        <Column label="SF" side="left" cells={[leftSf]} receives />

        <div className="bk-col center">
          <div className="bk-col-label">Final</div>
          <div className="bk-col-body bk-center-body">
            <div className="cell bk-final-cell">
              <Matchup match={finalM} champion />
            </div>
            <div className="bk-third">
              <div className="bk-col-label third">3rd Place</div>
              <div className="cell">
                <Matchup match={third} />
              </div>
            </div>
          </div>
        </div>

        <Column label="SF" side="right" cells={[rightSf]} receives />
        <Column label="QF" side="right" cells={levelOrder(right, SF, QF)} receives />
        <Column label="R16" side="right" cells={levelOrder(right, SF, R16)} receives />
        <Column label="R32" side="right" cells={levelOrder(right, SF, R32)} />
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

// Match kickoff formatted in US Pacific time, e.g. "Jul 14 · 3:00 PM PT".
function formatPT(date) {
  if (!date || Number.isNaN(date.getTime())) return null
  const s = date.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${s.replace(', ', ' · ')} PT`
}

function Matchup({ match: m, champion = false }) {
  const cls = `bracket-matchup ${champion ? 'final' : ''}`
  if (!m) {
    return <div className={cls}><Team /><Team /></div>
  }
  const hasScore = m.home.score !== null
  const when = formatPT(m.date)
  return (
    <div className={cls}>
      {when && <div className="bk-matchup-time">{when}</div>}
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
