"use client";

import type { ApiStateResponse, HistoricalRound } from "@/lib/types";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

function fmtAmount(n: number, decimals = 3) {
  return n.toFixed(decimals);
}

function lamportsToSol(lamports: string): number {
  const x = BigInt(lamports || "0");
  return Number(x) / 1e9;
}

function Timer({ secondsLeft }: { secondsLeft: number }) {
  const reduceMotion = useReducedMotion();
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
  const cls = ["timer"];
  if (total <= 60 && total > 10) cls.push("is-final");
  if (total <= 10) cls.push("is-final-10");
  if (tick && !reduceMotion) cls.push("tick");

  return (
    <div className={cls.join(" ")} aria-live="polite">
      <span>{String(m).padStart(2, "0")}</span>
      <span className="colon">:</span>
      <span className="seconds-tick">{String(s).padStart(2, "0")}</span>
    </div>
  );
}

function shortAddr(a: string): string {
  if (!a) return "—";
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-6)}`;
}

export function Hero({
  state,
  winners,
}: {
  state: ApiStateResponse | null | undefined;
  winners?: HistoricalRound[];
}) {
  const reduceMotion = useReducedMotion();
  const [displayPool, setDisplayPool] = useState(0);
  const [localSecs, setLocalSecs] = useState(0);
  const target = state ? lamportsToSol(state.estimatedPrize.amount) : 0;
  const n = state?.eligibleCount ?? 0;
  const phase = state?.round.phase ?? "live";
  const endsAt = state?.round.endsAt ?? 0;
  const roundId = state?.round.roundId ?? 0;
  const sys = state?.system;
  const systemStatus = sys?.status ?? "off";
  const mockHolders = sys?.mockHolders ?? false;
  const snapshotMock = sys?.holdersSnapshotMock ?? false;
  const holderErr = sys?.holdersFetchError;
  const prizeErr = sys?.prizeFetchError ?? null;
  const tokenAccountsOnChain = sys?.holderTokenAccountCount ?? 0;
  const latestWinner = winners?.[0];
  const showWinnerReveal =
    Boolean(latestWinner?.winner) &&
    latestWinner?.status === "paid" &&
    Date.now() - (latestWinner?.endedAt ?? 0) <= 45_000 &&
    phase === "live";

  useEffect(() => {
    if (reduceMotion) {
      setDisplayPool(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = displayPool;
    const dur = 800;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - p) ** 3;
      setDisplayPool(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, target]);

  useEffect(() => {
    if (phase === "drawing" || phase === "payout_pending" || !endsAt) {
      setLocalSecs(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      setLocalSecs(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [endsAt, phase]);

  const secs = phase === "drawing" || phase === "payout_pending" ? 0 : localSecs;

  const cardClass = ["hero-card"];
  if (systemStatus === "running" && phase === "live" && secs <= 60 && secs > 10) cardClass.push("is-final");
  if (systemStatus === "running" && phase === "live" && secs <= 10) cardClass.push("is-final-10");
  if (phase === "drawing" || phase === "payout_pending") cardClass.push("is-drawing");

  if (systemStatus === "off") {
    return (
      <section className="hero">
        <div className="shell">
          <div className="hero-card">
            <div className="hero-meta">
              <span className="round-id">STANDBY</span>
              <span>15-MIN ROUND · v1 equal draw</span>
            </div>
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <span className="hero-label">Rounds are stopped</span>
              <p className="how-deck" style={{ margin: "20px auto", maxWidth: 520 }}>
                Set the SPL <strong>token mint</strong> in the admin console, then press <strong>Start</strong>. The first
                round is scheduled for the <strong>next 15-minute UTC boundary</strong> (e.g. :00, :15, :30, :45).
                {holderErr ? (
                  <span className="block text-sm text-red-400" style={{ marginTop: 12 }}>
                    Last holder fetch: {holderErr}
                  </span>
                ) : null}
                {!snapshotMock && !mockHolders && tokenAccountsOnChain > 0 && (state?.eligibleCount ?? 0) === 0 ? (
                  <span className="block" style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
                    RPC sees <strong>{tokenAccountsOnChain}</strong> on-chain token account(s) for this mint;{" "}
                    <strong>none</strong> hold strictly more than <strong>0.2%</strong> of supply after combining
                    balances per wallet.
                  </span>
                ) : null}
                {snapshotMock || mockHolders ? (
                  <span className="block" style={{ marginTop: 12, fontSize: 12, color: "var(--text-faint)" }}>
                    {mockHolders
                      ? "MOCK_HOLDERS is enabled — eligible wallets are simulated. Set MOCK_HOLDERS=0 and RPC_URL for mainnet."
                      : "Holder list is simulated — set the token mint in admin (or TOKEN_MINT) for on-chain data."}
                  </span>
                ) : null}
              </p>
              <Link className="verify-btn" href="/admin" style={{ display: "inline-block" }}>
                Open admin
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (systemStatus === "scheduled") {
    return (
      <section className="hero">
        <div className="shell">
          <div className={["hero-card", "is-final"].join(" ")}>
            <div className="hero-meta">
              <span className="round-id">ROUND #0 (scheduled)</span>
              <span>First draw arms at the boundary</span>
            </div>
            <div>
              <span className="hero-label">Prize pool · estimated</span>
              <div className="prize">
                <span className="diamond">◆</span>
                <span>{fmtAmount(displayPool)}</span>
                <span className="unit">SOL</span>
              </div>
              <p className="prize-usd" style={{ textAlign: "left" }}>
                Unclaimed fees are claimed at draw time — live figure is an estimate.
              </p>
            </div>
            <div className="hero-divider" />
            <div>
              <span className="hero-label">First round starts in (UTC window)</span>
              <Timer secondsLeft={secs} />
            </div>
            {sys?.scheduledStartMs != null ? (
              <p className="mt-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                T0: {new Date(sys.scheduledStartMs).toISOString()}
              </p>
            ) : null}
            <div className="hero-bottom">
              <span className="eligible-count">
                <span className="dot" />
                <strong>{n}</strong> eligible
              </span>
            </div>
            {holderErr ? (
              <p className="text-sm" style={{ color: "var(--red, #f87171)" }}>
                Holder RPC: {holderErr}
              </p>
            ) : null}
            {snapshotMock || mockHolders ? (
              <p className="text-xs" style={{ color: "var(--text-faint)", marginTop: 8 }}>
                Preview uses simulated holders — use MOCK_HOLDERS=0 and a real mint for on-chain preview.
              </p>
            ) : null}
            {!snapshotMock && !mockHolders && tokenAccountsOnChain > 0 && n === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)", marginTop: 8 }}>
                {tokenAccountsOnChain} token account(s) on-chain; none over 0.2% supply per wallet (merged balances).
              </p>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="hero">
      <div className="shell">
        <div className={cardClass.join(" ")}>
          <div className="hero-meta">
            <span className="round-id">ROUND #{roundId}</span>
            <span>15-MIN ROUND · v1 equal draw</span>
          </div>

          {phase === "drawing" ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <span className="hero-label">Prize pool · estimated</span>
              <div className="prize" style={{ justifyContent: "center", marginBottom: 32 }}>
                <span className="diamond">◆</span>
                <span>{fmtAmount(displayPool)}</span>
                <span className="unit">SOL</span>
              </div>
              <div className="drawing-shimmer">DRAWING…</div>
              <div className="drawing-sub">Selecting winner from sorted eligible list</div>
            </div>
          ) : phase === "payout_pending" ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <span className="hero-label">Prize pool · estimated</span>
              <div className="prize" style={{ justifyContent: "center", marginBottom: 32 }}>
                <span className="diamond">◆</span>
                <span>{fmtAmount(displayPool)}</span>
                <span className="unit">SOL</span>
              </div>
              <div className="drawing-shimmer" style={{ animationDuration: "2.2s" }}>
                PAYOUT…
              </div>
              <div className="drawing-sub">Claim / transfer in progress — round data is frozen</div>
            </div>
          ) : (
            <>
              {showWinnerReveal && latestWinner ? (
                <div className="winner-reveal">
                  <div className="winner-label">Winner just drawn</div>
                  <div className="winner-address">{shortAddr(latestWinner.winner ?? "")}</div>
                  <div className="winner-prize">
                    ◆ {fmtAmount(lamportsToSol(latestWinner.prizeAmount), 3)} SOL
                  </div>
                  <div className="winner-meta">
                    Round #{latestWinner.roundId} · <Link href={`/round/${latestWinner.roundId}`}>verify ↗</Link>
                  </div>
                </div>
              ) : null}
              {holderErr ? (
                <p className="mb-4 text-sm" style={{ color: "var(--red, #f87171)" }}>
                  Holder data: {holderErr}
                </p>
              ) : null}
              {prizeErr ? (
                <p className="mb-4 text-sm" style={{ color: "var(--red, #f87171)" }}>
                  Prize estimate: {prizeErr}
                </p>
              ) : null}
              <div>
                <span className="hero-label">Prize pool · estimated</span>
                <div className="prize">
                  <span className="diamond">◆</span>
                  <span>{fmtAmount(displayPool)}</span>
                  <span className="unit">SOL</span>
                </div>
                <p className="prize-usd" style={{ textAlign: "left" }}>
                  Unclaimed fees are claimed at draw time — live figure is an estimate.
                </p>
              </div>

              <div className="hero-divider" />

              <div>
                <span className="hero-label">Next draw in</span>
                <Timer secondsLeft={secs} />
              </div>

              <div className="hero-bottom">
                <span className="eligible-count">
                  <span className="dot" />
                  <strong>{n}</strong> wallets in the running
                </span>
                <span className="status-badge">◆ Hold ≥0.2% of BALL to qualify</span>
              </div>
              {n > 0 ? (
                <p className="mt-3 font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Each eligible wallet has the same chance:{" "}
                  <span style={{ color: "var(--text-primary)" }}>1 in {n}</span>
                </p>
              ) : (
                <p className="mt-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                  No eligible wallets yet — pool rolls if nobody qualifies at draw.
                </p>
              )}
              {!snapshotMock && !mockHolders && tokenAccountsOnChain > 0 && n === 0 ? (
                <p className="mt-2 text-xs" style={{ color: "var(--text-muted)", maxWidth: 560 }}>
                  On-chain: <strong>{tokenAccountsOnChain}</strong> SPL token account(s);{" "}
                  <strong>0</strong> wallets over the <strong>&gt;0.2%</strong> supply bar (balances combined per
                  wallet). Explorers often list more “holders” than qualify here.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
