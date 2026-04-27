"use client";

import type { HistoricalRound } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_BASE, solscanTx } from "@/lib/env";

type SnapshotRow = { address: string; balance: string; balancePct: number };

function toCsv(rows: SnapshotRow[]) {
  const header = ["address", "balance", "balance_pct"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.address, r.balance, String(r.balancePct)].join(","));
  }
  return lines.join("\n");
}

function snapshotRowsFrom(data: HistoricalRound): SnapshotRow[] {
  if (data.eligibleSnapshot?.length) return data.eligibleSnapshot;
  return data.eligibleWallets.map((address) => ({ address, balance: "0", balancePct: 0 }));
}

function modIndex(seedHex: string, n: number): number {
  if (n <= 0) return 0;
  const v = BigInt(`0x${seedHex}`);
  return Number(v % BigInt(n));
}

export function VerifyRoundClient({ id }: { id: string }) {
  const [data, setData] = useState<HistoricalRound | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/round/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as HistoricalRound;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const snapshotRows = useMemo(() => (data ? snapshotRowsFrom(data) : []), [data]);
  const csv = useMemo(() => (snapshotRows.length ? toCsv(snapshotRows) : ""), [snapshotRows]);

  const walkthrough = useMemo(() => {
    if (!data || data.status === "void" || !data.eligibleWallets.length) return null;
    const n = data.eligibleWallets.length;
    const idx = data.winnerIndex ?? modIndex(data.seed, n);
    const picked = data.eligibleWallets[idx] ?? null;
    return { n, idx, picked };
  }, [data]);

  if (err) {
    return (
      <main className="shell verify-page">
        <p className="verify-error">Could not load round ({err}).</p>
        <Link className="verify-back" href="/">
          ← Home
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="shell verify-page">
        <div className="lb-empty" style={{ padding: "64px 24px", fontFamily: "var(--font-mono)" }}>
          Loading round…
        </div>
      </main>
    );
  }

  return (
    <main className="shell verify-page">
      <div className="verify-page-head">
        <h1 className="verify-title">Round #{data.roundId}</h1>
        <Link className="verify-back" href="/">
          ← Home
        </Link>
      </div>

      <section className="panel verify-panel-spaced">
        <div className="panel-head">
          <span className="panel-title">
            <span className="dot" />
            Metadata
          </span>
        </div>
        <div className="verify-meta">
          <div className="verify-meta-row">
            <div className="verify-meta-label">status</div>
            <div className="verify-meta-value">{data.status}</div>
          </div>
          <div className="verify-meta-row">
            <div className="verify-meta-label">started</div>
            <div className="verify-meta-value">{new Date(data.startedAt).toISOString()}</div>
          </div>
          <div className="verify-meta-row">
            <div className="verify-meta-label">ended</div>
            <div className="verify-meta-value">{new Date(data.endedAt).toISOString()}</div>
          </div>
          <div className="verify-meta-row">
            <div className="verify-meta-label">winner</div>
            <div className="verify-meta-value">{data.winner ?? "—"}</div>
          </div>
          <div className="verify-meta-row">
            <div className="verify-meta-label">prize</div>
            <div className="verify-meta-value">
              {data.prizeAmount} {data.prizeCurrency}
              <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>(lamports if SOL)</span>
            </div>
          </div>
        </div>
        <div className="verify-tx-row">
          {data.claimTx && !data.claimTx.startsWith("MOCK") ? (
            <a href={solscanTx(data.claimTx)} target="_blank" rel="noreferrer">
              claim tx ↗
            </a>
          ) : data.claimTx ? (
            <span style={{ color: "var(--text-muted)" }}>claim: {data.claimTx}</span>
          ) : null}
          {data.payoutTx && !data.payoutTx.startsWith("MOCK") ? (
            <a href={solscanTx(data.payoutTx)} target="_blank" rel="noreferrer">
              payout tx ↗
            </a>
          ) : data.payoutTx ? (
            <span style={{ color: "var(--text-muted)" }}>payout: {data.payoutTx}</span>
          ) : null}
        </div>
      </section>

      <section className="panel verify-panel-spaced">
        <div className="panel-head">
          <span className="panel-title">
            <span className="dot" />
            Randomness
          </span>
        </div>
        <div className="verify-prose">
          v1 uses server-side <strong style={{ color: "var(--text-primary)" }}>{data.seedSource}</strong>. We publish
          the seed and the sorted eligible list so anyone can reproduce the index math independently for every round.
        </div>
        <p className="verify-pre" style={{ marginTop: 0 }}>
          <span style={{ color: "var(--text-muted)", display: "block", marginBottom: 8 }}>seed (hex)</span>
          {data.seed || "—"}
        </p>
      </section>

      <section className="panel verify-panel-spaced">
        <div className="panel-head">
          <span className="panel-title">
            <span className="dot" />
            Selection walkthrough
          </span>
        </div>
        {walkthrough && data.seed ? (
          <pre className="verify-pre">{`seed (hex)         = ${data.seed}
eligible count     = ${walkthrough.n}
seed mod ${walkthrough.n}    = ${walkthrough.idx}
eligibleWallets[${walkthrough.idx}] = ${walkthrough.picked ?? "?"}`}</pre>
        ) : (
          <p className="verify-prose">No winner index (void round or missing seed).</p>
        )}
        <p className="verify-prose" style={{ paddingTop: 0 }}>
          Verify yourself: in Node, <code>{`Number(BigInt('0x'+seed) % BigInt(n))`}</code> must equal the published
          index; then read <code>eligibleWallets[index]</code> from the same JSON snapshot.
        </p>
      </section>

      <section className="panel verify-panel-spaced">
        <div className="panel-head">
          <span className="panel-title">
            <span className="dot" />
            Snapshot (eligible at draw)
          </span>
          <button
            type="button"
            className="verify-btn"
            onClick={() => {
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `round-${data.roundId}-eligible.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download CSV
          </button>
        </div>
        <div className="verify-table-wrap">
          <table className="lb-table density-comfortable">
            <thead>
              <tr>
                <th>#</th>
                <th>address</th>
                <th>balance</th>
                <th>balance_pct</th>
              </tr>
            </thead>
            <tbody>
              {snapshotRows.map((p, i) => (
                <tr key={p.address}>
                  <td className={`lb-rank ${i === walkthrough?.idx ? "is-top" : ""}`}>{i}</td>
                  <td>
                    <span className="lb-wallet" style={{ cursor: "default" }}>
                      {p.address}
                    </span>
                  </td>
                  <td className="lb-holdings">
                    <span className="raw">{p.balance}</span>
                  </td>
                  <td>{p.balancePct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
