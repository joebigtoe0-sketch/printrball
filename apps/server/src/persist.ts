import fs from "node:fs/promises";
import path from "node:path";
import type { ActivityEntry, HistoricalRound } from "./types.js";

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function atomicWriteJson(file: string, data: unknown) {
  const dir = path.dirname(file);
  await ensureDir(dir);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

export function historyPath(dataDir: string) {
  return path.join(dataDir, "history.json");
}

export function activityPath(dataDir: string) {
  return path.join(dataDir, "activity.json");
}

export async function loadHistory(dataDir: string): Promise<HistoricalRound[]> {
  const p = historyPath(dataDir);
  const rows = await readJsonFile<HistoricalRound[]>(p, []);
  return Array.isArray(rows) ? rows : [];
}

export async function saveHistory(dataDir: string, rows: HistoricalRound[]) {
  await atomicWriteJson(historyPath(dataDir), rows);
}

export async function loadActivity(dataDir: string): Promise<ActivityEntry[]> {
  const p = activityPath(dataDir);
  const rows = await readJsonFile<ActivityEntry[]>(p, []);
  return Array.isArray(rows) ? rows : [];
}

export async function saveActivity(dataDir: string, rows: ActivityEntry[]) {
  const capped = rows.slice(-500);
  await atomicWriteJson(activityPath(dataDir), capped);
}
