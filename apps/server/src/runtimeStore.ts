import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export type RuntimeConfig = {
  /** SPL token mint (base58) — the contract/token we track holders for */
  tokenMint: string;
  /** Set true when admin clicks "Start" — first round begins at scheduledStartMs */
  roundSystemEnabled: boolean;
  /** Unix ms of next 15m boundary when the first round should begin (if no history) */
  scheduledStartMs: number | null;
};

const DEFAULT: RuntimeConfig = {
  tokenMint: "",
  roundSystemEnabled: false,
  scheduledStartMs: null,
};

function runtimePath() {
  return path.join(config.dataDir, "runtime.json");
}

export function loadRuntime(): RuntimeConfig {
  const p = runtimePath();
  try {
    if (!fs.existsSync(p)) return { ...DEFAULT };
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Partial<RuntimeConfig>;
    return {
      tokenMint: typeof raw.tokenMint === "string" ? raw.tokenMint : "",
      roundSystemEnabled: Boolean(raw.roundSystemEnabled),
      scheduledStartMs:
        raw.scheduledStartMs != null && Number.isFinite(raw.scheduledStartMs)
          ? Number(raw.scheduledStartMs)
          : null,
    };
  } catch {
    return { ...DEFAULT };
  }
}

async function writeAtomic(p: string, data: string): Promise<void> {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${p}.${Date.now()}.tmp`;
  await fs.promises.writeFile(tmp, data, "utf-8");
  await fs.promises.rename(tmp, p);
}

export async function saveRuntime(next: RuntimeConfig): Promise<void> {
  const merged: RuntimeConfig = {
    tokenMint: next.tokenMint.trim(),
    roundSystemEnabled: next.roundSystemEnabled,
    scheduledStartMs: next.scheduledStartMs,
  };
  await writeAtomic(runtimePath(), JSON.stringify(merged, null, 2) + "\n");
}

export function getEffectiveTokenMint(disk: RuntimeConfig): string {
  return (disk.tokenMint || process.env.TOKEN_MINT || "").trim();
}
