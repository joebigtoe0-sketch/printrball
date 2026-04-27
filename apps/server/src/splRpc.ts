import { getHolderRpcUrl } from "./config.js";
import type { EligibleWallet } from "./types.js";
import { loadExclusions } from "./exclusions.js";

/** Classic SPL Token */
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
/** Token-2022 / Token Extensions — token accounts are larger than 165 bytes; do not use dataSize:165 filter */
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const RPC_MAX_ATTEMPTS = 8;
const RPC_BASE_DELAY_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function retryAfterMs(res: Response): number | null {
  const ra = res.headers.get("retry-after");
  if (!ra) return null;
  const sec = Number(ra);
  if (Number.isFinite(sec) && sec > 0) return Math.min(60_000, sec * 1000);
  return null;
}

function isRetryableHttp(status: number): boolean {
  return status === 429 || status === 408 || status === 502 || status === 503 || status === 504;
}

function isRetryableJsonRpcError(err: { code?: number; message?: string } | undefined): boolean {
  if (!err?.message && err?.code == null) return false;
  const m = (err.message ?? "").toLowerCase();
  if (m.includes("rate") || m.includes("429") || m.includes("throttle") || m.includes("too many")) return true;
  const c = err.code;
  return c === -32005 || c === -32001 || c === -32429 || c === -32603;
}

function strictAboveTwoTenthsPercent(balance: bigint, supply: bigint): boolean {
  if (supply <= 0n) return false;
  return balance * 1000n > supply * 2n;
}

/**
 * JSON-RPC to the holder-scan endpoint (see HOLDER_RPC_URL), with backoff on rate limits.
 */
export async function rpcRequest<T>(body: { method: string; params: unknown }): Promise<T> {
  const url = getHolderRpcUrl();
  if (!url) return Promise.reject(new Error("No RPC URL configured (set RPC_URL or HELIUS_API_KEY)"));

  let lastErr = "RPC request failed";

  for (let attempt = 0; attempt < RPC_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body }),
    });

    if (!res.ok) {
      lastErr = `RPC HTTP ${res.status}`;
      if (isRetryableHttp(res.status) && attempt < RPC_MAX_ATTEMPTS - 1) {
        const wait =
          retryAfterMs(res) ??
          Math.min(90_000, RPC_BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 800));
        await sleep(wait);
        continue;
      }
      if (res.status === 429) {
        return Promise.reject(
          new Error(
            `${lastErr} (rate limited). Holder RPC uses HELIUS before RPC_URL when HELIUS_API_KEY is set — set HELIUS_NETWORK=mainnet-beta for mainnet mints. Or set HOLDER_RPC_URL, raise HOLDER_POLL_MS (e.g. 120000), or upgrade the RPC plan.`,
          ),
        );
      }
      return Promise.reject(new Error(lastErr));
    }

    const j = (await res.json()) as { result: T; error?: { message: string; code?: number } };
    if (j.error) {
      lastErr = j.error.message || "RPC error";
      if (isRetryableJsonRpcError(j.error) && attempt < RPC_MAX_ATTEMPTS - 1) {
        const wait = Math.min(90_000, RPC_BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 800));
        await sleep(wait);
        continue;
      }
      return Promise.reject(new Error(lastErr));
    }
    return j.result;
  }

  return Promise.reject(new Error(lastErr));
}

export async function fetchTokenSupplyRaw(mint: string): Promise<bigint> {
  const r = await rpcRequest<{ value: { amount: string; decimals: number; uiAmountString: string } | null } | null>({
    method: "getTokenSupply",
    params: [mint],
  });
  const amt = r?.value?.amount;
  if (!amt) return 0n;
  return BigInt(amt);
}

type ProgramAccountRow = {
  pubkey: string;
  account: {
    data: {
      parsed?: {
        type: string;
        info?: {
          isNative?: boolean;
          mint?: string;
          owner?: string;
          tokenAmount?: { amount?: string };
        };
      };
    };
  };
};

