// "How it works" — verification surface, story-driven 4-step layout

const { useState: useStateHow, useMemo: useMemoHow } = React;

/* ── Selection algorithm code (verbatim) ────────────────────────────── */

const ALGORITHM_CODE = {
  rust: [
    { ln: 1,  tokens: [['com', '// powerball::draw — runs at every 15-min slot boundary']] },
    { ln: 2,  tokens: [['key', 'pub fn '], ['fn', 'select_winner'], ['pun', '('], ['pun', 'round'], ['pun', ': '], ['typ', '&Round'], ['pun', ', '], ['pun', 'holders'], ['pun', ': '], ['typ', '&[Holder]'], ['pun', ') -> '], ['typ', 'Option<Pubkey>'], ['pun', ' {']] },
    { ln: 3,  tokens: [['pun', '    '], ['key', 'let '], ['pun', 'eligible '], ['pun', '= holders.'], ['fn', 'iter'], ['pun', '()']] },
    { ln: 4,  tokens: [['pun', '        .'], ['fn', 'filter'], ['pun', '(|h| h.balance_pct >= '], ['num', '0.002'], ['pun', ')  '], ['com', '// 0.2% threshold']] },
    { ln: 5,  tokens: [['pun', '        .'], ['fn', 'collect'], ['pun', '::<'], ['typ', 'Vec<_>'], ['pun', '>();']] },
    { ln: 6,  tokens: [['pun', '']] },
    { ln: 7,  tokens: [['pun', '    '], ['key', 'if '], ['pun', 'eligible.'], ['fn', 'is_empty'], ['pun', '() { '], ['key', 'return '], ['typ', 'None'], ['pun', '; }  '], ['com', '// → rollover']] },
    { ln: 8,  tokens: [['pun', '']] },
    { ln: 9,  tokens: [['com', '    // weight = balance% × (1 + min(0.5, streak / 50))']] },
    { ln: 10, tokens: [['pun', '    '], ['key', 'let '], ['pun', 'weights'], ['pun', ': '], ['typ', 'Vec<u64>'], ['pun', ' = eligible.'], ['fn', 'iter'], ['pun', '()']] },
    { ln: 11, tokens: [['pun', '        .'], ['fn', 'map'], ['pun', '(|h| {']] },
    { ln: 12, tokens: [['pun', '            '], ['key', 'let '], ['pun', 'boost = '], ['fn', 'min'], ['pun', '('], ['num', '0.5'], ['pun', ', h.streak '], ['key', 'as '], ['typ', 'f64'], ['pun', ' / '], ['num', '50.0'], ['pun', ');']] },
    { ln: 13, tokens: [['pun', '            (h.balance_pct * ('], ['num', '1.0'], ['pun', ' + boost) * '], ['num', '1_000_000.0'], ['pun', ') '], ['key', 'as '], ['typ', 'u64']] },
    { ln: 14, tokens: [['pun', '        }).'], ['fn', 'collect'], ['pun', '();']] },
    { ln: 15, tokens: [['pun', '']] },
    { ln: 16, tokens: [['pun', '    '], ['key', 'let '], ['pun', 'total'], ['pun', ': '], ['typ', 'u64'], ['pun', ' = weights.'], ['fn', 'iter'], ['pun', '().'], ['fn', 'sum'], ['pun', '();']] },
    { ln: 17, tokens: [['com', '    // randomness = Solana slot hash @ commit_slot — public, verifiable']] },
    { ln: 18, tokens: [['pun', '    '], ['key', 'let '], ['pun', 'roll = '], ['fn', 'u64::from_le_bytes'], ['pun', '(round.seed[..'], ['num', '8'], ['pun', '].'], ['fn', 'try_into'], ['pun', '()?) % total;']] },
    { ln: 19, tokens: [['pun', '']] },
    { ln: 20, tokens: [['com', '    // walk cumulative weights — first bucket containing roll wins']] },
    { ln: 21, tokens: [['pun', '    '], ['key', 'let mut '], ['pun', 'cum = '], ['num', '0u64'], ['pun', ';']] },
    { ln: 22, tokens: [['pun', '    '], ['key', 'for '], ['pun', '(i, w) '], ['key', 'in '], ['pun', 'weights.'], ['fn', 'iter'], ['pun', '().'], ['fn', 'enumerate'], ['pun', '() {']] },
    { ln: 23, tokens: [['pun', '        cum += w;']] },
    { ln: 24, tokens: [['pun', '        '], ['key', 'if '], ['pun', 'roll < cum { '], ['key', 'return '], ['typ', 'Some'], ['pun', '(eligible[i].pubkey); }']] },
    { ln: 25, tokens: [['pun', '    }']] },
    { ln: 26, tokens: [['typ', '    None']] },
    { ln: 27, tokens: [['pun', '}']] },
  ],
  ts: [
    { ln: 1,  tokens: [['com', '// Reference implementation — recompute any past round from snapshot + seed']] },
    { ln: 2,  tokens: [['key', 'export function '], ['fn', 'selectWinner'], ['pun', '('], ['pun', 'snapshot'], ['pun', ': '], ['typ', 'Holder[]'], ['pun', ', '], ['pun', 'seed'], ['pun', ': '], ['typ', 'Buffer'], ['pun', ') {']] },
    { ln: 3,  tokens: [['pun', '  '], ['key', 'const '], ['pun', 'eligible = snapshot.'], ['fn', 'filter'], ['pun', '(h '], ['key', '=>'], ['pun', ' h.balancePct >= '], ['num', '0.002'], ['pun', ');']] },
    { ln: 4,  tokens: [['pun', '  '], ['key', 'if '], ['pun', '(eligible.length === '], ['num', '0'], ['pun', ') '], ['key', 'return null'], ['pun', ';']] },
    { ln: 5,  tokens: [['pun', '']] },
    { ln: 6,  tokens: [['pun', '  '], ['key', 'const '], ['pun', 'weights = eligible.'], ['fn', 'map'], ['pun', '(h '], ['key', '=>'], ['pun', ' {']] },
    { ln: 7,  tokens: [['pun', '    '], ['key', 'const '], ['pun', 'boost = '], ['typ', 'Math'], ['pun', '.'], ['fn', 'min'], ['pun', '('], ['num', '0.5'], ['pun', ', h.streak / '], ['num', '50'], ['pun', ');']] },
    { ln: 8,  tokens: [['pun', '    '], ['key', 'return '], ['typ', 'BigInt'], ['pun', '('], ['typ', 'Math'], ['pun', '.'], ['fn', 'floor'], ['pun', '(h.balancePct * ('], ['num', '1'], ['pun', ' + boost) * '], ['num', '1e6'], ['pun', '));']] },
    { ln: 9,  tokens: [['pun', '  });']] },
    { ln: 10, tokens: [['pun', '']] },
    { ln: 11, tokens: [['pun', '  '], ['key', 'const '], ['pun', 'total = weights.'], ['fn', 'reduce'], ['pun', '((a, b) '], ['key', '=>'], ['pun', ' a + b, '], ['num', '0n'], ['pun', ');']] },
    { ln: 12, tokens: [['pun', '  '], ['key', 'const '], ['pun', 'roll = seed.'], ['fn', 'readBigUInt64LE'], ['pun', '('], ['num', '0'], ['pun', ') % total;']] },
    { ln: 13, tokens: [['pun', '']] },
    { ln: 14, tokens: [['pun', '  '], ['key', 'let '], ['pun', 'cum = '], ['num', '0n'], ['pun', ';']] },
    { ln: 15, tokens: [['pun', '  '], ['key', 'for '], ['pun', '('], ['key', 'let '], ['pun', 'i = '], ['num', '0'], ['pun', '; i < eligible.length; i++) {']] },
    { ln: 16, tokens: [['pun', '    cum += weights[i];']] },
    { ln: 17, tokens: [['pun', '    '], ['key', 'if '], ['pun', '(roll < cum) '], ['key', 'return '], ['pun', 'eligible[i].pubkey;']] },
    { ln: 18, tokens: [['pun', '  }']] },
    { ln: 19, tokens: [['pun', '}']] },
  ],
};

