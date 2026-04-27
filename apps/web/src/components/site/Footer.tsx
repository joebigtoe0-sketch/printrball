import Link from "next/link";
import { CONTRACT_URL, GITHUB_REPO_URL } from "@/lib/env";

export function Footer() {
  return (
    <footer className="shell">
      <div className="footer">
        <div className="footer-links">
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/verify">Verify a round</Link>
          <a href={CONTRACT_URL} target="_blank" rel="noreferrer">
            Contract ↗
          </a>
          <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
            Source code ↗
          </a>
        </div>
        <div className="footer-meta">PRINTRBALL · Solana · Equal-odds v1 · Not financial advice</div>
      </div>
    </footer>
  );
}
