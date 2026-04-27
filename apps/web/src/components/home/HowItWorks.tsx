"use client";

function ThresholdViz() {
  const rows = [
    { addr: "7xKz…wAa", pct: 1.4, in: true },
    { addr: "Pq2s…2Bm", pct: 0.92, in: true },
    { addr: "Hf3R…0Ma", pct: 0.61, in: true },
    { addr: "4zN9…AyTm", pct: 0.34, in: true },
    { addr: "Mj4H…nPxa", pct: 0.18, in: false },
    { addr: "Lk6H…wPa", pct: 0.07, in: false },
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
                className={`threshold-fill ${r.in ? "is-in" : "is-out"}`}
                style={{ width: `${(r.pct / max) * 100}%` }}
              />
              {i === 0 ? (
                <div className="threshold-line" style={{ left: `${thresholdLeft}%` }} />
              ) : (
                <div className="threshold-line" style={{ left: `${thresholdLeft}%`, opacity: 0.25 }} />
              )}
            </div>
            <span className={`threshold-pct ${r.in ? "is-in" : "is-out"}`}>{r.pct.toFixed(2)}%</span>
          </div>
        ))}
      </div>
      <div className="threshold-caption">
        <span>
          <span className="in-count">● 4 eligible</span>
        </span>
        <span>
          <span className="out-count">○ 2 below threshold</span>
        </span>
      </div>
    </div>
  );
}

function EqualFormulaCard() {
  return (
    <div className="formula-card">
      <div className="formula-display">
        <span className="var">index</span>
        <span className="op">=</span>
        <span className="typ">Number</span>
        <span className="paren">(</span>
        <span className="typ">BigInt</span>
        <span className="paren">(</span>
        <span className="str">{`'0x'`}</span>
        <span className="op">+</span>
        <span className="var">seed</span>
        <span className="paren">)</span>
        <span className="op">%</span>
        <span className="typ">BigInt</span>
        <span className="paren">(</span>
        <span className="var">N</span>
        <span className="paren">))</span>
      </div>
      <div className="formula-vars">
        <div className="formula-var-item">
          <div className="formula-var-name">N</div>
          <div className="formula-var-desc">count of eligible wallets after sorting by address</div>
        </div>
        <div className="formula-var-item">
          <div className="formula-var-name">seed</div>
          <div className="formula-var-desc">32 hex chars from server-side crypto.randomBytes(16)</div>
        </div>
        <div className="formula-var-item">
          <div className="formula-var-name">winner</div>
          <div className="formula-var-desc">sortedAddresses[index] — identical odds for every row</div>
        </div>
        <div className="formula-var-item">
          <div className="formula-var-name">1 / N</div>
          <div className="formula-var-desc">no weights, streaks, or loyalty multipliers in v1</div>
        </div>
      </div>
    </div>
  );
}

