"use client";

import { API_BASE, GITHUB_REPO_URL, printrTradeUrl } from "@/lib/env";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import type { ApiStateResponse } from "@/lib/types";

export function Header({ live }: { live: boolean }) {
  const { data } = useQuery({
    queryKey: ["state"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/state`);
      if (!res.ok) throw new Error(String(res.status));
      return res.json() as Promise<ApiStateResponse>;
    },
    staleTime: 10_000,
  });

  const mint = data?.system?.tokenMint?.trim() ?? "";
  const tradeHref = printrTradeUrl(mint);

  return (
    <header className="header">
      <div className="shell header-inner">
        <div className="brand">
          <Link href="/" className="brand-mark" aria-label="Home">
            <Image src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" priority />
          </Link>
          <Link href="/" className="brand-name">
            PRINTBALL
          </Link>
          <span className="brand-divider" />
          <Link className="nav-bracket" href="/#how-it-works">
            <span className="br">[</span>HOW IT WORKS<span className="br">]</span>
          </Link>
          <Link className="nav-bracket" href="/verify">
            <span className="br">[</span>VERIFY<span className="br">]</span>
          </Link>
          <a className="nav-bracket" href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
            <span className="br">[</span>GITHUB<span className="br">]</span>
          </a>
          <span className="brand-divider" />
          <a className="ticker-pill" href={tradeHref} target="_blank" rel="noreferrer">
            $BALL
            <span className="ext">↗</span>
          </a>
        </div>
        <div className="header-right">
          <span className="live-indicator">
            {live ? (
              <>
                <span className="dot" />
                Live
              </>
            ) : (
              <>
                <span className="dot dot-yellow" />
                Reconnecting…
              </>
            )}
          </span>
          <Link className="verify-link" href="/verify">
            Verify <span style={{ fontSize: 10, opacity: 0.6 }}>↗</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
