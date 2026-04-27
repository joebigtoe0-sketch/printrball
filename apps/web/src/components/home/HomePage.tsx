"use client";

import { useMemo, useState, useEffect } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ActivityFeed } from "@/components/home/ActivityFeed";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Leaderboard, type Row } from "@/components/home/Leaderboard";
import { RecentWinners } from "@/components/home/RecentWinners";
import { StatsStrip } from "@/components/home/StatsStrip";
import { useHomeData } from "@/components/home/useHomeData";

export function HomePage() {
  const { state, stats, feed, winners, error, live, reconcile } = useHomeData();
  const [toast, setToast] = useState<string | null>(null);

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
      <main>
        <Hero state={state} />
        <section className="section" data-screen-label="Leaderboard + Activity">
          <div className="shell">
            <div className="section-grid">
              <Leaderboard
                rows={rows}
                eligibleCount={state?.eligibleCount ?? 0}
                onCopy={(m) => setToast(m)}
              />
              <ActivityFeed items={feed} />
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
