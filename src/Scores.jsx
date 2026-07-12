export default function Scores({ matches }) {
  if (!matches.length) {
    return (
      <div className="empty">
        <div className="e">⚽</div>
        No matches found. Check back soon!
      </div>
    )
  }

  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const sameDay = (d, ref) =>
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  const byTime = (a, b) => a.date - b.date

  const live = matches.filter(m => m.statusType === 'STATUS_IN_PROGRESS').sort(byTime)
  const todayGames = matches
    .filter(m => m.statusType !== 'STATUS_IN_PROGRESS' && sameDay(m.date, now))
    .sort(byTime)
  const tomorrowGames = matches
    .filter(m => m.statusType !== 'STATUS_IN_PROGRESS' && sameDay(m.date, tomorrow))
    .sort(byTime)

  const sections = []
  if (live.length) sections.push({ label: '🔴 Live Now', games: live })
  if (todayGames.length) sections.push({ label: "Today's Matches", games: todayGames })
  if (tomorrowGames.length) sections.push({ label: 'Tomorrow', games: tomorrowGames })

  if (!sections.length) {
    return (
      <div className="empty">
        <div className="e">⚽</div>
        No matches today or tomorrow. Check back soon!
      </div>
    )
  }

  return (
    <div>
      {sections.map(sec => (
        <div key={sec.label}>
          <div className="section-header">{sec.label}</div>
          {sec.games.map(m => <MatchCard key={m.id} match={m} />)}
        </div>
      ))}
    </div>
  )
}

export function MatchCard({ match: m }) {
  const isLive = m.statusType === 'STATUS_IN_PROGRESS'
  const isFinal = m.statusType === 'STATUS_FINAL' || m.statusType === 'STATUS_FULL_TIME'
  const hasScore = m.home.score !== null

  return (
    <div className="match-card">
      <div className="match-meta">
        {isLive && (
          <span className="live-badge">
            <span className="live-dot" />
            Live
          </span>
        )}
        <span>{m.group ? m.group.toUpperCase() : 'World Cup 2026'}</span>
        {m.venue && <span>· {m.venue}</span>}
      </div>
      <div className="match-body">
        <div className="match-team">
          <div className="team-flag-name">
            <span className="team-flag">{m.home.flag}</span>
            <span className="team-name">{m.home.team}</span>
          </div>
        </div>

        <div className="match-center">
          {hasScore ? (
            <div className="score-display">
              <span className="score-num" style={m.home.winner ? { color: 'var(--green)' } : {}}>
                {m.home.score}
              </span>
              <span className="score-dash">–</span>
              <span className="score-num" style={m.away.winner ? { color: 'var(--green)' } : {}}>
                {m.away.score}
              </span>
            </div>
          ) : (
            <span className="vs-text">vs</span>
          )}
          <div className={`match-status ${isLive ? 'status-live' : isFinal ? 'status-ft' : 'status-upcoming'}`}>
            {isLive
              ? `${m.displayClock} ${m.period > 0 ? `(${m.period}')` : ''}`
              : isFinal
              ? 'FT'
              : m.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div className="match-team away">
          <div className="team-flag-name">
            <span className="team-name">{m.away.team}</span>
            <span className="team-flag">{m.away.flag}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
