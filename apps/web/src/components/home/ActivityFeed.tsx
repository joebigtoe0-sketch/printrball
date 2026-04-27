"use client";

import type { ActivityEntry } from "@/lib/types";
import { solscanTx } from "@/lib/env";

function toneFor(type: string) {
  if (type === "holder_joined") return "green";
  if (type === "holder_dropped") return "red";
  if (type === "round_drawn" || type === "fees_claimed" || type === "payout_sent") return "gold";
  if (type === "payout_failed") return "red";
  if (type === "round_void") return "muted";
  return "neutral";
}

function iconFor(type: string) {
  if (type === "round_started") return "▶";
  if (type === "holder_joined") return "↑";
  if (type === "holder_dropped") return "↓";
  if (type === "round_drawn") return "◎";
  if (type === "fees_claimed") return "◆";
  if (type === "payout_sent") return "✦";
  if (type === "payout_failed") return "!";
  if (type === "round_void") return "ø";
  return "·";
}

function relTime(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function short(a?: string) {
  if (!a) return "—";
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

function titleFor(e: ActivityEntry) {
  switch (e.type) {
    case "round_started":
      return `Round #${e.roundId ?? "?"} started`;
    case "holder_joined":
      return `${short(e.wallet)} became eligible`;
    case "holder_dropped":
      return `${short(e.wallet)} dropped out`;
    case "round_drawn":
      return `Round drawn — winner ${short(e.wallet)}`;
    case "fees_claimed":
      return "Fees claimed";
    case "payout_sent":
      return "Payout sent";
    case "payout_failed":
      return "Payout failed, retrying…";
    case "round_void":
      return "Round void — no eligible wallets";
    default:
      return e.type;
  }
}

function subtitleFor(e: ActivityEntry) {
  const sig = (e.meta as { tx?: string } | undefined)?.tx;
  if (typeof sig === "string") {
    if (sig.startsWith("MOCK")) {
      return <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{sig}</span>;
    }
    return (
      <a href={solscanTx(sig)} target="_blank" rel="noreferrer">
        {sig.slice(0, 6)}…{sig.slice(-4)}
        <span className="ext">↗</span>
      </a>
    );
  }
  if (e.type === "round_drawn" || e.type === "fees_claimed" || e.type === "payout_sent") {
    return <span>See round verify for signatures</span>;
  }
  return null;
}

export function ActivityFeed({ items }: { items: ActivityEntry[] }) {
  return (
    <div className="panel feed">
      <div className="panel-head">
        <span className="panel-title">
          <span className="dot" />
          Live Activity
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>newest first</span>
      </div>
      <div className="feed-list">
        {items.length === 0 ? (
          <div className="lb-empty">Waiting for the first event…</div>
        ) : (
          items.map((e) => (
            <div key={e.id} className="feed-item">
              <div className={`feed-icon tone-${toneFor(e.type)}`}>{iconFor(e.type)}</div>
              <div>
                <div className="feed-text">{titleFor(e)}</div>
                {subtitleFor(e) ? <div className="feed-sub">{subtitleFor(e)}</div> : null}
              </div>
              <div className="feed-time">{relTime(e.ts)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
