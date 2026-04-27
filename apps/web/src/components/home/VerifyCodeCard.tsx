"use client";

import { GITHUB_REPO_URL } from "@/lib/env";

const PROGRAM_RS = [
  "// draw() runs every 15-min slot boundary",
  "pub fn select_winner(seed_hex: &str, eligible_wallets: Vec<String>) -> Option<String> {",
  "    if eligible_wallets.is_empty() { return None; }",
  "    let n = eligible_wallets.len() as u128;",
  "    let seed = u128::from_str_radix(seed_hex, 16).unwrap_or(0);",
  "    let idx = (seed % n) as usize;",
  "    Some(eligible_wallets[idx].clone())",
  "}",
];

const VERIFY_TS = [
  "// 1) fetch round JSON",
  "const r = await fetch('/api/round/:id').then((x) => x.json());",
  "const n = r.eligibleWallets.length;",
  "if (!n) throw new Error('No eligible wallets');",
  "const idx = Number(BigInt('0x' + r.seed) % BigInt(n));",
  "const computedWinner = r.eligibleWallets[idx];",
  "console.log({ idx, computedWinner, publishedWinner: r.winner });",
];

export function VerifyCodeCard() {
  return (
    <div className="panel verify-code-card">
      <div className="verify-code-head">
        <h3>The exact code used for each draw.</h3>
        <p>Use this reference logic with the published seed + snapshot to independently verify winner selection.</p>
        <p style={{ marginTop: 8 }}>
          <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer" className="verify-link">
            View full repository ↗
          </a>
        </p>
      </div>
      <div className="verify-code-stack">
        <div className="verify-code-block">
          <div className="verify-code-block-title">PROGRAM.RS</div>
          <div className="verify-code-body">
            <pre className="verify-code-pre">
              {PROGRAM_RS.map((line, i) => (
                <div key={i} className="verify-code-line">
                  <span className="ln">{String(i + 1).padStart(2, "0")}</span>
                  <span className="src">{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
        <div className="verify-code-block">
          <div className="verify-code-block-title">VERIFY.TS</div>
          <div className="verify-code-body">
            <pre className="verify-code-pre">
              {VERIFY_TS.map((line, i) => (
                <div key={i} className="verify-code-line">
                  <span className="ln">{String(i + 1).padStart(2, "0")}</span>
                  <span className="src">{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