function CodeLine({ line }) {
  return (
    <div className="code-line">
      <span className="code-ln">{line.ln}</span>
      <span className="code-content">
        {line.tokens.map(([cls, txt], i) => (
          <span key={i} className={`tk-${cls}`}>{txt}</span>
        ))}
      </span>
    </div>
  );
}

function CodeBlock() {
  const [tab, setTab] = useStateHow('rust');
  const lines = ALGORITHM_CODE[tab];
  return (
    <div className="code-block">
      <div className="code-tabs">
        <button className={`code-tab ${tab === 'rust' ? 'is-active' : ''}`} onClick={() => setTab('rust')}>
          <span className="lang-dot"></span>
          program.rs
        </button>
        <button className={`code-tab ${tab === 'ts' ? 'is-active' : ''}`} onClick={() => setTab('ts')}>
          <span className="lang-dot" style={{background: '#79CDFF'}}></span>
          verify.ts
        </button>
      </div>
      <div className="code-body">
        {lines.map((l) => <CodeLine key={l.ln} line={l} />)}
      </div>
      <div className="code-foot">
        <span>↳ exact code that runs on chain</span>
        <a href="#" onClick={(e) => e.preventDefault()}>github.com/printr/powerball ↗</a>
      </div>
    </div>
  );
}

