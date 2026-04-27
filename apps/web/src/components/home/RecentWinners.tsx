"use client";

import type { HistoricalRound } from "@/lib/types";
import Link from "next/link";
import { solscanTx } from "@/lib/env";

function shortAddr(a: string) {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function lamportsToSol(lamports: string): string {
  const n = BigInt(lamports || "0");
  return (Number(n) / 1e9).toFixed(4);
}

function ago(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function RecentWinners({ items }: { items: HistoricalRound[] }) {
  const paid = items.filter((r) => r.status === "paid" && r.winner);
  return (
    <section className="section">
      <div className="shell">
        <div className="section-head">
          <span className="section-title">
            Recent Winners
            <span className="count">· last rounds</span>
          </span>
        </div>
        <div className="winners-grid">
          {paid.length === 0 ? (
            <p className="lb-empty" style={{ gridColumn: "1 / -1" }}>
              No completed rounds yet.
            </p>
          ) : (
            paid.slice(0, 4).map((r, i) => (
              <div key={r.roundId} className={`winner-card ${i === 0 ? "is-recent" : ""}`}>
                <div className="winner-card-head">
                  <span>#{r.roundId}</span>
                  <span>{ago(r.endedAt)}</span>
                </div>
                <div className="winner-card-prize">
                  <span className="diamond">◆</span>
                  {lamportsToSol(r.prizeAmount)}
                  <span className="unit">{r.prizeCurrency}</span>
                </div>
                <div className="winner-card-addr">{r.winner ? shortAddr(r.winner) : "—"}</div>
                <div className="winner-card-foot">
                  <span>Drawn from {r.eligibleCount} eligible</span>
                  <span style={{ display: "flex", gap: 8 }}>
                    <Link href={`/round/${r.roundId}`}>verify</Link>
                    {r.payoutTx && !r.payoutTx.startsWith("MOCK") ? (
                      <a href={solscanTx(r.payoutTx)} target="_blank" rel="noreferrer">
                        payout ↗
                      </a>
                    ) : null}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
