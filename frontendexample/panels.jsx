// Leaderboard, Activity Feed, Recent Winners, Stats

const { useState: useStateLB, useEffect: useEffectLB, useRef: useRefLB, useMemo: useMemoLB } = React;
const { fmtAmount: fmtAmt, fmtPct, shortAddr: shortA, pickAddr: pickA, RECENT_WINNERS, STATS, EVENT_TEMPLATES, TXS } = window.PB_DATA;

function Leaderboard({ rows, density, totalEligible }) {
  const [query, setQuery] = useStateLB('');
  const [showCount, setShowCount] = useStateLB(12);
  const filtered = useMemoLB(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter(r => r.addr.toLowerCase().includes(q));
  }, [rows, query]);
  const visible = filtered.slice(0, showCount);
  const maxOdds = Math.max(...rows.map(r => r.odds), 1);

  const copyAddr = (addr, e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(addr).catch(() => {});
    window.dispatchEvent(new CustomEvent('pb-toast', { detail: 'Address copied' }));
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">
          <span className="dot"></span>
          Leaderboard
          <span style={{color: 'var(--text-muted)', marginLeft: 4}}>· {totalEligible} eligible</span>
        </span>
        <div className="panel-controls">
          <input
            className="search-input"
            placeholder="Search wallet…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="lb-empty">
          {query ? 'No matches.' : 'No eligible holders yet — be the first to qualify.'}
        </div>
      ) : density === 'card' ? (
        <div className="lb-cards">
          {visible.map((r, i) => (
            <div key={r.addr} className="lb-card-row">
              <div className={`lb-card-rank ${i === 0 ? 'is-top' : ''}`}>
                {i === 0 ? '◆' : `#${i + 1}`}
              </div>
              <div>
                <div className="lb-card-wallet" onClick={(e) => copyAddr(r.addr, e)} style={{cursor: 'pointer'}}>
                  {shortA(r.addr)}
                </div>
                <div className="lb-card-meta">
                  {fmtPct(r.pct)} · streak {r.streak}{r.streak >= 10 ? ' 🔥' : ''}
                </div>
              </div>
              <div className="lb-card-odds">{fmtPct(r.odds)}</div>
              <div className="lb-card-weight">w {r.weight}</div>
            </div>
          ))}
        </div>
      ) : (
        <table className={`lb-table density-${density}`}>
          <thead>
            <tr>
              <th>#</th>
              <th>Wallet</th>
              <th>Holdings</th>
              <th>Streak</th>
              <th>Weight</th>
              <th style={{textAlign: 'right'}}>Odds</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={r.addr}>
                <td className={`lb-rank ${i === 0 ? 'is-top' : ''}`}>
                  {i === 0 ? '◆' : i + 1}
                </td>
                <td>
                  <div className="lb-wallet" onClick={(e) => copyAddr(r.addr, e)} style={{cursor: 'pointer'}}>
                    <span>{shortA(r.addr)}</span>
                    <span className="copy">copy</span>
                  </div>
                </td>
                <td className="lb-holdings">
                  <span className="pct">{fmtPct(r.pct)}</span>
                  <span className="raw">{(r.balance / 1e6).toFixed(2)}M $BALL</span>
                </td>
                <td className={`lb-streak ${r.streak >= 10 ? 'is-hot' : ''}`}>
                  {r.streak >= 10 ? '🔥 ' : ''}{r.streak}
                </td>
                <td className="lb-weight">{r.weight}</td>
                <td className="lb-odds-cell">
                  <div className="lb-odds-bar" style={{transform: `scaleX(${r.odds / maxOdds})`}}></div>
                  <span>{fmtPct(r.odds)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {filtered.length > showCount && (
        <button className="lb-load-more" onClick={() => setShowCount(c => c + 12)}>
          Load more · {filtered.length - showCount} hidden
        </button>
      )}
    </div>
  );
}

function ActivityFeed({ events }) {
  return (
    <div className="panel feed">
      <div className="panel-head">
        <span className="panel-title">
          <span className="dot"></span>
          Live Activity
        </span>
        <span style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)'}}>
          newest first
        </span>
      </div>
      <div className="feed-list">
        {events.length === 0 ? (
          <div className="lb-empty">Waiting for the first event…</div>
        ) : events.map((e) => (
          <div key={e.id} className="feed-item">
            <div className={`feed-icon tone-${e.tone}`}>{e.icon}</div>
            <div>
              <div className="feed-text" dangerouslySetInnerHTML={{__html: e.text}} />
              {e.tx && (
                <div className="feed-sub">
                  <a href="#" onClick={(ev) => ev.preventDefault()}>{e.tx.slice(0, 6)}…{e.tx.slice(-4)}<span className="ext">↗</span></a>
                </div>
              )}
            </div>
            <div className="feed-time">{e.timeLabel}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentWinners({ winners }) {
  return (
    <section className="section">
      <div className="shell">
        <div className="section-head">
          <span className="section-title">
            Recent Winners
            <span className="count">· last 4 rounds</span>
          </span>
        </div>
        <div className="winners-grid">
          {winners.map((w, i) => (
            <div key={w.round} className={`winner-card ${i === 0 ? 'is-recent' : ''}`}>
              <div className="winner-card-head">
                <span>#{w.round}</span>
                <span>{w.ago}</span>
              </div>
              <div className="winner-card-prize">
                <span className="diamond">◆</span>
                {fmtAmt(w.prize)}
                <span className="unit">SOL</span>
              </div>
              <div className="winner-card-addr">{shortA(w.addr)}</div>
              <div className="winner-card-foot">
                <span>odds {w.oddsAt}%</span>
                <a href="#" onClick={(e) => e.preventDefault()}>payout ↗</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsStrip() {
  return (
    <section className="section">
      <div className="shell">
        <div className="stats-strip">
          <div className="stat">
            <div className="stat-label">Total paid out</div>
            <div className="stat-value">
              <span className="diamond">◆</span>
              {fmtAmt(STATS.totalPaid, 1)}
              <span className="unit">SOL</span>
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Rounds completed</div>
            <div className="stat-value">{STATS.rounds.toLocaleString()}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Biggest single win</div>
            <div className="stat-value">
              <span className="diamond">◆</span>
              {fmtAmt(STATS.biggestWin, 2)}
              <span className="unit">SOL</span>
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Unique winners</div>
            <div className="stat-value">{STATS.uniqueWinners}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="shell">
      <div className="footer">
        <div className="footer-links">
          <a href="#" onClick={(e) => e.preventDefault()}>How it works</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Verify a round</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Contract ↗</a>
          <a href="#" onClick={(e) => e.preventDefault()}>GitHub ↗</a>
        </div>
        <div className="footer-meta">
          PRINTRBALL · Built on PRINTR · Solana · No house edge
        </div>
      </div>
    </footer>
  );
}

window.PB_PANELS = { Leaderboard, ActivityFeed, RecentWinners, StatsStrip, Footer };
