// Main app — orchestrates state machine, event stream, and tweaks

const { useState: useStateApp, useEffect: useEffectApp, useRef: useRefApp, useMemo: useMemoApp, useCallback: useCallbackApp } = React;
const { Header, Hero } = window.PB_HERO;
const { Leaderboard, ActivityFeed, RecentWinners, StatsStrip, Footer } = window.PB_PANELS;
const { buildLeaderboard, RECENT_WINNERS, EVENT_TEMPLATES, TXS, pickAddr, shortAddr, fmtAmount, fmtPct } = window.PB_DATA;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "roundState": "idle",
  "feedSpeed": "normal",
  "leaderboardDensity": "compact"
}/*EDITMODE-END*/;

// State definitions
//  idle      — countdown live, prize ticking
//  final     — last 60s, gold timer
//  final10   — last 10s, red timer
//  drawing   — timer hit 0, shimmer
//  winner    — winner reveal
//  rollover  — no eligible holders, prize rolls

const STATE_TIMER = {
  idle:     { secs: 327, label: 'idle' },        // 5:27
  final:    { secs: 38,  label: 'final-min' },   // 0:38
  final10:  { secs: 7,   label: 'final-10' },    // 0:07
  drawing:  { secs: 0,   label: 'drawing' },
  winner:   { secs: 893, label: 'winner' },      // next round in ~14:53
  rollover: { secs: 612, label: 'rollover' },    // 10:12
};

const FEED_INTERVALS = {
  slow:   3500,
  normal: 1500,
  fast:   600,
};

let nextEventId = 1;

function buildEventFromTemplate(tpl, opts = {}) {
  const addr = opts.addr || pickAddr(Math.floor(Math.random() * 25));
  const pct = opts.pct ?? +(Math.random() * 1.4 + 0.21).toFixed(2);
  const slot = 287443210 + Math.floor(Math.random() * 50);
  const amt = +(Math.random() * 1.5 + 0.4).toFixed(3);
  return {
    id: nextEventId++,
    type: tpl.type,
    tone: tpl.tone,
    icon: tpl.icon,
    text: tpl.text(addr, tpl.type === 'fees_claimed' ? amt : pct, slot),
    tx: ['randomness_committed', 'fees_claimed', 'draw_executed', 'payout_sent'].includes(tpl.type)
      ? TXS[Math.floor(Math.random() * TXS.length)]
      : null,
    timeLabel: 'now',
    createdAt: Date.now(),
  };
}

function seedEvents() {
  const now = Date.now();
  const seeds = [
    { ago: '6s',   tplIdx: 0 },
    { ago: '14s',  tplIdx: 1 },
    { ago: '32s',  tplIdx: 0 },
    { ago: '48s',  tplIdx: 3 },
    { ago: '1m',   tplIdx: 2 },
    { ago: '1m',   tplIdx: 0 },
    { ago: '2m',   tplIdx: 0 },
    { ago: '3m',   tplIdx: 1 },
    { ago: '4m',   tplIdx: 3 },
    { ago: '5m',   tplIdx: 0 },
  ];
  return seeds.map((s, i) => {
    const tpl = EVENT_TEMPLATES[s.tplIdx];
    const ev = buildEventFromTemplate(tpl);
    ev.timeLabel = s.ago;
    ev.id = nextEventId++;
    return ev;
  });
}

