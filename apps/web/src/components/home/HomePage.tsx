"use client";

import { useMemo, useState, useEffect } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { SOLSCAN_CLUSTER, solscanToken } from "@/lib/env";
import { ActivityFeed } from "@/components/home/ActivityFeed";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Leaderboard, type Row } from "@/components/home/Leaderboard";
import { RecentWinners } from "@/components/home/RecentWinners";
import { StatsStrip } from "@/components/home/StatsStrip";
import { VerifyCodeCard } from "@/components/home/VerifyCodeCard";
import { useHomeData } from "@/components/home/useHomeData";

export function HomePage() {
  const { state, stats, feed, winners, error, live, reconcile } = useHomeData();
  const [toast, setToast] = useState<string | null>(null);
  const mint = state?.system?.tokenMint?.trim() ?? "";

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  const rows: Row[] = useMemo(() => {
    const list = state?.eligibleWallets ?? [];
    const sorted = [...list].sort((a, b) => b.balancePct - a.balancePct);
    return sorted.slice(0, 50).map((w, i) => ({
      rank: i + 1,
      address: w.address,
      balancePct: w.balancePct,
      balance: w.balance,
    }));
  }, [state?.eligibleWallets]);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
        <Header live={false} />
        <main className="shell py-20 text-center">
          <h1 className="how-step-title" style={{ fontSize: 22 }}>
            Data unavailable
          </h1>
          <p className="how-deck mx-auto mt-4 max-w-md" style={{ margin: "16px auto 0" }}>
            We&apos;re having trouble loading the API. Is the server running? Try again in a moment.
          </p>
          <button
            type="button"
            className="ticker-pill mt-8"
            style={{ border: "1px solid var(--border-emphasis)", cursor: "pointer" }}
            onClick={() => reconcile()}
          >
            Retry
          </button>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <Header live={live} />
      <section className="contract-strip-wrap">
        <div className="shell">
          <div className="contract-strip">
            <span className="contract-pill">● {SOLSCAN_CLUSTER}</span>
            <span className="contract-label">CONTRACT</span>
            <code className="contract-address">{mint || "Not set"}</code>
            <button
              type="button"
              className="contract-action"
              disabled={!mint}
              onClick={() => {
                if (!mint) return;
                void navigator.clipboard.writeText(mint);
                setToast("Contract copied");
              }}
            >
              COPY
            </button>
            <a className="contract-action" href={solscanToken(mint)} target="_blank" rel="noreferrer">
              SOLSCAN ↗
            </a>
          </div>
        </div>
      </section>
      <section className="quick-steps-wrap">
        <div className="shell">
          <div className="quick-steps-head">
            <div className="quick-steps-eyebrow">How it works</div>
            <h2 className="quick-steps-title">Three quick steps</h2>
          </div>
          <div className="quick-steps">
            <article className="quick-step-card">
              <div className="quick-step-head">
                <span className="quick-step-num">01</span>
                <span className="quick-step-title">HOLD $BALL</span>
              </div>
              <p className="quick-step-text">
                Hold at least 0.2% of supply at draw time to qualify. No sign-ups and no separate ticket wallet.
              </p>
            </article>
            <article className="quick-step-card">
              <div className="quick-step-head">
                <span className="quick-step-num">02</span>
                <span className="quick-step-title">EQUAL ODDS PER WALLET</span>
              </div>
              <p className="quick-step-text">
                Once above the threshold, each eligible wallet has the same chance. Bigger bags do not get extra weight.
              </p>
            </article>
            <article className="quick-step-card">
              <div className="quick-step-head">
                <span className="quick-step-num">03</span>
                <span className="quick-step-title">DRAWS EVERY 15 MIN</span>
              </div>
              <p className="quick-step-text">
                A new snapshot and draw run every 15 minutes, then the winner and verify data are published.
              </p>
            </article>
          </div>
        </div>
      </section>
      <main>
        <section className="section" data-screen-label="Round + Leaderboard">
          <div className="shell">
            <div className="round-leader-grid">
              <div className="hero-inline">
                <Hero state={state} winners={winners} />
              </div>
              <Leaderboard
                rows={rows}
                eligibleCount={state?.eligibleCount ?? 0}
                onCopy={(m) => setToast(m)}
              />
            </div>
          </div>
        </section>
        <section className="section" data-screen-label="Verify + Activity">
          <div className="shell">
            <div className="section-grid verify-activity-grid">
              <ActivityFeed items={feed} />
              <VerifyCodeCard />
            </div>
          </div>
        </section>
        <RecentWinners items={winners} />
        <StatsStrip stats={stats} />
        <HowItWorks />
      </main>
      <Footer />
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
