import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

type ExclusionFile = { addresses: string[] };

/** Rough Solana base58 pubkey check (mint / wallet). */
export function isPlausibleSolanaAddress(s: string): boolean {
  const t = s.trim();
  if (t.length < 32 || t.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-kj-z]+$/.test(t);
}

function normalizeAddr(s: string): string {
  return s.trim();
}

export async function loadExclusions(): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(config.exclusionsPath, "utf8");
    const data = JSON.parse(raw) as ExclusionFile;
    return new Set((data.addresses ?? []).map(normalizeAddr).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** Sorted unique list from disk (or empty). */
export async function readExclusionsFile(): Promise<string[]> {
  try {
    const raw = await fs.readFile(config.exclusionsPath, "utf8");
    const data = JSON.parse(raw) as ExclusionFile;
    return [...new Set((data.addresses ?? []).map(normalizeAddr).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
  } catch {
    return [];
  }
}

async function writeAtomic(p: string, data: string): Promise<void> {
  if (!p || p.trim() === "") {
    throw new Error("exclusionsPath is empty — remove EXCLUSIONS_PATH= from .env or set a valid path");
  }
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${p}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data, "utf8");
  try {
    await fs.unlink(p);
  } catch {
    /* target may not exist yet */
  }
  await fs.rename(tmp, p);
}

/**
 * Replace blacklist on disk. Drops invalid-looking lines; dedupes and sorts.
 * Returns the list actually written.
 */
export async function saveExclusions(addresses: string[]): Promise<string[]> {
  const uniq = [
    ...new Set(addresses.map(normalizeAddr).filter((a) => a && isPlausibleSolanaAddress(a))),
  ].sort((a, b) => a.localeCompare(b));
  const payload: ExclusionFile = { addresses: uniq };
  await writeAtomic(config.exclusionsPath, JSON.stringify(payload, null, 2) + "\n");
  return uniq;
}
