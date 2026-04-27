"use client";

import { useMemo, useState } from "react";

export type Row = { rank: number; address: string; balancePct: number; balance: string };

function shortAddr(a: string) {
  if (a.length <= 10) return a;
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export function Leaderboard({
  rows,
  eligibleCount,
  onCopy,
}: {
  rows: Row[];
  eligibleCount: number;
  onCopy?: (msg: string) => void;
}) {
  const [q, setQ] = useState("");
  const [showCount, setShowCount] = useState(12);
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    return rows.filter((r) => r.address.toLowerCase().includes(q.trim().toLowerCase()));
  }, [q, rows]);
  const visible = filtered.slice(0, showCount);
  const oneIn = eligibleCount > 0 ? eligibleCount : null;

  const copyAddr = (addr: string) => {
    void navigator.clipboard.writeText(addr).catch(() => {});
    onCopy?.("Address copied");
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">
          <span className="dot" />
          Leaderboard
          <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>· {eligibleCount} eligible</span>
        </span>
        <div className="panel-controls">
          <input
            className="search-input"
            placeholder="Search wallet…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search wallets"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="lb-empty">
          {q.trim() ? "No matches." : "No eligible holders yet — be the first to qualify."}
        </div>
      ) : (
        <table className="lb-table density-compact">
          <thead>
            <tr>
              <th>#</th>
              <th>Wallet</th>
              <th>Holdings</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.address}>
                <td className={`lb-rank ${r.rank === 1 ? "is-top" : ""}`}>{r.rank === 1 ? "◆" : r.rank}</td>
                <td>
                  <button
                    type="button"
                    className="lb-wallet"
                    onClick={() => copyAddr(r.address)}
                    style={{ cursor: "pointer", background: "none", border: 0, padding: 0 }}
                  >
                    <span>{shortAddr(r.address)}</span>
                    <span className="copy">copy</span>
                  </button>
                </td>
                <td className="lb-holdings">
                  <span className="pct">{r.balancePct.toFixed(2)}%</span>
                  <span className="raw">{r.balance}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {oneIn != null && visible.length > 0 ? (
        <p className="px-[14px] py-3 font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)" }}>
          Equal draw: every row has{" "}
          <span style={{ color: "var(--gold)" }}>1 in {oneIn}</span> odds.
        </p>
      ) : null}

      {filtered.length > showCount ? (
        <button type="button" className="lb-load-more" onClick={() => setShowCount((c) => c + 12)}>
          Load more · {filtered.length - showCount} hidden
        </button>
      ) : null}
    </div>
  );
}