function RandomnessV1() {
  return (
    <div className="how-visual">
      <div className="random-flow">
        <div className="random-stage">
          <div className="random-icon">1</div>
          <div className="random-content">
            <div className="random-label">snapshot</div>
            <div className="random-value">Sort eligible wallets lexicographically by pubkey</div>
          </div>
        </div>
        <div className="random-stage">
          <div className="random-icon">2</div>
          <div className="random-content">
            <div className="random-label">server entropy</div>
            <div className="random-value is-seed">randomBytes(16) → published hex seed</div>
          </div>
        </div>
        <div className="random-stage">
          <div className="random-icon">3</div>
          <div className="random-content">
            <div className="random-label">mod arithmetic</div>
            <div className="random-value">
              <code style={{ fontSize: "inherit", color: "inherit" }}>Number(BigInt(&quot;0x&quot; + seed) % BigInt(N))</code>
            </div>
          </div>
        </div>
        <div className="random-stage">
          <div className="random-icon is-final">◆</div>
          <div className="random-content">
            <div className="random-label">winner row</div>
            <div className="random-value is-roll">eligibleWallets[index]</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Illustrative equal-width buckets — v1 uses the same idea at any N. */
function EqualNumberLineDemo() {
  const n = 5;
  const winnerIdx = 2;
  const pctEach = 100 / n;
  const markerLeft = ((winnerIdx + 0.5) / n) * 100;
  const colors = ["#2BFF7A", "#8B5CF6", "#FFC940", "#FF4D5E", "#2D6BFF"];
  return (
    <div className="how-visual numline-card">
      <div className="numline-roll-display">
        <span className="numline-roll-label">winning index (example)</span>
        <span className="numline-roll-value">{winnerIdx}</span>
      </div>
      <div className="numline-bar">
        {Array.from({ length: n }).map((_, i) => (
          <div
            key={i}
            className={`numline-seg ${i === winnerIdx ? "is-winner" : ""}`}
            style={{
              width: `${pctEach}%`,
              background: i === winnerIdx ? "rgba(255, 201, 64, 0.18)" : `${colors[i]}1f`,
              color: colors[i],
            }}
          >
            {i}
          </div>
        ))}
        <div className="numline-marker" style={{ left: `${markerLeft}%` }} />
      </div>
      <div className="numline-axis">
        <span>0</span>
        <span>N = {n}</span>
      </div>
      <div className="numline-winner-callout">
        Each wallet gets an equal slice; the seed picks one index — no weight curve in v1.
      </div>
    </div>
  );
}

function VerifyCodeBlock() {
  const code = `// Recompute winner from published round JSON
const idx = Number(BigInt(\`0x\${seed}\`) % BigInt(eligibleWallets.length));
const winner = eligibleWallets[idx];`;
  return (
    <div className="code-block">
      <div className="code-tabs">
        <button type="button" className="code-tab is-active">
          <span className="lang-dot" />
          verify.ts
        </button>
      </div>
      <div className="code-body">
        <pre
          style={{
            margin: 0,
            padding: "18px",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1.65,
            color: "var(--text-primary)",
          }}
        >
          {code}
        </pre>
      </div>
      <div className="code-foot">
        <span>↳ same math as the server draw</span>
        <a href="/verify">Open verify tool ↗</a>
      </div>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="how-section" id="how-it-works">
      <div className="shell">
        <div className="how-intro">
          <div>
            <div className="how-eyebrow">How it works</div>
            <h2 className="how-headline">
              No tickets. No wallet.
              <br />
              Just <em>hold</em>, and the draw picks.
            </h2>
          </div>
          <p className="how-deck">
            Every 15 minutes we snapshot BALL holders, keep everyone above the 0.2% threshold, shuffle
            nobody — <strong>equal 1-in-N odds</strong> — roll a published server seed, and record the result.{" "}
            <strong>You can recompute any past round from the JSON we publish.</strong>
          </p>
        </div>

        <div className="how-steps">
          <div className="how-step">
            <div className="how-step-text">
              <div className="how-step-num">
                <span>01</span> · Eligibility
              </div>
              <h3 className="how-step-title">Hold ≥ 0.2% to qualify.</h3>
              <p className="how-step-body">
                A snapshot of holders is taken at draw time. Anyone holding at least <strong>0.2% of supply</strong> is
                eligible for that round.
              </p>
              <p className="how-step-body">
                Below the line you sit out; the list is sorted by wallet address before the index is applied.
              </p>
            </div>
            <div className="how-step-visual">
              <ThresholdViz />
            </div>
          </div>

          <div className="how-step is-flipped">
            <div className="how-step-text">
              <div className="how-step-num">
                <span>02</span> · Equal odds
              </div>
              <h3 className="how-step-title">Same chance for every eligible wallet.</h3>
              <p className="how-step-body">
                v1 does <strong>not</strong> weight by balance or streak. If there are <code>N</code> eligible wallets,
                you always have a <strong>1 / N</strong> probability before the seed is revealed.
              </p>
              <p className="how-step-body">Larger holders don&apos;t get wider slices on the number line.</p>
            </div>
            <div className="how-step-visual">
              <EqualFormulaCard />
            </div>
          </div>

          <div className="how-step">
            <div className="how-step-text">
              <div className="how-step-num">
                <span>03</span> · Randomness
              </div>
              <h3 className="how-step-title">Published seed, reproducible index.</h3>
              <p className="how-step-body">
                The server draws 16 bytes from <code>crypto.randomBytes</code>, publishes the hex string with the
                sorted list, and sets the winner index with modular arithmetic.
              </p>
              <p className="how-step-body">
                The published seed and sorted eligible list let anyone reproduce the winner index independently.
              </p>
            </div>
            <div className="how-step-visual">
              <RandomnessV1 />
            </div>
          </div>

          <div className="how-step is-flipped">
            <div className="how-step-text">
              <div className="how-step-num">
                <span>04</span> · Selection
              </div>
              <h3 className="how-step-title">Equal slices. One index wins.</h3>
              <p className="how-step-body">
                Think of each eligible wallet as an equal segment. The seed reduces to an integer in{" "}
                <code>0 … N-1</code> and that row wins.
              </p>
              <p className="how-step-body">
                If nobody qualifies, the round is void and the cadence continues — see activity feed for status.
              </p>
            </div>
            <div className="how-step-visual">
              <EqualNumberLineDemo />
            </div>
          </div>
        </div>

        <div className="how-code-reveal">
          <div className="how-code-header">
            <div>
              <h3>Reference verification snippet</h3>
              <p>
                Paste your exported <code>seed</code> and <code>eligibleWallets</code> from GET /api/round/:id
              </p>
            </div>
          </div>
          <VerifyCodeBlock />
        </div>
      </div>
    </section>
  );
}