function relativeTime(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 5) return 'now';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const state = t.roundState || 'idle';

  // Round / timer state
  const [secondsLeft, setSecondsLeft] = useStateApp(STATE_TIMER[state].secs);
  const [prizeSOL, setPrizeSOL] = useStateApp(4.231);
  const [eligibleCount, setEligibleCount] = useStateApp(127);
  const [roundId, setRoundId] = useStateApp(1429);
  const [winner] = useStateApp({ addr: pickAddr(2), prize: 4.231, oddsAt: 3.2 });
  const [rolloverPool] = useStateApp(8.204);
  const [live] = useStateApp(true);

  // Reset timer when state changes
  useEffectApp(() => {
    setSecondsLeft(STATE_TIMER[state].secs);
  }, [state]);

  // Countdown using rAF for smooth subsecond
  useEffectApp(() => {
    if (state === 'drawing') return;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setSecondsLeft((s) => Math.max(0, s - dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  // Prize ticks up while idle / final
  useEffectApp(() => {
    if (state !== 'idle' && state !== 'final' && state !== 'final10') return;
    const id = setInterval(() => {
      setPrizeSOL((p) => +(p + Math.random() * 0.012).toFixed(3));
    }, 2000);
    return () => clearInterval(id);
  }, [state]);

  // Eligible count drift
  useEffectApp(() => {
    const id = setInterval(() => {
      setEligibleCount((c) => {
        const delta = Math.random() < 0.5 ? -1 : 1;
        return Math.max(80, Math.min(180, c + delta));
      });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Activity feed
  const [events, setEvents] = useStateApp(() => seedEvents());

  useEffectApp(() => {
    const interval = FEED_INTERVALS[t.feedSpeed] || FEED_INTERVALS.normal;
    const id = setInterval(() => {
      // Don't pump too many while in special states (looks weird)
      if (state === 'drawing' || state === 'winner') return;
      const tpl = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
      const ev = buildEventFromTemplate(tpl);
      setEvents((prev) => {
        const next = [ev, ...prev].slice(0, 50);
        // Update relative times
        return next.map((e, i) => ({
          ...e,
          timeLabel: i === 0 ? 'now' : relativeTime(Date.now() - e.createdAt),
        }));
      });
    }, interval);
    return () => clearInterval(id);
  }, [t.feedSpeed, state]);

  // Refresh time labels every few seconds
  useEffectApp(() => {
    const id = setInterval(() => {
      setEvents((prev) => prev.map((e, i) => ({
        ...e,
        timeLabel: i === 0 ? 'now' : relativeTime(Date.now() - e.createdAt),
      })));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // Toast handler
  const [toast, setToast] = useStateApp(null);
  useEffectApp(() => {
    const onToast = (e) => {
      setToast(e.detail);
      setTimeout(() => setToast(null), 1500);
    };
    window.addEventListener('pb-toast', onToast);
    return () => window.removeEventListener('pb-toast', onToast);
  }, []);

  // Leaderboard data
  const lbData = useMemoApp(() => buildLeaderboard(20), []);
  const prizeUSD = prizeSOL * 192;

  // Recent winners list — when in winner state, push the new one to the front
  const winnersList = useMemoApp(() => {
    if (state === 'winner') {
      return [
        { round: roundId - 1, ago: 'just now', prize: winner.prize, addr: winner.addr, oddsAt: winner.oddsAt },
        ...RECENT_WINNERS,
      ].slice(0, 4);
    }
    return RECENT_WINNERS;
  }, [state, roundId, winner]);

  return (
    <>
      <Header live={live} prizePoolUSD={prizeUSD} />
      <Hero
        state={state}
        secondsLeft={secondsLeft}
        prizeSOL={prizeSOL}
        prizeUSD={prizeUSD}
        eligibleCount={eligibleCount}
        winner={winner}
        rolloverPool={rolloverPool}
        roundId={roundId}
      />

      <section className="section" data-screen-label="Leaderboard + Activity">
        <div className="shell">
          <div className="section-grid">
            <Leaderboard
              rows={lbData.rows}
              density={t.leaderboardDensity}
              totalEligible={lbData.rows.length}
            />
            <ActivityFeed events={events} />
          </div>
        </div>
      </section>

      <RecentWinners winners={winnersList} />
      <StatsStrip />
      {window.PB_HOW && <window.PB_HOW.HowItWorks />}
      <Footer />

      {toast && <div className="toast">{toast}</div>}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Round state" />
        <TweakSelect
          label="State"
          value={t.roundState}
          options={[
            { value: 'idle',     label: 'Idle (5:27)' },
            { value: 'final',    label: 'Final minute (0:38)' },
            { value: 'final10',  label: 'Final 10s (0:07)' },
            { value: 'drawing',  label: 'DRAWING shimmer' },
            { value: 'winner',   label: 'Winner reveal' },
            { value: 'rollover', label: 'Rolled over' },
          ]}
          onChange={(v) => setTweak('roundState', v)}
        />

        <TweakSection label="Activity feed" />
        <TweakRadio
          label="Speed"
          value={t.feedSpeed}
          options={['slow', 'normal', 'fast']}
          onChange={(v) => setTweak('feedSpeed', v)}
        />

        <TweakSection label="Leaderboard" />
        <TweakRadio
          label="Density"
          value={t.leaderboardDensity}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Comfy' },
            { value: 'card', label: 'Card' },
          ]}
          onChange={(v) => setTweak('leaderboardDensity', v)}
        />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
