import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const repoRoot = path.join(root, "..", "..");

/** Repo `.env` then `apps/server/.env` (override) — server does not auto-load env like Next.js */
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(root, ".env"), override: true });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  /** Blank env (e.g. `DATA_DIR=`) must not win over default — `??` does not treat "" as missing */
  dataDir: process.env.DATA_DIR?.trim() || path.join(root, "data"),
  exclusionsPath: process.env.EXCLUSIONS_PATH?.trim() || path.join(root, "config", "exclusions.json"),
  /** Unix ms of round #1 start; default aligns to next 15m boundary from first boot */
  roundLaunchMs: process.env.ROUND_LAUNCH_MS ? Number(process.env.ROUND_LAUNCH_MS) : null,
  roundLengthMs: Number(process.env.ROUND_LENGTH_MS ?? 15 * 60 * 1000),
  holderPollMs: Number(process.env.HOLDER_POLL_MS ?? 5000),
  prizePollMs: Number(process.env.PRIZE_POLL_MS ?? 10_000),
  /** Helius / RPC — optional for mock mode */
  heliusApiKey: process.env.HELIUS_API_KEY ?? "",
  heliusNetwork: (process.env.HELIUS_NETWORK || "devnet") as "devnet" | "mainnet" | "mainnet-beta",
  rpcUrl: process.env.RPC_URL ?? "https://api.devnet.solana.com",
  mint: process.env.TOKEN_MINT ?? "",
  /** Set MOCK_HOLDERS=0 to use on-chain fetches (requires token mint + RPC) */
  mockHolders: process.env.MOCK_HOLDERS !== "0",
  /** Lamports string for mock estimated prize display */
  mockPrizeLamports: process.env.MOCK_PRIZE_LAMPORTS ?? "4231000000",
  /** Plain password for /api/admin (set in production) */
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  meteoraLiveEnabled: process.env.METEORA_LIVE_ENABLED === "1",
};

/** Helius JSON-RPC URL from `HELIUS_API_KEY` + `HELIUS_NETWORK`, or null if no key. */
function buildHeliusRpcUrl(): string | null {
  const k = config.heliusApiKey.trim();
  if (!k) return null;
  const n = config.heliusNetwork === "mainnet" || config.heliusNetwork === "mainnet-beta" ? "mainnet" : "devnet";
  return `https://${n}.helius-rpc.com/?api-key=${encodeURIComponent(k)}`;
}

/**
 * Public Solana JSON-RPC URL — prefer RPC_URL, else Helius with API key, else public devnet.
 */
export function getJsonRpcUrl(): string {
  const u = process.env.RPC_URL?.trim();
  if (u) return u;
  return buildHeliusRpcUrl() ?? "https://api.devnet.solana.com";
}

/**
 * Holder scans (`getProgramAccounts`, `getTokenSupply` for the mint).
 * Order: HOLDER_RPC_URL → Helius from API key (even if RPC_URL is another provider) → RPC_URL / default.
 * This avoids Alchemy-on-RPC_URL winning while HELIUS_API_KEY was only meant for heavy holder calls.
 */
export function getHolderRpcUrl(): string {
  const h = process.env.HOLDER_RPC_URL?.trim();
  if (h) return h;
  const helius = buildHeliusRpcUrl();
  if (helius) return helius;
  return getJsonRpcUrl();
}
