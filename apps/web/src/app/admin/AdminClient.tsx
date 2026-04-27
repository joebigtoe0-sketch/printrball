"use client";

import { API_BASE } from "@/lib/env";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "powerball_admin_token";

type AdminStatus = {
  tokenMint: string;
  roundSystemEnabled: boolean;
  scheduledStartMs: number | null;
  systemStatus: string;
  hasHistory: boolean;
  currentRoundId: number;
  nextBoundaryPreview: number;
  excludedWallets: string[];
};

export function AdminClient() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [mint, setMint] = useState("");
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [blacklistText, setBlacklistText] = useState("");

  useEffect(() => {
    try {
      const t = sessionStorage.getItem(TOKEN_KEY);
      if (t) setToken(t);
    } catch {
      /* private mode */
    }
  }, []);

  const loadStatus = useCallback(async () => {
    const t =
      token ?? (typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null);
    if (!t) return;
    setErr(null);
    const res = await fetch(`${API_BASE}/api/admin/status`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        setToken(null);
        try {
          sessionStorage.removeItem(TOKEN_KEY);
        } catch {
          /* */
        }
      }
      setErr(String(res.status));
      return;
    }
    const s = (await res.json()) as AdminStatus;
    setStatus(s);
    setMint(s.tokenMint);
    setBlacklistText((s.excludedWallets ?? []).join("\n"));
  }, [token]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function login() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = (await res.json().catch(() => ({}))) as { token?: string; error?: string; message?: string };
      if (!res.ok) {
        setErr(j.message ?? j.error ?? "login failed");
        return;
      }
      if (j.token) {
        setToken(j.token);
        try {
          sessionStorage.setItem(TOKEN_KEY, j.token);
        } catch {
          /* */
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveMint() {
    const t =
      token ?? (typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null);
    if (!t) return;
    setMessage(null);
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ tokenMint: mint.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; tokenMint?: string };
      if (!res.ok) {
        setErr(j.error ?? "save failed");
        return;
      }
      setMessage("Saved.");
      void loadStatus();
    } finally {
      setBusy(false);
    }
  }

  async function saveBlacklist() {
    const t =
      token ?? (typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null);
    if (!t) return;
    setMessage(null);
    setErr(null);
    setBusy(true);
    try {
      const lines = blacklistText
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await fetch(`${API_BASE}/api/admin/exclusions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ addresses: lines }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        invalid?: string[];
        excludedWallets?: string[];
        refreshWarning?: string;
      };
      if (!res.ok) {
        if (j.error === "invalid_address" && j.invalid?.length) {
          setErr(`Invalid address(es): ${j.invalid.join(", ")}`);
        } else {
          setErr(j.error ?? "save blacklist failed");
        }
        return;
      }
      const n = j.excludedWallets?.length ?? lines.length;
      setMessage(
        j.refreshWarning
          ? `Blacklist saved (${n} wallet(s)). File OK — holder refresh failed: ${j.refreshWarning}`
          : `Blacklist saved (${n} wallet(s)). Holder list refreshed.`,
      );
      void loadStatus();
    } finally {
      setBusy(false);
    }
  }

  async function startSystem() {
    const t =
      token ?? (typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null);
    if (!t) return;
    setMessage(null);
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/system/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; nextBoundary?: number; ok?: boolean };
      if (!res.ok) {
        setErr(j.error ?? "start failed");
        return;
      }
      setMessage(
        j.nextBoundary
          ? `Scheduled: first round starts at ${new Date(j.nextBoundary).toISOString()} (next 15m boundary).`
          : "Started.",
      );
      void loadStatus();
    } finally {
      setBusy(false);
    }
  }

  const logout = () => {
    setToken(null);
    setStatus(null);
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* */
    }
  };

  if (!token) {
    return (
      <main className="shell verify-page">
        <h1 className="how-headline" style={{ fontSize: 28, marginTop: 8 }}>
          Admin
        </h1>
        <p className="verify-index-lead">Sign in with the server&apos;s <code>ADMIN_PASSWORD</code>.</p>
        <div className="panel verify-panel-spaced" style={{ maxWidth: 400 }}>
          <div className="panel-head">
            <span className="panel-title">
              <span className="dot" />
              Login
            </span>
          </div>
          <div className="verify-meta" style={{ padding: "12px 18px 20px" }}>
            <input
              type="password"
              className="search-input"
              style={{ width: "100%" }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void login()}
              placeholder="Password"
            />
            <button
              type="button"
              className="verify-btn"
              style={{ marginTop: 12 }}
              disabled={busy}
              onClick={() => void login()}
            >
              {busy ? "…" : "Sign in"}
            </button>
            {err ? <p className="verify-error" style={{ padding: 0 }}>{err}</p> : null}
          </div>
        </div>
        <p className="mt-6">
          <Link className="verify-back" href="/">
            ← Home
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="shell verify-page">
      <div className="verify-page-head" style={{ marginBottom: 16 }}>
        <h1 className="verify-title" style={{ fontSize: 26 }}>
          Admin
        </h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button type="button" className="verify-btn" onClick={() => void loadStatus()}>
            Refresh
          </button>
          <button type="button" className="verify-back" onClick={logout} style={{ border: "none", background: "none", cursor: "pointer" }}>
            Sign out
          </button>
        </div>
      </div>

      {message ? <p className="verify-prose" style={{ color: "var(--green)" }}>{message}</p> : null}
      {err ? <p className="verify-error">{err}</p> : null}

      <section className="panel verify-panel-spaced" style={{ maxWidth: 720 }}>
        <div className="panel-head">
          <span className="panel-title">
            <span className="dot" />
            Token mint (SPL)
          </span>
        </div>
        <div className="verify-prose" style={{ paddingTop: 12 }}>
          Paste the <strong>mint address</strong> of the token to track holders for. Set{" "}
          <code>MOCK_HOLDERS=0</code> and configure <code>HELIUS_API_KEY</code> or <code>RPC_URL</code> on the server
          for live RPC.
        </div>
        <div className="verify-meta" style={{ padding: "0 18px 16px" }}>
          <input
            className="search-input"
            style={{ width: "100%", maxWidth: "100%" }}
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            placeholder="e.g. EPjF… (base58 mint)"
            spellCheck={false}
          />
          <button type="button" className="verify-btn" style={{ marginTop: 12 }} disabled={busy} onClick={() => void saveMint()}>
            Save token
          </button>
        </div>
      </section>

      <section className="panel verify-panel-spaced" style={{ maxWidth: 720 }}>
        <div className="panel-head">
          <span className="panel-title">
            <span className="dot" />
            Blacklist (never win)
          </span>
        </div>
        <div className="verify-prose" style={{ paddingTop: 12 }}>
          Wallet addresses that <strong>cannot</strong> be drawn as winners (e.g. bonding curve pool, staking vault).
          One address per line. They are still counted for supply; they are removed from the eligible pool only.
        </div>
        <div className="verify-meta" style={{ padding: "0 18px 16px" }}>
          <textarea
            className="search-input"
            style={{
              width: "100%",
              maxWidth: "100%",
              minHeight: 140,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              resize: "vertical",
            }}
            value={blacklistText}
            onChange={(e) => setBlacklistText(e.target.value)}
            placeholder={"BondingCurve…\nStakingVault…"}
            spellCheck={false}
          />
          <button
            type="button"
            className="verify-btn"
            style={{ marginTop: 12 }}
            disabled={busy}
            onClick={() => void saveBlacklist()}
          >
            Save blacklist
          </button>
        </div>
      </section>

      <section className="panel verify-panel-spaced" style={{ maxWidth: 720 }}>
        <div className="panel-head">
          <span className="panel-title">
            <span className="dot" />
            Round system
          </span>
        </div>
        <div className="verify-meta" style={{ padding: "0 18px 16px" }}>
          {status ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.8 }}>
              <li>server status: {status.systemStatus}</li>
              <li>round id: {status.currentRoundId}</li>
              <li>has history: {String(status.hasHistory)}</li>
              <li>next 15m boundary (preview, now): {new Date(status.nextBoundaryPreview).toISOString()}</li>
              {status.scheduledStartMs != null ? (
                <li>scheduled start: {new Date(status.scheduledStartMs).toISOString()}</li>
              ) : null}
            </ul>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Load status…</p>
          )}
          <p className="verify-prose" style={{ marginTop: 12 }}>
            <strong>Start</strong> arms the 15-minute draws. The <strong>first</strong> round always begins on the next
            full 15-minute boundary (e.g. click at :39 → first round starts at :00, :15, :30, or :45, whichever is next
            in UTC time).
          </p>
          <button
            type="button"
            className="verify-btn"
            style={{ marginTop: 8 }}
            disabled={busy || (status?.hasHistory ?? false) || (status?.currentRoundId ?? 0) >= 1}
            onClick={() => void startSystem()}
          >
            Start (next boundary)
          </button>
        </div>
      </section>

      <p className="mt-6">
        <Link className="verify-back" href="/">
          ← Home
        </Link>
      </p>
    </main>
  );
}
