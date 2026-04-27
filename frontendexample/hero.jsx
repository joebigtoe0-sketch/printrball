// Header, Hero, and round state machine

const { useState, useEffect, useRef, useMemo, useCallback } = React;
const { fmtAmount, fmtUSD, shortAddr, pickAddr } = window.PB_DATA;

// Animated count-up hook for prize pool ticking
function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target);
      return;
    }
    cancelAnimationFrame(rafRef.current);
    fromRef.current = val;
    startRef.current = null;
    const tick = (t) => {
      if (!startRef.current) startRef.current = t;
      const k = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setVal(fromRef.current + (target - fromRef.current) * eased);
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return val;
}

function Header({ live, prizePoolUSD }) {
  return (
    <header className="header">
      <div className="shell header-inner">
        <div className="brand">
          <div className="brand-mark"><img src="assets/printrball-logo.png" alt="PRINTRBALL" /></div>
          <span className="brand-name">PRINTRBALL</span>
          <span className="brand-divider"></span>
          <a className="nav-bracket" href="#" onClick={(e) => e.preventDefault()}><span className="br">[</span>EXPLORE<span className="br">]</span></a>
          <a className="nav-bracket" href="#how-it-works" onClick={(e) => { e.preventDefault(); document.getElementById('how-it-works')?.scrollIntoView({behavior:'smooth'}); }}><span className="br">[</span>HOW IT WORKS<span className="br">]</span></a>
          <a className="nav-bracket" href="#" onClick={(e) => e.preventDefault()}><span className="br">[</span>VERIFY<span className="br">]</span></a>
          <span className="brand-divider"></span>
          <a className="ticker-pill" href="#" onClick={(e) => e.preventDefault()}>
            $BALL
            <span className="ext">↗</span>
          </a>
        </div>
        <div className="header-right">
          <span className="live-indicator">
            {live ? (<><span className="dot"></span> Live</>)
                  : (<><span className="dot dot-yellow"></span> Reconnecting…</>)}
          </span>
          <a className="verify-link" href="#" onClick={(e) => e.preventDefault()}>
            Verify <span style={{fontSize: 10, opacity: 0.6}}>↗</span>
          </a>
        </div>
      </div>
    </header>
  );
}

function Timer({ secondsLeft }) {
  const [tick, setTick] = useState(false);
  const prevSec = useRef(secondsLeft);
  useEffect(() => {
    const cur = Math.floor(secondsLeft);
    if (cur !== Math.floor(prevSec.current)) {
      setTick(true);
      const t = setTimeout(() => setTick(false), 150);
      prevSec.current = secondsLeft;
      return () => clearTimeout(t);
    }
  }, [secondsLeft]);

  const total = Math.max(0, Math.floor(secondsLeft));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const cls = ['timer'];
  if (total <= 60 && total > 10) cls.push('is-final');
  if (total <= 10) cls.push('is-final-10');
  if (tick) cls.push('tick');

  return (
    <div className={cls.join(' ')} aria-live="off">
      <span>{String(m).padStart(2, '0')}</span>
      <span className="colon">:</span>
      <span className="seconds-tick">{String(s).padStart(2, '0')}</span>
    </div>
  );
}

function Hero({ state, secondsLeft, prizeSOL, prizeUSD, eligibleCount, winner, rolloverPool, roundId }) {
  const animatedPrize = useCountUp(prizeSOL, 800);
  const animatedUSD = useCountUp(prizeUSD, 800);
  const animatedEligible = useCountUp(eligibleCount, 600);

  const cardClass = ['hero-card'];
  if (state === 'final') cardClass.push('is-final');
  if (state === 'final10') cardClass.push('is-final-10');
  if (state === 'drawing') cardClass.push('is-drawing');
  if (state === 'winner') cardClass.push('is-winner');

  return (
    <section className="hero">
      <div className="shell">
        <div className={cardClass.join(' ')}>
          <div className="hero-meta">
            <span className="round-id">ROUND #{roundId}</span>
            <span>15-MIN ROUND</span>
          </div>

          {state === 'rollover' ? (
            <div className="rollover-card">
              <div className="hero-label">Prize rolled over</div>
              <div className="prize" style={{justifyContent: 'center'}}>
                <span className="diamond">◆</span>
                <span>{fmtAmount(rolloverPool)}</span>
                <span className="unit">SOL</span>
              </div>
              <div className="prize-usd" style={{textAlign: 'center', marginBottom: 24}}>
                {fmtUSD(rolloverPool * 192)}
              </div>
              <div className="rollover-headline">No eligible holders this round</div>
              <div className="rollover-sub">Pool rolls into the next draw. Hold 0.2% to qualify.</div>
              <div className="hero-divider"></div>
              <div className="hero-bottom" style={{justifyContent: 'center'}}>
                <span className="eligible-count">
                  <span className="dot"></span>
                  Next draw in <strong>{String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(Math.floor(secondsLeft % 60)).padStart(2, '0')}</strong>
                </span>
              </div>
            </div>
          ) : state === 'drawing' ? (
            <div style={{textAlign: 'center', padding: '20px 0'}}>
              <div className="hero-label">Prize pool</div>
              <div className="prize" style={{justifyContent: 'center', marginBottom: 32}}>
                <span className="diamond">◆</span>
                <span>{fmtAmount(prizeSOL)}</span>
                <span className="unit">SOL</span>
              </div>
              <div className="drawing-shimmer">DRAWING…</div>
              <div className="drawing-sub">Verifying randomness · slot 287443210</div>
            </div>
          ) : state === 'winner' && winner ? (
            <div className="winner-reveal">
              <div className="winner-label">◆ Round #{roundId - 1} winner</div>
              <div className="winner-address mono">{shortAddr(winner.addr)}</div>
              <div className="winner-prize">
                <span style={{fontSize: '0.6em', color: 'var(--gold-dim)', marginRight: 8}}>◆</span>
                {fmtAmount(winner.prize)}
                <span style={{fontSize: '0.4em', color: 'var(--gold-dim)', marginLeft: 8, fontWeight: 500}}>SOL</span>
              </div>
              <div className="winner-meta">
                <span>Odds at draw: <span style={{color: 'var(--text-primary)'}}>{winner.oddsAt}%</span></span>
                <span>·</span>
                <a href="#" onClick={(e) => e.preventDefault()}>View payout tx ↗</a>
                <span>·</span>
                <span>Next round in {Math.floor(secondsLeft)}s</span>
              </div>
            </div>
          ) : (
            <>
              <div>
                <span className="hero-label">Prize pool</span>
                <div className="prize">
                  <span className="diamond">◆</span>
                  <span>{fmtAmount(animatedPrize)}</span>
                  <span className="unit">SOL</span>
                </div>
                <div className="prize-usd">≈ {fmtUSD(animatedUSD)}</div>
              </div>

              <div className="hero-divider"></div>

              <div>
                <span className="hero-label">Next draw in</span>
                <Timer secondsLeft={secondsLeft} />
              </div>

              <div className="hero-bottom">
                <span className="eligible-count">
                  <span className="dot"></span>
                  <strong>{Math.round(animatedEligible)}</strong> wallets in the running
                </span>
                <span className="status-badge">
                  ◆ Hold 0.2% of $BALL to enter
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

window.PB_HERO = { Header, Hero };