/* ── Step 1: Threshold visual ───────────────────────────────────────── */

function ThresholdViz() {
  const rows = [
    { addr: '7xKz…wAa', pct: 1.40, in: true },
    { addr: 'Pq2s…2Bm', pct: 0.92, in: true },
    { addr: 'Hf3R…0Ma', pct: 0.61, in: true },
    { addr: '4zN9…AyTm', pct: 0.34, in: true },
    { addr: 'Mj4H…nPxa', pct: 0.18, in: false },
    { addr: 'Lk6H…wPa',  pct: 0.07, in: false },
  ];
  const max = 1.6;
  const thresholdLeft = (0.2 / max) * 100;
  return (
    <div className="how-visual">
      <div className="threshold-viz">
        {rows.map((r, i) => (
          <div key={i} className="threshold-row">
            <span className="threshold-addr">{r.addr}</span>
            <div className="threshold-bar">
              <div
                className={`threshold-fill ${r.in ? 'is-in' : 'is-out'}`}
                style={{ width: `${(r.pct / max) * 100}%` }}
              ></div>
              {i === 0 && <div className="threshold-line" style={{ left: `${thresholdLeft}%` }}></div>}
              {i !== 0 && <div className="threshold-line" style={{ left: `${thresholdLeft}%`, opacity: 0.25 }}></div>}
            </div>
            <span className={`threshold-pct ${r.in ? 'is-in' : 'is-out'}`}>{r.pct.toFixed(2)}%</span>
          </div>
        ))}
      </div>
      <div className="threshold-caption">
        <span><span className="in-count">● 4 eligible</span></span>
        <span><span className="out-count">○ 2 below threshold</span></span>
      </div>
    </div>
  );
}

/* ── Step 2: Formula ─────────────────────────────────────────────────── */

function FormulaCard() {
  return (
    <div className="formula-card">
      <div className="formula-display">
        <span className="var">weight</span>
        <span className="op">=</span>
        <span className="var">balance%</span>
        <span className="op">×</span>
        <span className="paren">(</span>
        <span className="num">1</span>
        <span className="op">+</span>
        <span>min</span>
        <span className="paren">(</span>
        <span className="num">0.5</span>
        <span className="op">,</span>
        <span className="var">streak</span>
        <span className="op">/</span>
        <span className="num">50</span>
        <span className="paren">))</span>
      </div>
      <div className="formula-vars">
        <div className="formula-var-item">
          <div className="formula-var-name">balance%</div>
          <div className="formula-var-desc">your share of $BALL supply</div>
        </div>
        <div className="formula-var-item">
          <div className="formula-var-name">streak</div>
          <div className="formula-var-desc">consecutive eligible rounds</div>
        </div>
        <div className="formula-var-item">
          <div className="formula-var-name">min(0.5, …)</div>
          <div className="formula-var-desc">loyalty boost, caps at 1.5×</div>
        </div>
        <div className="formula-var-item">
          <div className="formula-var-name">25 rounds</div>
          <div className="formula-var-desc">≈ 6 hours to max boost</div>
        </div>
      </div>
    </div>
  );
}

