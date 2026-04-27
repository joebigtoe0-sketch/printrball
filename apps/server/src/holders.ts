import { config } from "./config.js";
import { loadExclusions } from "./exclusions.js";
import { getEffectiveTokenMint, loadRuntime } from "./runtimeStore.js";
import { fetchHoldersForMint, fetchTokenSupplyRaw } from "./splRpc.js";
import type { EligibleWallet } from "./types.js";

const MOCK_SUPPLY = "1000000000000000";

function strictAboveTwoTenthsPercent(balance: bigint, supply: bigint): boolean {
  return balance * 1000n > supply * 2n;
}

async function mockEligible(totalSupply: string): Promise<EligibleWallet[]> {
  const exclusions = await loadExclusions();
  const supply = BigInt(totalSupply);

  const rawBalances: Array<{ addr: string; fraction: number }> = [
    { addr: "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK", fraction: 0.005 },
    { addr: "CYRjVzyu9QaMnlJV638EfLBDrbxdTvvDDD2SnVivuPt", fraction: 0.0035 },
    { addr: "8pMCKZjyixnYCZymwxvBfqUiL5C9zuApqjCVsYEARqs7", fraction: 0.0025 },
    { addr: "GjJyeC1rFn18LfpvvkoJBUiyZAKTsH9aBJJ69pWeGCG", fraction: 0.0015 },
  ];
  const out: EligibleWallet[] = [];
  for (const row of rawBalances) {
    if (exclusions.has(row.addr)) continue;
    const bal = (supply * BigInt(Math.floor(row.fraction * 1_000_000))) / 1_000_000n;
    if (!strictAboveTwoTenthsPercent(bal, supply)) continue;
    const balancePct = (Number(bal) / Number(supply)) * 100;
    out.push({
      address: row.addr,
      balance: bal.toString(),
      balancePct,
    });
  }
  out.sort((a, b) => a.address.localeCompare(b.address));
  return out;
}

export function defaultTotalSupply(): string {
  return MOCK_SUPPLY;
}

export type HolderSnapshot = {
  eligible: EligibleWallet[];
  totalSupply: string;
  /** Non-null if on-chain path failed (RPC or parsing) */
  error: string | null;
  /** true when using static mock data */
  mock: boolean;
  /** SPL token accounts for this mint on last successful scan (before ≥0.2% filter); undefined in mock mode */
  tokenAccountCount?: number;
};

/**
 * Fetches current eligible wallets: mock mode, or SPL mint + getProgramAccounts.
 */
export async function getHolderSnapshot(): Promise<HolderSnapshot> {
  const runtime = loadRuntime();
  const mint = getEffectiveTokenMint(runtime);
  if (config.mockHolders) {
    const supply = MOCK_SUPPLY;
    const eligible = await mockEligible(supply);
    return { eligible, totalSupply: supply, error: null, mock: true };
  }
  if (!mint) {
    return {
      eligible: [],
      totalSupply: "0",
      error: "Token mint is not set — use admin or TOKEN_MINT in env",
      mock: false,
    };
  }

  try {
    const supply = await fetchTokenSupplyRaw(mint);
    if (supply <= 0n) {
      return { eligible: [], totalSupply: "0", error: "getTokenSupply returned 0 (unknown mint?)", mock: false };
    }
    const s = supply.toString();
    const { rows, error, tokenAccountCount } = await fetchHoldersForMint(mint, supply);
    return { eligible: rows, totalSupply: s, error, mock: false, tokenAccountCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { eligible: [], totalSupply: "0", error: msg, mock: false };
  }
}
