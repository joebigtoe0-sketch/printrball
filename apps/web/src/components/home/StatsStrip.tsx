"use client";

import type { StatsResponse } from "@/lib/types";

function lamportsToSol(lamports: string): string {
  const n = BigInt(lamports || "0");
  return (Number(n) / 1e9).toFixed(3);
}

export function StatsStrip({ stats }: { stats: StatsResponse | undefined }) {
  if (!stats) return null;
  return (
    <section className="section">
      <div className="shell">
        <div className="stats-strip">
          <div className="stat">
            <div className="stat-label">Total paid out</div>
            <div className="stat-value">
              <span className="diamond">◆</span>
              {lamportsToSol(stats.totalPaidOut.amount)}
              <span className="unit">SOL</span>
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Rounds completed</div>
            <div className="stat-value">{stats.totalRounds.toLocaleString()}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Biggest single win</div>
            <div className="stat-value">
              <span className="diamond">◆</span>
              {lamportsToSol(stats.biggestWin.amount)}
              <span className="unit">SOL</span>
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Unique winners</div>
            <div className="stat-value">{stats.uniqueWinners}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