/* ── Step 3: Randomness flow ─────────────────────────────────────────── */

function RandomnessFlow() {
  return (
    <div className="how-visual">
      <div className="random-flow">
        <div className="random-stage">
          <div className="random-icon">1</div>
          <div className="random-content">
            <div className="random-label">commit slot · t–60s</div>
            <div className="random-value">slot 287 443 210</div>
          </div>
        </div>
        <div className="random-stage">
          <div className="random-icon">2</div>
          <div className="random-content">
            <div className="random-label">slot hash becomes seed</div>
            <div className="random-value is-seed">0x9f3c…a217e4b8</div>
          </div>
        </div>
        <div className="random-stage">
          <div className="random-icon">3</div>
          <div className="random-content">
            <div className="random-label">u64(seed[0..8]) mod total</div>
            <div className="random-value">11 463 988 042 …</div>
          </div>
        </div>
        <div className="random-stage">
          <div className="random-icon is-final">◆</div>
          <div className="random-content">
            <div className="random-label">the roll</div>
            <div className="random-value is-roll">1 847 392</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Step 4: Number-line picker ──────────────────────────────────────── */

function NumberLine() {
  const data = useMemoHow(() => {
    const holders = [
      { addr: '7xKz…wAa', pct: 1.40, streak: 12, color: '#00E59D' },
      { addr: 'Pq2s…2Bm', pct: 0.92, streak: 5,  color: '#8B5CF6' },
      { addr: 'Hf3R…0Ma', pct: 0.61, streak: 22, color: '#FFC940' },
      { addr: '4zN9…AyTm', pct: 0.34, streak: 3,  color: '#FF4D5E' },
    ];
    const enriched = holders.map(h => {
      const boost = Math.min(0.5, h.streak / 50);
      const weight = Math.floor(h.pct * (1 + boost) * 1e6);
      return { ...h, weight };
    });
    const total = enriched.reduce((s, h) => s + h.weight, 0);
    let cum = 0;
    const segs = enriched.map(h => {
      const lo = cum;
      cum += h.weight;
      return { ...h, lo, hi: cum, share: h.weight / total };
    });
    const roll = 1_847_392;
    const winnerIdx = segs.findIndex(s => roll < s.hi);
    return { segs, total, roll, winnerIdx };
  }, []);

  return (
    <div className="how-visual numline-card">
      <div className="numline-roll-display">
        <span className="numline-roll-label">the roll</span>
        <span className="numline-roll-value">{data.roll.toLocaleString()}</span>
      </div>
      <div className="numline-bar">
        {data.segs.map((s, i) => (
          <div
            key={i}
            className={`numline-seg ${i === data.winnerIdx ? 'is-winner' : ''}`}
            style={{
              width: `${s.share * 100}%`,
              background: i === data.winnerIdx
                ? 'rgba(255, 201, 64, 0.18)'
                : `${s.color}1f`,
              color: s.color,
            }}
            title={`${s.addr}: ${s.lo.toLocaleString()}–${s.hi.toLocaleString()}`}
          >
            {s.share > 0.12 ? s.addr : ''}
          </div>
        ))}
        <div
          className="numline-marker"
          style={{ left: `${(data.roll / data.total) * 100}%` }}
        ></div>
      </div>
      <div className="numline-axis">
        <span>0</span>
        <span>{data.total.toLocaleString()}</span>
      </div>

      <div className="numline-legend">
        {data.segs.map((s, i) => (
          <div key={i} className={`numline-legend-row ${i === data.winnerIdx ? 'is-winner' : ''}`}>
            <span className="numline-swatch" style={{ background: s.color }}></span>
            <span className="numline-addr">{s.addr}</span>
            <span className="numline-range">{s.lo.toLocaleString()} – {s.hi.toLocaleString()}</span>
            <span className="numline-share">{(s.share * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>

      <div className="numline-winner-callout">
        Roll {data.roll.toLocaleString()} lands in {data.segs[data.winnerIdx].addr}'s bucket → winner
      </div>
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────────────────── */

function HowItWorks() {
  return (
    <section className="how-section" id="how-it-works" data-screen-label="How it works">
      <div className="shell">
        <div className="how-intro">
          <div>
            <div className="how-eyebrow">How it works</div>
            <h2 className="how-headline">
              No tickets. No sign-ups.<br />
              Just <em>hold</em>, and the chain picks.
            </h2>
          </div>
          <p className="how-deck">
            Every 15 minutes, an on-chain program filters holders, weights them, rolls a verifiable
            random number, and pays out. <strong>You can recompute any past round yourself.</strong>
          </p>
        </div>

        <div className="how-steps">
          {/* Step 1 */}
          <div className="how-step">
            <div className="how-step-text">
              <div className="how-step-num"><span>01</span> · Eligibility</div>
              <h3 className="how-step-title">Hold ≥ 0.2% to qualify.</h3>
              <p className="how-step-body">
                A snapshot of every $BALL holder is taken at the moment of draw. Anyone holding
                at least <strong>0.2% of supply</strong> is in the running.
              </p>
              <p className="how-step-body">
                Sell below the line — even briefly — and you're out for that round.
                No grace period, no exceptions.
              </p>
            </div>
            <div className="how-step-visual">
              <ThresholdViz />
            </div>
          </div>

          {/* Step 2 */}
          <div className="how-step is-flipped">
            <div className="how-step-text">
              <div className="how-step-num"><span>02</span> · Weighting</div>
              <h3 className="how-step-title">Bigger bag wins more often. Loyalty pays a bonus.</h3>
              <p className="how-step-body">
                Your odds aren't just balance. Every consecutive round you stay eligible builds a{' '}
                <strong>streak</strong>, which adds up to a <strong>1.5× boost</strong> after 25 rounds (~6 hours).
              </p>
              <p className="how-step-body">
                Drop out for one round and the streak resets to zero.
              </p>
            </div>
            <div className="how-step-visual">
              <FormulaCard />
            </div>
          </div>

          {/* Step 3 */}
          <div className="how-step">
            <div className="how-step-text">
              <div className="how-step-num"><span>03</span> · Randomness</div>
              <h3 className="how-step-title">The chain picks the number, not us.</h3>
              <p className="how-step-body">
                Each round commits to a <strong>future Solana slot</strong> before holders are weighted.
                When that slot lands, its block hash becomes the seed — public, immutable,
                impossible to game once committed.
              </p>
              <p className="how-step-body">
                We take the first 8 bytes <code>mod total_weight</code>. That's the roll.
              </p>
            </div>
            <div className="how-step-visual">
              <RandomnessFlow />
            </div>
          </div>

          {/* Step 4 */}
          <div className="how-step is-flipped">
            <div className="how-step-text">
              <div className="how-step-num"><span>04</span> · Selection</div>
              <h3 className="how-step-title">Lay every weight on a number line. The roll picks one.</h3>
              <p className="how-step-body">
                Each eligible holder gets a slice of the line proportional to their weight.
                Whichever slice the roll lands in — that's the winner.
              </p>
              <p className="how-step-body">
                Bigger weight = wider slice = better odds. Math, not magic.
                <strong> No house edge. No vesting. No cut.</strong> If nobody's eligible, the prize
                rolls into the next round and the pool grows.
              </p>
            </div>
            <div className="how-step-visual">
              <NumberLine />
            </div>
          </div>
        </div>

        {/* Code reveal */}
        <div className="how-code-reveal">
          <div className="how-code-header">
            <div>
              <h3>The exact code that runs on chain.</h3>
              <p>
                Audit it, fork it, or use the reference TS implementation to verify any round
                against the snapshot and seed yourself.
              </p>
            </div>
          </div>
          <CodeBlock />
        </div>
      </div>
    </section>
  );
}

window.PB_HOW = { HowItWorks };