async function mintTokenProgramKind(mint: string): Promise<"spl" | "token2022" | "missing" | "unknown"> {
  const r = await rpcRequest<{ value: { owner: string } | null } | null>({
    method: "getAccountInfo",
    params: [mint, { encoding: "jsonParsed" }],
  });
  const owner = r?.value?.owner;
  if (!owner) return "missing";
  if (owner === SPL_TOKEN_PROGRAM) return "spl";
  if (owner === TOKEN_2022_PROGRAM) return "token2022";
  return "unknown";
}

function accumulateTokenAccounts(
  programAccounts: ProgramAccountRow[] | null,
  mint: string,
): { byOwner: Map<string, bigint>; tokenAccountCount: number } {
  const byOwner = new Map<string, bigint>();
  let tokenAccountCount = 0;
  if (!programAccounts?.length) return { byOwner, tokenAccountCount: 0 };

  for (const row of programAccounts) {
    const parsed = row.account?.data?.parsed;
    if (parsed?.type !== "account") continue;
    const info = parsed.info;
    if (!info) continue;
    if (info.mint && info.mint !== mint) continue;
    const owner = info.owner;
    const amountStr = info.tokenAmount?.amount;
    if (!owner || !amountStr) continue;
    const amount = BigInt(amountStr);
    if (amount <= 0n) continue;
    tokenAccountCount += 1;
    byOwner.set(owner, (byOwner.get(owner) ?? 0n) + amount);
  }
  return { byOwner, tokenAccountCount };
}

export type HolderFetchResult = {
  rows: EligibleWallet[];
  error: string | null;
  /** SPL token accounts parsed for this mint (before ≥0.2% filter) */
  tokenAccountCount: number;
};

/**
 * All SPL / Token-2022 token accounts for this mint via getProgramAccounts (jsonParsed).
 * Aggregates balances per wallet (owner) before applying the 0.2% supply threshold.
 */
export async function fetchHoldersForMint(mint: string, supply: bigint): Promise<HolderFetchResult> {
  if (!mint) return { rows: [], error: "Token mint is empty", tokenAccountCount: 0 };
  const exclusions = await loadExclusions();

  try {
    const kind = await mintTokenProgramKind(mint);
    if (kind === "missing") {
      return { rows: [], error: "Mint account not found on this RPC cluster", tokenAccountCount: 0 };
    }
    if (kind === "unknown") {
      return {
        rows: [],
        error: "Mint is not an SPL or Token-2022 mint (unexpected program owner)",
        tokenAccountCount: 0,
      };
    }

    const programId = kind === "token2022" ? TOKEN_2022_PROGRAM : SPL_TOKEN_PROGRAM;
    /** Token-2022 accounts vary in size (extensions); classic accounts are 165 bytes */
    const filters =
      kind === "token2022"
        ? [{ memcmp: { offset: 0, bytes: mint } }]
        : [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: mint } }];

    const programAccounts = await rpcRequest<ProgramAccountRow[] | null>({
      method: "getProgramAccounts",
      params: [
        programId,
        {
          encoding: "jsonParsed",
          filters,
        },
      ],
    });

    const { byOwner, tokenAccountCount } = accumulateTokenAccounts(programAccounts, mint);

    if (tokenAccountCount === 0) {
      return { rows: [], error: null, tokenAccountCount: 0 };
    }

    const out: EligibleWallet[] = [];
    for (const [owner, amount] of byOwner) {
      if (exclusions.has(owner)) continue;
      if (!strictAboveTwoTenthsPercent(amount, supply)) continue;
      const balancePct = (Number(amount) / Number(supply)) * 100;
      out.push({
        address: owner,
        balance: amount.toString(),
        balancePct,
      });
    }
    out.sort((a, b) => a.address.localeCompare(b.address));
    return { rows: out, error: null, tokenAccountCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], error: msg, tokenAccountCount: 0 };
  }
}
